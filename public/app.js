// app.js — Integra Status Page (ES6+, hash router, sparklines, toasts)
'use strict';

const REFRESH_INTERVAL = 30000;
const CATEGORY_LABELS = {
  blockchain: 'Blockchain',
  validators: 'Validators',
  apis: 'Backend APIs',
  frontends: 'Frontends & Explorers',
  external: 'External Dependencies',
};
const CATEGORY_ICONS = {
  blockchain: { text: '\u26D3', bg: 'rgba(168,85,247,0.15)', color: '#A855F7' },
  validators: { text: '\u26A1', bg: 'rgba(255,184,76,0.15)', color: '#FFB84C' },
  apis: { text: '\u2699', bg: 'rgba(51,92,255,0.15)', color: '#335CFF' },
  frontends: { text: '\u25C9', bg: 'rgba(255,79,145,0.15)', color: '#FF4F91' },
  external: { text: '\u2197', bg: 'rgba(153,153,153,0.15)', color: '#999999' },
};
const CATEGORY_ORDER = ['blockchain', 'validators', 'apis', 'frontends', 'external'];

// ---------------------------------------------------------------------------
// State — reactive pub/sub store
// ---------------------------------------------------------------------------

const State = (() => {
  const state = {
    viewMode: 'minimal',
    envFilter: 'all',
    searchQuery: '',
    expandedCards: {},
    collapsedCategories: {},
    lastData: null,
    previousStatusMap: {},
    route: { page: 'overview', serviceId: null },
  };
  const listeners = new Map();

  return {
    get(key) { return state[key]; },
    set(key, value) {
      state[key] = value;
      const cbs = listeners.get(key);
      if (cbs) for (const cb of cbs) cb(value);
    },
    on(key, cb) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(cb);
    },
  };
})();

// ---------------------------------------------------------------------------
// Hash-based router
// ---------------------------------------------------------------------------

const Router = {
  init() {
    window.addEventListener('hashchange', () => Router._resolve());
    Router._resolve();
  },
  navigate(path) {
    window.location.hash = path;
  },
  back() {
    Router.navigate('#/');
  },
  _resolve() {
    const hash = window.location.hash || '#/';
    const serviceMatch = hash.match(/^#\/service\/(.+)$/);
    if (serviceMatch) {
      State.set('route', { page: 'service', serviceId: decodeURIComponent(serviceMatch[1]) });
    } else {
      State.set('route', { page: 'overview', serviceId: null });
    }
  },
};

// ---------------------------------------------------------------------------
// DOM helper
// ---------------------------------------------------------------------------

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') node.className = v;
      else if (k === 'textContent') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else node.setAttribute(k, v);
    }
  }
  if (children != null) {
    const items = Array.isArray(children) ? children : [children];
    for (const child of items) {
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    }
  }
  return node;
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function fetchHealth() {
  return fetch('/api/health').then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeAgo(ms) {
  const sec = Math.round((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = new Date(ms);
  return `Yesterday ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Blast radius + cascade tree (BFS)
// ---------------------------------------------------------------------------

function getBlastRadius(endpointId, graph) {
  const visited = new Set([endpointId]);
  const queue = [endpointId];
  let count = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    const node = graph[current];
    if (!node) continue;
    for (const dep of (node.requiredBy || [])) {
      if (!visited.has(dep)) {
        visited.add(dep);
        count++;
        queue.push(dep);
      }
    }
  }
  return count;
}

function buildCascadeTree(startId, graph) {
  const levels = [];
  const visited = new Set([startId]);
  let currentLevel = [startId];
  while (currentLevel.length > 0) {
    const nextLevel = [];
    for (const id of currentLevel) {
      const node = graph[id];
      if (!node) continue;
      for (const dep of (node.requiredBy || [])) {
        if (!visited.has(dep)) {
          visited.add(dep);
          nextLevel.push(dep);
        }
      }
    }
    if (nextLevel.length > 0) levels.push(nextLevel);
    currentLevel = nextLevel;
  }
  return levels;
}

// ---------------------------------------------------------------------------
// Progress bar + countdown
// ---------------------------------------------------------------------------

let lastRefreshTime = null;
let countdownInterval = null;

function resetProgressBar() {
  const fill = document.getElementById('refresh-bar-fill');
  if (!fill) return;
  fill.classList.remove('complete');
  fill.classList.add('reset');
  fill.offsetHeight; // force reflow
  fill.classList.remove('reset');
  fill.classList.add('complete');
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  lastRefreshTime = Date.now();
  const span = document.getElementById('last-updated');
  span.textContent = 'Updated just now';
  countdownInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - lastRefreshTime) / 1000);
    span.textContent = elapsed < 5 ? 'Updated just now' : `Updated ${elapsed}s ago`;
  }, 1000);
}

function pauseCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  const span = document.getElementById('last-updated');
  span.textContent = 'Update failed \u2014 retrying\u2026';
}

// ---------------------------------------------------------------------------
// Sparkline renderer (inline SVG)
// ---------------------------------------------------------------------------

const Sparkline = {
  _svg(data, w, h, opts = {}) {
    if (!data || data.length < 2) return null;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('role', 'img');
    svg.setAttribute('class', 'sparkline-svg');

    const title = document.createElementNS(ns, 'title');
    title.textContent = opts.title || 'Response time sparkline';
    svg.appendChild(title);

    // Filter out nulls, find valid values
    const validData = data.map((v, i) => ({ v, i })).filter(d => d.v !== null);
    if (validData.length < 2) return null;

    const positiveValues = validData.filter(d => d.v >= 0).map(d => d.v);
    const maxVal = Math.max(...positiveValues, 1);
    const padding = 2;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const step = graphW / (data.length - 1);

    // Build path
    const points = [];
    for (const { v, i } of validData) {
      const x = padding + i * step;
      const val = v < 0 ? 0 : v; // DOWN endpoints go to baseline
      const y = padding + graphH - (val / maxVal) * graphH;
      points.push({ x, y, down: v < 0 });
    }

    // Line path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', opts.color || '#F34499');
    path.setAttribute('stroke-width', opts.strokeWidth || '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('class', 'sparkline-line');

    // Animate draw-in
    const totalLen = points.reduce((acc, p, i) => {
      if (i === 0) return 0;
      return acc + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }, 0);
    path.setAttribute('stroke-dasharray', totalLen);
    path.setAttribute('stroke-dashoffset', totalLen);
    svg.appendChild(path);

    // Area fill
    if (opts.fill !== false) {
      const areaD = pathD + ` L ${points[points.length - 1].x} ${padding + graphH} L ${points[0].x} ${padding + graphH} Z`;
      const area = document.createElementNS(ns, 'path');
      area.setAttribute('d', areaD);
      area.setAttribute('fill', opts.fillColor || 'rgba(243,68,153,0.08)');
      area.setAttribute('class', 'sparkline-area');
      svg.insertBefore(area, path);
    }

    // Last point dot
    const last = points[points.length - 1];
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', last.x);
    dot.setAttribute('cy', last.y);
    dot.setAttribute('r', opts.dotRadius || '2.5');
    dot.setAttribute('fill', opts.color || '#F34499');
    dot.setAttribute('class', 'sparkline-dot');
    svg.appendChild(dot);

    // Down segments (red area at baseline)
    for (const { x, down } of points) {
      if (down) {
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', x - 1);
        rect.setAttribute('y', padding + graphH - 2);
        rect.setAttribute('width', 2);
        rect.setAttribute('height', 2);
        rect.setAttribute('fill', '#DC2626');
        rect.setAttribute('rx', 1);
        svg.appendChild(rect);
      }
    }

    return svg;
  },

  small(data, opts = {}) {
    return Sparkline._svg(data, opts.width || 80, opts.height || 20, { strokeWidth: '1.2', dotRadius: '2', ...opts });
  },

  large(data, opts = {}) {
    return Sparkline._svg(data, opts.width || 600, opts.height || 100, { strokeWidth: '2', dotRadius: '3', fill: true, ...opts });
  },
};

// ---------------------------------------------------------------------------
// Toast notification system
// ---------------------------------------------------------------------------

const Toast = {
  _container: null,
  _maxVisible: 3,

  show({ title, message, status, serviceId }) {
    if (!Toast._container) Toast._container = document.getElementById('toasts');
    if (!Toast._container) return;

    const statusClass = status === 'UP' ? 'toast-success' : status === 'DEGRADED' ? 'toast-warning' : 'toast-error';
    const icon = status === 'UP' ? '\u2714' : status === 'DEGRADED' ? '\u26A0' : '\u2716';

    const toast = el('div', { className: `toast ${statusClass}`, role: 'alert' }, [
      el('div', { className: 'toast-icon', textContent: icon }),
      el('div', { className: 'toast-content' }, [
        el('div', { className: 'toast-title', textContent: title }),
        el('div', { className: 'toast-message', textContent: message }),
      ]),
      el('button', {
        className: 'toast-close',
        textContent: '\u00D7',
        'aria-label': 'Dismiss',
        onClick: () => Toast._dismiss(toast),
      }),
      el('div', { className: 'toast-progress' }),
    ]);

    if (serviceId) {
      toast.style.cursor = 'pointer';
      toast.addEventListener('click', (e) => {
        if (e.target.closest('.toast-close')) return;
        Router.navigate(`#/service/${serviceId}`);
        Toast._dismiss(toast);
      });
    }

    Toast._container.prepend(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    // Auto-dismiss after 8s
    const timer = setTimeout(() => Toast._dismiss(toast), 8000);
    toast._timer = timer;

    // Enforce max visible
    const all = Toast._container.querySelectorAll('.toast');
    if (all.length > Toast._maxVisible) {
      for (let i = Toast._maxVisible; i < all.length; i++) {
        Toast._dismiss(all[i]);
      }
    }
  },

  _dismiss(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove());
  },
};

// ---------------------------------------------------------------------------
// Status banner component
// ---------------------------------------------------------------------------

function renderStatusBanner(data) {
  const banner = document.getElementById('status-banner');
  if (!banner) return;

  const { up, degraded, down, total } = data;
  const history = data.history || {};
  const uptimes = history.uptimes || {};

  // Compute overall uptime
  const uptimeValues = Object.values(uptimes);
  const avgUptime = uptimeValues.length > 0
    ? (uptimeValues.reduce((a, b) => a + b, 0) / uptimeValues.length).toFixed(2)
    : '100.00';

  // Compute average response time from results
  const responseTimes = (data.results || []).filter(r => r.responseTimeMs > 0).map(r => r.responseTimeMs);
  const avgResponse = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  let statusClass, icon, primaryText;
  if (down > 0) {
    statusClass = 'banner-outage';
    icon = '\u2716';
    primaryText = `${down} service${down > 1 ? 's' : ''} experiencing issues`;
  } else if (degraded > 0) {
    statusClass = 'banner-degraded';
    icon = '\u26A0';
    primaryText = `${degraded} service${degraded > 1 ? 's' : ''} degraded`;
  } else {
    statusClass = 'banner-operational';
    icon = '\u2714';
    primaryText = 'All systems operational';
  }

  banner.className = `status-banner ${statusClass}`;
  clearNode(banner);
  banner.appendChild(el('div', { className: 'banner-inner' }, [
    el('div', { className: 'banner-status' }, [
      el('span', { className: 'banner-icon', textContent: icon }),
      el('span', { className: 'banner-text', textContent: primaryText }),
    ]),
    el('div', { className: 'banner-metrics' }, [
      el('span', { className: 'banner-metric', textContent: `${avgUptime}% uptime` }),
      el('span', { className: 'banner-sep', textContent: '\u00B7' }),
      el('span', { className: 'banner-metric', textContent: `${avgResponse}ms avg` }),
      el('span', { className: 'banner-sep', textContent: '\u00B7' }),
      el('span', { className: 'banner-metric', textContent: `${total} checked` }),
    ]),
  ]));
}

// ---------------------------------------------------------------------------
// Overall badge
// ---------------------------------------------------------------------------

function renderOverallBadge(data) {
  const badge = document.getElementById('overall-status');
  badge.classList.remove('all-up', 'has-degraded', 'has-down', 'loading');
  if (data.down > 0) {
    badge.textContent = 'Partial Outage';
    badge.classList.add('has-down');
  } else if (data.degraded > 0) {
    badge.textContent = 'Degraded';
    badge.classList.add('has-degraded');
  } else {
    badge.textContent = 'All Operational';
    badge.classList.add('all-up');
  }
}

// ---------------------------------------------------------------------------
// Incident timeline component
// ---------------------------------------------------------------------------

function renderIncidentTimeline(incidents, resultMap) {
  if (!incidents || incidents.length === 0) return null;

  const maxShow = 5;
  const shown = incidents.slice(0, maxShow);

  const items = shown.map(inc => {
    const epName = resultMap[inc.id] ? resultMap[inc.id].name : inc.id;
    const isRecovery = inc.toStatus === 'UP';
    const dotClass = isRecovery ? 'incident-dot-up' : inc.toStatus === 'DEGRADED' ? 'incident-dot-degraded' : 'incident-dot-down';
    const ongoing = inc.toStatus !== 'UP';
    const label = isRecovery
      ? `${epName} recovered`
      : `${epName} went ${inc.toStatus.toLowerCase()}`;

    return el('div', { className: 'incident-item' }, [
      el('div', { className: `incident-dot ${dotClass}${ongoing ? ' incident-ongoing' : ''}` }),
      el('div', { className: 'incident-info' }, [
        el('div', { className: 'incident-label', textContent: label }),
        el('div', { className: 'incident-time', textContent: timeAgo(inc.at) }),
      ]),
    ]);
  });

  const timeline = el('div', { className: 'incident-timeline' }, [
    el('div', { className: 'section-title', textContent: 'Recent Events' }),
    el('div', { className: 'incident-list' }, items),
  ]);

  if (incidents.length > maxShow) {
    timeline.appendChild(el('button', {
      className: 'incident-show-more',
      textContent: `Show ${incidents.length - maxShow} more`,
      onClick: () => {
        const listEl = timeline.querySelector('.incident-list');
        clearNode(listEl);
        for (const inc of incidents) {
          const epName = resultMap[inc.id] ? resultMap[inc.id].name : inc.id;
          const isRec = inc.toStatus === 'UP';
          const dc = isRec ? 'incident-dot-up' : inc.toStatus === 'DEGRADED' ? 'incident-dot-degraded' : 'incident-dot-down';
          listEl.appendChild(el('div', { className: 'incident-item' }, [
            el('div', { className: `incident-dot ${dc}` }),
            el('div', { className: 'incident-info' }, [
              el('div', { className: 'incident-label', textContent: `${epName} ${isRec ? 'recovered' : 'went ' + inc.toStatus.toLowerCase()}` }),
              el('div', { className: 'incident-time', textContent: timeAgo(inc.at) }),
            ]),
          ]));
        }
        timeline.querySelector('.incident-show-more')?.remove();
      },
    }));
  }

  return timeline;
}

// ---------------------------------------------------------------------------
// Summary metrics
// ---------------------------------------------------------------------------

function renderSummary(summaryData) {
  const items = [
    { value: summaryData.up, label: 'Operational', colorClass: 'color-up' },
    { value: summaryData.degraded, label: 'Degraded', colorClass: 'color-degraded' },
    { value: summaryData.down, label: 'Down', colorClass: 'color-down' },
    { value: summaryData.total, label: 'Total', colorClass: 'color-total' },
  ];

  const bar = el('div', { className: 'summary-bar', 'aria-live': 'polite', 'aria-atomic': 'true' });
  for (const item of items) {
    bar.appendChild(el('div', { className: 'summary-item' }, [
      el('span', { className: `count ${item.colorClass}`, textContent: String(item.value) }),
      el('span', { className: 'label', textContent: item.label }),
    ]));
  }
  return bar;
}

// ---------------------------------------------------------------------------
// Status segments bar (per-card health visualization)
// ---------------------------------------------------------------------------

function renderStatusSegments(endpoints) {
  const bar = el('div', { className: 'status-segments' });
  for (const ep of endpoints) {
    const status = ep.status === 'UP' ? 'up' : ep.status === 'DEGRADED' ? 'degraded' : 'down';
    bar.appendChild(el('div', {
      className: `status-segment ${status}`,
      title: `${ep.name}: ${ep.status}`,
    }));
  }
  return bar;
}

// ---------------------------------------------------------------------------
// Endpoint row component
// ---------------------------------------------------------------------------

function buildDetailNodes(r) {
  const parts = [];
  if (r.details.blockHeight) parts.push(`Block ${r.details.blockHeight.toLocaleString()}`);
  if (r.details.chainId) parts.push(`Chain ${r.details.chainId}`);
  if (r.details.peerCount != null) parts.push(`${r.details.peerCount} peers`);
  if (r.details.catchingUp != null) parts.push(r.details.catchingUp ? 'Syncing' : 'Synced');
  if (r.details.bondedValidators != null) parts.push(`${r.details.bondedValidators} validators`);
  if (r.details.blockAgeSec != null) parts.push(`${r.details.blockAgeSec}s ago`);
  if (r.details.healthStatus) parts.push(r.details.healthStatus);
  if (r.details.version) parts.push(`v${r.details.version}`);
  if (parts.length === 0) return null;
  return el('span', { className: 'detail', textContent: parts.join(' \u00B7 ') });
}

function renderEndpoint(r, { impactMap, dependencyGraph, resultMap, sparklines }) {
  const statusClass = r.status.toLowerCase();
  const responseTime = r.responseTimeMs > 0 ? `${r.responseTimeMs}ms` : '\u2014';
  const prevMap = State.get('previousStatusMap');
  const changed = prevMap[r.id] && prevMap[r.id] !== r.status;

  const nameBtn = el('button', {
    className: 'endpoint-name-btn',
    textContent: r.name,
    onClick: (e) => { e.stopPropagation(); Router.navigate(`#/service/${r.id}`); },
  });

  const leftChildren = [
    el('span', { className: `status-dot ${statusClass}`, title: r.status, 'aria-label': r.status }),
    el('div', {}, [
      nameBtn,
      ...(r.description ? [el('span', { className: 'endpoint-desc', textContent: r.description })] : []),
    ]),
    el('span', { className: `env-badge env-${r.environment}`, textContent: r.environment }),
  ];

  const rightChildren = [
    el('span', { className: `badge ${statusClass}`, textContent: r.status }),
  ];

  const detailNode = buildDetailNodes(r);
  if (detailNode) rightChildren.push(detailNode);
  if (r.error) rightChildren.push(el('span', { className: 'error-text', textContent: r.error }));

  const blastRadius = getBlastRadius(r.id, dependencyGraph);
  if (blastRadius > 0) {
    rightChildren.push(el('span', {
      className: 'blast-badge',
      title: `${blastRadius} service${blastRadius > 1 ? 's' : ''} affected if this goes down`,
      textContent: `\u26A1 ${blastRadius}`,
    }));
  }

  // Mini sparkline per endpoint
  if (sparklines && sparklines[r.id]) {
    const miniSpark = Sparkline.small(sparklines[r.id]);
    if (miniSpark) rightChildren.push(el('div', { className: 'endpoint-sparkline' }, [miniSpark]));
  }

  // Response time
  let rtClass = 'response-time';
  if (r.responseTimeMs > 0 && r.responseTimeMs < 200) rtClass += ' rt-fast';
  else if (r.responseTimeMs >= 1000) rtClass += ' rt-slow';
  rightChildren.push(el('span', { className: rtClass, textContent: responseTime }));

  const row = el('div', {
    className: `endpoint${changed ? ' status-changed' : ''}`,
    'data-endpoint-id': r.id,
    role: 'button',
    tabindex: '0',
    'aria-label': `View details for ${r.name}`,
  }, [
    el('div', { className: 'endpoint-left' }, leftChildren),
    el('div', { className: 'endpoint-right' }, rightChildren),
  ]);

  row.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    Router.navigate(`#/service/${r.id}`);
  });
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Router.navigate(`#/service/${r.id}`);
  });

  // Impact warning
  if ((r.status === 'DOWN' || r.status === 'DEGRADED') && impactMap && impactMap[r.id]) {
    const affected = impactMap[r.id];
    const names = affected.map(a => a.name).join(', ');
    const warningText = r.impactDescription || `Affects: ${names}`;
    row.appendChild(el('div', { className: 'impact-warning' }, [
      el('span', { className: 'impact-warning-icon', textContent: '\u26A0' }),
      el('div', { className: 'impact-warning-text' }, [
        el('strong', { textContent: 'Impact: ' }),
        warningText,
      ]),
    ]));
  }

  return row;
}

// ---------------------------------------------------------------------------
// App card component (minimal view)
// ---------------------------------------------------------------------------

function computeWorstStatus(endpoints) {
  let hasDown = false, hasDegraded = false;
  for (const ep of endpoints) {
    if (ep.status === 'DOWN') hasDown = true;
    else if (ep.status === 'DEGRADED') hasDegraded = true;
  }
  return hasDown ? 'down' : hasDegraded ? 'degraded' : 'up';
}

function computeGroupSparkline(endpoints, sparklines) {
  if (!sparklines) return null;
  const epSparklines = endpoints
    .map(ep => sparklines[ep.id])
    .filter(s => s && s.length > 0);
  if (epSparklines.length === 0) return null;
  const maxLen = Math.max(...epSparklines.map(s => s.length));
  const combined = [];
  for (let i = 0; i < maxLen; i++) {
    let sum = 0, count = 0;
    for (const s of epSparklines) {
      const idx = i - (maxLen - s.length);
      if (idx >= 0 && idx < s.length && s[idx] !== null && s[idx] >= 0) {
        sum += s[idx]; count++;
      }
    }
    combined.push(count > 0 ? Math.round(sum / count) : null);
  }
  return combined;
}

function renderAppCard(group, groupEndpoints, context) {
  const { sparklines, uptimes, incidents } = context;
  const worstStatus = computeWorstStatus(groupEndpoints);
  const upCount = groupEndpoints.filter(ep => ep.status === 'UP').length;
  const countText = `${upCount}/${groupEndpoints.length} up`;

  // Compute group avg uptime
  let avgUptime = null;
  if (uptimes) {
    const epUptimes = groupEndpoints.map(ep => uptimes[ep.id]).filter(v => v != null);
    if (epUptimes.length > 0) {
      avgUptime = (epUptimes.reduce((a, b) => a + b, 0) / epUptimes.length).toFixed(1);
    }
  }

  // Compute group avg response time
  const rts = groupEndpoints.filter(ep => ep.responseTimeMs > 0).map(ep => ep.responseTimeMs);
  const avgRt = rts.length > 0 ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;

  // Compute active incidents for this group
  const epIds = new Set(groupEndpoints.map(ep => ep.id));
  const activeIncidents = (incidents || []).filter(inc => epIds.has(inc.id) && inc.toStatus !== 'UP').length;

  const card = el('div', {
    className: `app-card status-${worstStatus}`,
    'aria-label': `${group.name} — ${countText}`,
  });

  // 1. Status bar (4px colored top)
  card.appendChild(el('div', { className: `card-status-bar status-bar-${worstStatus}` }));

  // 2. Header: icon + name + desc + count | uptime% + badge
  const headerLeft = el('div', { className: 'app-card-left' }, [
    el('div', { className: 'app-card-icon', textContent: group.icon }),
    el('div', {}, [
      el('div', { className: 'app-card-name', textContent: group.name }),
      ...(group.description ? [el('div', { className: 'app-card-desc', textContent: group.description })] : []),
      el('div', { className: `app-card-count ${worstStatus === 'down' ? 'color-down' : worstStatus === 'degraded' ? 'color-degraded' : 'color-up'}`, textContent: countText }),
    ]),
  ]);

  const headerRight = el('div', { className: 'app-card-status' }, [
    ...(avgUptime != null ? [el('span', { className: `app-card-uptime ${parseFloat(avgUptime) < 99 ? 'uptime-warn' : ''}`, textContent: `${avgUptime}%` })] : []),
    el('span', { className: 'badge ' + worstStatus, textContent: worstStatus.toUpperCase() }),
  ]);

  const header = el('div', { className: 'app-card-header' }, [headerLeft, headerRight]);

  // Click header name to navigate to first endpoint detail
  header.querySelector('.app-card-name').addEventListener('click', (e) => {
    e.stopPropagation();
    if (groupEndpoints.length > 0) Router.navigate(`#/service/${groupEndpoints[0].id}`);
  });

  card.appendChild(header);

  // 3. Metrics bar: 4 stat boxes
  const uptimeClass = avgUptime != null
    ? (parseFloat(avgUptime) >= 99.9 ? 'metric-success' : parseFloat(avgUptime) >= 99 ? '' : 'metric-warning')
    : '';
  const rtClass = avgRt != null
    ? (avgRt < 200 ? 'metric-success' : avgRt < 1000 ? '' : 'metric-warning')
    : '';
  const incidentClass = activeIncidents > 0 ? 'metric-error' : 'metric-success';

  card.appendChild(el('div', { className: 'card-metrics-bar' }, [
    el('div', { className: 'card-metric' }, [
      el('span', { className: `card-metric-value ${rtClass}`, textContent: avgRt != null ? `${avgRt}ms` : '\u2014' }),
      el('span', { className: 'card-metric-label', textContent: 'Avg Response' }),
    ]),
    el('div', { className: 'card-metric' }, [
      el('span', { className: `card-metric-value ${uptimeClass}`, textContent: avgUptime != null ? `${avgUptime}%` : '\u2014' }),
      el('span', { className: 'card-metric-label', textContent: 'Uptime' }),
    ]),
    el('div', { className: 'card-metric' }, [
      el('span', { className: `card-metric-value ${incidentClass}`, textContent: String(activeIncidents) }),
      el('span', { className: 'card-metric-label', textContent: 'Incidents' }),
    ]),
    el('div', { className: 'card-metric' }, [
      el('span', { className: 'card-metric-value metric-brand', textContent: String(groupEndpoints.length) }),
      el('span', { className: 'card-metric-label', textContent: 'Endpoints' }),
    ]),
  ]));

  // 4. Large sparkline: group average response time
  const groupSparkData = computeGroupSparkline(groupEndpoints, sparklines);
  if (groupSparkData) {
    const sparkSvg = Sparkline.large(groupSparkData, { width: 800, height: 80, title: `${group.name} avg response time` });
    if (sparkSvg) {
      // Make responsive: override fixed dimensions
      sparkSvg.setAttribute('width', '100%');
      sparkSvg.setAttribute('height', '80');
      sparkSvg.style.width = '100%';
      sparkSvg.style.height = '80px';

      const lastVal = groupSparkData.filter(v => v !== null && v >= 0).pop();
      card.appendChild(el('div', { className: 'card-sparkline-section' }, [
        el('div', { className: 'card-sparkline-header' }, [
          el('span', { className: 'card-sparkline-title', textContent: 'Response Time' }),
          ...(lastVal != null ? [el('span', { className: 'card-sparkline-value', textContent: `${lastVal}ms` })] : []),
        ]),
        sparkSvg,
      ]));
    }
  }

  // 5. Status segments bar
  card.appendChild(renderStatusSegments(groupEndpoints));

  // 6. Endpoints section (always visible)
  const endpointSection = el('div', { className: 'card-endpoints' }, [
    el('div', { className: 'card-endpoints-header' }, [
      el('span', { className: 'card-endpoints-title', textContent: `Endpoints (${groupEndpoints.length})` }),
    ]),
  ]);
  for (const ep of groupEndpoints) {
    endpointSection.appendChild(renderEndpoint(ep, context));
  }
  card.appendChild(endpointSection);

  return card;
}

// ---------------------------------------------------------------------------
// Category view (advanced mode)
// ---------------------------------------------------------------------------

function renderCategories(data, context) {
  const { results } = data;
  const envFilter = State.get('envFilter');
  const collapsedCategories = State.get('collapsedCategories');

  let filtered = results;
  if (envFilter !== 'all') filtered = results.filter(r => r.environment === envFilter);

  const grouped = {};
  for (const r of filtered) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  const container = el('div', {});
  for (const cat of CATEGORY_ORDER) {
    const endpoints = grouped[cat];
    if (!endpoints || endpoints.length === 0) continue;

    let upCount = 0, degradedCount = 0, downCount = 0;
    for (const ep of endpoints) {
      if (ep.status === 'UP') upCount++;
      else if (ep.status === 'DEGRADED') degradedCount++;
      else downCount++;
    }

    // Category uptime
    const uptimes = context.uptimes || {};
    const catUptimes = endpoints.map(ep => uptimes[ep.id]).filter(v => v != null);
    const catUptime = catUptimes.length > 0
      ? (catUptimes.reduce((a, b) => a + b, 0) / catUptimes.length).toFixed(1)
      : null;

    const iconCfg = CATEGORY_ICONS[cat];
    const iconNode = el('div', { className: 'category-icon' });
    iconNode.style.background = iconCfg.bg;
    iconNode.style.color = iconCfg.color;
    iconNode.textContent = iconCfg.text;

    const countText = `${upCount}/${endpoints.length} up`;
    let countClass = 'category-count';
    if (downCount > 0) countClass += ' color-down';
    else if (degradedCount > 0) countClass += ' color-degraded';
    else countClass += ' color-up';

    const isCollapsed = !!collapsedCategories[cat];
    const chevron = el('span', { className: `category-chevron${isCollapsed ? ' collapsed' : ''}`, textContent: '\u25BE' });

    const headerDiv = el('div', { className: 'category-header' }, [
      iconNode,
      el('h2', { textContent: CATEGORY_LABELS[cat] || cat }),
      chevron,
      ...(catUptime != null ? [el('span', { className: 'category-uptime', textContent: `${catUptime}%` })] : []),
      el('span', { className: countClass, textContent: countText }),
    ]);

    const list = el('div', { className: `endpoint-list${isCollapsed ? ' collapsed' : ''}` },
      endpoints.map(ep => renderEndpoint(ep, context))
    );

    headerDiv.addEventListener('click', () => {
      const collapsed = State.get('collapsedCategories');
      const nowCollapsed = !collapsed[cat];
      State.set('collapsedCategories', { ...collapsed, [cat]: nowCollapsed });

      if (nowCollapsed) {
        list.style.maxHeight = list.scrollHeight + 'px';
        list.offsetHeight;
        list.classList.add('collapsed');
        list.style.maxHeight = '0';
        chevron.classList.add('collapsed');
      } else {
        list.classList.remove('collapsed');
        list.style.maxHeight = list.scrollHeight + 'px';
        chevron.classList.remove('collapsed');
        list.addEventListener('transitionend', function handler() {
          if (!State.get('collapsedCategories')[cat]) list.style.maxHeight = '';
          list.removeEventListener('transitionend', handler);
        });
      }
    });

    const section = el('div', { className: 'category' }, [headerDiv, list]);
    container.appendChild(section);
    if (isCollapsed) list.style.maxHeight = '0';
  }
  return container;
}

// ---------------------------------------------------------------------------
// Mini SVG dependency graph
// ---------------------------------------------------------------------------

function renderMiniGraph(r, graphNode, resultMap, opts = {}) {
  const { dependsOn = [], requiredBy = [] } = graphNode;
  if (dependsOn.length === 0 && requiredBy.length === 0) return null;

  const nodeH = 28, nodeGap = 6, colW = opts.colW || 100, arrowGap = 24;
  const maxCount = Math.max(dependsOn.length, requiredBy.length, 1);
  const svgH = maxCount * (nodeH + nodeGap) + 20;
  const svgW = colW * 3 + arrowGap * 2;
  const ns = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
  svg.setAttribute('class', 'dep-graph-svg');
  if (opts.fullWidth) {
    svg.setAttribute('width', '100%');
    svg.style.maxWidth = svgW + 'px';
  } else {
    svg.setAttribute('width', svgW);
  }
  svg.setAttribute('height', svgH);

  const statusColors = { up: '#16A34A', degraded: '#EA580C', down: '#DC2626', unknown: '#9CA3AF' };

  const truncName = (name, max = 13) => name.length > max ? name.substring(0, max) + '\u2026' : name;

  function drawNode(x, y, name, status, isCenter) {
    const g = document.createElementNS(ns, 'g');
    if (opts.clickable) {
      g.style.cursor = 'pointer';
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
    }

    const rect = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: colW, height: nodeH, rx: 6, fill: isCenter ? '#FFF5F9' : '#F6F8FA', stroke: isCenter ? '#F34499' : '#E5E7EB', 'stroke-width': isCenter ? 1.5 : 1 })) rect.setAttribute(k, v);
    g.appendChild(rect);

    const border = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: 3, height: nodeH, rx: 1.5, fill: statusColors[status] || statusColors.unknown })) border.setAttribute(k, v);
    g.appendChild(border);

    const dot = document.createElementNS(ns, 'circle');
    for (const [k, v] of Object.entries({ cx: x + 12, cy: y + nodeH / 2, r: 3, fill: statusColors[status] || statusColors.unknown })) dot.setAttribute(k, v);
    g.appendChild(dot);

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', x + 19);
    text.setAttribute('y', y + nodeH / 2 + 3.5);
    text.textContent = truncName(name);
    g.appendChild(text);
    return g;
  }

  function drawArrow(x1, y1, x2, y2, color) {
    const line = document.createElementNS(ns, 'line');
    for (const [k, v] of Object.entries({ x1, y1, x2, y2, stroke: color || '#D1D5DB', 'stroke-width': 1.2, 'marker-end': `url(#arrow-${(color || '#D1D5DB').replace('#', '')})` })) line.setAttribute(k, v);
    return line;
  }

  // Arrow markers
  const defs = document.createElementNS(ns, 'defs');
  for (const c of ['D1D5DB', '16A34A', 'EA580C', 'DC2626', '9CA3AF']) {
    const marker = document.createElementNS(ns, 'marker');
    for (const [k, v] of Object.entries({ id: `arrow-${c}`, viewBox: '0 0 6 6', refX: 5, refY: 3, markerWidth: 5, markerHeight: 5, orient: 'auto' })) marker.setAttribute(k, v);
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', '0,0 6,3 0,6');
    poly.setAttribute('fill', `#${c}`);
    marker.appendChild(poly);
    defs.appendChild(marker);
  }
  svg.appendChild(defs);

  // Center
  const centerX = colW + arrowGap;
  const centerY = (svgH - nodeH) / 2;
  const rStatus = r.status ? r.status.toLowerCase() : 'unknown';
  svg.appendChild(drawNode(centerX, centerY, r.name, rStatus, true));

  // Left column (dependsOn)
  for (let i = 0; i < dependsOn.length; i++) {
    const depId = dependsOn[i];
    const depR = resultMap[depId];
    const depName = depR ? depR.name : depId;
    const depStatus = depR ? depR.status.toLowerCase() : 'unknown';
    const ly = 10 + i * (nodeH + nodeGap);
    const g = drawNode(0, ly, depName, depStatus, false);
    if (opts.clickable) g.addEventListener('click', () => Router.navigate(`#/service/${depId}`));
    svg.appendChild(g);
    svg.appendChild(drawArrow(colW, ly + nodeH / 2, centerX, centerY + nodeH / 2, statusColors[depStatus] || statusColors.unknown));
  }

  // Right column (requiredBy)
  for (let i = 0; i < requiredBy.length; i++) {
    const reqId = requiredBy[i];
    const reqR = resultMap[reqId];
    const reqName = reqR ? reqR.name : reqId;
    const reqStatus = reqR ? reqR.status.toLowerCase() : 'unknown';
    const ry = 10 + i * (nodeH + nodeGap);
    const g = drawNode(centerX + colW + arrowGap, ry, reqName, reqStatus, false);
    if (opts.clickable) g.addEventListener('click', () => Router.navigate(`#/service/${reqId}`));
    svg.appendChild(g);
    svg.appendChild(drawArrow(centerX + colW, centerY + nodeH / 2, centerX + colW + arrowGap, ry + nodeH / 2, statusColors[rStatus] || statusColors.unknown));
  }

  const wrapper = el('div', { className: 'dep-mini-graph' });
  wrapper.appendChild(svg);
  return wrapper;
}

// ---------------------------------------------------------------------------
// Service detail drill-down page
// ---------------------------------------------------------------------------

function renderServiceDetail(serviceId, data) {
  const resultMap = {};
  for (const r of data.results) resultMap[r.id] = r;

  const r = resultMap[serviceId];
  if (!r) {
    return el('div', { className: 'detail-page' }, [
      el('button', { className: 'back-btn', textContent: '\u2190 Back to Overview', onClick: () => Router.back() }),
      el('div', { className: 'detail-not-found', textContent: `Service "${serviceId}" not found.` }),
    ]);
  }

  const graph = data.dependencyGraph || {};
  const graphNode = graph[r.id] || { dependsOn: [], requiredBy: [] };
  const history = data.history || {};
  const sparklines = history.sparklines || {};
  const uptimes = history.uptimes || {};
  const incidents = history.incidents || [];

  const statusClass = r.status.toLowerCase();
  const responseTime = r.responseTimeMs > 0 ? `${r.responseTimeMs}ms` : '\u2014';
  const uptime = uptimes[r.id] != null ? `${uptimes[r.id]}%` : '\u2014';

  // Find which app group this belongs to
  const appGroups = data.appGroups || [];
  const parentGroup = appGroups.find(g => g.endpoints.includes(r.id));
  const groupEndpoints = parentGroup
    ? parentGroup.endpoints.map(id => resultMap[id]).filter(Boolean)
    : [r];

  const page = el('div', { className: 'detail-page' });

  // Back button
  page.appendChild(el('button', { className: 'back-btn', textContent: '\u2190 Back to Overview', onClick: () => Router.back() }));

  // Service header
  page.appendChild(el('div', { className: 'detail-header' }, [
    el('div', { className: 'detail-header-top' }, [
      ...(parentGroup ? [el('div', { className: 'detail-icon', textContent: parentGroup.icon })] : []),
      el('div', { className: 'detail-header-info' }, [
        el('h2', { className: 'detail-name', textContent: r.name }),
        el('div', { className: 'detail-rich-desc', textContent: r.richDescription || r.description || '' }),
      ]),
    ]),
    el('div', { className: 'detail-header-metrics' }, [
      el('span', { className: `badge ${statusClass}`, textContent: r.status }),
      el('span', { className: `detail-uptime ${parseFloat(uptime) < 99 ? 'uptime-warn' : ''}`, textContent: uptime }),
      el('span', { className: 'detail-rt', textContent: responseTime }),
      el('span', { className: `env-badge env-${r.environment}`, textContent: r.environment }),
    ]),
  ]));

  // Owner card
  if (r.owner) {
    const initials = r.owner.name.split(' ').map(w => w[0]).join('').toUpperCase();
    page.appendChild(el('div', { className: 'detail-owner' }, [
      el('div', { className: 'detail-owner-avatar', textContent: initials }),
      el('div', { className: 'detail-owner-info' }, [
        el('div', { className: 'detail-owner-name', textContent: r.owner.name }),
        el('div', { className: 'detail-owner-role', textContent: r.owner.role }),
        el('div', { className: 'detail-owner-contact', textContent: r.owner.contact }),
      ]),
    ]));
  }

  // Quick links
  const links = el('div', { className: 'detail-quick-links' });
  if (r.url) links.appendChild(el('a', { className: 'detail-link-btn', href: r.url, target: '_blank', rel: 'noopener' }, [el('span', { textContent: '\uD83D\uDD17 Open URL' })]));
  links.appendChild(r.docsUrl
    ? el('a', { className: 'detail-link-btn', href: r.docsUrl, target: '_blank', rel: 'noopener' }, [el('span', { textContent: '\uD83D\uDCD6 Docs' })])
    : el('span', { className: 'detail-link-btn disabled' }, [el('span', { textContent: '\uD83D\uDCD6 Docs' })]));
  links.appendChild(r.repoUrl
    ? el('a', { className: 'detail-link-btn', href: r.repoUrl, target: '_blank', rel: 'noopener' }, [el('span', { textContent: '\uD83D\uDCBB Repo' })])
    : el('span', { className: 'detail-link-btn disabled' }, [el('span', { textContent: '\uD83D\uDCBB Repo' })]));
  page.appendChild(links);

  // Tags
  if (r.tags && r.tags.length > 0) {
    page.appendChild(el('div', { className: 'detail-tags' }, r.tags.map(t => el('span', { className: 'detail-tag', textContent: t }))));
  }

  // Response time chart (large sparkline)
  if (sparklines[r.id] && sparklines[r.id].length >= 2) {
    page.appendChild(el('div', { className: 'detail-section' }, [
      el('div', { className: 'section-title', textContent: 'Response Time' }),
      el('div', { className: 'detail-sparkline-large' }, [Sparkline.large(sparklines[r.id], { title: `${r.name} response time` })]),
    ]));
  }

  // Status segments (if this is a group)
  if (groupEndpoints.length > 1) {
    page.appendChild(el('div', { className: 'detail-section' }, [
      el('div', { className: 'section-title', textContent: 'Service Status' }),
      renderStatusSegments(groupEndpoints),
    ]));
  }

  // Endpoints list (if this is a group)
  if (groupEndpoints.length > 1) {
    const context = {
      impactMap: data.impactMap || {},
      dependencyGraph: graph,
      resultMap,
      sparklines,
    };
    page.appendChild(el('div', { className: 'detail-section' }, [
      el('div', { className: 'section-title', textContent: `Endpoints (${groupEndpoints.length})` }),
      ...groupEndpoints.map(ep => renderEndpoint(ep, context)),
    ]));
  }

  // Health components
  if (r.details && r.details.components) {
    const compKeys = Object.keys(r.details.components);
    const hcSection = el('div', { className: 'detail-section' }, [
      el('div', { className: 'section-title', textContent: 'Health Components' }),
    ]);
    for (const key of compKeys) {
      const comp = r.details.components[key];
      const compStatus = (typeof comp === 'object') ? (comp.status || comp.state || 'unknown') : String(comp);
      const isHealthy = /up|healthy|ok|pass/i.test(compStatus);
      const dotClass = isHealthy ? 'up' : 'down';
      hcSection.appendChild(el('div', { className: `dep-item dep-item-border-${dotClass}` }, [
        el('span', { className: `dep-item-dot ${dotClass}` }),
        el('span', { className: 'dep-item-name', textContent: key }),
        el('span', { className: `dep-item-status color-${dotClass}`, textContent: compStatus }),
      ]));
    }
    page.appendChild(hcSection);
  }

  // Dependency graph (enlarged, clickable)
  const miniGraph = renderMiniGraph(r, graphNode, resultMap, { fullWidth: true, clickable: true, colW: 120 });
  if (miniGraph) {
    page.appendChild(el('div', { className: 'detail-section' }, [
      el('div', { className: 'section-title', textContent: 'Dependencies' }),
      miniGraph,
    ]));
  }

  // Cascade chain
  const cascadeLevels = buildCascadeTree(r.id, graph);
  if (cascadeLevels.length > 0) {
    const totalCascade = cascadeLevels.reduce((acc, lvl) => acc + lvl.length, 0);
    const cascadeSection = el('div', { className: 'detail-section' }, [
      el('div', { className: 'section-title', textContent: `Cascade If Down (${totalCascade} service${totalCascade > 1 ? 's' : ''})` }),
    ]);
    for (let d = 0; d < cascadeLevels.length; d++) {
      for (let i = 0; i < cascadeLevels[d].length; i++) {
        const cId = cascadeLevels[d][i];
        const cResult = resultMap[cId];
        const cStatus = cResult ? cResult.status.toLowerCase() : 'unknown';
        const cName = cResult ? cResult.name : cId;
        const isLast = d === cascadeLevels.length - 1 && i === cascadeLevels[d].length - 1;
        const prefix = isLast ? '\u2514\u2500 ' : '\u251C\u2500 ';

        const item = el('div', { className: 'dep-cascade-item', style: `padding-left: ${(d + 1) * 16}px; cursor: pointer` }, [
          el('span', { className: 'dep-cascade-depth', textContent: `L${d + 1}` }),
          el('span', { className: `dep-item-dot ${cStatus}` }),
          el('span', { className: 'dep-item-name', textContent: `${prefix}${cName}` }),
          el('span', { className: `dep-item-status color-${cStatus}`, textContent: cResult ? cResult.status : 'N/A' }),
        ]);
        item.addEventListener('click', () => Router.navigate(`#/service/${cId}`));
        cascadeSection.appendChild(item);
      }
    }
    page.appendChild(cascadeSection);
  }

  // Impact description
  if (r.impactDescription) {
    page.appendChild(el('div', { className: 'detail-section' }, [
      el('div', { className: 'section-title', textContent: 'Impact If Down' }),
      el('div', { className: 'dep-impact-text', textContent: r.impactDescription }),
    ]));
  }

  // Service incident history (filtered)
  const serviceIncidents = incidents.filter(inc => inc.id === r.id);
  if (serviceIncidents.length > 0) {
    const incTimeline = renderIncidentTimeline(serviceIncidents, resultMap);
    if (incTimeline) page.appendChild(incTimeline);
  }

  return page;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function matchesSearch(r, query) {
  if (!query) return true;
  const hay = `${r.id} ${r.name} ${r.description || ''} ${r.owner?.name || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
  return hay.includes(query);
}

// ---------------------------------------------------------------------------
// Overview page renderer
// ---------------------------------------------------------------------------

function renderOverview(data) {
  const page = el('div', { className: 'overview-page' });
  const history = data.history || {};
  const sparklines = history.sparklines || {};
  const uptimes = history.uptimes || {};
  const incidents = history.incidents || [];

  const resultMap = {};
  for (const r of data.results) resultMap[r.id] = r;

  const envFilter = State.get('envFilter');
  const searchQuery = State.get('searchQuery');

  // Filter results
  let filtered = data.results;
  if (envFilter !== 'all') filtered = filtered.filter(r => r.environment === envFilter);
  if (searchQuery) filtered = filtered.filter(r => matchesSearch(r, searchQuery));

  // Summary
  const summaryData = {
    total: filtered.length,
    up: filtered.filter(r => r.status === 'UP').length,
    degraded: filtered.filter(r => r.status === 'DEGRADED').length,
    down: filtered.filter(r => r.status === 'DOWN').length,
  };
  page.appendChild(renderSummary(summaryData));

  // Incident timeline
  if (!searchQuery && incidents.length > 0) {
    const timeline = renderIncidentTimeline(incidents, resultMap);
    if (timeline) page.appendChild(timeline);
  }

  // Environment tabs
  const envTabs = el('div', { className: 'env-tabs' });
  for (const env of ['all', 'prod', 'dev', 'staging', 'release']) {
    const label = env === 'all' ? 'All' : env === 'prod' ? 'Production' : env === 'dev' ? 'Development' : env.charAt(0).toUpperCase() + env.slice(1);
    const tab = el('button', {
      className: `env-tab${envFilter === env ? ' active' : ''}`,
      'data-env': env,
      textContent: label,
      onClick: () => {
        State.set('envFilter', env);
        renderPage();
      },
    });
    envTabs.appendChild(tab);
  }
  page.appendChild(envTabs);

  // Search bar
  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Search endpoints, apps, owners...',
    'aria-label': 'Search endpoints',
    role: 'searchbox',
    id: 'search-input',
  });
  searchInput.value = searchQuery;

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim().toLowerCase();
    clearBtn.classList.toggle('hidden', val.length === 0);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      State.set('searchQuery', val);
      renderPage();
    }, 200);
  });

  const clearBtn = el('span', {
    className: `search-clear${searchQuery ? '' : ' hidden'}`,
    textContent: '\u00D7',
    onClick: () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      State.set('searchQuery', '');
      renderPage();
    },
  });

  page.appendChild(el('div', { className: 'search-bar' }, [
    el('span', { className: 'search-icon', textContent: '\uD83D\uDD0E\uFE0E' }),
    searchInput,
    clearBtn,
  ]));

  // Cards / categories
  const context = {
    impactMap: data.impactMap || {},
    dependencyGraph: data.dependencyGraph || {},
    resultMap,
    sparklines,
    uptimes,
    incidents: incidents || [],
  };

  const viewMode = State.get('viewMode');

  if (filtered.length === 0 && searchQuery) {
    page.appendChild(el('div', { className: 'search-no-results' }, [
      el('span', { className: 'search-no-results-icon', textContent: '\uD83D\uDD0D' }),
      el('span', { textContent: `No endpoints match "${searchQuery}"` }),
    ]));
  } else if (viewMode === 'minimal') {
    const filteredIds = new Set(filtered.map(r => r.id));
    const grid = el('div', { className: 'app-grid' });
    for (const group of (data.appGroups || [])) {
      const groupEndpoints = group.endpoints
        .map(id => resultMap[id])
        .filter(ep => ep && filteredIds.has(ep.id));
      if (groupEndpoints.length === 0) continue;
      grid.appendChild(renderAppCard(group, groupEndpoints, context));
    }
    page.appendChild(grid);
  } else {
    page.appendChild(renderCategories(data, context));
  }

  return page;
}

// ---------------------------------------------------------------------------
// Page renderer (router-driven)
// ---------------------------------------------------------------------------

function renderPage() {
  const data = State.get('lastData');
  if (!data) return;

  const route = State.get('route');
  const pageContent = document.getElementById('page-content');

  // Fade transition
  pageContent.classList.add('page-exit');
  setTimeout(() => {
    clearNode(pageContent);
    let content;
    if (route.page === 'service') {
      content = renderServiceDetail(route.serviceId, data);
    } else {
      content = renderOverview(data);
    }
    pageContent.appendChild(content);
    pageContent.classList.remove('page-exit');
    pageContent.classList.add('page-enter');
    requestAnimationFrame(() => {
      pageContent.classList.remove('page-enter');
      // Trigger sparkline draw-in animations
      for (const line of pageContent.querySelectorAll('.sparkline-line')) {
        line.style.transition = 'stroke-dashoffset 600ms ease';
        line.style.strokeDashoffset = '0';
      }
    });

    // Focus management for detail page
    if (route.page === 'service') {
      pageContent.querySelector('.back-btn')?.focus();
    } else {
      if (State.get('searchQuery')) {
        const input = pageContent.querySelector('#search-input');
        if (input) { input.focus(); input.selectionStart = input.value.length; }
      }
    }
  }, 150);
}

// ---------------------------------------------------------------------------
// Status change detection + toast notifications
// ---------------------------------------------------------------------------

function detectStatusChanges(results) {
  const prevMap = State.get('previousStatusMap');
  if (Object.keys(prevMap).length === 0) return;

  for (const r of results) {
    const prev = prevMap[r.id];
    if (prev && prev !== r.status) {
      const isRecovery = r.status === 'UP';
      Toast.show({
        title: isRecovery ? 'Recovered' : r.status === 'DEGRADED' ? 'Degraded' : 'Down',
        message: `${r.name} is now ${r.status}`,
        status: r.status,
        serviceId: r.id,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function renderSkeleton() {
  const pageContent = document.getElementById('page-content');
  clearNode(pageContent);
  const grid = el('div', { className: 'app-grid' });
  for (let i = 0; i < 6; i++) {
    grid.appendChild(el('div', { className: 'app-card skeleton-card' }, [
      el('div', { className: 'skeleton skeleton-header' }),
      el('div', { className: 'skeleton skeleton-line' }),
      el('div', { className: 'skeleton skeleton-line short' }),
    ]));
  }
  pageContent.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function showError(msg) {
  const pageContent = document.getElementById('page-content');
  const existing = pageContent.querySelector('.error-banner');
  if (existing) existing.remove();
  pageContent.appendChild(el('div', { className: 'error-banner' }, [
    el('span', { textContent: msg }),
  ]));
}

// ---------------------------------------------------------------------------
// Main refresh loop
// ---------------------------------------------------------------------------

function refresh() {
  fetchHealth().then(data => {
    detectStatusChanges(data.results);

    const newStatusMap = {};
    for (const r of data.results) newStatusMap[r.id] = r.status;
    State.set('previousStatusMap', newStatusMap);

    State.set('lastData', data);

    const envFilter = State.get('envFilter');
    let filtered = data.results;
    if (envFilter !== 'all') filtered = filtered.filter(r => r.environment === envFilter);
    const summaryData = {
      timestamp: data.timestamp,
      total: filtered.length,
      up: filtered.filter(r => r.status === 'UP').length,
      degraded: filtered.filter(r => r.status === 'DEGRADED').length,
      down: filtered.filter(r => r.status === 'DOWN').length,
      results: data.results,
      history: data.history,
    };

    renderStatusBanner(summaryData);
    renderOverallBadge(summaryData);
    renderPage();

    resetProgressBar();
    startCountdown();
  }).catch(err => {
    showError(`Failed to fetch status: ${err.message}. Retrying in ${REFRESH_INTERVAL / 1000}s.`);
    pauseCountdown();
  });
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && State.get('route').page === 'service') {
    Router.back();
  }
  if (e.key === '/' && !e.target.closest('input, textarea, [contenteditable]')) {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
  }
});

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

function initViewToggle() {
  const btns = document.querySelectorAll('.view-btn');
  for (const btn of btns) {
    btn.addEventListener('click', () => {
      for (const b of btns) b.classList.remove('active');
      btn.classList.add('active');
      State.set('viewMode', btn.getAttribute('data-view'));
      renderPage();
    });
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

Router.init();
State.on('route', () => renderPage());
initViewToggle();
renderSkeleton();
refresh();
setInterval(refresh, REFRESH_INTERVAL);

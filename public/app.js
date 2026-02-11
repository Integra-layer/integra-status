// app.js — Integra Status Page (vanilla JS, auto-refresh 30s)
'use strict';

var REFRESH_INTERVAL = 30000;
var CATEGORY_LABELS = {
  blockchain: 'Blockchain',
  validators: 'Validators',
  apis: 'Backend APIs',
  frontends: 'Frontends & Explorers',
  external: 'External Dependencies',
};
var CATEGORY_ICONS = {
  blockchain: { text: '\u26D3', bg: 'rgba(168,85,247,0.15)', color: '#A855F7' },
  validators: { text: '\u26A1', bg: 'rgba(255,184,76,0.15)', color: '#FFB84C' },
  apis: { text: '\u2699', bg: 'rgba(51,92,255,0.15)', color: '#335CFF' },
  frontends: { text: '\u25C9', bg: 'rgba(255,79,145,0.15)', color: '#FF4F91' },
  external: { text: '\u2197', bg: 'rgba(153,153,153,0.15)', color: '#999999' },
};
var CATEGORY_ORDER = ['blockchain', 'validators', 'apis', 'frontends', 'external'];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

var currentEnvFilter = 'all';
var currentViewMode = 'minimal'; // 'minimal' | 'advanced'
var expandedApps = {}; // { appId: true/false }
var lastData = null; // cache last API response for re-rendering on tab switch
var collapsedCategories = {}; // { categoryKey: true/false } — persists across refreshes
var lastRefreshTime = null;
var countdownInterval = null;
var previousStatusMap = {}; // { endpointId: 'UP'|'DOWN'|... } for change detection
var currentSearchQuery = ''; // lowercase search term
var searchDebounceTimer = null;
var panelOpener = null; // element that opened the detail panel (for focus return)

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function fetchHealth() {
  return fetch('/api/health').then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// DOM helper
// ---------------------------------------------------------------------------

function el(tag, attrs, children) {
  var node = document.createElement(tag);
  if (attrs) {
    var keys = Object.keys(attrs);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = attrs[k];
      if (k === 'className') node.className = v;
      else if (k === 'textContent') node.textContent = v;
      else node.setAttribute(k, v);
    }
  }
  if (children) {
    var items = Array.isArray(children) ? children : [children];
    for (var j = 0; j < items.length; j++) {
      var child = items[j];
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    }
  }
  return node;
}

// ---------------------------------------------------------------------------
// Blast radius (BFS on dependencyGraph)
// ---------------------------------------------------------------------------

function getBlastRadius(endpointId, dependencyGraph) {
  var visited = {};
  var queue = [endpointId];
  visited[endpointId] = true;
  var count = 0;
  while (queue.length > 0) {
    var current = queue.shift();
    var node = dependencyGraph[current];
    if (!node) continue;
    var dependents = node.requiredBy || [];
    for (var i = 0; i < dependents.length; i++) {
      if (!visited[dependents[i]]) {
        visited[dependents[i]] = true;
        count++;
        queue.push(dependents[i]);
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Cascade tree (BFS with depth tracking)
// ---------------------------------------------------------------------------

function buildCascadeTree(startId, dependencyGraph) {
  var levels = [];
  var visited = {};
  visited[startId] = true;
  var currentLevel = [startId];
  while (currentLevel.length > 0) {
    var nextLevel = [];
    for (var i = 0; i < currentLevel.length; i++) {
      var node = dependencyGraph[currentLevel[i]];
      if (!node) continue;
      var deps = node.requiredBy || [];
      for (var j = 0; j < deps.length; j++) {
        if (!visited[deps[j]]) {
          visited[deps[j]] = true;
          nextLevel.push(deps[j]);
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

function resetProgressBar() {
  var fill = document.getElementById('refresh-bar-fill');
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
  var span = document.getElementById('last-updated');
  span.textContent = 'Updated just now';

  countdownInterval = setInterval(function() {
    var elapsed = Math.floor((Date.now() - lastRefreshTime) / 1000);
    if (elapsed < 5) {
      span.textContent = 'Updated just now';
    } else {
      span.textContent = 'Updated ' + elapsed + 's ago';
    }
  }, 1000);
}

function pauseCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  var span = document.getElementById('last-updated');
  span.textContent = 'Update failed \u2014 retrying\u2026';
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function renderSummary(data) {
  // Set aria-live on summary for screen reader announcements
  var summaryEl = document.getElementById('summary');
  if (summaryEl && !summaryEl.getAttribute('aria-live')) {
    summaryEl.setAttribute('aria-live', 'polite');
    summaryEl.setAttribute('aria-atomic', 'true');
  }

  var countUp = document.getElementById('count-up');
  countUp.textContent = data.up;
  countUp.className = 'count color-up';

  var countDegraded = document.getElementById('count-degraded');
  countDegraded.textContent = data.degraded;
  countDegraded.className = 'count color-degraded';

  var countDown = document.getElementById('count-down');
  countDown.textContent = data.down;
  countDown.className = 'count color-down';

  var countTotal = document.getElementById('count-total');
  countTotal.textContent = data.total;
  countTotal.className = 'count color-total';

  var badge = document.getElementById('overall-status');
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
// Endpoint rendering
// ---------------------------------------------------------------------------

function buildDetailNodes(r) {
  var parts = [];
  if (r.details.blockHeight) parts.push('Block ' + r.details.blockHeight.toLocaleString());
  if (r.details.chainId) parts.push('Chain ' + r.details.chainId);
  if (r.details.peerCount != null) parts.push(r.details.peerCount + ' peers');
  if (r.details.catchingUp != null) parts.push(r.details.catchingUp ? 'Syncing' : 'Synced');
  if (r.details.bondedValidators != null) parts.push(r.details.bondedValidators + ' validators');
  if (r.details.blockAgeSec != null) parts.push(r.details.blockAgeSec + 's ago');
  if (r.details.healthStatus) parts.push(r.details.healthStatus);
  if (r.details.version) parts.push('v' + r.details.version);
  if (parts.length === 0) return null;
  return el('span', { className: 'detail', textContent: parts.join(' \u00B7 ') });
}

function renderEndpoint(r, impactMap, dependencyGraph, resultMap) {
  var statusClass = r.status.toLowerCase();
  var responseTime = r.responseTimeMs > 0 ? r.responseTimeMs + 'ms' : '\u2014';

  // Detect status change for flash animation
  var changed = previousStatusMap[r.id] && previousStatusMap[r.id] !== r.status;

  // Left side: dot + name (clickable to open detail panel) + env badge + description
  var nameNode = el('button', { className: 'endpoint-name-btn', textContent: r.name });
  nameNode.addEventListener('click', function(e) {
    e.stopPropagation();
    openDepPanel(r, dependencyGraph, resultMap);
  });
  var leftChildren = [
    el('span', { className: 'status-dot ' + statusClass, title: r.status === 'UP' ? 'Operational' : r.status === 'DEGRADED' ? 'Degraded' : r.status === 'DOWN' ? 'Down' : r.status, 'aria-label': r.status === 'UP' ? 'Operational' : r.status === 'DEGRADED' ? 'Degraded' : r.status === 'DOWN' ? 'Down' : r.status }),
    el('div', {}, (function() {
      var inner = [nameNode];
      if (r.description) {
        inner.push(el('span', { className: 'endpoint-desc', textContent: r.description }));
      }
      return inner;
    })()),
    el('span', { className: 'env-badge env-' + r.environment, textContent: r.environment }),
  ];
  var left = el('div', { className: 'endpoint-left' }, leftChildren);

  // Right side: status badge + details + blast badge + dep button + response time
  var rightChildren = [
    el('span', { className: 'badge ' + statusClass, textContent: r.status }),
  ];

  var detailNode = buildDetailNodes(r);
  if (detailNode) rightChildren.push(detailNode);
  if (r.error) rightChildren.push(el('span', { className: 'error-text', textContent: r.error }));

  // Blast radius badge
  var blastRadius = getBlastRadius(r.id, dependencyGraph);
  if (blastRadius > 0) {
    rightChildren.push(el('span', {
      className: 'blast-badge',
      title: blastRadius + ' service' + (blastRadius > 1 ? 's' : '') + ' affected if this goes down',
      textContent: '\u26A1 ' + blastRadius,
    }));
  }

  // Dependency button — always show, dim if no deps
  var graphNode = dependencyGraph[r.id] || { dependsOn: [], requiredBy: [] };
  var hasDeps = (graphNode.dependsOn && graphNode.dependsOn.length > 0) ||
                (graphNode.requiredBy && graphNode.requiredBy.length > 0);
  var depBtnClass = 'dep-btn' + (hasDeps ? '' : ' no-deps');
  var depBtn = el('button', { className: depBtnClass, title: 'View details for ' + r.name, 'aria-label': 'View details for ' + r.name, textContent: '\u{1F517}' });
  depBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    openDepPanel(r, dependencyGraph, resultMap);
  });
  rightChildren.push(depBtn);

  // Response time with color coding
  var rtClass = 'response-time';
  if (r.responseTimeMs > 0 && r.responseTimeMs < 200) rtClass += ' rt-fast';
  else if (r.responseTimeMs >= 1000) rtClass += ' rt-slow';
  rightChildren.push(el('span', { className: rtClass, textContent: responseTime }));

  var right = el('div', { className: 'endpoint-right' }, rightChildren);
  var endpointClass = 'endpoint' + (changed ? ' status-changed' : '');
  var endpointNode = el('div', { className: endpointClass, 'data-endpoint-id': r.id, role: 'button', tabindex: '0', 'aria-label': 'View details for ' + r.name }, [left, right]);

  // Make entire row clickable
  endpointNode.addEventListener('click', function(e) {
    if (e.target.closest('a') || e.target.closest('button')) return;
    openDepPanel(r, dependencyGraph, resultMap);
  });
  endpointNode.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDepPanel(r, dependencyGraph, resultMap);
    }
  });

  // Impact warning: if this endpoint is DOWN/DEGRADED and has impacted services
  if ((r.status === 'DOWN' || r.status === 'DEGRADED') && impactMap && impactMap[r.id]) {
    var affected = impactMap[r.id];
    var names = affected.map(function(a) { return a.name; }).join(', ');
    var warningText = r.impactDescription || ('Affects: ' + names);

    var warning = el('div', { className: 'impact-warning' }, [
      el('span', { className: 'impact-warning-icon', textContent: '\u26A0' }),
      el('div', { className: 'impact-warning-text' }, [
        el('strong', { textContent: 'Impact: ' }),
        document.createTextNode(warningText),
      ]),
    ]);
    endpointNode.appendChild(warning);
  }

  return endpointNode;
}

// ---------------------------------------------------------------------------
// Category rendering (with env filtering)
// ---------------------------------------------------------------------------

function renderCategories(data) {
  var results = data.results;
  var impactMap = data.impactMap || {};
  var dependencyGraph = data.dependencyGraph || {};

  // Build result map for quick status lookups
  var resultMap = {};
  for (var i = 0; i < results.length; i++) {
    resultMap[results[i].id] = results[i];
  }

  // Filter by environment
  var filtered = results;
  if (currentEnvFilter !== 'all') {
    filtered = results.filter(function(r) {
      return r.environment === currentEnvFilter;
    });
  }

  // Group by category
  var grouped = {};
  for (var j = 0; j < filtered.length; j++) {
    var r = filtered[j];
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  var container = document.getElementById('categories');
  while (container.firstChild) container.removeChild(container.firstChild);

  for (var c = 0; c < CATEGORY_ORDER.length; c++) {
    var cat = CATEGORY_ORDER[c];
    var endpoints = grouped[cat];
    if (!endpoints || endpoints.length === 0) continue;

    var upCount = 0;
    var degradedCount = 0;
    var downCount = 0;
    for (var e = 0; e < endpoints.length; e++) {
      if (endpoints[e].status === 'UP') upCount++;
      else if (endpoints[e].status === 'DEGRADED') degradedCount++;
      else if (endpoints[e].status === 'DOWN') downCount++;
    }

    var iconCfg = CATEGORY_ICONS[cat] || { text: '\u2022', bg: 'rgba(153,153,153,0.15)', color: '#999' };
    var iconNode = el('div', { className: 'category-icon' });
    iconNode.style.background = iconCfg.bg;
    iconNode.style.color = iconCfg.color;
    iconNode.textContent = iconCfg.text;

    // Color-coded count: green if all UP, orange if degraded, red if any down
    var countText = upCount + '/' + endpoints.length + ' up';
    var countClass = 'category-count';
    if (downCount > 0) countClass += ' color-down';
    else if (degradedCount > 0) countClass += ' color-degraded';
    else countClass += ' color-up';

    // Chevron for collapse/expand
    var isCollapsed = !!collapsedCategories[cat];
    var chevron = el('span', { className: 'category-chevron' + (isCollapsed ? ' collapsed' : ''), textContent: '\u25BE' });

    var headerDiv = el('div', { className: 'category-header' }, [
      iconNode,
      el('h2', { textContent: CATEGORY_LABELS[cat] || cat }),
      chevron,
      el('span', { className: countClass, textContent: countText }),
    ]);

    var list = el('div', { className: 'endpoint-list' + (isCollapsed ? ' collapsed' : '') }, endpoints.map(function(ep) {
      return renderEndpoint(ep, impactMap, dependencyGraph, resultMap);
    }));

    // Click handler for collapse/expand (closure over cat, list, chevron)
    (function(catKey, listNode, chevronNode) {
      headerDiv.addEventListener('click', function() {
        var nowCollapsed = !collapsedCategories[catKey];
        collapsedCategories[catKey] = nowCollapsed;
        if (nowCollapsed) {
          listNode.style.maxHeight = listNode.scrollHeight + 'px';
          listNode.offsetHeight; // force reflow
          listNode.classList.add('collapsed');
          listNode.style.maxHeight = '0';
          chevronNode.classList.add('collapsed');
        } else {
          listNode.classList.remove('collapsed');
          listNode.style.maxHeight = listNode.scrollHeight + 'px';
          chevronNode.classList.remove('collapsed');
          listNode.addEventListener('transitionend', function handler() {
            if (!collapsedCategories[catKey]) listNode.style.maxHeight = '';
            listNode.removeEventListener('transitionend', handler);
          });
        }
      });
    })(cat, list, chevron);

    var section = el('div', { className: 'category' }, [headerDiv, list]);
    container.appendChild(section);

    if (isCollapsed) {
      list.style.maxHeight = '0';
    }
  }
}

// ---------------------------------------------------------------------------
// Mini SVG dependency graph
// ---------------------------------------------------------------------------

function renderMiniGraph(r, graphNode, resultMap) {
  var dependsOn = graphNode.dependsOn || [];
  var requiredBy = graphNode.requiredBy || [];
  if (dependsOn.length === 0 && requiredBy.length === 0) return null;

  var nodeH = 28;
  var nodeGap = 6;
  var colW = 100;
  var arrowGap = 24;
  var leftCount = dependsOn.length;
  var rightCount = requiredBy.length;
  var maxCount = Math.max(leftCount, rightCount, 1);
  var svgH = maxCount * (nodeH + nodeGap) + 20;
  var svgW = colW * 3 + arrowGap * 2;

  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);
  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.style.display = 'block';

  var statusColors = {
    up: '#16A34A',
    degraded: '#EA580C',
    down: '#DC2626',
    unknown: '#9CA3AF',
  };

  function truncName(name, max) {
    if (!max) max = 13;
    return name.length > max ? name.substring(0, max) + '\u2026' : name;
  }

  function drawNode(x, y, name, status, isCenter) {
    var g = document.createElementNS(ns, 'g');
    var rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', colW);
    rect.setAttribute('height', nodeH);
    rect.setAttribute('rx', 6);
    rect.setAttribute('fill', isCenter ? '#FFF5F9' : '#F6F8FA');
    rect.setAttribute('stroke', isCenter ? '#F34499' : '#E5E7EB');
    rect.setAttribute('stroke-width', isCenter ? 1.5 : 1);
    g.appendChild(rect);

    // Status left border
    var border = document.createElementNS(ns, 'rect');
    border.setAttribute('x', x);
    border.setAttribute('y', y);
    border.setAttribute('width', 3);
    border.setAttribute('height', nodeH);
    border.setAttribute('rx', '1.5');
    border.setAttribute('fill', statusColors[status] || statusColors.unknown);
    g.appendChild(border);

    // Status dot
    var dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', x + 12);
    dot.setAttribute('cy', y + nodeH / 2);
    dot.setAttribute('r', 3);
    dot.setAttribute('fill', statusColors[status] || statusColors.unknown);
    g.appendChild(dot);

    // Name text
    var text = document.createElementNS(ns, 'text');
    text.setAttribute('x', x + 19);
    text.setAttribute('y', y + nodeH / 2 + 3.5);
    text.textContent = truncName(name);
    g.appendChild(text);

    return g;
  }

  function drawArrow(x1, y1, x2, y2, color) {
    var line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color || '#D1D5DB');
    line.setAttribute('stroke-width', 1.2);
    line.setAttribute('marker-end', 'url(#arrow-' + (color || 'gray').replace('#', '') + ')');
    return line;
  }

  // Arrow marker defs
  var defs = document.createElementNS(ns, 'defs');
  var colors = ['D1D5DB', '16A34A', 'EA580C', 'DC2626', '9CA3AF'];
  for (var ci = 0; ci < colors.length; ci++) {
    var marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', 'arrow-' + colors[ci]);
    marker.setAttribute('viewBox', '0 0 6 6');
    marker.setAttribute('refX', 5);
    marker.setAttribute('refY', 3);
    marker.setAttribute('markerWidth', 5);
    marker.setAttribute('markerHeight', 5);
    marker.setAttribute('orient', 'auto');
    var poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', '0,0 6,3 0,6');
    poly.setAttribute('fill', '#' + colors[ci]);
    marker.appendChild(poly);
    defs.appendChild(marker);
  }
  svg.appendChild(defs);

  // Center column
  var centerX = colW + arrowGap;
  var centerY = (svgH - nodeH) / 2;
  var rStatus = r.status ? r.status.toLowerCase() : 'unknown';
  svg.appendChild(drawNode(centerX, centerY, r.name, rStatus, true));

  // Left column (dependsOn)
  for (var li = 0; li < leftCount; li++) {
    var depId = dependsOn[li];
    var depR = resultMap[depId];
    var depName = depR ? depR.name : depId;
    var depStatus = depR ? depR.status.toLowerCase() : 'unknown';
    var ly = 10 + li * (nodeH + nodeGap);
    svg.appendChild(drawNode(0, ly, depName, depStatus, false));
    var arrowColor = statusColors[depStatus] || statusColors.unknown;
    svg.appendChild(drawArrow(colW, ly + nodeH / 2, centerX, centerY + nodeH / 2, arrowColor));
  }

  // Right column (requiredBy)
  for (var ri = 0; ri < rightCount; ri++) {
    var reqId = requiredBy[ri];
    var reqR = resultMap[reqId];
    var reqName = reqR ? reqR.name : reqId;
    var reqStatus = reqR ? reqR.status.toLowerCase() : 'unknown';
    var ry = 10 + ri * (nodeH + nodeGap);
    svg.appendChild(drawNode(centerX + colW + arrowGap, ry, reqName, reqStatus, false));
    var reqArrowColor = statusColors[rStatus] || statusColors.unknown;
    svg.appendChild(drawArrow(centerX + colW, centerY + nodeH / 2, centerX + colW + arrowGap, ry + nodeH / 2, reqArrowColor));
  }

  var wrapper = el('div', { className: 'dep-mini-graph' });
  wrapper.appendChild(svg);
  return wrapper;
}

// ---------------------------------------------------------------------------
// Dependency panel
// ---------------------------------------------------------------------------

function openDepPanel(r, dependencyGraph, resultMap) {
  var panel = document.getElementById('dep-panel');
  var overlay = document.getElementById('dep-overlay');
  var title = document.getElementById('dep-panel-title');
  var body = document.getElementById('dep-panel-body');

  title.textContent = r.name;
  while (body.firstChild) body.removeChild(body.firstChild);

  // ── Status row: badge + response time + env ──
  var statusClass = r.status ? r.status.toLowerCase() : 'unknown';
  var responseTime = r.responseTimeMs > 0 ? r.responseTimeMs + 'ms' : '\u2014';
  var statusRow = el('div', { className: 'detail-status-row' }, [
    el('span', { className: 'badge ' + statusClass, textContent: r.status || 'UNKNOWN' }),
    el('span', { className: 'detail-response-time', textContent: responseTime }),
    el('span', { className: 'env-badge env-' + r.environment, textContent: r.environment }),
  ]);
  body.appendChild(statusRow);

  // ── Description ──
  if (r.description) {
    body.appendChild(el('div', { className: 'detail-description', textContent: r.description }));
  }

  // ── Quick links: URL, Docs, Repo ──
  var links = el('div', { className: 'detail-quick-links' });
  // URL link
  if (r.url) {
    var urlBtn = el('a', { className: 'detail-link-btn', href: r.url, target: '_blank', rel: 'noopener' }, [
      el('span', { className: 'detail-link-icon', textContent: '\u{1F517}' }),
      el('span', { textContent: 'Open URL' }),
    ]);
    links.appendChild(urlBtn);
  }
  // Docs link
  var docsClass = 'detail-link-btn' + (r.docsUrl ? '' : ' disabled');
  var docsBtn = r.docsUrl
    ? el('a', { className: docsClass, href: r.docsUrl, target: '_blank', rel: 'noopener' }, [
        el('span', { className: 'detail-link-icon', textContent: '\uD83D\uDCD6' }),
        el('span', { textContent: 'Docs' }),
      ])
    : el('span', { className: docsClass }, [
        el('span', { className: 'detail-link-icon', textContent: '\uD83D\uDCD6' }),
        el('span', { textContent: 'Docs' }),
      ]);
  links.appendChild(docsBtn);
  // Repo link
  var repoClass = 'detail-link-btn' + (r.repoUrl ? '' : ' disabled');
  var repoBtn = r.repoUrl
    ? el('a', { className: repoClass, href: r.repoUrl, target: '_blank', rel: 'noopener' }, [
        el('span', { className: 'detail-link-icon', textContent: '\u{1F4BB}' }),
        el('span', { textContent: 'Repo' }),
      ])
    : el('span', { className: repoClass }, [
        el('span', { className: 'detail-link-icon', textContent: '\u{1F4BB}' }),
        el('span', { textContent: 'Repo' }),
      ]);
  links.appendChild(repoBtn);
  body.appendChild(links);

  // ── Owner card ──
  if (r.owner) {
    var initials = r.owner.name.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase();
    var ownerCard = el('div', { className: 'detail-owner' }, [
      el('div', { className: 'detail-owner-avatar', textContent: initials }),
      el('div', { className: 'detail-owner-info' }, [
        el('div', { className: 'detail-owner-name', textContent: r.owner.name }),
        el('div', { className: 'detail-owner-role', textContent: r.owner.role }),
        el('div', { className: 'detail-owner-contact', textContent: r.owner.contact }),
      ]),
    ]);
    body.appendChild(ownerCard);
  }

  // ── Tech tags ──
  if (r.tags && r.tags.length > 0) {
    var tagsContainer = el('div', { className: 'detail-tags' });
    for (var t = 0; t < r.tags.length; t++) {
      tagsContainer.appendChild(el('span', { className: 'detail-tag', textContent: r.tags[t] }));
    }
    body.appendChild(tagsContainer);
  }

  // ── Health components (from deep-health check) ──
  if (r.details && r.details.components) {
    var hcSection = el('div', { className: 'dep-section' });
    hcSection.appendChild(el('div', { className: 'dep-section-title', textContent: 'Health Components' }));
    var compKeys = Object.keys(r.details.components);
    for (var hc = 0; hc < compKeys.length; hc++) {
      var compKey = compKeys[hc];
      var comp = r.details.components[compKey];
      var compStatus = (typeof comp === 'object') ? (comp.status || comp.state || 'unknown') : String(comp);
      var isHealthy = /up|healthy|ok|pass/i.test(compStatus);
      var hcDotClass = isHealthy ? 'up' : 'down';
      var hcItem = el('div', { className: 'dep-item dep-item-border-' + hcDotClass }, [
        el('span', { className: 'dep-item-dot ' + hcDotClass }),
        el('span', { className: 'dep-item-name', textContent: compKey }),
        el('span', { className: 'dep-item-status color-' + hcDotClass, textContent: compStatus }),
      ]);
      hcSection.appendChild(hcItem);
    }
    body.appendChild(hcSection);
  }

  // ── Fallback notice ──
  if (r.details && r.details.fallback) {
    body.appendChild(el('div', { className: 'detail-description', textContent: 'No /health endpoint found — using basic reachability check as fallback.' }));
  }

  // ── Separator before dependencies ──
  var graphNode = dependencyGraph[r.id] || { dependsOn: [], requiredBy: [] };
  var hasDeps = (graphNode.dependsOn && graphNode.dependsOn.length > 0) ||
                (graphNode.requiredBy && graphNode.requiredBy.length > 0);
  if (hasDeps) {
    body.appendChild(el('div', { className: 'detail-separator' }));
  }

  // Mini SVG graph
  var miniGraph = renderMiniGraph(r, graphNode, resultMap);
  if (miniGraph) body.appendChild(miniGraph);

  // "Depends On" section with status-colored borders
  if (graphNode.dependsOn && graphNode.dependsOn.length > 0) {
    var depSection = el('div', { className: 'dep-section' });
    depSection.appendChild(el('div', { className: 'dep-section-title', textContent: 'Depends On (' + graphNode.dependsOn.length + ')' }));
    for (var i = 0; i < graphNode.dependsOn.length; i++) {
      var depId = graphNode.dependsOn[i];
      var depResult = resultMap[depId];
      var depStatus = depResult ? depResult.status.toLowerCase() : 'unknown';
      var depName = depResult ? depResult.name : depId;
      var depBlast = getBlastRadius(depId, dependencyGraph);
      var itemChildren = [
        el('span', { className: 'dep-item-dot ' + depStatus }),
        el('span', { className: 'dep-item-name', textContent: depName }),
        el('span', { className: 'dep-item-status color-' + depStatus, textContent: depResult ? depResult.status : 'N/A' }),
      ];
      if (depBlast > 0) {
        itemChildren.push(el('span', { className: 'blast-badge', textContent: '\u26A1 ' + depBlast }));
      }
      var item = el('div', { className: 'dep-item dep-item-border-' + depStatus }, itemChildren);
      depSection.appendChild(item);
    }
    body.appendChild(depSection);
  }

  // "Required By" section with status-colored borders
  if (graphNode.requiredBy && graphNode.requiredBy.length > 0) {
    var reqSection = el('div', { className: 'dep-section' });
    reqSection.appendChild(el('div', { className: 'dep-section-title', textContent: 'Required By (' + graphNode.requiredBy.length + ')' }));
    for (var j = 0; j < graphNode.requiredBy.length; j++) {
      var reqId = graphNode.requiredBy[j];
      var reqResult = resultMap[reqId];
      var reqStatus = reqResult ? reqResult.status.toLowerCase() : 'unknown';
      var reqName = reqResult ? reqResult.name : reqId;
      var reqBlast = getBlastRadius(reqId, dependencyGraph);
      var reqItemChildren = [
        el('span', { className: 'dep-item-dot ' + reqStatus }),
        el('span', { className: 'dep-item-name', textContent: reqName }),
        el('span', { className: 'dep-item-status color-' + reqStatus, textContent: reqResult ? reqResult.status : 'N/A' }),
      ];
      if (reqBlast > 0) {
        reqItemChildren.push(el('span', { className: 'blast-badge', textContent: '\u26A1 ' + reqBlast }));
      }
      var reqItem = el('div', { className: 'dep-item dep-item-border-' + reqStatus }, reqItemChildren);
      reqSection.appendChild(reqItem);
    }
    body.appendChild(reqSection);
  }

  // "Cascade Chain" section — full transitive tree if this goes down
  var cascadeLevels = buildCascadeTree(r.id, dependencyGraph);
  if (cascadeLevels.length > 0) {
    var totalCascade = 0;
    for (var cl = 0; cl < cascadeLevels.length; cl++) totalCascade += cascadeLevels[cl].length;

    var cascadeSection = el('div', { className: 'dep-section' });
    cascadeSection.appendChild(el('div', { className: 'dep-section-title', textContent: 'Cascade If Down (' + totalCascade + ' service' + (totalCascade > 1 ? 's' : '') + ')' }));

    for (var d = 0; d < cascadeLevels.length; d++) {
      var level = cascadeLevels[d];
      for (var li = 0; li < level.length; li++) {
        var cId = level[li];
        var cResult = resultMap[cId];
        var cStatus = cResult ? cResult.status.toLowerCase() : 'unknown';
        var cName = cResult ? cResult.name : cId;
        var isLast = (d === cascadeLevels.length - 1 && li === level.length - 1);
        var prefix = isLast ? '\u2514\u2500 ' : '\u251C\u2500 ';

        var cascadeItem = el('div', { className: 'dep-cascade-item' });
        cascadeItem.style.paddingLeft = ((d + 1) * 16) + 'px';
        cascadeItem.appendChild(el('span', { className: 'dep-cascade-depth', textContent: 'L' + (d + 1) }));
        cascadeItem.appendChild(el('span', { className: 'dep-item-dot ' + cStatus }));
        cascadeItem.appendChild(el('span', { className: 'dep-item-name', textContent: prefix + cName }));
        cascadeItem.appendChild(el('span', { className: 'dep-item-status color-' + cStatus, textContent: cResult ? cResult.status : 'N/A' }));
        cascadeSection.appendChild(cascadeItem);
      }
    }
    body.appendChild(cascadeSection);
  }

  // "Impact If Down" section
  if (r.impactDescription) {
    var impactSection = el('div', { className: 'dep-section' });
    impactSection.appendChild(el('div', { className: 'dep-section-title', textContent: 'Impact If Down' }));
    impactSection.appendChild(el('div', { className: 'dep-impact-text', textContent: r.impactDescription }));
    body.appendChild(impactSection);
  }

  // If nothing to show
  if (!body.firstChild) {
    body.appendChild(el('div', { className: 'dep-section', textContent: 'No information configured for this endpoint.' }));
  }

  panel.classList.add('open');
  overlay.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');

  // Track opener for focus return and move focus to panel title
  panelOpener = document.activeElement;
  title.setAttribute('tabindex', '-1');
  title.focus();
}

function closeDepPanel() {
  var panel = document.getElementById('dep-panel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  document.getElementById('dep-overlay').classList.remove('open');
  // Return focus to the element that opened the panel
  if (panelOpener && panelOpener.focus) {
    panelOpener.focus();
    panelOpener = null;
  }
}

// ---------------------------------------------------------------------------
// Minimal view rendering (app cards)
// ---------------------------------------------------------------------------

function computeWorstStatus(endpoints) {
  var hasDown = false;
  var hasDegraded = false;
  for (var i = 0; i < endpoints.length; i++) {
    if (endpoints[i].status === 'DOWN') hasDown = true;
    else if (endpoints[i].status === 'DEGRADED') hasDegraded = true;
  }
  if (hasDown) return 'down';
  if (hasDegraded) return 'degraded';
  return 'up';
}

function renderMinimalView(data) {
  var appGroups = data.appGroups || [];
  var results = data.results;
  var impactMap = data.impactMap || {};
  var dependencyGraph = data.dependencyGraph || {};

  // Build result map
  var resultMap = {};
  for (var i = 0; i < results.length; i++) {
    resultMap[results[i].id] = results[i];
  }

  // Filter by environment
  var filtered = results;
  if (currentEnvFilter !== 'all') {
    filtered = results.filter(function(r) {
      return r.environment === currentEnvFilter;
    });
  }
  var filteredIds = {};
  for (var f = 0; f < filtered.length; f++) {
    filteredIds[filtered[f].id] = true;
  }

  var container = document.getElementById('categories');
  while (container.firstChild) container.removeChild(container.firstChild);

  var grid = el('div', { className: 'app-grid' });

  for (var g = 0; g < appGroups.length; g++) {
    var group = appGroups[g];

    // Get endpoints in this group that match the current env filter
    var groupEndpoints = [];
    for (var e = 0; e < group.endpoints.length; e++) {
      var epId = group.endpoints[e];
      if (resultMap[epId] && filteredIds[epId]) {
        groupEndpoints.push(resultMap[epId]);
      }
    }

    // Skip empty groups (no endpoints match current filter)
    if (groupEndpoints.length === 0) continue;

    var worstStatus = computeWorstStatus(groupEndpoints);
    var upCount = groupEndpoints.filter(function(ep) { return ep.status === 'UP'; }).length;
    var countText = upCount + '/' + groupEndpoints.length + ' up';

    // Count class for coloring
    var countClass = 'app-card-count';
    if (worstStatus === 'down') countClass += ' color-down';
    else if (worstStatus === 'degraded') countClass += ' color-degraded';
    else countClass += ' color-up';

    // Status badge
    var statusLabel = worstStatus === 'up' ? 'UP' : worstStatus === 'degraded' ? 'DEGRADED' : 'DOWN';
    var badge = el('span', { className: 'badge ' + worstStatus, textContent: statusLabel });

    var isExpanded = !!expandedApps[group.id];

    var card = el('div', { className: 'app-card status-' + worstStatus + (isExpanded ? ' expanded' : ''), role: 'button', tabindex: '0', 'aria-expanded': isExpanded ? 'true' : 'false', 'aria-label': group.name + ' — ' + countText });

    var cardInfoChildren = [
      el('div', { className: 'app-card-name', textContent: group.name }),
      el('div', { className: countClass, textContent: countText }),
    ];
    if (group.description) {
      cardInfoChildren.splice(1, 0, el('div', { className: 'app-card-desc', textContent: group.description }));
    }

    var header = el('div', { className: 'app-card-header' }, [
      el('div', { className: 'app-card-left' }, [
        el('div', { className: 'app-card-icon', textContent: group.icon }),
        el('div', {}, cardInfoChildren),
      ]),
      el('div', { className: 'app-card-status' }, [
        badge,
        el('span', { className: 'app-card-chevron', textContent: '\u25BE' }),
      ]),
    ]);

    // Endpoint list (hidden by default, shown when expanded)
    var endpointList = el('div', { className: 'app-card-endpoints' });
    for (var ep = 0; ep < groupEndpoints.length; ep++) {
      endpointList.appendChild(renderEndpoint(groupEndpoints[ep], impactMap, dependencyGraph, resultMap));
    }

    card.appendChild(header);
    card.appendChild(endpointList);

    // Expand/collapse click + keyboard handler
    (function(cardNode, listNode, appId) {
      function toggleCard(e) {
        if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.endpoint')) return;

        var nowExpanded = !expandedApps[appId];
        expandedApps[appId] = nowExpanded;
        cardNode.setAttribute('aria-expanded', nowExpanded ? 'true' : 'false');

        if (nowExpanded) {
          cardNode.classList.add('expanded');
          listNode.style.maxHeight = listNode.scrollHeight + 'px';
          listNode.addEventListener('transitionend', function handler() {
            if (expandedApps[appId]) listNode.style.maxHeight = 'none';
            listNode.removeEventListener('transitionend', handler);
          });
        } else {
          listNode.style.maxHeight = listNode.scrollHeight + 'px';
          listNode.offsetHeight; // force reflow
          cardNode.classList.remove('expanded');
          listNode.style.maxHeight = '0';
        }
      }
      cardNode.addEventListener('click', toggleCard);
      cardNode.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCard(e);
        }
      });
    })(card, endpointList, group.id);

    // If already expanded (persisted state), show immediately without animation
    if (isExpanded) {
      endpointList.style.transition = 'none';
      endpointList.style.maxHeight = 'none';
      // Re-enable transitions after paint
      (function(listNode) {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            listNode.style.transition = '';
          });
        });
      })(endpointList);
    }

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

function initViewToggle() {
  var btns = document.querySelectorAll('.view-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function() {
      for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
      this.classList.add('active');
      currentViewMode = this.getAttribute('data-view');
      if (lastData) renderCurrentView(lastData);
    });
  }
}

function renderCurrentView(data) {
  if (currentSearchQuery) {
    renderSearchView(data);
  } else if (currentViewMode === 'minimal') {
    renderMinimalView(data);
  } else {
    renderCategories(data);
  }
}

// ---------------------------------------------------------------------------
// Environment tab handling
// ---------------------------------------------------------------------------

function initEnvTabs() {
  var tabs = document.querySelectorAll('.env-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() {
      // Update active tab
      for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
      this.classList.add('active');

      currentEnvFilter = this.getAttribute('data-env');

      // Re-render with cached data (no new API call)
      if (lastData) {
        var filtered = lastData.results;
        if (currentEnvFilter !== 'all') {
          filtered = lastData.results.filter(function(r) {
            return r.environment === currentEnvFilter;
          });
        }
        // Update summary counts for filtered view
        var filteredSummary = {
          timestamp: lastData.timestamp,
          total: filtered.length,
          up: filtered.filter(function(r) { return r.status === 'UP'; }).length,
          degraded: filtered.filter(function(r) { return r.status === 'DEGRADED'; }).length,
          down: filtered.filter(function(r) { return r.status === 'DOWN'; }).length,
        };
        renderSummary(filteredSummary);
        renderCurrentView(lastData);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function showError(msg) {
  var banner = document.getElementById('error-banner');
  document.getElementById('error-text').textContent = msg;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Main refresh loop
// ---------------------------------------------------------------------------

function refresh() {
  fetchHealth().then(function(data) {
    // Build new status map and detect changes
    var newStatusMap = {};
    for (var s = 0; s < data.results.length; s++) {
      newStatusMap[data.results[s].id] = data.results[s].status;
    }

    lastData = data;

    // Compute filtered summary if env tab is active
    var filtered = data.results;
    if (currentEnvFilter !== 'all') {
      filtered = data.results.filter(function(r) {
        return r.environment === currentEnvFilter;
      });
    }
    var summaryData = {
      timestamp: data.timestamp,
      total: filtered.length,
      up: filtered.filter(function(r) { return r.status === 'UP'; }).length,
      degraded: filtered.filter(function(r) { return r.status === 'DEGRADED'; }).length,
      down: filtered.filter(function(r) { return r.status === 'DOWN'; }).length,
    };

    renderSummary(summaryData);
    renderCurrentView(data);
    hideError();

    // Update status map for next diff
    previousStatusMap = newStatusMap;

    // Progress bar + countdown
    resetProgressBar();
    startCountdown();
  }).catch(function(err) {
    showError('Failed to fetch status: ' + err.message + '. Retrying in ' + (REFRESH_INTERVAL / 1000) + 's.');
    pauseCountdown();
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function matchesSearch(r, query) {
  if (!query) return true;
  var hay = (r.id + ' ' + r.name + ' ' + (r.description || '') + ' ' +
    (r.owner && r.owner.name ? r.owner.name : '') + ' ' +
    (r.tags ? r.tags.join(' ') : '')).toLowerCase();
  return hay.indexOf(query) !== -1;
}

function filterResults(results, query) {
  if (!query) return results;
  return results.filter(function(r) { return matchesSearch(r, query); });
}

function renderSearchView(data) {
  // Filter results by search query
  var filtered = filterResults(data.results, currentSearchQuery);

  // Also apply env filter
  if (currentEnvFilter !== 'all') {
    filtered = filtered.filter(function(r) { return r.environment === currentEnvFilter; });
  }

  // Update summary for filtered results
  var summaryData = {
    total: filtered.length,
    up: filtered.filter(function(r) { return r.status === 'UP'; }).length,
    degraded: filtered.filter(function(r) { return r.status === 'DEGRADED'; }).length,
    down: filtered.filter(function(r) { return r.status === 'DOWN'; }).length,
  };
  renderSummary(summaryData);

  if (filtered.length === 0) {
    var container = document.getElementById('categories');
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(el('div', { className: 'search-no-results' }, [
      el('span', { className: 'search-no-results-icon', textContent: '\uD83D\uDD0D' }),
      el('span', { textContent: 'No endpoints match "' + currentSearchQuery + '"' }),
    ]));
    return;
  }

  // Create a modified data object with filtered results
  var filteredData = {
    results: filtered,
    appGroups: data.appGroups,
    impactMap: data.impactMap,
    dependencyGraph: data.dependencyGraph,
    timestamp: data.timestamp,
  };

  if (currentViewMode === 'minimal') {
    renderMinimalView(filteredData);
    // Auto-expand matching app cards
    if (currentSearchQuery) {
      var cards = document.querySelectorAll('.app-card');
      for (var i = 0; i < cards.length; i++) {
        if (!cards[i].classList.contains('expanded')) {
          cards[i].click();
        }
      }
    }
  } else {
    renderCategories(filteredData);
  }
}

function initSearch() {
  var input = document.getElementById('search-input');
  var clearBtn = document.getElementById('search-clear');
  if (!input || !clearBtn) return;

  input.addEventListener('input', function() {
    var val = input.value.trim().toLowerCase();
    clearBtn.classList.toggle('hidden', val.length === 0);

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(function() {
      currentSearchQuery = val;
      if (lastData) renderSearchView(lastData);
    }, 200);
  });

  clearBtn.addEventListener('click', function() {
    input.value = '';
    clearBtn.classList.add('hidden');
    currentSearchQuery = '';
    if (lastData) {
      // Re-render full view with proper summary
      var filtered = lastData.results;
      if (currentEnvFilter !== 'all') {
        filtered = lastData.results.filter(function(r) { return r.environment === currentEnvFilter; });
      }
      var summaryData = {
        total: filtered.length,
        up: filtered.filter(function(r) { return r.status === 'UP'; }).length,
        degraded: filtered.filter(function(r) { return r.status === 'DEGRADED'; }).length,
        down: filtered.filter(function(r) { return r.status === 'DOWN'; }).length,
      };
      renderSummary(summaryData);
      renderCurrentView(lastData);
    }
  });
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function renderSkeleton() {
  var container = document.getElementById('categories');
  while (container.firstChild) container.removeChild(container.firstChild);
  var grid = el('div', { className: 'app-grid' });
  for (var i = 0; i < 6; i++) {
    grid.appendChild(el('div', { className: 'app-card skeleton-card' }, [
      el('div', { className: 'skeleton skeleton-header' }),
      el('div', { className: 'skeleton skeleton-line' }),
      el('div', { className: 'skeleton skeleton-line short' }),
    ]));
  }
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

initEnvTabs();
initViewToggle();
initSearch();
renderSkeleton(); // show skeleton before first data load

// Close panel handlers
document.getElementById('dep-panel-close').addEventListener('click', closeDepPanel);
document.getElementById('dep-overlay').addEventListener('click', closeDepPanel);
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeDepPanel();
});

// Initial load + auto-refresh
refresh();
setInterval(refresh, REFRESH_INTERVAL);

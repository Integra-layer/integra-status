// app.js — Integra Status Page (vanilla JS, auto-refresh 30s)
'use strict';

const REFRESH_INTERVAL = 30000;
const CATEGORY_LABELS = {
  blockchain: 'Blockchain',
  validators: 'Validators',
  apis: 'Backend APIs',
  frontends: 'Frontends & Explorers',
  external: 'External Dependencies',
};
const CATEGORY_ORDER = ['blockchain', 'validators', 'apis', 'frontends', 'external'];

async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') node.className = v;
      else if (k === 'textContent') node.textContent = v;
      else node.setAttribute(k, v);
    }
  }
  if (children) {
    for (const child of Array.isArray(children) ? children : [children]) {
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    }
  }
  return node;
}

function renderSummary(data) {
  document.getElementById('count-up').textContent = data.up;
  document.getElementById('count-up').className = 'count color-up';
  document.getElementById('count-degraded').textContent = data.degraded;
  document.getElementById('count-degraded').className = 'count color-degraded';
  document.getElementById('count-down').textContent = data.down;
  document.getElementById('count-down').className = 'count color-down';
  document.getElementById('count-total').textContent = data.total;

  const badge = document.getElementById('overall-status');
  badge.classList.remove('all-up', 'has-degraded', 'has-down', 'loading');
  if (data.down > 0) {
    badge.textContent = 'Partial Outage';
    badge.classList.add('has-down');
  } else if (data.degraded > 0) {
    badge.textContent = 'Degraded';
    badge.classList.add('has-degraded');
  } else {
    badge.textContent = 'All Systems Operational';
    badge.classList.add('all-up');
  }

  document.getElementById('last-updated').textContent = 'Updated ' + formatTime(data.timestamp);
}

function buildDetailNodes(r) {
  const parts = [];
  if (r.details.blockHeight) parts.push('Block: ' + r.details.blockHeight.toLocaleString());
  if (r.details.chainId) parts.push('Chain: ' + r.details.chainId);
  if (r.details.peerCount != null) parts.push('Peers: ' + r.details.peerCount);
  if (r.details.catchingUp != null) parts.push('Syncing: ' + (r.details.catchingUp ? 'Yes' : 'No'));
  if (r.details.bondedValidators != null) parts.push('Validators: ' + r.details.bondedValidators);
  if (r.details.blockAgeSec != null) parts.push('Block age: ' + r.details.blockAgeSec + 's');
  if (parts.length === 0) return null;
  return el('span', { className: 'detail', textContent: parts.join(' | ') });
}

function renderEndpoint(r) {
  const statusClass = r.status.toLowerCase();
  const responseTime = r.responseTimeMs > 0 ? r.responseTimeMs + 'ms' : '-';

  const left = el('div', { className: 'endpoint-left' }, [
    el('span', { className: 'status-dot ' + statusClass }),
    el('span', { className: 'endpoint-name', textContent: r.name }),
  ]);

  const rightChildren = [
    el('span', { className: 'badge ' + statusClass, textContent: r.status }),
  ];

  const detailNode = buildDetailNodes(r);
  if (detailNode) rightChildren.push(detailNode);
  if (r.error) rightChildren.push(el('span', { className: 'error-text', textContent: r.error }));
  rightChildren.push(el('span', { className: 'response-time', textContent: responseTime }));

  const right = el('div', { className: 'endpoint-right' }, rightChildren);
  return el('div', { className: 'endpoint' }, [left, right]);
}

function renderCategories(results) {
  const grouped = {};
  for (const r of results) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  const container = document.getElementById('categories');
  while (container.firstChild) container.removeChild(container.firstChild);

  for (const cat of CATEGORY_ORDER) {
    const endpoints = grouped[cat];
    if (!endpoints || endpoints.length === 0) continue;

    const list = el('div', { className: 'endpoint-list' }, endpoints.map(renderEndpoint));
    const section = el('div', { className: 'category' }, [
      el('h2', { textContent: CATEGORY_LABELS[cat] || cat }),
      list,
    ]);
    container.appendChild(section);
  }
}

function showError(msg) {
  const banner = document.getElementById('error-banner');
  document.getElementById('error-text').textContent = msg;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

async function refresh() {
  try {
    const data = await fetchHealth();
    renderSummary(data);
    renderCategories(data.results);
    hideError();
  } catch (err) {
    showError('Failed to fetch status: ' + err.message + '. Will retry in ' + (REFRESH_INTERVAL / 1000) + 's.');
  }
}

// Initial load + auto-refresh
refresh();
setInterval(refresh, REFRESH_INTERVAL);

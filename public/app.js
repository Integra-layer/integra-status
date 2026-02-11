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

function fetchHealth() {
  return fetch('/api/health').then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

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

function renderSummary(data) {
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

  document.getElementById('last-updated').textContent = formatTime(data.timestamp);
}

function buildDetailNodes(r) {
  var parts = [];
  if (r.details.blockHeight) parts.push('Block ' + r.details.blockHeight.toLocaleString());
  if (r.details.chainId) parts.push('Chain ' + r.details.chainId);
  if (r.details.peerCount != null) parts.push(r.details.peerCount + ' peers');
  if (r.details.catchingUp != null) parts.push(r.details.catchingUp ? 'Syncing' : 'Synced');
  if (r.details.bondedValidators != null) parts.push(r.details.bondedValidators + ' validators');
  if (r.details.blockAgeSec != null) parts.push(r.details.blockAgeSec + 's ago');
  if (parts.length === 0) return null;
  return el('span', { className: 'detail', textContent: parts.join(' \u00B7 ') });
}

function renderEndpoint(r) {
  var statusClass = r.status.toLowerCase();
  var responseTime = r.responseTimeMs > 0 ? r.responseTimeMs + 'ms' : '\u2014';

  var left = el('div', { className: 'endpoint-left' }, [
    el('span', { className: 'status-dot ' + statusClass }),
    el('span', { className: 'endpoint-name', textContent: r.name }),
  ]);

  var rightChildren = [
    el('span', { className: 'badge ' + statusClass, textContent: r.status }),
  ];

  var detailNode = buildDetailNodes(r);
  if (detailNode) rightChildren.push(detailNode);
  if (r.error) rightChildren.push(el('span', { className: 'error-text', textContent: r.error }));
  rightChildren.push(el('span', { className: 'response-time', textContent: responseTime }));

  var right = el('div', { className: 'endpoint-right' }, rightChildren);
  return el('div', { className: 'endpoint' }, [left, right]);
}

function renderCategories(results) {
  var grouped = {};
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
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
    for (var e = 0; e < endpoints.length; e++) {
      if (endpoints[e].status === 'UP') upCount++;
    }

    var iconCfg = CATEGORY_ICONS[cat] || { text: '\u2022', bg: 'rgba(153,153,153,0.15)', color: '#999' };
    var iconNode = el('div', { className: 'category-icon' });
    iconNode.style.background = iconCfg.bg;
    iconNode.style.color = iconCfg.color;
    iconNode.textContent = iconCfg.text;

    var countText = upCount + '/' + endpoints.length + ' up';
    var headerDiv = el('div', { className: 'category-header' }, [
      iconNode,
      el('h2', { textContent: CATEGORY_LABELS[cat] || cat }),
      el('span', { className: 'category-count', textContent: countText }),
    ]);

    var list = el('div', { className: 'endpoint-list' }, endpoints.map(renderEndpoint));
    var section = el('div', { className: 'category' }, [headerDiv, list]);
    container.appendChild(section);
  }
}

function showError(msg) {
  var banner = document.getElementById('error-banner');
  document.getElementById('error-text').textContent = msg;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

function refresh() {
  fetchHealth().then(function(data) {
    renderSummary(data);
    renderCategories(data.results);
    hideError();
  }).catch(function(err) {
    showError('Failed to fetch status: ' + err.message + '. Retrying in ' + (REFRESH_INTERVAL / 1000) + 's.');
  });
}

// Initial load + auto-refresh
refresh();
setInterval(refresh, REFRESH_INTERVAL);

// lib/health.js — Health check engine for Integra status page
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const config = require('./health-config.js');

function httpRequest(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const timeout = opts.timeout || 10000;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: opts.method || 'GET',
      headers: { 'User-Agent': 'integra-health/1.0', ...(opts.headers || {}) },
      timeout,
      rejectUnauthorized: false,
    };
    const start = Date.now();
    const req = mod.request(reqOpts, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { resolve({ statusCode: res.statusCode, headers: res.headers, body, responseTimeMs: Date.now() - start }); });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', (err) => reject(err));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function jsonRpc(url, method, params = [], timeout) {
  return httpRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), timeout });
}

// ---------------------------------------------------------------------------
// Check functions
// ---------------------------------------------------------------------------

async function checkEvmRpc(ep) {
  const details = {}; const start = Date.now();
  const blockRes = await jsonRpc(ep.url, 'eth_blockNumber', [], ep.timeout);
  const blockData = JSON.parse(blockRes.body);
  if (blockData.error) throw new Error(blockData.error.message || 'eth_blockNumber failed');
  details.blockHeight = parseInt(blockData.result, 16);
  const chainRes = await jsonRpc(ep.url, 'eth_chainId', [], ep.timeout);
  const chainData = JSON.parse(chainRes.body);
  details.chainId = chainData.result;
  if (ep.expectedChainId && chainData.result !== ep.expectedChainId) {
    return result(ep, 'DEGRADED', Date.now() - start, details, `Chain ID mismatch: expected ${ep.expectedChainId}, got ${chainData.result}`);
  }
  const syncRes = await jsonRpc(ep.url, 'eth_syncing', [], ep.timeout);
  const syncData = JSON.parse(syncRes.body);
  details.syncing = syncData.result !== false;
  if (details.syncing) return result(ep, 'DEGRADED', Date.now() - start, details, 'Node is syncing');
  const peerRes = await jsonRpc(ep.url, 'net_peerCount', [], ep.timeout);
  const peerData = JSON.parse(peerRes.body);
  details.peerCount = peerData.result ? parseInt(peerData.result, 16) : null;
  return result(ep, 'UP', Date.now() - start, details);
}

async function checkCosmosRpc(ep) {
  const details = {}; const start = Date.now();
  const statusRes = await httpRequest(`${ep.url}/status`, { timeout: ep.timeout });
  if (statusRes.statusCode !== 200) throw new Error(`HTTP ${statusRes.statusCode}`);
  const statusData = JSON.parse(statusRes.body);
  const syncInfo = statusData.result ? statusData.result.sync_info : statusData.sync_info;
  if (syncInfo) {
    details.blockHeight = parseInt(syncInfo.latest_block_height, 10);
    details.latestBlockTime = syncInfo.latest_block_time;
    details.catchingUp = syncInfo.catching_up;
    const blockAge = (Date.now() - new Date(syncInfo.latest_block_time).getTime()) / 1000;
    details.blockAgeSec = Math.round(blockAge);
    if (blockAge > config.CHAIN_HALT_THRESHOLD_SECONDS) return result(ep, 'DEGRADED', Date.now() - start, details, `Possible chain halt — last block ${Math.round(blockAge)}s ago`);
    if (syncInfo.catching_up) return result(ep, 'DEGRADED', Date.now() - start, details, 'Node is catching up');
  }
  try {
    const netRes = await httpRequest(`${ep.url}/net_info`, { timeout: ep.timeout });
    if (netRes.statusCode === 200) {
      const netData = JSON.parse(netRes.body);
      const peers = netData.result ? netData.result.peers : netData.peers;
      details.peerCount = Array.isArray(peers) ? peers.length : (parseInt(netData.result?.n_peers, 10) || null);
    }
  } catch (_) {}
  return result(ep, 'UP', Date.now() - start, details);
}

async function checkCosmosRest(ep) {
  const details = {}; const start = Date.now();
  const blockRes = await httpRequest(`${ep.url}/cosmos/base/tendermint/v1beta1/blocks/latest`, { timeout: ep.timeout });
  if (blockRes.statusCode !== 200) throw new Error(`HTTP ${blockRes.statusCode}`);
  const blockData = JSON.parse(blockRes.body);
  const header = blockData.block?.header || blockData.sdk_block?.header;
  if (header) {
    details.blockHeight = parseInt(header.height, 10);
    details.latestBlockTime = header.time;
    details.chainId = header.chain_id;
    const blockAge = (Date.now() - new Date(header.time).getTime()) / 1000;
    details.blockAgeSec = Math.round(blockAge);
    if (blockAge > config.CHAIN_HALT_THRESHOLD_SECONDS) return result(ep, 'DEGRADED', Date.now() - start, details, `Possible chain halt — last block ${Math.round(blockAge)}s ago`);
  }
  try {
    const valRes = await httpRequest(`${ep.url}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`, { timeout: ep.timeout });
    if (valRes.statusCode === 200) { const valData = JSON.parse(valRes.body); details.bondedValidators = valData.validators ? valData.validators.length : null; }
  } catch (_) {}
  return result(ep, 'UP', Date.now() - start, details);
}

async function checkHttpJson(ep) {
  const start = Date.now();
  const res = await httpRequest(ep.url, { timeout: ep.timeout });
  if (res.statusCode < 200 || res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
  const data = JSON.parse(res.body);
  const details = { statusCode: res.statusCode };
  if (ep.expectedField && !(ep.expectedField in data)) return result(ep, 'DEGRADED', Date.now() - start, details, `Missing expected field: ${ep.expectedField}`);
  return result(ep, 'UP', Date.now() - start, details);
}

async function checkHttpGet(ep) {
  const start = Date.now();
  const res = await httpRequest(ep.url, { timeout: ep.timeout });
  if (res.statusCode >= 200 && res.statusCode < 400) return result(ep, 'UP', Date.now() - start, { statusCode: res.statusCode });
  throw new Error(`HTTP ${res.statusCode}`);
}

async function checkWebsocket(ep) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const parsed = new URL(ep.url.replace('wss://', 'https://').replace('ws://', 'http://'));
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname || '/', method: 'GET',
      headers: { 'Upgrade': 'websocket', 'Connection': 'Upgrade', 'Sec-WebSocket-Key': Buffer.from(Math.random().toString()).toString('base64'), 'Sec-WebSocket-Version': '13' },
      timeout: ep.timeout, rejectUnauthorized: false,
    });
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(result(ep, 'UP', Date.now() - start, { upgraded: true })); });
    req.on('response', (res) => { res.statusCode < 400 ? resolve(result(ep, 'UP', Date.now() - start, { statusCode: res.statusCode })) : reject(new Error(`HTTP ${res.statusCode}`)); });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// New check types
// ---------------------------------------------------------------------------

/** api-health: GET a /health endpoint, parse JSON body for status/version */
async function checkApiHealth(ep) {
  const start = Date.now();
  const res = await httpRequest(ep.url, { timeout: ep.timeout });
  const details = { statusCode: res.statusCode };
  if (res.statusCode >= 200 && res.statusCode < 400) {
    try {
      const data = JSON.parse(res.body);
      if (data.status) details.healthStatus = data.status;
      if (data.version) details.version = data.version;
    } catch (_) { /* body may not be JSON — that's ok, status code is enough */ }
    return result(ep, 'UP', Date.now() - start, details);
  }
  throw new Error(`HTTP ${res.statusCode}`);
}

/** http-reachable: any non-5xx means UP (401/403 = service is running, just needs auth) */
async function checkHttpReachable(ep) {
  const start = Date.now();
  const res = await httpRequest(ep.url, { timeout: ep.timeout });
  const details = { statusCode: res.statusCode };
  if (res.statusCode < 500) return result(ep, 'UP', Date.now() - start, details);
  throw new Error(`HTTP ${res.statusCode}`);
}

/** graphql: POST introspection query, check response for data or errors */
async function checkGraphql(ep) {
  const start = Date.now();
  const body = JSON.stringify({ query: '{ __typename }' });
  const res = await httpRequest(ep.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body,
    timeout: ep.timeout,
  });
  const details = { statusCode: res.statusCode };
  if (res.statusCode >= 200 && res.statusCode < 400) {
    try {
      const data = JSON.parse(res.body);
      if (data.data) return result(ep, 'UP', Date.now() - start, details);
      if (data.errors) return result(ep, 'DEGRADED', Date.now() - start, details, data.errors[0]?.message || 'GraphQL errors');
    } catch (_) {}
    return result(ep, 'UP', Date.now() - start, details);
  }
  throw new Error(`HTTP ${res.statusCode}`);
}

/** deep-health: GET /health endpoint, parse JSON for component statuses, fall back to http-reachable if 404 */
async function checkDeepHealth(ep) {
  const start = Date.now();
  const healthUrl = ep.healthUrl || ep.url + '/health';
  const res = await httpRequest(healthUrl, { timeout: ep.timeout });
  const details = { statusCode: res.statusCode };

  // No health endpoint — fall back to basic reachability
  if (res.statusCode === 404) {
    const fallbackRes = await httpRequest(ep.url, { timeout: ep.timeout });
    if (fallbackRes.statusCode < 500) return result(ep, 'UP', Date.now() - start, { statusCode: fallbackRes.statusCode, fallback: true });
    throw new Error('HTTP ' + fallbackRes.statusCode);
  }

  if (res.statusCode >= 200 && res.statusCode < 400) {
    try {
      const data = JSON.parse(res.body);
      if (data.status) details.healthStatus = data.status;
      if (data.version) details.version = data.version;
      if (data.uptime) details.uptime = data.uptime;
      // Check sub-components (db, cache, etc.)
      var components = data.components || data.checks || data.dependencies;
      if (components) {
        details.components = components;
        var keys = Object.keys(components);
        for (var i = 0; i < keys.length; i++) {
          var comp = components[keys[i]];
          var compStatus = (typeof comp === 'object') ? (comp.status || comp.state) : comp;
          if (compStatus && /down|unhealthy|error|fail/i.test(String(compStatus))) {
            return result(ep, 'DEGRADED', Date.now() - start, details, keys[i] + ' is unhealthy');
          }
        }
      }
      if (data.status && /down|unhealthy|error/i.test(data.status)) {
        return result(ep, 'DEGRADED', Date.now() - start, details, 'Health reports: ' + data.status);
      }
      return result(ep, 'UP', Date.now() - start, details);
    } catch (_) {
      return result(ep, 'UP', Date.now() - start, details);
    }
  }
  throw new Error('HTTP ' + res.statusCode);
}

/** cosmos-peer-check: verify a validator is connected by checking if its IP appears in a public RPC's /net_info peer list */
async function checkCosmosPeer(ep) {
  const start = Date.now();
  const peerIp = ep.peerIp || new URL(ep.url).hostname;
  const publicRpc = ep.publicRpc || 'https://rpc.integralayer.com';
  const res = await httpRequest(`${publicRpc}/net_info`, { timeout: ep.timeout });
  if (res.statusCode !== 200) throw new Error(`Public RPC returned HTTP ${res.statusCode}`);
  const data = JSON.parse(res.body);
  const peers = (data.result && data.result.peers) || [];
  const details = { totalPeers: peers.length };
  for (let i = 0; i < peers.length; i++) {
    if (peers[i].remote_ip === peerIp) {
      details.moniker = peers[i].node_info ? peers[i].node_info.moniker : null;
      details.peerId = peers[i].node_info ? peers[i].node_info.id : null;
      return result(ep, 'UP', Date.now() - start, details);
    }
  }
  return result(ep, 'DEGRADED', Date.now() - start, details, 'Validator not found in peer list');
}

// ---------------------------------------------------------------------------
// Result builder — enriched with environment + dependency info
// ---------------------------------------------------------------------------

function result(ep, status, responseTimeMs, details, error) {
  return {
    id: ep.id,
    name: ep.name,
    url: ep.url,
    category: ep.category,
    environment: ep.environment || 'prod',
    status: status,
    responseTimeMs: responseTimeMs,
    timestamp: new Date().toISOString(),
    details: details || {},
    error: error || null,
    dependsOn: ep.dependsOn || [],
    impacts: ep.impacts || [],
    impactDescription: ep.impactDescription || null,
    description: ep.description || null,
    owner: ep.owner || null,
    docsUrl: ep.docsUrl || null,
    repoUrl: ep.repoUrl || null,
    tags: ep.tags || [],
  };
}

// ---------------------------------------------------------------------------
// Check registry + runner
// ---------------------------------------------------------------------------

const CHECK_FNS = {
  'evm-rpc': checkEvmRpc,
  'cosmos-rpc': checkCosmosRpc,
  'cosmos-rest': checkCosmosRest,
  'http-json': checkHttpJson,
  'http-get': checkHttpGet,
  'websocket': checkWebsocket,
  'api-health': checkApiHealth,
  'http-reachable': checkHttpReachable,
  'deep-health': checkDeepHealth,
  'graphql': checkGraphql,
  'cosmos-peer-check': checkCosmosPeer,
};

async function runCheck(ep) {
  const fn = CHECK_FNS[ep.checkType];
  if (!fn) return result(ep, 'DOWN', 0, {}, `Unknown check type: ${ep.checkType}`);
  try { return await fn(ep); } catch (err) {
    const isFirewall = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'EHOSTUNREACH';
    const status = (ep.category === 'validators' && isFirewall) ? 'DEGRADED' : 'DOWN';
    const errMsg = (ep.category === 'validators' && isFirewall) ? 'Unreachable (likely firewalled)' : (err.message || String(err));
    return result(ep, status, 0, {}, errMsg);
  }
}

async function checkAll(opts) {
  const endpoints = config.getEndpoints(Object.assign({ enabledOnly: true }, opts || {}));
  const results = await Promise.allSettled(endpoints.map(runCheck));
  return results.map((r, i) => r.status === 'fulfilled' ? r.value : result(endpoints[i], 'DOWN', 0, {}, r.reason?.message || 'Check failed'));
}

module.exports = { checkAll };

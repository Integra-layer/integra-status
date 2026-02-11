// lib/health-config.js — Endpoint registry for Integra status page
'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = ['blockchain', 'validators', 'apis', 'frontends', 'external'];
const ENVIRONMENTS = ['prod', 'dev', 'staging', 'release'];
const CHAIN_HALT_THRESHOLD_SECONDS = 60;

// ---------------------------------------------------------------------------
// App groups (for minimal view)
// ---------------------------------------------------------------------------

const APP_GROUPS = [
  { id: 'dashboard', name: 'Dashboard', icon: '\uD83D\uDCCA', endpoints: ['dashboard-prod', 'dashboard-dev', 'dashboard-api-prod', 'dashboard-api-dev', 'notification-api-prod', 'notification-api-dev', 'price-api'] },
  { id: 'explorer', name: 'Explorer', icon: '\uD83D\uDD0D', endpoints: ['explorer-mainnet', 'explorer-testnet', 'mainnet-cosmos-rpc', 'mainnet-cosmos-rest', 'testnet-cosmos-rpc', 'testnet-cosmos-rest'] },
  { id: 'city', name: 'City of Integra', icon: '\uD83C\uDFD9\uFE0F', endpoints: ['city-prod', 'city-dev', 'city-api-prod', 'city-api-dev'] },
  { id: 'portal', name: 'XP Portal', icon: '\u2B50', endpoints: ['portal', 'absinthe-api'] },
  { id: 'blockchain', name: 'Blockchain Nodes', icon: '\u26D3\uFE0F', endpoints: ['mainnet-evm-rpc', 'testnet-evm-rpc'] },
  { id: 'validators', name: 'Validators', icon: '\u26A1', endpoints: ['validator-1', 'validator-2', 'validator-3', 'validator-adam'] },
  { id: 'sites', name: 'Websites & Docs', icon: '\uD83C\uDF10', endpoints: ['main-website', 'docs-site', 'whitepaper', 'staking', 'datastore'] },
  { id: 'standalone', name: 'Other APIs', icon: '\u2699\uFE0F', endpoints: ['supply-api', 'presign-api', 'upload-tracker-api'] },
  { id: 'external', name: 'External Services', icon: '\u2197\uFE0F', endpoints: [] }, // filled dynamically below
];

// ---------------------------------------------------------------------------
// Endpoint registry
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  // ── Blockchain (Mainnet — integra-1, EVM chain 26217) ──────────────────
  { id: 'mainnet-evm-rpc', name: 'Mainnet EVM RPC', category: 'blockchain', environment: 'prod', url: 'https://evm.integralayer.com', checkType: 'evm-rpc', timeout: 10000, enabled: true, expectedChainId: '0x6669', dependsOn: [], impacts: ['dashboard-api-prod'], impactDescription: 'Dashboard API loses EVM data — balances and transactions unavailable' },
  { id: 'mainnet-evm-ws', name: 'Mainnet EVM WebSocket', category: 'blockchain', environment: 'prod', url: 'wss://ws.integralayer.com', checkType: 'websocket', timeout: 10000, enabled: false, dependsOn: [], impacts: [] },
  { id: 'mainnet-cosmos-rpc', name: 'Mainnet Cosmos RPC', category: 'blockchain', environment: 'prod', url: 'https://rpc.integralayer.com', checkType: 'cosmos-rpc', timeout: 10000, enabled: true, dependsOn: [], impacts: ['explorer-mainnet'], impactDescription: 'Mainnet explorer loses real-time block data' },
  { id: 'mainnet-cosmos-rpc2', name: 'Mainnet Cosmos RPC 2', category: 'blockchain', environment: 'prod', url: 'https://rpc2.integralayer.com', checkType: 'cosmos-rpc', timeout: 10000, enabled: false, dependsOn: [], impacts: [] },
  { id: 'mainnet-cosmos-rest', name: 'Mainnet REST/LCD', category: 'blockchain', environment: 'prod', url: 'https://api.integralayer.com', checkType: 'cosmos-rest', timeout: 10000, enabled: true, dependsOn: [], impacts: ['explorer-mainnet'], impactDescription: 'Mainnet explorer loses validator and governance data' },

  // ── Blockchain (Testnet — ormos-1, EVM chain 26218) ────────────────────
  { id: 'testnet-evm-rpc', name: 'Testnet EVM RPC', category: 'blockchain', environment: 'dev', url: 'https://testnet-evm.integralayer.com', checkType: 'evm-rpc', timeout: 10000, enabled: true, expectedChainId: '0x666a', dependsOn: [], impacts: [] },
  { id: 'testnet-cosmos-rpc', name: 'Testnet Cosmos RPC', category: 'blockchain', environment: 'dev', url: 'https://testnet-rpc.integralayer.com', checkType: 'cosmos-rpc', timeout: 10000, enabled: true, dependsOn: [], impacts: ['explorer-testnet'], impactDescription: 'Testnet explorer loses real-time block data' },
  { id: 'testnet-cosmos-rest', name: 'Testnet REST/LCD', category: 'blockchain', environment: 'dev', url: 'https://testnet-api.integralayer.com', checkType: 'cosmos-rest', timeout: 10000, enabled: true, dependsOn: [], impacts: ['explorer-testnet'], impactDescription: 'Testnet explorer loses validator and governance data' },

  // ── Validators (mainnet) ───────────────────────────────────────────────
  { id: 'validator-1', name: 'Validator 1', category: 'validators', environment: 'prod', url: 'http://165.227.118.77:26657', checkType: 'cosmos-peer-check', peerIp: '3.92.110.107', publicRpc: 'https://rpc.integralayer.com', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },
  { id: 'validator-2', name: 'Validator 2', category: 'validators', environment: 'prod', url: 'http://159.65.168.118:26657', checkType: 'cosmos-peer-check', peerIp: '159.65.168.118', publicRpc: 'https://rpc.integralayer.com', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },
  { id: 'validator-3', name: 'Validator 3', category: 'validators', environment: 'prod', url: 'http://104.131.34.167:26657', checkType: 'cosmos-peer-check', peerIp: '104.131.34.167', publicRpc: 'https://rpc.integralayer.com', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },
  { id: 'validator-adam', name: "Adam's Node (AWS SG)", category: 'validators', environment: 'prod', url: 'http://18.140.134.114:26657', checkType: 'cosmos-peer-check', peerIp: '94.207.99.127', publicRpc: 'https://rpc.integralayer.com', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },

  // ── Backend APIs ───────────────────────────────────────────────────────
  { id: 'passport-api', name: 'Passport API', category: 'apis', environment: 'prod', url: 'https://passport-apis.integralayer.com/health/database', checkType: 'api-health', timeout: 10000, enabled: false, dependsOn: ['web3auth', 'google-oauth'], impacts: [] },
  { id: 'dashboard-api-prod', name: 'Dashboard API', category: 'apis', environment: 'prod', url: 'https://dashboard-apis.integralayer.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: ['absinthe-api'], impacts: ['dashboard-prod'], impactDescription: 'Production dashboard fully unavailable' },
  { id: 'dashboard-api-dev', name: 'Dashboard API (Dev)', category: 'apis', environment: 'dev', url: 'https://dev-dashboard-apis.integralayer.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: ['absinthe-api'], impacts: ['dashboard-dev'], impactDescription: 'Dev dashboard fully unavailable' },
  { id: 'notification-api-prod', name: 'Notification API', category: 'apis', environment: 'prod', url: 'https://production-apis.integralayer.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-prod'], impactDescription: 'Dashboard notifications and alerts stop working' },
  { id: 'notification-api-dev', name: 'Notification API (Dev)', category: 'apis', environment: 'dev', url: 'https://develop-apis.integralayer.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-dev'], impactDescription: 'Dev dashboard notifications stop working' },
  { id: 'city-api-prod', name: 'City of Integra API', category: 'apis', environment: 'prod', url: 'https://ng6mpgxjz7.ap-south-1.awsapprunner.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['city-prod'], impactDescription: 'City builder game unavailable' },
  { id: 'city-api-dev', name: 'City of Integra API (Dev)', category: 'apis', environment: 'dev', url: 'https://ygmwadph3x.ap-south-1.awsapprunner.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['city-dev'], impactDescription: 'Dev city builder unavailable' },
  { id: 'supply-api', name: 'Circulating Supply', category: 'apis', environment: 'prod', url: 'https://supply.polytrade.finance', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },
  { id: 'price-api', name: 'Pricing API', category: 'apis', environment: 'prod', url: 'https://price.api.polytrade.app', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-prod'], impactDescription: 'Token prices missing from dashboard' },
  { id: 'presign-api', name: 'Presigned URL API', category: 'apis', environment: 'prod', url: 'https://presign.api.polytrade.app', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },
  { id: 'upload-tracker-api', name: 'Upload Tracker', category: 'apis', environment: 'prod', url: 'https://upload-tracker.api.polytrade.app', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },

  // ── Frontends & Explorers ──────────────────────────────────────────────
  { id: 'explorer-mainnet', name: 'Explorer (Mainnet)', category: 'frontends', environment: 'prod', url: 'https://explorer.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['mainnet-cosmos-rpc', 'mainnet-cosmos-rest'], impacts: [] },
  { id: 'explorer-testnet', name: 'Explorer (Testnet)', category: 'frontends', environment: 'dev', url: 'https://testnet.explorer.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['testnet-cosmos-rpc', 'testnet-cosmos-rest'], impacts: [] },
  { id: 'docs-site', name: 'Documentation', category: 'frontends', environment: 'prod', url: 'https://docs.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['vercel'], impacts: [] },
  { id: 'main-website', name: 'Integra Website', category: 'frontends', environment: 'prod', url: 'https://integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['vercel'], impacts: [] },
  { id: 'dashboard-prod', name: 'Dashboard', category: 'frontends', environment: 'prod', url: 'https://dashboard.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['dashboard-api-prod'], impacts: [] },
  { id: 'dashboard-dev', name: 'Dashboard (Dev)', category: 'frontends', environment: 'dev', url: 'https://dev-dashboard.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['dashboard-api-dev'], impacts: [] },
  { id: 'city-prod', name: 'City Builder', category: 'frontends', environment: 'prod', url: 'https://city.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['city-api-prod'], impacts: [] },
  { id: 'city-dev', name: 'City Builder (Dev)', category: 'frontends', environment: 'dev', url: 'https://dev-city.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['city-api-dev'], impacts: [] },
  { id: 'whitepaper', name: 'Whitepaper', category: 'frontends', environment: 'prod', url: 'https://whitepaper.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },
  { id: 'portal', name: 'XP Portal', category: 'frontends', environment: 'prod', url: 'https://portal.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['absinthe-api'], impacts: [] },
  { id: 'staking', name: 'Staking App', category: 'frontends', environment: 'prod', url: 'https://staking.polytrade.finance', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: ['vercel'], impacts: [] },
  { id: 'landing', name: 'Landing Page', category: 'frontends', environment: 'prod', url: 'https://get.polytrade.finance', checkType: 'http-get', timeout: 10000, enabled: false, dependsOn: ['vercel'], impacts: [] },
  { id: 'datastore', name: 'NFT Datastore', category: 'frontends', environment: 'prod', url: 'https://datastore.polytrade.app', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },

  // ── External Dependencies ──────────────────────────────────────────────
  { id: 'github-integra-layer', name: 'GitHub (Integra-layer)', category: 'external', environment: 'prod', url: 'https://api.github.com/orgs/Integra-layer', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },
  { id: 'github-polytrade', name: 'GitHub (polytrade-finance)', category: 'external', environment: 'prod', url: 'https://api.github.com/orgs/polytrade-finance', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [] },
  { id: 'absinthe-api', name: 'Absinthe XP', category: 'external', environment: 'prod', url: 'https://gql3.absinthe.network', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-api-prod', 'dashboard-api-dev', 'portal'], impactDescription: 'Dashboard XP features break, portal unusable' },
  { id: 'web3auth', name: 'Web3Auth', category: 'external', environment: 'prod', url: 'https://lookup.web3auth.io', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['passport-api'], impactDescription: 'Wallet pregeneration fails' },
  { id: 'openai-api', name: 'OpenAI', category: 'external', environment: 'prod', url: 'https://api.openai.com/v1/models', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], impactDescription: 'Title deed extraction fails' },
  { id: 'alchemy-rpc', name: 'Alchemy', category: 'external', environment: 'prod', url: 'https://eth-mainnet.g.alchemy.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], impactDescription: 'Webhook events stop, RPC fallback lost' },
  { id: 'twitter-api', name: 'Twitter/X', category: 'external', environment: 'prod', url: 'https://api.twitter.com/2', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-prod'], impactDescription: 'Tweet display on dashboard fails' },
  { id: 'google-oauth', name: 'Google OAuth', category: 'external', environment: 'prod', url: 'https://accounts.google.com/.well-known/openid-configuration', checkType: 'http-json', timeout: 10000, enabled: true, dependsOn: [], impacts: ['passport-api'], impactDescription: 'Social login breaks' },
  { id: 'dicebear-api', name: 'DiceBear Avatars', category: 'external', environment: 'prod', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=test', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: [], impacts: ['city-prod', 'city-dev'], impactDescription: 'City builder avatars break' },
  { id: 'walletconnect', name: 'WalletConnect', category: 'external', environment: 'prod', url: 'https://relay.walletconnect.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-prod'], impactDescription: 'Wallet connections fail' },
  { id: 'vercel', name: 'Vercel Platform', category: 'external', environment: 'prod', url: 'https://vercel.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: [], impacts: ['docs-site', 'main-website', 'staking', 'landing'], impactDescription: 'Docs, staking, landing go down' },
];

// ---------------------------------------------------------------------------
// Auto-fill external group with any external endpoints not claimed by others
// ---------------------------------------------------------------------------

(function() {
  var claimed = {};
  for (var g = 0; g < APP_GROUPS.length; g++) {
    if (APP_GROUPS[g].id === 'external') continue;
    var eps = APP_GROUPS[g].endpoints;
    for (var e = 0; e < eps.length; e++) claimed[eps[e]] = true;
  }
  var extGroup = APP_GROUPS.find(function(g) { return g.id === 'external'; });
  for (var i = 0; i < ENDPOINTS.length; i++) {
    if (ENDPOINTS[i].category === 'external' && !claimed[ENDPOINTS[i].id]) {
      extGroup.endpoints.push(ENDPOINTS[i].id);
    }
  }
})();

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function getEndpoints(opts) {
  if (!opts) opts = {};
  var eps = ENDPOINTS;
  if (opts.enabledOnly !== false) eps = eps.filter(function(e) { return e.enabled; });
  if (opts.category) eps = eps.filter(function(e) { return e.category === opts.category; });
  if (opts.environment) eps = eps.filter(function(e) { return e.environment === opts.environment; });
  return eps;
}

function getEndpoint(id) {
  return ENDPOINTS.find(function(e) { return e.id === id; }) || null;
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

/**
 * Build adjacency lists for the dependency graph.
 * Returns { [id]: { dependsOn: [...], requiredBy: [...] } }
 */
function getDependencyGraph() {
  var graph = {};

  // Initialize every node
  for (var i = 0; i < ENDPOINTS.length; i++) {
    var ep = ENDPOINTS[i];
    if (!graph[ep.id]) graph[ep.id] = { dependsOn: [], requiredBy: [] };
  }

  // Build edges from dependsOn
  for (var j = 0; j < ENDPOINTS.length; j++) {
    var ep2 = ENDPOINTS[j];
    var deps = ep2.dependsOn || [];
    for (var k = 0; k < deps.length; k++) {
      var depId = deps[k];
      graph[ep2.id].dependsOn.push(depId);
      if (!graph[depId]) graph[depId] = { dependsOn: [], requiredBy: [] };
      graph[depId].requiredBy.push(ep2.id);
    }
  }

  // Build edges from impacts
  for (var m = 0; m < ENDPOINTS.length; m++) {
    var ep3 = ENDPOINTS[m];
    var imps = ep3.impacts || [];
    for (var n = 0; n < imps.length; n++) {
      var impId = imps[n];
      // Add to requiredBy if not already via dependsOn
      if (!graph[ep3.id]) graph[ep3.id] = { dependsOn: [], requiredBy: [] };
      if (graph[ep3.id].requiredBy.indexOf(impId) === -1) {
        graph[ep3.id].requiredBy.push(impId);
      }
      if (!graph[impId]) graph[impId] = { dependsOn: [], requiredBy: [] };
      if (graph[impId].dependsOn.indexOf(ep3.id) === -1) {
        graph[impId].dependsOn.push(ep3.id);
      }
    }
  }

  return graph;
}

/**
 * BFS: given a down endpoint ID, find all transitively impacted services.
 * Returns array of endpoint IDs that depend (directly or transitively) on downId.
 */
function getImpactedServices(downId) {
  var graph = getDependencyGraph();
  var visited = {};
  var queue = [downId];
  visited[downId] = true;
  var impacted = [];

  while (queue.length > 0) {
    var current = queue.shift();
    var node = graph[current];
    if (!node) continue;
    var dependents = node.requiredBy || [];
    for (var i = 0; i < dependents.length; i++) {
      var dep = dependents[i];
      if (!visited[dep]) {
        visited[dep] = true;
        impacted.push(dep);
        queue.push(dep);
      }
    }
  }

  return impacted;
}

module.exports = {
  ENDPOINTS: ENDPOINTS,
  CATEGORIES: CATEGORIES,
  ENVIRONMENTS: ENVIRONMENTS,
  CHAIN_HALT_THRESHOLD_SECONDS: CHAIN_HALT_THRESHOLD_SECONDS,
  APP_GROUPS: APP_GROUPS,
  getEndpoints: getEndpoints,
  getEndpoint: getEndpoint,
  getDependencyGraph: getDependencyGraph,
  getImpactedServices: getImpactedServices,
};

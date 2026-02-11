// lib/health-config.js — Endpoint registry for Integra status page
'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = ['blockchain', 'validators', 'apis', 'frontends', 'external'];
const ENVIRONMENTS = ['prod', 'dev', 'staging', 'release'];
const CHAIN_HALT_THRESHOLD_SECONDS = 60;

// Owner constants (customize names/handles as needed)
var OWNERS = {
  infra: { name: 'Infra Team', role: 'Infrastructure', contact: '#infra' },
  backend: { name: 'Backend Team', role: 'Backend Engineering', contact: '#backend' },
  frontend: { name: 'Frontend Team', role: 'Frontend Engineering', contact: '#frontend' },
  adam: { name: 'Adam', role: 'CTO', contact: '@adam' },
  product: { name: 'Product Team', role: 'Product', contact: '#product' },
};

// ---------------------------------------------------------------------------
// App groups (for minimal view)
// ---------------------------------------------------------------------------

const APP_GROUPS = [
  { id: 'dashboard', name: 'Dashboard', icon: '\uD83D\uDCCA', description: 'Portfolio management, staking, XP tracking, and asset management', endpoints: ['dashboard-prod', 'dashboard-dev', 'dashboard-api-prod', 'dashboard-api-dev', 'notification-api-prod', 'notification-api-dev', 'price-api'] },
  { id: 'explorer', name: 'Explorer', icon: '\uD83D\uDD0D', description: 'Block explorer for transactions, blocks, and validators', endpoints: ['explorer-mainnet', 'explorer-testnet', 'mainnet-cosmos-rpc', 'mainnet-cosmos-rest', 'testnet-cosmos-rpc', 'testnet-cosmos-rest'] },
  { id: 'city', name: 'City of Integra', icon: '\uD83C\uDFD9\uFE0F', description: 'Gamified city builder experience and game backend', endpoints: ['city-prod', 'city-dev', 'city-api-prod', 'city-api-dev'] },
  { id: 'portal', name: 'XP Portal', icon: '\u2B50', description: 'Points tracking, leaderboard, and rewards', endpoints: ['portal', 'absinthe-api'] },
  { id: 'blockchain', name: 'Blockchain Nodes', icon: '\u26D3\uFE0F', description: 'EVM and Cosmos RPC/REST nodes for mainnet and testnet', endpoints: ['mainnet-evm-rpc', 'testnet-evm-rpc'] },
  { id: 'validators', name: 'Validators', icon: '\u26A1', description: 'Mainnet validator nodes for block production and consensus', endpoints: ['validator-1', 'validator-2', 'validator-3', 'validator-adam'] },
  { id: 'sites', name: 'Websites & Docs', icon: '\uD83C\uDF10', description: 'Marketing website, documentation, whitepaper, and staking', endpoints: ['main-website', 'docs-site', 'whitepaper', 'staking', 'datastore'] },
  { id: 'standalone', name: 'Other APIs', icon: '\u2699\uFE0F', description: 'Supply data, file uploads, and utility endpoints', endpoints: ['supply-api', 'presign-api', 'upload-tracker-api'] },
  { id: 'external', name: 'External Services', icon: '\u2197\uFE0F', description: 'Third-party dependencies and integrations', endpoints: [] }, // filled dynamically below
];

// ---------------------------------------------------------------------------
// Endpoint registry
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  // ── Blockchain (Mainnet — integra-1, EVM chain 26217) ──────────────────
  { id: 'mainnet-evm-rpc', name: 'Mainnet EVM RPC', category: 'blockchain', environment: 'prod', url: 'https://evm.integralayer.com', checkType: 'evm-rpc', timeout: 10000, enabled: true, expectedChainId: '0x6669', dependsOn: [], impacts: ['dashboard-api-prod'], impactDescription: 'Dashboard API loses EVM data — balances and transactions unavailable', description: 'EVM JSON-RPC for mainnet (chain 26217) — wallet balances, transactions, smart contracts', owner: OWNERS.infra, docsUrl: 'https://docs.integralayer.com/nodes', repoUrl: null, tags: ['EVM', 'Cosmos SDK'] },
  { id: 'mainnet-evm-ws', name: 'Mainnet EVM WebSocket', category: 'blockchain', environment: 'prod', url: 'wss://ws.integralayer.com', checkType: 'websocket', timeout: 10000, enabled: false, dependsOn: [], impacts: [], description: 'EVM WebSocket for mainnet — real-time event subscriptions', owner: OWNERS.infra, docsUrl: 'https://docs.integralayer.com/nodes', repoUrl: null, tags: ['EVM', 'WebSocket'] },
  { id: 'mainnet-cosmos-rpc', name: 'Mainnet Cosmos RPC', category: 'blockchain', environment: 'prod', url: 'https://rpc.integralayer.com', checkType: 'cosmos-rpc', timeout: 10000, enabled: true, dependsOn: [], impacts: ['explorer-mainnet'], impactDescription: 'Mainnet explorer loses real-time block data', description: 'Cosmos RPC for mainnet — block data, transaction broadcasting, validator info', owner: OWNERS.infra, docsUrl: 'https://docs.integralayer.com/nodes', repoUrl: null, tags: ['Tendermint', 'CometBFT'] },
  { id: 'mainnet-cosmos-rpc2', name: 'Mainnet Cosmos RPC 2', category: 'blockchain', environment: 'prod', url: 'https://rpc2.integralayer.com', checkType: 'cosmos-rpc', timeout: 10000, enabled: false, dependsOn: [], impacts: [], description: 'Cosmos RPC backup for mainnet — failover node', owner: OWNERS.infra, docsUrl: 'https://docs.integralayer.com/nodes', repoUrl: null, tags: ['Tendermint'] },
  { id: 'mainnet-cosmos-rest', name: 'Mainnet REST/LCD', category: 'blockchain', environment: 'prod', url: 'https://api.integralayer.com', checkType: 'cosmos-rest', timeout: 10000, enabled: true, dependsOn: [], impacts: ['explorer-mainnet'], impactDescription: 'Mainnet explorer loses validator and governance data', description: 'Cosmos REST/LCD for mainnet — governance, staking queries, account info', owner: OWNERS.infra, docsUrl: 'https://docs.integralayer.com/nodes', repoUrl: null, tags: ['Cosmos SDK'] },

  // ── Blockchain (Testnet — ormos-1, EVM chain 26218) ────────────────────
  { id: 'testnet-evm-rpc', name: 'Testnet EVM RPC', category: 'blockchain', environment: 'dev', url: 'https://testnet-evm.integralayer.com', checkType: 'evm-rpc', timeout: 10000, enabled: true, expectedChainId: '0x666a', dependsOn: [], impacts: [], description: 'EVM JSON-RPC for testnet Ormos (chain 26218) — development & testing', owner: OWNERS.infra, docsUrl: 'https://docs.integralayer.com/nodes', repoUrl: null, tags: ['EVM', 'Cosmos SDK'] },
  { id: 'testnet-cosmos-rpc', name: 'Testnet Cosmos RPC', category: 'blockchain', environment: 'dev', url: 'https://testnet-rpc.integralayer.com', checkType: 'cosmos-rpc', timeout: 10000, enabled: true, dependsOn: [], impacts: ['explorer-testnet'], impactDescription: 'Testnet explorer loses real-time block data', description: 'Cosmos RPC for testnet — development block data and testing', owner: OWNERS.infra, docsUrl: 'https://docs.integralayer.com/nodes', repoUrl: null, tags: ['Tendermint'] },
  { id: 'testnet-cosmos-rest', name: 'Testnet REST/LCD', category: 'blockchain', environment: 'dev', url: 'https://testnet-api.integralayer.com', checkType: 'cosmos-rest', timeout: 10000, enabled: true, dependsOn: [], impacts: ['explorer-testnet'], impactDescription: 'Testnet explorer loses validator and governance data', description: 'Cosmos REST/LCD for testnet — development queries and testing', owner: OWNERS.infra, docsUrl: 'https://docs.integralayer.com/nodes', repoUrl: null, tags: ['Cosmos SDK'] },

  // ── Validators (mainnet) ───────────────────────────────────────────────
  { id: 'validator-1', name: 'Validator 1', category: 'validators', environment: 'prod', url: 'http://165.227.118.77:26657', checkType: 'cosmos-peer-check', peerIp: '3.92.110.107', publicRpc: 'https://rpc.integralayer.com', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'Mainnet validator node (DigitalOcean) — block production and consensus', owner: OWNERS.infra, docsUrl: null, repoUrl: null, tags: ['CometBFT', 'DigitalOcean'] },
  { id: 'validator-2', name: 'Validator 2', category: 'validators', environment: 'prod', url: 'http://159.65.168.118:26657', checkType: 'cosmos-peer-check', peerIp: '159.65.168.118', publicRpc: 'https://rpc.integralayer.com', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'Mainnet validator node (DigitalOcean) — block production and consensus', owner: OWNERS.infra, docsUrl: null, repoUrl: null, tags: ['CometBFT', 'DigitalOcean'] },
  { id: 'validator-3', name: 'Validator 3', category: 'validators', environment: 'prod', url: 'http://104.131.34.167:26657', checkType: 'cosmos-peer-check', peerIp: '104.131.34.167', publicRpc: 'https://rpc.integralayer.com', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'Mainnet validator node (DigitalOcean) — block production and consensus', owner: OWNERS.infra, docsUrl: null, repoUrl: null, tags: ['CometBFT', 'DigitalOcean'] },
  { id: 'validator-adam', name: "Adam's Node (AWS SG)", category: 'validators', environment: 'prod', url: 'http://18.140.134.114:26657', checkType: 'cosmos-peer-check', peerIp: '94.207.99.127', publicRpc: 'https://rpc.integralayer.com', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: "Adam's validator node (AWS Singapore) — personal validator", owner: OWNERS.adam, docsUrl: null, repoUrl: null, tags: ['CometBFT', 'AWS'] },

  // ── Backend APIs ───────────────────────────────────────────────────────
  { id: 'passport-api', name: 'Passport API', category: 'apis', environment: 'prod', url: 'https://passport-apis.integralayer.com/health/database', checkType: 'api-health', timeout: 10000, enabled: false, dependsOn: ['web3auth', 'google-oauth'], impacts: [], description: 'Passport authentication — wallet pregeneration, social login', owner: OWNERS.backend, docsUrl: 'https://docs.integralayer.com', repoUrl: null, tags: ['NestJS', 'PostgreSQL'] },
  { id: 'dashboard-api-prod', name: 'Dashboard API', category: 'apis', environment: 'prod', url: 'https://dashboard-apis.integralayer.com', checkType: 'deep-health', healthUrl: 'https://dashboard-apis.integralayer.com/health', timeout: 10000, enabled: true, dependsOn: ['absinthe-api'], impacts: ['dashboard-prod'], impactDescription: 'Production dashboard fully unavailable', description: 'Dashboard backend — auth, assets, XP, staking, bulk imports (75+ endpoints)', owner: OWNERS.backend, docsUrl: 'https://docs.integralayer.com', repoUrl: 'https://github.com/Integra-layer/dashboard', tags: ['NestJS', 'PostgreSQL', 'JWT'] },
  { id: 'dashboard-api-dev', name: 'Dashboard API (Dev)', category: 'apis', environment: 'dev', url: 'https://dev-dashboard-apis.integralayer.com', checkType: 'deep-health', healthUrl: 'https://dev-dashboard-apis.integralayer.com/health', timeout: 10000, enabled: true, dependsOn: ['absinthe-api'], impacts: ['dashboard-dev'], impactDescription: 'Dev dashboard fully unavailable', description: 'Dashboard backend (dev) — same as prod, testnet networks', owner: OWNERS.backend, docsUrl: 'https://docs.integralayer.com', repoUrl: 'https://github.com/Integra-layer/dashboard', tags: ['NestJS', 'PostgreSQL'] },
  { id: 'notification-api-prod', name: 'Notification API', category: 'apis', environment: 'prod', url: 'https://production-apis.integralayer.com', checkType: 'deep-health', healthUrl: 'https://production-apis.integralayer.com/health', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-prod'], impactDescription: 'Dashboard notifications and alerts stop working', description: 'Push notifications and alerts for dashboard events', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['NestJS'] },
  { id: 'notification-api-dev', name: 'Notification API (Dev)', category: 'apis', environment: 'dev', url: 'https://develop-apis.integralayer.com', checkType: 'deep-health', healthUrl: 'https://develop-apis.integralayer.com/health', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-dev'], impactDescription: 'Dev dashboard notifications stop working', description: 'Notification service (dev) — testing notifications', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['NestJS'] },
  { id: 'city-api-prod', name: 'City of Integra API', category: 'apis', environment: 'prod', url: 'https://ng6mpgxjz7.ap-south-1.awsapprunner.com', checkType: 'deep-health', healthUrl: 'https://ng6mpgxjz7.ap-south-1.awsapprunner.com/health', timeout: 10000, enabled: true, dependsOn: [], impacts: ['city-prod'], impactDescription: 'City builder game unavailable', description: 'City of Integra game backend — city builder logic, game state', owner: OWNERS.backend, docsUrl: null, repoUrl: 'https://github.com/Integra-layer/city', tags: ['AppRunner'] },
  { id: 'city-api-dev', name: 'City of Integra API (Dev)', category: 'apis', environment: 'dev', url: 'https://ygmwadph3x.ap-south-1.awsapprunner.com', checkType: 'deep-health', healthUrl: 'https://ygmwadph3x.ap-south-1.awsapprunner.com/health', timeout: 10000, enabled: true, dependsOn: [], impacts: ['city-dev'], impactDescription: 'Dev city builder unavailable', description: 'City of Integra game backend (dev)', owner: OWNERS.backend, docsUrl: null, repoUrl: 'https://github.com/Integra-layer/city', tags: ['AppRunner'] },
  { id: 'supply-api', name: 'Circulating Supply', category: 'apis', environment: 'prod', url: 'https://supply.polytrade.finance', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'Circulating token supply endpoint for exchanges/aggregators', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['API'] },
  { id: 'price-api', name: 'Pricing API', category: 'apis', environment: 'prod', url: 'https://price.api.polytrade.app', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-prod'], impactDescription: 'Token prices missing from dashboard', description: 'Token pricing data for dashboard display', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['API'] },
  { id: 'presign-api', name: 'Presigned URL API', category: 'apis', environment: 'prod', url: 'https://presign.api.polytrade.app', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'Pre-signed URL generation for secure file uploads to S3', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['AWS S3'] },
  { id: 'upload-tracker-api', name: 'Upload Tracker', category: 'apis', environment: 'prod', url: 'https://upload-tracker.api.polytrade.app', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'Tracks file upload status and metadata', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['API'] },

  // ── Frontends & Explorers ──────────────────────────────────────────────
  { id: 'explorer-mainnet', name: 'Explorer (Mainnet)', category: 'frontends', environment: 'prod', url: 'https://explorer.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['mainnet-cosmos-rpc', 'mainnet-cosmos-rest'], impacts: [], description: 'Block explorer for mainnet — transactions, blocks, validators', owner: OWNERS.frontend, docsUrl: 'https://docs.integralayer.com', repoUrl: 'https://github.com/Integra-layer/explorer', tags: ['Next.js', 'Vercel'] },
  { id: 'explorer-testnet', name: 'Explorer (Testnet)', category: 'frontends', environment: 'dev', url: 'https://testnet.explorer.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['testnet-cosmos-rpc', 'testnet-cosmos-rest'], impacts: [], description: 'Block explorer for testnet — development testing', owner: OWNERS.frontend, docsUrl: 'https://docs.integralayer.com', repoUrl: 'https://github.com/Integra-layer/explorer', tags: ['Next.js', 'Vercel'] },
  { id: 'docs-site', name: 'Documentation', category: 'frontends', environment: 'prod', url: 'https://docs.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['vercel'], impacts: [], description: 'Developer documentation and integration guides', owner: OWNERS.frontend, docsUrl: 'https://docs.integralayer.com', repoUrl: null, tags: ['Docusaurus', 'Vercel'] },
  { id: 'main-website', name: 'Integra Website', category: 'frontends', environment: 'prod', url: 'https://integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['vercel'], impacts: [], description: 'Integra Layer marketing website', owner: OWNERS.frontend, docsUrl: null, repoUrl: null, tags: ['Next.js', 'Vercel'] },
  { id: 'dashboard-prod', name: 'Dashboard', category: 'frontends', environment: 'prod', url: 'https://dashboard.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['dashboard-api-prod'], impacts: [], description: 'Main dashboard — portfolio, staking, XP, assets, leaderboard', owner: OWNERS.frontend, docsUrl: 'https://docs.integralayer.com', repoUrl: 'https://github.com/Integra-layer/dashboard', tags: ['React', 'Vercel'] },
  { id: 'dashboard-dev', name: 'Dashboard (Dev)', category: 'frontends', environment: 'dev', url: 'https://dev-dashboard.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['dashboard-api-dev'], impacts: [], description: 'Dashboard (dev) — development and staging', owner: OWNERS.frontend, docsUrl: 'https://docs.integralayer.com', repoUrl: 'https://github.com/Integra-layer/dashboard', tags: ['React', 'Vercel'] },
  { id: 'city-prod', name: 'City Builder', category: 'frontends', environment: 'prod', url: 'https://city.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['city-api-prod'], impacts: [], description: 'City of Integra — gamified city builder experience', owner: OWNERS.frontend, docsUrl: null, repoUrl: 'https://github.com/Integra-layer/city', tags: ['React', 'Vercel'] },
  { id: 'city-dev', name: 'City Builder (Dev)', category: 'frontends', environment: 'dev', url: 'https://dev-city.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['city-api-dev'], impacts: [], description: 'City of Integra (dev)', owner: OWNERS.frontend, docsUrl: null, repoUrl: 'https://github.com/Integra-layer/city', tags: ['React', 'Vercel'] },
  { id: 'whitepaper', name: 'Whitepaper', category: 'frontends', environment: 'prod', url: 'https://whitepaper.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'Technical whitepaper — protocol design and architecture', owner: OWNERS.product, docsUrl: null, repoUrl: null, tags: ['Vercel'] },
  { id: 'portal', name: 'XP Portal', category: 'frontends', environment: 'prod', url: 'https://portal.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: ['absinthe-api'], impacts: [], description: 'XP Portal — points tracking, leaderboard, rewards', owner: OWNERS.frontend, docsUrl: null, repoUrl: 'https://github.com/Integra-layer/portal', tags: ['React', 'Vercel'] },
  { id: 'staking', name: 'Staking App', category: 'frontends', environment: 'prod', url: 'https://staking.polytrade.finance', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: ['vercel'], impacts: [], description: 'Staking interface — delegate, undelegate, claim rewards', owner: OWNERS.frontend, docsUrl: null, repoUrl: null, tags: ['React', 'Vercel'] },
  { id: 'landing', name: 'Landing Page', category: 'frontends', environment: 'prod', url: 'https://get.polytrade.finance', checkType: 'http-get', timeout: 10000, enabled: false, dependsOn: ['vercel'], impacts: [], description: 'Legacy landing page (disabled)', owner: OWNERS.frontend, docsUrl: null, repoUrl: null, tags: ['Vercel'] },
  { id: 'datastore', name: 'NFT Datastore', category: 'frontends', environment: 'prod', url: 'https://datastore.polytrade.app', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'NFT datastore — asset metadata and media storage', owner: OWNERS.frontend, docsUrl: null, repoUrl: null, tags: ['Vercel'] },

  // ── External Dependencies ──────────────────────────────────────────────
  { id: 'github-integra-layer', name: 'GitHub (Integra-layer)', category: 'external', environment: 'prod', url: 'https://api.github.com/orgs/Integra-layer', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'GitHub org — Integra-layer repositories', owner: OWNERS.infra, docsUrl: null, repoUrl: 'https://github.com/Integra-layer', tags: ['GitHub'] },
  { id: 'github-polytrade', name: 'GitHub (polytrade-finance)', category: 'external', environment: 'prod', url: 'https://api.github.com/orgs/polytrade-finance', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], description: 'GitHub org — polytrade-finance repositories', owner: OWNERS.infra, docsUrl: null, repoUrl: 'https://github.com/polytrade-finance', tags: ['GitHub'] },
  { id: 'absinthe-api', name: 'Absinthe XP', category: 'external', environment: 'prod', url: 'https://gql3.absinthe.network', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-api-prod', 'dashboard-api-dev', 'portal'], impactDescription: 'Dashboard XP features break, portal unusable', description: 'Absinthe Network — XP/points system, leaderboard sync', owner: OWNERS.product, docsUrl: null, repoUrl: null, tags: ['GraphQL'] },
  { id: 'web3auth', name: 'Web3Auth', category: 'external', environment: 'prod', url: 'https://lookup.web3auth.io', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['passport-api'], impactDescription: 'Wallet pregeneration fails', description: 'Web3Auth — non-custodial wallet pregeneration, social login', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['OAuth'] },
  { id: 'openai-api', name: 'OpenAI', category: 'external', environment: 'prod', url: 'https://api.openai.com/v1/models', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], impactDescription: 'Title deed extraction fails', description: 'OpenAI — AI-powered title deed extraction and document processing', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['AI', 'GPT'] },
  { id: 'alchemy-rpc', name: 'Alchemy', category: 'external', environment: 'prod', url: 'https://eth-mainnet.g.alchemy.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: [], impactDescription: 'Webhook events stop, RPC fallback lost', description: 'Alchemy — blockchain RPC fallback, webhooks, event indexing', owner: OWNERS.infra, docsUrl: null, repoUrl: null, tags: ['RPC', 'Webhooks'] },
  { id: 'twitter-api', name: 'Twitter/X', category: 'external', environment: 'prod', url: 'https://api.twitter.com/2', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-prod'], impactDescription: 'Tweet display on dashboard fails', description: 'Twitter/X API — social media feed integration on dashboard', owner: OWNERS.frontend, docsUrl: null, repoUrl: null, tags: ['OAuth'] },
  { id: 'google-oauth', name: 'Google OAuth', category: 'external', environment: 'prod', url: 'https://accounts.google.com/.well-known/openid-configuration', checkType: 'http-json', timeout: 10000, enabled: true, dependsOn: [], impacts: ['passport-api'], impactDescription: 'Social login breaks', description: 'Google OAuth — social login for user authentication', owner: OWNERS.backend, docsUrl: null, repoUrl: null, tags: ['OAuth', 'OIDC'] },
  { id: 'dicebear-api', name: 'DiceBear Avatars', category: 'external', environment: 'prod', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=test', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: [], impacts: ['city-prod', 'city-dev'], impactDescription: 'City builder avatars break', description: 'DiceBear — procedural avatar generation for city builder', owner: OWNERS.frontend, docsUrl: null, repoUrl: null, tags: ['API'] },
  { id: 'walletconnect', name: 'WalletConnect', category: 'external', environment: 'prod', url: 'https://relay.walletconnect.com', checkType: 'http-reachable', timeout: 10000, enabled: true, dependsOn: [], impacts: ['dashboard-prod'], impactDescription: 'Wallet connections fail', description: 'WalletConnect — external wallet connection relay', owner: OWNERS.frontend, docsUrl: null, repoUrl: null, tags: ['WebSocket'] },
  { id: 'vercel', name: 'Vercel Platform', category: 'external', environment: 'prod', url: 'https://vercel.com', checkType: 'http-get', timeout: 10000, enabled: true, dependsOn: [], impacts: ['docs-site', 'main-website', 'staking', 'landing'], impactDescription: 'Docs, staking, landing go down', description: 'Vercel Platform — hosting for all frontend apps and docs', owner: OWNERS.infra, docsUrl: null, repoUrl: null, tags: ['CDN', 'Edge'] },
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
  OWNERS: OWNERS,
  getEndpoints: getEndpoints,
  getEndpoint: getEndpoint,
  getDependencyGraph: getDependencyGraph,
  getImpactedServices: getImpactedServices,
};

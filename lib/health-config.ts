// lib/health-config.ts — Endpoint registry for Integra status page
import type {
  Category,
  Environment,
  Endpoint,
  AppGroup,
  Owner,
  CommonIssue,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CATEGORIES: Category[] = [
  "blockchain",
  "validators",
  "apis",
  "frontends",
  "external",
];
export const ENVIRONMENTS: Environment[] = [
  "prod",
  "dev",
  "staging",
  "release",
];
export const CHAIN_HALT_THRESHOLD_SECONDS = 60;

// Owner constants — real team members with email contacts + Telegram handles
export const OWNERS: Record<string, Owner> = {
  adam: {
    name: "Adam Boudj",
    role: "CTO / Infrastructure",
    contact: "adam@integralayer.com",
    telegram: "adamboudj",
  },
  nawar: {
    name: "Nawar",
    role: "Backend Engineering",
    contact: "nawar@integralayer.com",
    telegram: "iamnawar",
  },
  kalki: {
    name: "Kalki",
    role: "Full-Stack / Explorer",
    contact: "kalki@integralayer.com",
    telegram: "yourdevkalki",
  },
  tara: {
    name: "Tara",
    role: "Frontend Engineering",
    contact: "tara@integralayer.com",
    telegram: "TaraMathews",
  },
  parth: {
    name: "Parth",
    role: "APIs / External Services",
    contact: "parth@integralayer.com",
    telegram: "parthbisht22",
  },
};

// CTO Telegram handle — always pinged on DOWN/DEGRADED alerts (unless CTO is the owner)
export const CTO_TELEGRAM = "adamboudj";

// ---------------------------------------------------------------------------
// Common issue templates by check type / infrastructure
// ---------------------------------------------------------------------------

const evmRpcIssues: CommonIssue[] = [
  {
    cause: "intgd service stopped or crashed",
    fix: "SSH in and restart: sudo systemctl restart intgd",
  },
  {
    cause: "Disk full on EC2 instance",
    fix: "Check disk usage: df -h, clean up old logs or prune chain data",
  },
  {
    cause: "Node fell behind sync",
    fix: 'Check sync status: curl localhost:8545 -X POST -H \'Content-Type: application/json\' -d \'{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}\'',
  },
];

const evmRpcCaddyIssues: CommonIssue[] = [
  {
    cause: "intgd service stopped or crashed",
    fix: "SSH in and restart: sudo systemctl restart intgd",
  },
  {
    cause: "Caddy reverse proxy misconfigured or down",
    fix: "Check Caddy status: sudo systemctl status caddy; verify /rpc route uses handle_path to strip prefix",
  },
  {
    cause: "TLS certificate expired or renewal failed",
    fix: "Check Caddy logs: journalctl -u caddy -n 50; Let's Encrypt renewal should be automatic",
  },
];

const cosmosRpcIssues: CommonIssue[] = [
  {
    cause: "CometBFT process crashed or halted",
    fix: "SSH in and restart: sudo systemctl restart intgd; check logs: journalctl -u intgd -n 100",
  },
  {
    cause: "Node stuck at a block height (consensus stall)",
    fix: "Check latest block: curl localhost:26657/status | jq .result.sync_info; compare with peers",
  },
  {
    cause: "P2P port 26656 blocked by firewall",
    fix: "Check security group rules allow inbound TCP 26656; verify with: ss -tlnp | grep 26656",
  },
];

const cosmosRpcCaddyIssues: CommonIssue[] = [
  {
    cause: "CometBFT process crashed or halted",
    fix: "SSH in and restart: sudo systemctl restart intgd",
  },
  {
    cause: "Caddy reverse proxy not routing /cometbft correctly",
    fix: "Check Caddyfile route for /cometbft; ensure handle_path strips prefix before proxying to port 26657",
  },
  {
    cause: "TLS certificate expired or renewal failed",
    fix: "Check Caddy logs: journalctl -u caddy -n 50; Let's Encrypt auto-renewal should handle this",
  },
];

const cosmosRestIssues: CommonIssue[] = [
  {
    cause: "REST/LCD server not enabled or crashed",
    fix: "Verify api.enable = true in app.toml; restart: sudo systemctl restart intgd",
  },
  {
    cause: "Node is syncing and REST queries return stale data",
    fix: "Check sync status: curl localhost:26657/status | jq .result.sync_info.catching_up",
  },
  {
    cause: "Port 1317 blocked or not exposed",
    fix: "Check firewall rules and Caddy config for REST proxy route",
  },
];

const cosmosRestCaddyIssues: CommonIssue[] = [
  {
    cause: "REST/LCD server not enabled or crashed",
    fix: "Verify api.enable = true in app.toml; restart: sudo systemctl restart intgd",
  },
  {
    cause: "Caddy reverse proxy not routing /rest correctly",
    fix: "Check Caddyfile route for /rest; ensure handle_path strips prefix before proxying to port 1317",
  },
  {
    cause: "TLS certificate expired",
    fix: "Check Caddy logs: journalctl -u caddy -n 50",
  },
];

const validatorPeerIssues: CommonIssue[] = [
  {
    cause: "Validator not in peer list — node may be offline",
    fix: "Verify the validator is running and has peers: curl localhost:26657/net_info | jq '.result.peers | length'",
  },
  {
    cause: "Firewall blocking P2P port 26656",
    fix: "Check security group rules for port 26656 inbound; verify with: ss -tlnp | grep 26656",
  },
  {
    cause: "Validator jailed due to downtime",
    fix: "Check jail status: intgd query staking validator <valoper> --output json | jq .jailed; unjail if needed",
  },
];

const vercelFrontendIssues: CommonIssue[] = [
  {
    cause: "Vercel deployment failed",
    fix: "Check Vercel dashboard for build errors; redeploy with: vercel --prod",
  },
  {
    cause: "DNS resolution failure",
    fix: "Verify DNS records in Cloudflare/Route53 point to Vercel",
  },
  {
    cause: "Vercel platform outage",
    fix: "Check https://www.vercelstatus.com for platform-wide incidents",
  },
];

const deepHealthApiIssues: CommonIssue[] = [
  {
    cause: "Application crashed or OOM killed",
    fix: "Check application logs; restart the service; verify memory limits",
  },
  {
    cause: "Database connection pool exhausted",
    fix: "Restart the service to reset connections; check DB connection count and limits",
  },
  {
    cause: "Health endpoint returning unhealthy status",
    fix: "Check /health response for specific component failures (DB, cache, queue)",
  },
];

const httpReachableApiIssues: CommonIssue[] = [
  {
    cause: "Service unreachable or DNS failure",
    fix: "Verify DNS resolves correctly; check if service is running on the host",
  },
  {
    cause: "TLS/SSL certificate expired",
    fix: "Check certificate expiry; renew or redeploy",
  },
];

const externalServiceIssues: CommonIssue[] = [
  {
    cause: "Third-party service outage",
    fix: "Check their status page; no action needed, wait for recovery",
  },
  {
    cause: "API rate limit exceeded",
    fix: "Check rate limit headers in response; reduce polling frequency or upgrade plan",
  },
];

const explorerSyncIssues: CommonIssue[] = [
  {
    cause: "BullMQ blockSync job stuck in active state",
    fix: "SSH to server, clear queue: docker exec <backend> node -e \"...Queue('blockSync')...obliterate()...\"; restart workers",
  },
  {
    cause: "PM2 sync process crashed",
    fix: "Check PM2 logs: docker exec <pm2> pm2 logs --lines 50; restart: docker compose restart pm2",
  },
  {
    cause: "EVM indexer disabled on chain node",
    fix: "Set enable-indexer = true in app.toml, restart node, run: intgd index-eth-tx backward && intgd index-eth-tx forward",
  },
  {
    cause: "Workers disconnected from Redis/RPC",
    fix: "docker compose restart high_priority_worker medium_priority_worker low_priority_worker",
  },
  {
    cause: "Missing DB columns causing silent INSERT failures",
    fix: "Run migration: docker exec <backend> npx sequelize-cli db:migrate",
  },
];

const explorerDeepHealthIssues: CommonIssue[] = [
  {
    cause: "Callisto workers crashed or disconnected",
    fix: "Check running containers: docker ps; restart workers: docker compose restart worker-high worker-medium worker-low",
  },
  {
    cause: "Schema drift — missing columns causing silent INSERT failures",
    fix: "Check table schema: docker exec postgres psql -U postgres -d ethernal -c '\\d block'; run pending migrations",
  },
  {
    cause: "Block gaps from indexer crash during sync",
    fix: "Detect gaps: SELECT height FROM block ORDER BY height DESC LIMIT 1000; backfill via job queue API",
  },
  {
    cause: "Receipt sync blocked by transaction_receipts schema mismatch",
    fix: "Check transaction_receipts table exists and has correct columns; re-run receipt sync jobs",
  },
  {
    cause: "Indexer hung but latest height cached (stale write)",
    fix: "Restart Callisto: docker compose restart callisto; verify blocks advancing: SELECT MAX(height) FROM block",
  },
];

// ---------------------------------------------------------------------------
// App groups (for minimal view)
// ---------------------------------------------------------------------------

export const APP_GROUPS: AppGroup[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "\uD83D\uDCCA",
    description:
      "Portfolio management, staking, XP tracking, and asset management",
    endpoints: [
      "dashboard-prod",
      "dashboard-dev",
      "dashboard-api-prod",
      "dashboard-api-dev",
      "notification-api-prod",
      "notification-api-dev",
      "price-api",
    ],
  },
  {
    id: "explorer",
    name: "Explorer",
    icon: "\uD83D\uDD0D",
    description: "Block explorer for transactions, blocks, and validators",
    endpoints: [
      "explorer-mainnet",
      "explorer-testnet",
      "explorer-v2",
      "explorer-graphql",
      "blockscout-mainnet",
      "blockscout-testnet",
      "mainnet-cosmos-rpc",
      "mainnet-cosmos-rest",
      "testnet-cosmos-rpc",
      "testnet-cosmos-rest",
      "explorer-mainnet-sync",
      "explorer-testnet-sync",
      "explorer-mainnet-deep-health",
      "explorer-mainnet-backend",
      "explorer-testnet-backend",
    ],
  },
  {
    id: "city",
    name: "City of Integra",
    icon: "\uD83C\uDFD9\uFE0F",
    description: "Gamified city builder experience and game backend",
    endpoints: ["city-prod", "city-dev", "city-api-prod", "city-api-dev"],
  },
  {
    id: "portal",
    name: "XP Portal",
    icon: "\u2B50",
    description: "Points tracking, leaderboard, and rewards",
    endpoints: ["portal", "absinthe-api"],
  },
  {
    id: "blockchain",
    name: "Blockchain Nodes",
    icon: "\u26D3\uFE0F",
    description: "EVM and Cosmos RPC/REST nodes for mainnet and testnet",
    endpoints: [
      "mainnet-evm-rpc",
      "mainnet-cosmos-rpc-adam",
      "mainnet-cosmos-rest-adam",
      "testnet-evm-rpc",
      "testnet-evm-rpc-ormos",
      "testnet-cosmos-rpc-ormos",
      "testnet-cosmos-rest-ormos",
    ],
  },
  {
    id: "validators",
    name: "Validators",
    icon: "\u26A1",
    description: "Mainnet validator nodes for block production and consensus",
    endpoints: ["validator-1", "validator-2", "validator-3", "validator-adam"],
  },
  {
    id: "sites",
    name: "Websites & Docs",
    icon: "\uD83C\uDF10",
    description: "Marketing website, documentation, whitepaper, and staking",
    endpoints: [
      "main-website",
      "docs-site",
      "whitepaper",
      "staking",
      "datastore",
      "integra-connect",
      "portal-mainnet",
      "portal-testnet",
      "status-page",
    ],
  },
  {
    id: "standalone",
    name: "Other APIs",
    icon: "\u2699\uFE0F",
    description: "Supply data, file uploads, and utility endpoints",
    endpoints: [
      "supply-api",
      "presign-api",
      "upload-tracker-api",
      "testnet-faucet-api",
    ],
  },
  {
    id: "external",
    name: "External Services",
    icon: "\u2197\uFE0F",
    description: "Third-party dependencies and integrations",
    endpoints: [],
  }, // filled dynamically below
];

// ---------------------------------------------------------------------------
// Endpoint registry
// ---------------------------------------------------------------------------

export const ENDPOINTS: Endpoint[] = [
  // -- Blockchain (Mainnet -- integra-1, EVM chain 26217) --------------------
  {
    id: "mainnet-evm-rpc",
    name: "Mainnet EVM RPC",
    category: "blockchain",
    environment: "prod",
    url: "https://adamboudj.integralayer.com/rpc",
    checkType: "evm-rpc",
    timeout: 10000,
    enabled: true,
    expectedChainId: "0x6669",
    dependsOn: [],
    impacts: ["dashboard-api-prod", "explorer-v2"],
    impactDescription:
      "Dashboard API and Explorer v2 lose EVM data — balances and transactions unavailable",
    description:
      "EVM JSON-RPC for mainnet (chain 26217) — wallet balances, transactions, smart contracts",
    richDescription:
      "The primary Ethereum-compatible JSON-RPC node for Integra mainnet (chain ID 26217), served via Caddy reverse proxy on Adam's AWS EC2 validator node (3.92.110.107). It serves all on-chain EVM data including wallet balances, token transfers, smart contract calls, and transaction receipts. The Dashboard API and Explorer v2 depend on this directly. Caddy handles TLS termination and path-based routing (/rpc strips prefix before proxying to port 8545).",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://adamboudj.integralayer.com/rpc",
      docs: "https://docs.integralayer.com/nodes",
    },
    commonIssues: evmRpcCaddyIssues,
    tags: ["EVM", "Caddy", "AWS"],
  },
  {
    id: "mainnet-evm-ws",
    name: "Mainnet EVM WebSocket",
    category: "blockchain",
    environment: "prod",
    url: "wss://ws.integralayer.com",
    checkType: "websocket",
    timeout: 10000,
    enabled: false,
    dependsOn: [],
    impacts: [],
    description: "EVM WebSocket for mainnet — real-time event subscriptions",
    richDescription:
      "WebSocket endpoint for real-time EVM event subscriptions on mainnet, enabling live monitoring of token transfers, contract events, and new blocks without polling. Currently disabled but planned for real-time dashboard features like live transaction feeds and instant balance updates. When activated, it will reduce latency for event-driven workflows from 30s polling intervals to sub-second push notifications.",
    owner: OWNERS.adam,
    links: {
      endpoint: "wss://ws.integralayer.com",
      docs: "https://docs.integralayer.com/nodes",
    },
    commonIssues: [
      {
        cause: "WebSocket server not started or crashed",
        fix: "SSH in and check if the WS listener is active on the expected port; restart intgd",
      },
      {
        cause: "Firewall blocking WebSocket port",
        fix: "Check security group rules for the WebSocket port; ensure wss:// upgrade is allowed through the proxy",
      },
    ],
    tags: ["EVM", "WebSocket"],
  },
  {
    id: "mainnet-cosmos-rpc",
    name: "Mainnet Cosmos RPC",
    category: "blockchain",
    environment: "prod",
    url: "https://rpc.integralayer.com",
    checkType: "cosmos-rpc",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["explorer-mainnet"],
    impactDescription: "Mainnet explorer loses real-time block data",
    description:
      "Cosmos RPC for mainnet — block data, transaction broadcasting, validator info",
    richDescription:
      "The primary CometBFT RPC endpoint for the Integra mainnet, handling block queries, transaction broadcasting, validator set lookups, and consensus state. This is the backbone of the mainnet block explorer — it sources all real-time block data, transaction details, and validator information displayed to users. The explorer, staking interfaces, and governance tooling all query this node. Downtime means the explorer shows stale data and users cannot broadcast Cosmos-side transactions.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://rpc.integralayer.com",
      docs: "https://docs.integralayer.com/nodes",
    },
    commonIssues: cosmosRpcIssues,
    tags: ["Tendermint", "CometBFT"],
  },
  {
    id: "mainnet-cosmos-rpc2",
    name: "Mainnet Cosmos RPC 2",
    category: "blockchain",
    environment: "prod",
    url: "https://rpc2.integralayer.com",
    checkType: "cosmos-rpc",
    timeout: 10000,
    enabled: false,
    dependsOn: [],
    impacts: [],
    description: "Cosmos RPC backup for mainnet — failover node",
    richDescription:
      "Backup CometBFT RPC node for mainnet, providing automatic failover if the primary RPC (rpc.integralayer.com) goes down or becomes unresponsive. Runs on a separate server from the primary node for geographic and infrastructure redundancy. Currently disabled in monitoring but kept synced and ready for emergency activation — can be promoted to primary within minutes by updating DNS records.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://rpc2.integralayer.com",
      docs: "https://docs.integralayer.com/nodes",
    },
    commonIssues: cosmosRpcIssues,
    tags: ["Tendermint"],
  },
  {
    id: "mainnet-cosmos-rest",
    name: "Mainnet REST/LCD",
    category: "blockchain",
    environment: "prod",
    url: "https://api.integralayer.com",
    checkType: "cosmos-rest",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["explorer-mainnet"],
    impactDescription: "Mainnet explorer loses validator and governance data",
    description:
      "Cosmos REST/LCD for mainnet — governance, staking queries, account info",
    richDescription:
      "The Cosmos REST (LCD) endpoint for mainnet, serving governance proposals, staking delegation data, account balances, validator sets, and distribution rewards via standard HTTP REST calls. The explorer depends on this heavily for validator detail pages, governance proposal displays, and account lookup features. External integrations (wallets, aggregators) also use this endpoint for IRL token balance queries. If down, governance and staking data disappears from all consumer applications.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://api.integralayer.com",
      docs: "https://docs.integralayer.com/nodes",
    },
    commonIssues: cosmosRestIssues,
    tags: ["Cosmos SDK"],
  },

  // -- Blockchain (Mainnet -- Adam's gateway, adamboudj.integralayer.com) ----
  {
    id: "mainnet-cosmos-rpc-adam",
    name: "Mainnet Cosmos RPC (Adam)",
    category: "blockchain",
    environment: "prod",
    url: "https://adamboudj.integralayer.com/cometbft",
    checkType: "cosmos-rpc",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["explorer-v2"],
    impactDescription: "Explorer v2 loses block data if primary also down",
    description: "Adam's Cosmos RPC gateway — CometBFT via Caddy reverse proxy",
    richDescription:
      "Secondary CometBFT RPC endpoint for mainnet, proxied through Caddy on Adam's validator node. Powers the Callisto block indexer for the Explorer v2 with real-time block data, transaction details, and validator information. Provides an alternative RPC path independent of the primary rpc.integralayer.com infrastructure.",
    owner: OWNERS.adam,
    links: { endpoint: "https://adamboudj.integralayer.com/cometbft" },
    commonIssues: cosmosRpcCaddyIssues,
    tags: ["CometBFT", "Caddy", "AWS"],
  },
  {
    id: "mainnet-cosmos-rest-adam",
    name: "Mainnet REST/LCD (Adam)",
    category: "blockchain",
    environment: "prod",
    url: "https://adamboudj.integralayer.com/rest",
    checkType: "cosmos-rest",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description:
      "Adam's REST/LCD gateway — Cosmos REST via Caddy reverse proxy",
    richDescription:
      "Secondary Cosmos REST/LCD endpoint for mainnet, served via Caddy on Adam's validator node. Provides governance, staking, and account queries as a fallback to the primary api.integralayer.com endpoint. Used by the Explorer v2 staking indexer for validator set queries every 100 blocks.",
    owner: OWNERS.adam,
    links: { endpoint: "https://adamboudj.integralayer.com/rest" },
    commonIssues: cosmosRestCaddyIssues,
    tags: ["Cosmos SDK", "Caddy", "AWS"],
  },

  // -- Blockchain (Testnet -- ormos-1, EVM chain 26218) ----------------------
  {
    id: "testnet-evm-rpc",
    name: "Testnet EVM RPC",
    category: "blockchain",
    environment: "dev",
    url: "https://testnet-evm.integralayer.com",
    checkType: "evm-rpc",
    timeout: 10000,
    enabled: true,
    expectedChainId: "0x666a",
    dependsOn: [],
    impacts: [],
    description:
      "EVM JSON-RPC for testnet Ormos (chain 26218) — development & testing",
    richDescription:
      "EVM JSON-RPC for the Ormos testnet (chain ID 26218), used by the development team for testing smart contract deployments, EVM transaction flows, and wallet integration before mainnet release. Nawar and Kalki rely on this for testing Dashboard and Explorer EVM features against real chain state. Downtime blocks the entire dev team from testing any EVM-related feature changes.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://testnet-evm.integralayer.com",
      docs: "https://docs.integralayer.com/nodes",
    },
    commonIssues: evmRpcIssues,
    tags: ["EVM", "Cosmos SDK"],
  },
  {
    id: "testnet-cosmos-rpc",
    name: "Testnet Cosmos RPC",
    category: "blockchain",
    environment: "dev",
    url: "https://testnet-rpc.integralayer.com",
    checkType: "cosmos-rpc",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["explorer-testnet"],
    impactDescription: "Testnet explorer loses real-time block data",
    description: "Cosmos RPC for testnet — development block data and testing",
    richDescription:
      "CometBFT RPC for the Ormos testnet chain, providing block data, transaction broadcasting, and consensus state for development and QA. Powers the testnet block explorer with live chain data. The entire development workflow for Cosmos-side features depends on this — staking tests, governance simulations, and transaction verification all run against this endpoint. Outages halt QA cycles for features headed to mainnet.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://testnet-rpc.integralayer.com",
      docs: "https://docs.integralayer.com/nodes",
    },
    commonIssues: cosmosRpcIssues,
    tags: ["Tendermint"],
  },
  {
    id: "testnet-cosmos-rest",
    name: "Testnet REST/LCD",
    category: "blockchain",
    environment: "dev",
    url: "https://testnet-api.integralayer.com",
    checkType: "cosmos-rest",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["explorer-testnet"],
    impactDescription: "Testnet explorer loses validator and governance data",
    description:
      "Cosmos REST/LCD for testnet — development queries and testing",
    richDescription:
      "Cosmos REST/LCD for the Ormos testnet, serving governance, staking, and account queries over HTTP for development. The testnet explorer depends on this for displaying validator and governance data during QA. Also used by the backend team for integration testing Dashboard API features against realistic chain data before promoting to production.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://testnet-api.integralayer.com",
      docs: "https://docs.integralayer.com/nodes",
    },
    commonIssues: cosmosRestIssues,
    tags: ["Cosmos SDK"],
  },

  // -- Blockchain (Testnet -- Ormos gateway, ormos.integralayer.com) ---------
  {
    id: "testnet-evm-rpc-ormos",
    name: "Testnet EVM RPC (Ormos)",
    category: "blockchain",
    environment: "dev",
    url: "https://ormos.integralayer.com/rpc",
    checkType: "evm-rpc",
    timeout: 10000,
    enabled: true,
    expectedChainId: "0x666a",
    dependsOn: [],
    impacts: [],
    description:
      "Ormos testnet EVM RPC gateway — Caddy reverse proxy to local EVM node",
    richDescription:
      "EVM JSON-RPC endpoint for the Ormos testnet (chain ID 26218), served via Caddy reverse proxy on Adam's testnet AWS EC2 validator node (13.218.88.209). Provides a secondary EVM RPC path for testnet development. Caddy handles TLS termination via Let's Encrypt and path-based routing (/rpc strips prefix before proxying to port 8545). Also used by the IntegraWatch Telegram bot for faucet token sends.",
    owner: OWNERS.adam,
    links: { endpoint: "https://ormos.integralayer.com/rpc" },
    commonIssues: evmRpcCaddyIssues,
    tags: ["EVM", "Caddy", "AWS"],
  },
  {
    id: "testnet-cosmos-rpc-ormos",
    name: "Testnet Cosmos RPC (Ormos)",
    category: "blockchain",
    environment: "dev",
    url: "https://ormos.integralayer.com/cometbft",
    checkType: "cosmos-rpc",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description:
      "Ormos testnet Cosmos RPC gateway — CometBFT via Caddy reverse proxy",
    richDescription:
      "Secondary CometBFT RPC endpoint for the Ormos testnet, proxied through Caddy on Adam's testnet validator node. Provides an alternative RPC path to the primary testnet-rpc.integralayer.com endpoint. Used by the IntegraWatch Telegram bot for /status validator monitoring.",
    owner: OWNERS.adam,
    links: { endpoint: "https://ormos.integralayer.com/cometbft" },
    commonIssues: cosmosRpcCaddyIssues,
    tags: ["CometBFT", "Caddy", "AWS"],
  },
  {
    id: "testnet-cosmos-rest-ormos",
    name: "Testnet REST/LCD (Ormos)",
    category: "blockchain",
    environment: "dev",
    url: "https://ormos.integralayer.com/rest",
    checkType: "cosmos-rest",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description:
      "Ormos testnet REST/LCD gateway — Cosmos REST via Caddy reverse proxy",
    richDescription:
      "Secondary Cosmos REST/LCD endpoint for the Ormos testnet, served via Caddy on Adam's testnet validator node. Provides governance, staking, and account queries as a fallback to the primary testnet-api.integralayer.com endpoint.",
    owner: OWNERS.adam,
    links: { endpoint: "https://ormos.integralayer.com/rest" },
    commonIssues: cosmosRestCaddyIssues,
    tags: ["Cosmos SDK", "Caddy", "AWS"],
  },
  {
    id: "testnet-faucet-api",
    name: "Testnet Faucet API",
    category: "apis",
    environment: "dev",
    url: "https://ormos.integralayer.com/api/faucet",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: ["testnet-cosmos-rpc-ormos"],
    impacts: [],
    description: "Testnet faucet — dispenses test IRL tokens to developers",
    richDescription:
      "Testnet faucet API running on Adam's Ormos validator node (13.218.88.209), proxied via Caddy at /api/faucet. Dispenses test IRL tokens to developer wallet addresses for testing smart contracts, transaction flows, and staking features on the Ormos testnet. Includes a cooldown timer to prevent abuse. Depends on the testnet Cosmos RPC for broadcasting faucet transactions.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://ormos.integralayer.com/api/faucet",
      docs: "https://docs.integralayer.com",
      repo: "https://github.com/Integra-layer/docs",
    },
    commonIssues: [
      {
        cause: "Faucet wallet out of test IRL tokens",
        fix: "Top up the faucet wallet from the testnet genesis account or mint new tokens",
      },
      {
        cause: "Caddy not routing /api/faucet correctly",
        fix: "Check Caddyfile route; ensure handle_path strips /api/faucet prefix before proxying",
      },
      {
        cause: "Cosmos RPC dependency down",
        fix: "Faucet cannot broadcast transactions without RPC; fix testnet-cosmos-rpc-ormos first",
      },
    ],
    tags: ["API", "Caddy", "AWS"],
  },

  // -- Validators (mainnet) --------------------------------------------------
  {
    id: "validator-1",
    name: "Validator 1",
    category: "validators",
    environment: "prod",
    url: "http://165.227.118.77:26657",
    checkType: "cosmos-peer-check",
    peerIp: "3.92.110.107",
    publicRpc: "https://rpc.integralayer.com",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description:
      "Mainnet validator node (DigitalOcean) — block production and consensus",
    richDescription:
      "Primary mainnet validator node hosted on DigitalOcean (NYC region), actively participating in CometBFT consensus and block production for the Integra network. This is one of four validators in the active set — its voting power directly influences block finality times. If this validator goes offline, the network loses ~25% of voting power, which degrades block production speed and could risk chain halts if combined with another validator failure. Monitored via peer connectivity checks against the public RPC.",
    owner: OWNERS.adam,
    links: { endpoint: "http://165.227.118.77:26657" },
    commonIssues: validatorPeerIssues,
    tags: ["CometBFT", "DigitalOcean"],
  },
  {
    id: "validator-2",
    name: "Validator 2",
    category: "validators",
    environment: "prod",
    url: "http://159.65.168.118:26657",
    checkType: "cosmos-peer-check",
    peerIp: "159.65.168.118",
    publicRpc: "https://rpc.integralayer.com",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description:
      "Mainnet validator node (DigitalOcean) — block production and consensus",
    richDescription:
      "Second mainnet validator on DigitalOcean, contributing to BFT consensus and block finality for Integra mainnet. Provides redundancy in the validator set — if Validator 1 goes down, this node and others maintain consensus. Geographic separation from other nodes ensures the network withstands regional outages. Its consistent uptime is critical for maintaining the 2/3+ voting power threshold required for block production.",
    owner: OWNERS.adam,
    links: { endpoint: "http://159.65.168.118:26657" },
    commonIssues: validatorPeerIssues,
    tags: ["CometBFT", "DigitalOcean"],
  },
  {
    id: "validator-3",
    name: "Validator 3",
    category: "validators",
    environment: "prod",
    url: "http://104.131.34.167:26657",
    checkType: "cosmos-peer-check",
    peerIp: "104.131.34.167",
    publicRpc: "https://rpc.integralayer.com",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description:
      "Mainnet validator node (DigitalOcean) — block production and consensus",
    richDescription:
      "Third mainnet validator on DigitalOcean, completing the infrastructure-managed validator trio. Participates in block signing, consensus voting, and maintains a full copy of chain state. Together with Validators 1 and 2, this node ensures the network has sufficient voting power for liveness even if one validator is temporarily down. Monitored for peer connectivity and block-signing participation.",
    owner: OWNERS.adam,
    links: { endpoint: "http://104.131.34.167:26657" },
    commonIssues: validatorPeerIssues,
    tags: ["CometBFT", "DigitalOcean"],
  },
  {
    id: "validator-adam",
    name: "Adam's Node (AWS)",
    category: "validators",
    environment: "prod",
    url: "http://adamboudj.integralayer.com:26657",
    checkType: "cosmos-peer-check",
    peerIp: "3.92.110.107",
    publicRpc: "https://rpc.integralayer.com",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "Adam's validator node (AWS Singapore) — personal validator",
    richDescription:
      "Adam's personal validator node running on AWS EC2 in Singapore (ap-southeast-1), providing Asia-Pacific geographic diversity to the validator set. This is the only validator outside the DigitalOcean infrastructure, reducing single-provider risk. Bonded with 100 IRL tokens staked, actively signing blocks and earning staking rewards. Managed directly by Adam with separate SSH keys and monitoring — contact adam@integralayer.com for any issues with this specific node.",
    owner: OWNERS.adam,
    links: { endpoint: "http://adamboudj.integralayer.com:26657" },
    commonIssues: [
      {
        cause: "Validator not in peer list — node may be offline",
        fix: "SSH into AWS EC2 (3.92.110.107): ssh -i ~/.ssh/integra-validator-key.pem ubuntu@3.92.110.107; check: sudo systemctl status intgd",
      },
      {
        cause: "AWS EC2 instance stopped or terminated",
        fix: "Check AWS console for instance i-* in ap-southeast-1; restart if stopped",
      },
      {
        cause: "Validator jailed due to downtime",
        fix: "Check jail status: intgd query staking validator integravaloper124gllptlcu2ew5guxnyvcc483jwkwj8mejng0m; unjail with: intgd tx slashing unjail",
      },
    ],
    tags: ["CometBFT", "AWS"],
  },

  // -- Backend APIs ----------------------------------------------------------
  {
    id: "passport-api",
    name: "Passport API",
    category: "apis",
    environment: "prod",
    url: "https://passport-apis.integralayer.com/health/database",
    checkType: "api-health",
    timeout: 10000,
    enabled: false,
    dependsOn: ["web3auth", "google-oauth"],
    impacts: [],
    description: "Passport authentication — wallet pregeneration, social login",
    richDescription:
      "The authentication gateway for Integra, handling user signup and login via Web3Auth wallet pregeneration and Google OAuth social login. Built with NestJS and PostgreSQL, it creates non-custodial Integra wallets automatically when users sign up — no seed phrase management required. Depends on both Web3Auth (for wallet creation) and Google OAuth (for social login). Currently disabled pending the next onboarding flow release, but when active, it is the single entry point for all new user registrations.",
    owner: OWNERS.nawar,
    links: {
      endpoint: "https://passport-apis.integralayer.com/health/database",
      docs: "https://docs.integralayer.com",
    },
    commonIssues: [
      {
        cause: "NestJS application crashed or OOM killed",
        fix: "Check application logs; restart the service; verify memory limits on the host",
      },
      {
        cause: "PostgreSQL database connection failed",
        fix: "Verify database is running and accessible; check connection string in environment variables",
      },
      {
        cause: "Web3Auth or Google OAuth dependency down",
        fix: "Check web3auth and google-oauth endpoint status; Passport cannot create wallets or authenticate without them",
      },
    ],
    tags: ["NestJS", "PostgreSQL"],
  },
  {
    id: "dashboard-api-prod",
    name: "Dashboard API",
    category: "apis",
    environment: "prod",
    url: "https://dashboard-apis.integralayer.com",
    checkType: "deep-health",
    healthUrl: "https://dashboard-apis.integralayer.com/health",
    timeout: 10000,
    enabled: true,
    dependsOn: ["absinthe-api"],
    impacts: ["dashboard-prod"],
    impactDescription: "Production dashboard fully unavailable",
    description:
      "Dashboard backend — auth, assets, XP, staking, bulk imports (75+ endpoints)",
    richDescription:
      "The primary backend powering the Integra Dashboard with 75+ REST API endpoints, built with NestJS, PostgreSQL, and JWT authentication. Handles portfolio management, staking position tracking, XP/points integration, asset management, bulk CSV imports, and notification preferences. The production Dashboard frontend is 100% dependent on this — if it goes down, users see a blank dashboard. Depends on the Absinthe XP API for points and leaderboard data. Deep health checks verify database connectivity and cache availability.",
    owner: OWNERS.nawar,
    links: {
      endpoint: "https://dashboard-apis.integralayer.com",
      docs: "https://docs.integralayer.com",
      repo: "https://github.com/Integra-layer/dashboard",
    },
    commonIssues: [
      {
        cause: "NestJS application crashed or OOM killed",
        fix: "Check application logs on the server; restart the service",
      },
      {
        cause: "PostgreSQL database connection pool exhausted",
        fix: "Restart the service to reset DB connections; check max_connections and pool size in config",
      },
      {
        cause: "Absinthe XP API dependency down",
        fix: "XP features will fail but core dashboard should still work; check absinthe-api status",
      },
    ],
    tags: ["NestJS", "PostgreSQL", "JWT"],
  },
  {
    id: "dashboard-api-dev",
    name: "Dashboard API (Dev)",
    category: "apis",
    environment: "dev",
    url: "https://dev-dashboard-apis.integralayer.com",
    checkType: "deep-health",
    healthUrl: "https://dev-dashboard-apis.integralayer.com/health",
    timeout: 10000,
    enabled: true,
    dependsOn: ["absinthe-api"],
    impacts: ["dashboard-dev"],
    impactDescription: "Dev dashboard fully unavailable",
    description: "Dashboard backend (dev) — same as prod, testnet networks",
    richDescription:
      "Development instance of the Dashboard API, running the same NestJS codebase as production but connected to testnet blockchain networks and a separate dev database. Used by Nawar and the backend team for feature development, API testing, and QA validation before promoting changes to production. Also depends on Absinthe for XP features. If down, the dev Dashboard frontend is completely unusable, blocking frontend development and integration testing.",
    owner: OWNERS.nawar,
    links: {
      endpoint: "https://dev-dashboard-apis.integralayer.com",
      docs: "https://docs.integralayer.com",
      repo: "https://github.com/Integra-layer/dashboard",
    },
    commonIssues: deepHealthApiIssues,
    tags: ["NestJS", "PostgreSQL"],
  },
  {
    id: "notification-api-prod",
    name: "Notification API",
    category: "apis",
    environment: "prod",
    url: "https://production-apis.integralayer.com",
    checkType: "deep-health",
    healthUrl: "https://production-apis.integralayer.com/health",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["dashboard-prod"],
    impactDescription: "Dashboard notifications and alerts stop working",
    description: "Push notifications and alerts for dashboard events",
    richDescription:
      "Push notification service built with NestJS, responsible for delivering real-time alerts to Dashboard users for staking rewards, governance proposal updates, transaction confirmations, and account activity. Processes event triggers from the Dashboard API and dispatches notifications via push and in-app channels. If this service goes down, users miss time-sensitive alerts about their staking rewards and governance votes. Deep health checks monitor database and queue connectivity.",
    owner: OWNERS.nawar,
    links: { endpoint: "https://production-apis.integralayer.com" },
    commonIssues: [
      {
        cause: "NestJS notification service crashed",
        fix: "Check application logs; restart the service",
      },
      {
        cause: "Push notification queue backed up or stalled",
        fix: "Check message queue health; clear stuck messages if needed; restart workers",
      },
      {
        cause: "Database connection pool exhausted",
        fix: "Restart the service to reset connections; check DB connection count",
      },
    ],
    tags: ["NestJS"],
  },
  {
    id: "notification-api-dev",
    name: "Notification API (Dev)",
    category: "apis",
    environment: "dev",
    url: "https://develop-apis.integralayer.com",
    checkType: "deep-health",
    healthUrl: "https://develop-apis.integralayer.com/health",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["dashboard-dev"],
    impactDescription: "Dev dashboard notifications stop working",
    description: "Notification service (dev) — testing notifications",
    richDescription:
      "Development instance of the Notification API, used for testing notification delivery logic, alert templates, and event trigger configurations before production deployment. Runs against a separate dev database and test notification channels. Essential for validating that new notification types render correctly and trigger at the right events. If down, the dev Dashboard loses notification functionality, blocking QA on notification-related features.",
    owner: OWNERS.nawar,
    links: { endpoint: "https://develop-apis.integralayer.com" },
    commonIssues: deepHealthApiIssues,
    tags: ["NestJS"],
  },
  {
    id: "city-api-prod",
    name: "City of Integra API",
    category: "apis",
    environment: "prod",
    url: "https://ng6mpgxjz7.ap-south-1.awsapprunner.com",
    checkType: "deep-health",
    healthUrl: "https://ng6mpgxjz7.ap-south-1.awsapprunner.com/health",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["city-prod"],
    impactDescription: "City builder game unavailable",
    description:
      "City of Integra game backend — city builder logic, game state",
    richDescription:
      "The game backend for City of Integra, a gamified city builder experience hosted on AWS App Runner in ap-south-1 (Mumbai). Manages all game state including building placement, resource generation, city progression, upgrade paths, and player inventories. The City Builder frontend is 100% dependent on this service — without it, the game is completely unplayable. Deep health checks verify database connectivity and game state consistency. Contact Kalki for game logic issues or Nawar for infrastructure/deployment concerns.",
    owner: OWNERS.kalki,
    links: {
      endpoint: "https://ng6mpgxjz7.ap-south-1.awsapprunner.com",
      repo: "https://github.com/Integra-layer/city",
    },
    commonIssues: [
      {
        cause: "AWS App Runner service crashed or scaling issue",
        fix: "Check AWS App Runner console in ap-south-1; force new deployment if stuck",
      },
      {
        cause: "Database connection pool exhausted",
        fix: "Restart the App Runner service; check DB connection limits and pool configuration",
      },
      {
        cause: "Game state corruption or migration failure",
        fix: "Check application logs for schema errors; contact Kalki for game logic issues",
      },
    ],
    tags: ["AppRunner"],
  },
  {
    id: "city-api-dev",
    name: "City of Integra API (Dev)",
    category: "apis",
    environment: "dev",
    url: "https://ygmwadph3x.ap-south-1.awsapprunner.com",
    checkType: "deep-health",
    healthUrl: "https://ygmwadph3x.ap-south-1.awsapprunner.com/health",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["city-dev"],
    impactDescription: "Dev city builder unavailable",
    description: "City of Integra game backend (dev)",
    richDescription:
      "Development instance of the City of Integra game backend on AWS App Runner (Mumbai), used for testing new game mechanics, balance tuning, feature prototyping, and QA before production release. Runs against a separate dev database with test game state. If down, Kalki and the game team cannot test new features or validate bug fixes. Also used for load testing game logic before mainnet events.",
    owner: OWNERS.kalki,
    links: {
      endpoint: "https://ygmwadph3x.ap-south-1.awsapprunner.com",
      repo: "https://github.com/Integra-layer/city",
    },
    commonIssues: [
      {
        cause: "AWS App Runner dev service crashed",
        fix: "Check AWS App Runner console in ap-south-1; force new deployment",
      },
      {
        cause: "Dev database out of sync with schema",
        fix: "Run pending migrations; check for failed migration logs in App Runner",
      },
      {
        cause: "App Runner cold start timeout",
        fix: "Dev instances may scale to zero; retry request — App Runner will auto-provision",
      },
    ],
    tags: ["AppRunner"],
  },
  {
    id: "supply-api",
    name: "Circulating Supply",
    category: "apis",
    environment: "prod",
    url: "https://supply.polytrade.finance",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "Circulating token supply endpoint for exchanges/aggregators",
    richDescription:
      "A lightweight API endpoint serving the current circulating supply of IRL tokens, consumed by cryptocurrency exchanges (for market cap calculations), data aggregators like CoinGecko and CoinMarketCap, and portfolio trackers. Returns a single number but has outsized importance — incorrect or unavailable supply data causes wrong market cap figures across all listing platforms. Hosted on Polytrade infrastructure (legacy domain). Contact Parth for supply calculation logic updates.",
    owner: OWNERS.parth,
    links: { endpoint: "https://supply.polytrade.finance" },
    commonIssues: [
      {
        cause: "Polytrade infrastructure hosting issue",
        fix: "Contact Parth — this is hosted on legacy Polytrade infrastructure",
      },
      {
        cause: "Supply calculation returning incorrect value",
        fix: "Verify the supply calculation logic; check if chain data source is accessible",
      },
    ],
    tags: ["API"],
  },
  {
    id: "price-api",
    name: "Pricing API",
    category: "apis",
    environment: "prod",
    url: "https://price.api.polytrade.app",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["dashboard-prod"],
    impactDescription: "Token prices missing from dashboard",
    description: "Token pricing data for dashboard display",
    richDescription:
      "Real-time token pricing API that aggregates IRL and related token prices from multiple sources, serving them to the Dashboard for portfolio valuations, staking reward estimates, and transaction value displays. If this endpoint goes down or returns stale data, users see incorrect portfolio totals and missing price charts in the production Dashboard. Hosted on Polytrade infrastructure. No external dependencies but impacts user confidence when prices appear stale or zero.",
    owner: OWNERS.parth,
    links: { endpoint: "https://price.api.polytrade.app" },
    commonIssues: [
      {
        cause: "Price aggregation source unreachable",
        fix: "Check upstream price feeds (CoinGecko, DEX); service may return stale cached prices",
      },
      {
        cause: "Polytrade infrastructure hosting issue",
        fix: "Contact Parth — this is hosted on legacy Polytrade infrastructure",
      },
    ],
    tags: ["API"],
  },
  {
    id: "presign-api",
    name: "Presigned URL API",
    category: "apis",
    environment: "prod",
    url: "https://presign.api.polytrade.app",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "Pre-signed URL generation for secure file uploads to S3",
    richDescription:
      "Stateless microservice that generates time-limited pre-signed AWS S3 URLs for secure file uploads, used by the Dashboard for document uploads (KYC, title deeds) and the City Builder for asset uploads. Each URL expires after 15 minutes and is scoped to a specific S3 path. If down, all file upload workflows across the platform fail silently — users see upload buttons but files never reach S3. Contact Parth for S3 bucket configuration or CORS issues.",
    owner: OWNERS.parth,
    links: { endpoint: "https://presign.api.polytrade.app" },
    commonIssues: [
      {
        cause: "AWS S3 credentials expired or rotated",
        fix: "Check IAM role/credentials for S3 access; rotate keys if expired",
      },
      {
        cause: "S3 bucket CORS misconfigured",
        fix: "Verify CORS settings on the target S3 bucket allow the frontend origin",
      },
      {
        cause: "Polytrade infrastructure hosting issue",
        fix: "Contact Parth — hosted on legacy Polytrade infrastructure",
      },
    ],
    tags: ["AWS S3"],
  },
  {
    id: "upload-tracker-api",
    name: "Upload Tracker",
    category: "apis",
    environment: "prod",
    url: "https://upload-tracker.api.polytrade.app",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "Tracks file upload status and metadata",
    richDescription:
      'Companion service to the Presigned URL API that tracks file upload progress, stores metadata (file size, type, upload timestamp), and confirms successful uploads to the requesting application. The Dashboard polls this service to show upload progress bars and confirm document receipt. If down, uploads still succeed (files reach S3) but the frontend shows perpetual "uploading" spinners and cannot confirm completion to the user.',
    owner: OWNERS.parth,
    links: { endpoint: "https://upload-tracker.api.polytrade.app" },
    commonIssues: [
      {
        cause: "Tracker service crashed or unresponsive",
        fix: "Restart the upload tracker service; check application logs",
      },
      {
        cause: "Polytrade infrastructure hosting issue",
        fix: "Contact Parth — hosted on legacy Polytrade infrastructure",
      },
    ],
    tags: ["API"],
  },

  // -- Frontends & Explorers -------------------------------------------------
  {
    id: "explorer-mainnet",
    name: "Explorer (Mainnet)",
    category: "frontends",
    environment: "prod",
    url: "https://explorer.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["mainnet-cosmos-rpc", "mainnet-cosmos-rest"],
    impacts: [],
    description:
      "Block explorer for mainnet — transactions, blocks, validators",
    richDescription:
      "The mainnet block explorer built with Next.js and deployed on Vercel, providing transaction lookup, block browsing, validator profiles, governance proposal tracking, and account balance queries. This is the primary tool for anyone inspecting on-chain activity — validators checking their signing status, users verifying transactions, and developers debugging contract interactions. Depends on both the Cosmos RPC (for real-time blocks) and REST/LCD (for validator and governance data). Contact Kalki for explorer application issues.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://explorer.integralayer.com",
      docs: "https://docs.integralayer.com",
      repo: "https://github.com/Integra-layer/explorer",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["Next.js", "Vercel"],
  },
  {
    id: "explorer-testnet",
    name: "Explorer (Testnet)",
    category: "frontends",
    environment: "dev",
    url: "https://testnet.explorer.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["testnet-cosmos-rpc", "testnet-cosmos-rest"],
    impacts: [],
    description: "Block explorer for testnet — development testing",
    richDescription:
      "Testnet block explorer for the Ormos chain, running the same Next.js codebase as the mainnet explorer but connected to testnet RPC and REST endpoints. Used daily by the dev team to verify test transactions, inspect testnet blocks, and validate governance features during QA. Depends on testnet Cosmos RPC and REST. If down, developers lose visibility into testnet chain activity and must resort to CLI queries for debugging.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://testnet.explorer.integralayer.com",
      docs: "https://docs.integralayer.com",
      repo: "https://github.com/Integra-layer/explorer",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["Next.js", "Vercel"],
  },
  {
    id: "explorer-v2",
    name: "Explorer v2 (Mainnet)",
    category: "frontends",
    environment: "prod",
    url: "https://scan.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["mainnet-cosmos-rpc-adam", "mainnet-evm-rpc"],
    impacts: [],
    description: "Explorer v2 — Big Dipper fork with Cosmos + EVM indexing",
    richDescription:
      "Full-rewrite block explorer (Big Dipper 2.0 fork) deployed on Adam's mainnet validator node (3.92.110.107) via Caddy reverse proxy. Built with Next.js 16 + React 19 + Tailwind v4 + Apollo Client 3. Backed by PostgreSQL 15 (54 tables), Hasura v2.29.0 GraphQL engine, and the Callisto Go indexer for both Cosmos and EVM data. Features gas analytics, address labels, contract verification, and validator staking views. Depends on Adam's CometBFT RPC and EVM RPC endpoints for live indexing.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://scan.integralayer.com",
      repo: "https://github.com/Integra-layer/bid-dipper",
    },
    commonIssues: [
      {
        cause: "Explorer web service (explorer-web.service) crashed",
        fix: "SSH in and restart: sudo systemctl restart explorer-web; check logs: journalctl -u explorer-web -n 50",
      },
      {
        cause: "Callisto indexer stopped or fell behind",
        fix: "Check Callisto service: sudo systemctl status callisto; restart if needed; check indexing lag in PostgreSQL",
      },
      {
        cause: "Hasura GraphQL engine down",
        fix: "Check Docker containers: docker ps | grep hasura; restart: docker compose -f /path/to/docker-compose.yml restart hasura",
      },
    ],
    tags: ["Next.js", "Hasura", "Go", "AWS"],
  },
  {
    id: "explorer-graphql",
    name: "Explorer GraphQL API",
    category: "apis",
    environment: "prod",
    url: "https://scan.integralayer.com/v1/graphql",
    checkType: "graphql",
    timeout: 10000,
    enabled: true,
    dependsOn: ["explorer-v2"],
    impacts: [],
    description:
      "Hasura GraphQL API for Explorer v2 — blocks, transactions, validators",
    richDescription:
      "Hasura v2.29.0 GraphQL engine serving the Explorer v2 data layer. Tracks 51 PostgreSQL tables and 3 analytics functions (recent_gas_stats, gas_price_tiers, gas_price_by_day). Provides real-time queries for blocks, transactions, validators, staking data, EVM tokens, and address labels. Used by the Explorer v2 frontend via Apollo Client. Health depends on both PostgreSQL and the Callisto indexer keeping data fresh.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://scan.integralayer.com/v1/graphql",
      repo: "https://github.com/Integra-layer/bid-dipper",
    },
    commonIssues: [
      {
        cause: "Hasura container crashed or out of memory",
        fix: "Check: docker ps | grep hasura; restart: docker compose restart hasura",
      },
      {
        cause: "PostgreSQL database connection failed",
        fix: "Check PostgreSQL container: docker ps | grep postgres; verify connection in Hasura environment variables",
      },
      {
        cause: "Hasura metadata inconsistency",
        fix: "Re-apply metadata: run /tmp/apply_hasura_metadata.py on the server; check for tracked table/function mismatches",
      },
    ],
    tags: ["GraphQL", "Hasura", "PostgreSQL"],
  },
  {
    id: "blockscout-mainnet",
    name: "Blockscout EVM (Mainnet)",
    category: "frontends",
    environment: "prod",
    url: "https://blockscout.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["mainnet-evm-rpc"],
    impacts: [],
    description:
      "Blockscout EVM explorer for mainnet — EVM transactions, tokens, contracts",
    richDescription:
      "Blockscout EVM block explorer for Integra mainnet (chain ID 26217), deployed via Docker Compose on Adam's validator EC2 (3.92.110.107). Backend indexes EVM blocks, transactions, token transfers, and contract interactions via JSON-RPC. Frontend provides transaction search, address pages, token lists, gas tracker, and contract verification. Caddy reverse proxies blockscout.integralayer.com to the frontend (port 3002) and API (port 4000). Depends on the local EVM RPC node for indexing.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://blockscout.integralayer.com",
      repo: "https://github.com/Integra-layer/bid-dipper",
    },
    commonIssues: [
      {
        cause: "Blockscout Docker containers stopped",
        fix: "SSH in; check: docker ps | grep blockscout; restart: docker compose up -d blockscout",
      },
      {
        cause: "Blockscout indexer fell behind or stuck",
        fix: "Check indexer logs: docker logs blockscout-backend --tail 100; may need to restart backend container",
      },
      {
        cause: "Caddy not routing blockscout.integralayer.com correctly",
        fix: "Check Caddyfile for blockscout reverse proxy config; verify ports 3002 (frontend) and 4000 (API)",
      },
    ],
    tags: ["Blockscout", "Docker", "AWS"],
  },
  {
    id: "blockscout-testnet",
    name: "Blockscout EVM (Testnet)",
    category: "frontends",
    environment: "dev",
    url: "https://testnet.blockscout.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["testnet-evm-rpc-ormos"],
    impacts: [],
    description:
      "Blockscout EVM explorer for testnet Ormos — development EVM testing",
    richDescription:
      "Blockscout EVM block explorer for the Ormos testnet (chain ID 26218), deployed via Docker Compose on Adam's testnet EC2 (13.218.88.209). Same stack as mainnet — backend on port 4001 (port 4000 occupied by faucet), frontend on port 3002. Caddy reverse proxies testnet.blockscout.integralayer.com. Used by the dev team for inspecting testnet EVM transactions, verifying contract deployments, and testing token transfers before mainnet.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://testnet.blockscout.integralayer.com",
      repo: "https://github.com/Integra-layer/bid-dipper",
    },
    commonIssues: [
      {
        cause: "Blockscout Docker containers stopped on testnet EC2",
        fix: "SSH into 13.218.88.209; check: docker ps | grep blockscout; restart: docker compose up -d",
      },
      {
        cause: "Testnet Blockscout backend on port 4001 (not 4000)",
        fix: "Port 4000 is used by faucet on testnet; verify backend is on 4001 in docker-compose.yml",
      },
      {
        cause: "Caddy not routing testnet.blockscout.integralayer.com",
        fix: "Check Caddyfile on testnet server for blockscout reverse proxy routes",
      },
    ],
    tags: ["Blockscout", "Docker", "AWS"],
  },
  {
    id: "status-page",
    name: "Status Page",
    category: "frontends",
    environment: "prod",
    url: "https://status.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["vercel"],
    impacts: [],
    description:
      "Infrastructure status dashboard — real-time health monitoring",
    richDescription:
      "The Integra infrastructure status page deployed on Vercel at status.integralayer.com, monitoring 40+ endpoints across blockchain nodes, validators, APIs, frontends, and external services. Self-monitoring ensures the status page itself is accessible when users need to check system health during incidents.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://status.integralayer.com",
      repo: "https://github.com/Integra-layer/integra-status",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["Vercel"],
  },
  {
    id: "integra-connect",
    name: "Integra Connect",
    category: "frontends",
    environment: "prod",
    url: "https://integra-connect.vercel.app",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "Validator dashboard — chain status, health, wallet connect",
    richDescription:
      "Validator dashboard web app built with Next.js 15 + TypeScript + Tailwind + shadcn/ui, deployed on Vercel. Features chain status monitoring, health dashboard, wallet connect (MetaMask/Keplr/OKX), and a mainnet/testnet network toggle. Provides validators and stakers with a quick overview of network health and their staking positions across both networks.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://integra-connect.vercel.app",
      repo: "https://github.com/Integra-layer/integra-connect",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["Next.js", "Vercel"],
  },
  {
    id: "portal-mainnet",
    name: "Blockchain Portal (Mainnet)",
    category: "frontends",
    environment: "prod",
    url: "https://mainnet.integralayer.com",
    checkType: "http-get",
    timeout: 15000,
    enabled: true,
    dependsOn: ["mainnet-evm-rpc", "mainnet-cosmos-rpc-adam"],
    impacts: [],
    description:
      "Mainnet blockchain portal — validators, governance, chain info",
    richDescription:
      "The mainnet blockchain portal for Integra Layer, providing a unified gateway to network metrics (block height, total bonded, active validators), validator browsing, governance proposals, chain parameters, and node operator dashboard. Also lists all mainnet RPC/REST/WebSocket endpoints for developers. This is the primary entry point for validators and stakers interacting with the Integra mainnet. Deployed on Vercel with Next.js.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://mainnet.integralayer.com",
      docs: "https://docs.integralayer.com",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["Next.js", "Vercel", "Portal"],
  },
  {
    id: "portal-testnet",
    name: "Blockchain Portal (Testnet)",
    category: "frontends",
    environment: "dev",
    url: "https://testnet.integralayer.com",
    checkType: "http-get",
    timeout: 15000,
    enabled: true,
    dependsOn: ["testnet-evm-rpc", "testnet-cosmos-rpc"],
    impacts: [],
    description:
      "Testnet blockchain portal — validators, governance, chain info (Ormos)",
    richDescription:
      "The testnet blockchain portal for the Ormos chain, same app as mainnet but connected to testnet endpoints. Provides network metrics, validator list, governance proposals, and chain parameters for the Ormos testnet (EVM chain ID 26218). Used by the dev team and external testers to interact with the testnet. If down, validators and testers lose the primary UI for testnet chain interaction.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://testnet.integralayer.com",
      docs: "https://docs.integralayer.com",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["Next.js", "Vercel", "Portal"],
  },
  {
    id: "docs-site",
    name: "Documentation",
    category: "frontends",
    environment: "prod",
    url: "https://docs.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["vercel"],
    impacts: [],
    description: "Developer documentation and integration guides",
    richDescription:
      "Developer documentation site built with Docusaurus and hosted on Vercel, containing API references, SDK integration guides, node operator runbooks, architecture overviews, and smart contract documentation. This is the first stop for external developers integrating with Integra and for internal team members referencing API specs. If down, developer onboarding stalls and the team loses access to canonical API documentation. Contact Tara for content updates or Vercel deployment issues.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://docs.integralayer.com",
      docs: "https://docs.integralayer.com",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["Docusaurus", "Vercel"],
  },
  {
    id: "main-website",
    name: "Integra Website",
    category: "frontends",
    environment: "prod",
    url: "https://integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["vercel"],
    impacts: [],
    description: "Integra Layer marketing website",
    richDescription:
      "The primary public-facing website for Integra Layer, built with Next.js and deployed on Vercel. Serves as the main entry point for potential users, investors, partners, and developers discovering the Integra ecosystem. Contains the product overview, team page, ecosystem links, blog, and investor materials. Downtime is highly visible — it is the first URL shared in pitches, press releases, and social media. Contact Tara for content or deployment.",
    owner: OWNERS.tara,
    links: { endpoint: "https://integralayer.com" },
    commonIssues: vercelFrontendIssues,
    tags: ["Next.js", "Vercel"],
  },
  {
    id: "dashboard-prod",
    name: "Dashboard",
    category: "frontends",
    environment: "prod",
    url: "https://dashboard.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["dashboard-api-prod"],
    impacts: [],
    description: "Main dashboard — portfolio, staking, XP, assets, leaderboard",
    richDescription:
      "The production Integra Dashboard — the flagship user-facing application built with React and deployed on Vercel. Provides portfolio management, staking delegation, XP tracking, asset management, leaderboard rankings, and notification preferences. This is where Integra users spend most of their time and is the single most important frontend service. Fully depends on the Dashboard API for all data. If the frontend itself is down (Vercel issue), users cannot access any platform features. Contact Nawar for API-related issues or Tara for frontend bugs.",
    owner: OWNERS.tara,
    links: {
      endpoint: "https://dashboard.integralayer.com",
      docs: "https://docs.integralayer.com",
      repo: "https://github.com/Integra-layer/dashboard",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["React", "Vercel"],
  },
  {
    id: "dashboard-dev",
    name: "Dashboard (Dev)",
    category: "frontends",
    environment: "dev",
    url: "https://dev-dashboard.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["dashboard-api-dev"],
    impacts: [],
    description: "Dashboard (dev) — development and staging",
    richDescription:
      "Development instance of the Dashboard frontend on Vercel, connected to the dev Dashboard API and testnet blockchain endpoints. Used by Tara and the frontend team for building and testing new UI features, validating design changes, and running E2E tests before production deployment. Also serves as the staging environment for stakeholder previews. If down, frontend development is blocked and the team cannot demo upcoming features.",
    owner: OWNERS.tara,
    links: {
      endpoint: "https://dev-dashboard.integralayer.com",
      docs: "https://docs.integralayer.com",
      repo: "https://github.com/Integra-layer/dashboard",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["React", "Vercel"],
  },
  {
    id: "city-prod",
    name: "City Builder",
    category: "frontends",
    environment: "prod",
    url: "https://city.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["city-api-prod"],
    impacts: [],
    description: "City of Integra — gamified city builder experience",
    richDescription:
      "The production City of Integra web application — a gamified city builder where users construct and manage virtual cities to earn XP and rewards. Built with React and deployed on Vercel, it renders an interactive isometric city view with real-time building placement and resource management. Fully depends on the City API for all game logic and state persistence. If the frontend is down, users cannot access the game at all. Contact Kalki for game-related issues or Tara for frontend deployment.",
    owner: OWNERS.kalki,
    links: {
      endpoint: "https://city.integralayer.com",
      repo: "https://github.com/Integra-layer/city",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["React", "Vercel"],
  },
  {
    id: "city-dev",
    name: "City Builder (Dev)",
    category: "frontends",
    environment: "dev",
    url: "https://dev-city.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["city-api-dev"],
    impacts: [],
    description: "City of Integra (dev)",
    richDescription:
      "Development instance of the City of Integra frontend on Vercel, used by Kalki for testing new game UI features, building animations, and UX improvements before production. Connected to the dev City API with test game state. Also used for playtesting new mechanics and balance changes with the team before releasing to users.",
    owner: OWNERS.kalki,
    links: {
      endpoint: "https://dev-city.integralayer.com",
      repo: "https://github.com/Integra-layer/city",
    },
    commonIssues: vercelFrontendIssues,
    tags: ["React", "Vercel"],
  },
  {
    id: "whitepaper",
    name: "Whitepaper",
    category: "frontends",
    environment: "prod",
    url: "https://whitepaper.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "Technical whitepaper — protocol design and architecture",
    richDescription:
      "The Integra Layer technical whitepaper, a static site on Vercel detailing the protocol design, CometBFT consensus mechanism, EVM module architecture, tokenomics (IRL supply, staking rewards, inflation), and network governance model. This document is referenced in investor due diligence, exchange listing applications, and developer onboarding. Downtime prevents potential investors and partners from accessing critical technical information. Contact Tara for content updates.",
    owner: OWNERS.tara,
    links: { endpoint: "https://whitepaper.integralayer.com" },
    commonIssues: vercelFrontendIssues,
    tags: ["Vercel"],
  },
  {
    id: "portal",
    name: "XP Portal",
    category: "frontends",
    environment: "prod",
    url: "https://portal.integralayer.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: ["absinthe-api"],
    impacts: [],
    description: "XP Portal — points tracking, leaderboard, rewards",
    richDescription:
      "The XP Portal built with React on Vercel, where users track their accumulated points, view real-time leaderboard rankings, complete quests, and claim rewards. This is a key community engagement tool — active users check it daily for leaderboard position changes and new quest availability. Depends entirely on the Absinthe XP API for all points data and leaderboard calculations. If Absinthe is down, the portal shows stale or empty data. Contact Tara for frontend issues or Parth for Absinthe integration.",
    owner: OWNERS.tara,
    links: {
      endpoint: "https://portal.integralayer.com",
      repo: "https://github.com/Integra-layer/portal",
    },
    commonIssues: [
      {
        cause: "Vercel deployment failed",
        fix: "Check Vercel dashboard for build errors; redeploy with: vercel --prod",
      },
      {
        cause: "Absinthe XP API dependency down",
        fix: "Portal shows empty leaderboard when Absinthe is down; check absinthe-api status first",
      },
      {
        cause: "DNS resolution failure",
        fix: "Verify DNS records in Cloudflare/Route53 point to Vercel",
      },
    ],
    tags: ["React", "Vercel"],
  },
  {
    id: "staking",
    name: "Staking App",
    category: "frontends",
    environment: "prod",
    url: "https://staking.polytrade.finance",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: ["vercel"],
    impacts: [],
    description: "Staking interface — delegate, undelegate, claim rewards",
    richDescription:
      "The staking interface built with React on Vercel (Polytrade legacy domain), where users delegate IRL tokens to validators, manage their delegation positions, redelegate between validators, and claim accumulated staking rewards. This is critical for network security — it is the primary way token holders participate in consensus by staking. If down, users cannot delegate or claim rewards, potentially impacting validator economics and network security participation rates. Contact Tara for frontend issues.",
    owner: OWNERS.tara,
    links: { endpoint: "https://staking.polytrade.finance" },
    commonIssues: [
      {
        cause: "Vercel deployment failed",
        fix: "Check Vercel dashboard for build errors; redeploy with: vercel --prod",
      },
      {
        cause: "Legacy Polytrade domain DNS issue",
        fix: "Verify DNS records for staking.polytrade.finance point to Vercel",
      },
      {
        cause: "Vercel platform outage",
        fix: "Check https://www.vercelstatus.com for platform-wide incidents",
      },
    ],
    tags: ["React", "Vercel"],
  },
  {
    id: "landing",
    name: "Landing Page",
    category: "frontends",
    environment: "prod",
    url: "https://get.polytrade.finance",
    checkType: "http-get",
    timeout: 10000,
    enabled: false,
    dependsOn: ["vercel"],
    impacts: [],
    description: "Legacy landing page (disabled)",
    richDescription:
      "Legacy landing page from the Polytrade Finance era, currently disabled in monitoring. Traffic is being migrated to the new integralayer.com domain. Will be fully deprecated once DNS redirects are confirmed and all inbound links are updated. Keeping the endpoint registered for tracking purposes until deprecation is complete.",
    owner: OWNERS.tara,
    links: { endpoint: "https://get.polytrade.finance" },
    commonIssues: [
      {
        cause: "Legacy page still receiving traffic after deprecation",
        fix: "Set up DNS redirect from get.polytrade.finance to integralayer.com",
      },
      {
        cause: "Vercel deployment issue",
        fix: "Check Vercel dashboard; this endpoint is disabled and may not need action",
      },
    ],
    tags: ["Vercel"],
  },
  {
    id: "datastore",
    name: "NFT Datastore",
    category: "frontends",
    environment: "prod",
    url: "https://datastore.polytrade.app",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "NFT datastore — asset metadata and media storage",
    richDescription:
      "NFT metadata and media storage service hosted on Vercel, serving asset images, metadata JSON files, and collection information for NFT display across the Dashboard and marketplace features. Follows the ERC-721/1155 metadata standard so wallets and aggregators can resolve token URIs. If down, NFT thumbnails and metadata fail to load across the platform — users see broken images and missing asset names. Contact Tara for deployment or Parth for metadata schema changes.",
    owner: OWNERS.tara,
    links: { endpoint: "https://datastore.polytrade.app" },
    commonIssues: [
      {
        cause: "Vercel deployment failed or build error",
        fix: "Check Vercel dashboard for build errors; redeploy",
      },
      {
        cause: "NFT metadata format changed breaking consumers",
        fix: "Verify ERC-721/1155 metadata schema compliance; check token URI resolution",
      },
      {
        cause: "Legacy Polytrade domain DNS issue",
        fix: "Verify DNS records for datastore.polytrade.app",
      },
    ],
    tags: ["Vercel"],
  },

  // -- External Dependencies -------------------------------------------------
  {
    id: "github-integra-layer",
    name: "GitHub (Integra-layer)",
    category: "external",
    environment: "prod",
    url: "https://api.github.com/orgs/Integra-layer",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "GitHub org — Integra-layer repositories",
    richDescription:
      "The primary GitHub organization for Integra Layer, hosting all active repositories including the explorer, dashboard, city builder, validator tooling, and infrastructure-as-code. Monitored via the GitHub API to detect outages that would block CI/CD pipelines, code deployments, PR reviews, and developer collaboration. A GitHub outage halts all development velocity across the team. Contact Adam for org-level access issues.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://api.github.com/orgs/Integra-layer",
      repo: "https://github.com/Integra-layer",
    },
    commonIssues: [
      {
        cause: "GitHub platform outage",
        fix: "Check https://www.githubstatus.com; no action needed, wait for recovery",
      },
      {
        cause: "GitHub API rate limit exceeded",
        fix: "Check rate limit headers: curl -I https://api.github.com/rate_limit; use authenticated requests for higher limits",
      },
    ],
    tags: ["GitHub"],
  },
  {
    id: "github-polytrade",
    name: "GitHub (polytrade-finance)",
    category: "external",
    environment: "prod",
    url: "https://api.github.com/orgs/polytrade-finance",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    description: "GitHub org — polytrade-finance repositories",
    richDescription:
      "Legacy GitHub organization from the Polytrade Finance era, still hosting shared libraries, older smart contracts, and utility packages that some services depend on. Monitored to ensure CI/CD pipelines that pull from these repos continue to function. Being gradually migrated to the Integra-layer org. Contact Adam for access or migration questions.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://api.github.com/orgs/polytrade-finance",
      repo: "https://github.com/polytrade-finance",
    },
    commonIssues: [
      {
        cause: "GitHub platform outage",
        fix: "Check https://www.githubstatus.com; no action needed, wait for recovery",
      },
      {
        cause: "Legacy repo access permissions changed",
        fix: "Verify org membership and repo access; contact Adam for org admin changes",
      },
    ],
    tags: ["GitHub"],
  },
  {
    id: "absinthe-api",
    name: "Absinthe XP",
    category: "external",
    environment: "prod",
    url: "https://gql3.absinthe.network",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["dashboard-api-prod", "dashboard-api-dev", "portal"],
    impactDescription: "Dashboard XP features break, portal unusable",
    description: "Absinthe Network — XP/points system, leaderboard sync",
    richDescription:
      "Absinthe Network's GraphQL API (gql3.absinthe.network) powering the entire XP/points ecosystem — point accumulation, leaderboard rankings, quest tracking, and reward eligibility calculations. This is a critical third-party dependency with wide blast radius: both Dashboard API instances (prod and dev) and the XP Portal depend on it. When Absinthe is down, XP features show errors across the Dashboard, the Portal displays empty leaderboards, and quest progress stops updating. Contact Parth for integration issues or escalation to the Absinthe team.",
    owner: OWNERS.parth,
    links: { endpoint: "https://gql3.absinthe.network" },
    commonIssues: [
      {
        cause: "Absinthe Network platform outage",
        fix: "Check Absinthe status channels; escalate via Parth; no action on our side — wait for recovery",
      },
      {
        cause: "Absinthe API rate limit or auth token expired",
        fix: "Check API credentials in environment variables; contact Parth for token rotation",
      },
      {
        cause: "GraphQL schema change breaking queries",
        fix: "Compare current queries against Absinthe schema; update query definitions if fields changed",
      },
    ],
    tags: ["GraphQL"],
  },
  {
    id: "web3auth",
    name: "Web3Auth",
    category: "external",
    environment: "prod",
    url: "https://lookup.web3auth.io",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["passport-api"],
    impactDescription: "Wallet pregeneration fails",
    description: "Web3Auth — non-custodial wallet pregeneration, social login",
    richDescription:
      "Web3Auth third-party service enabling non-custodial wallet pregeneration and social login for Integra users. When a user signs up via Google or email, Web3Auth generates an Integra wallet using MPC (multi-party computation) without the user managing a seed phrase. The Passport API depends on this for all new user registrations. If Web3Auth is down, new user onboarding fails completely — existing users can still log in via cached sessions but no new wallets can be created. Contact Parth for Web3Auth configuration or API key issues.",
    owner: OWNERS.parth,
    links: { endpoint: "https://lookup.web3auth.io" },
    commonIssues: [
      {
        cause: "Web3Auth platform outage",
        fix: "Check https://status.web3auth.io; no action needed on our side, wait for recovery",
      },
      {
        cause: "Web3Auth API key expired or misconfigured",
        fix: "Check Web3Auth dashboard for key status; contact Parth for key rotation",
      },
    ],
    tags: ["OAuth"],
  },
  {
    id: "openai-api",
    name: "OpenAI",
    category: "external",
    environment: "prod",
    url: "https://api.openai.com/v1/models",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    impactDescription: "Title deed extraction fails",
    description:
      "OpenAI — AI-powered title deed extraction and document processing",
    richDescription:
      "OpenAI API integration (GPT-4 Vision) used in the Dashboard for AI-powered title deed extraction and document processing. When users upload property documents, the system uses GPT-4V to perform OCR, extract structured data (owner name, property details, valuation), and auto-populate form fields. If OpenAI is down, document uploads still succeed but automatic data extraction fails — users must manually enter all property information. Non-blocking but degrades UX significantly. Contact Parth for API key or model configuration.",
    owner: OWNERS.parth,
    links: { endpoint: "https://api.openai.com/v1/models" },
    commonIssues: [
      {
        cause: "OpenAI platform outage or degraded performance",
        fix: "Check https://status.openai.com; document extraction will fail but uploads still work",
      },
      {
        cause: "OpenAI API key expired or rate limited",
        fix: "Check API key in environment variables; contact Parth for key rotation or plan upgrade",
      },
      {
        cause: "GPT-4V model not available or deprecated",
        fix: "Check available models at api.openai.com/v1/models; update model ID in config if needed",
      },
    ],
    tags: ["AI", "GPT"],
  },
  {
    id: "alchemy-rpc",
    name: "Alchemy",
    category: "external",
    environment: "prod",
    url: "https://eth-mainnet.g.alchemy.com",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: [],
    impactDescription: "Webhook events stop, RPC fallback lost",
    description: "Alchemy — blockchain RPC fallback, webhooks, event indexing",
    richDescription:
      "Alchemy's enterprise blockchain infrastructure providing fallback RPC access for Ethereum mainnet and EVM-compatible chains, plus webhook-based event indexing for token transfers and contract events. Acts as a reliability layer — if Integra's primary EVM RPC nodes are slow or unresponsive, services can failover to Alchemy endpoints. Also powers webhook-driven notifications for on-chain events. If Alchemy is down, the fallback RPC path is lost and webhook-based event processing stops. Contact Adam for Alchemy dashboard access or API key rotation.",
    owner: OWNERS.adam,
    links: { endpoint: "https://eth-mainnet.g.alchemy.com" },
    commonIssues: [
      {
        cause: "Alchemy platform outage",
        fix: "Check https://status.alchemy.com; fallback RPC path is lost but primary nodes should still work",
      },
      {
        cause: "Alchemy API key expired or rate limited",
        fix: "Check Alchemy dashboard for key status and usage; contact Adam for key rotation",
      },
    ],
    tags: ["RPC", "Webhooks"],
  },
  {
    id: "twitter-api",
    name: "Twitter/X",
    category: "external",
    environment: "prod",
    url: "https://api.twitter.com/2",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["dashboard-prod"],
    impactDescription: "Tweet display on dashboard fails",
    description: "Twitter/X API — social media feed integration on dashboard",
    richDescription:
      "Twitter/X API v2 integration for displaying the Integra social media feed on the Dashboard, showing recent announcements, community highlights, and ecosystem updates. While non-critical to core functionality, the social feed is prominently placed on the Dashboard home screen and its absence is visually noticeable to users. Frequent Twitter API rate limits or outages cause the feed section to show an empty state. Contact Tara for frontend display issues or Parth for API credential management.",
    owner: OWNERS.parth,
    links: { endpoint: "https://api.twitter.com/2" },
    commonIssues: [
      {
        cause: "Twitter/X API rate limit exceeded",
        fix: "Check rate limit headers; reduce polling frequency; Twitter free tier has very low limits",
      },
      {
        cause: "Twitter/X API key expired or app suspended",
        fix: "Check Twitter developer portal for app status; contact Parth for credential updates",
      },
      {
        cause: "Twitter/X platform outage",
        fix: "Check https://api.twitterstat.us; the dashboard feed will show empty state — no action needed",
      },
    ],
    tags: ["OAuth"],
  },
  {
    id: "google-oauth",
    name: "Google OAuth",
    category: "external",
    environment: "prod",
    url: "https://accounts.google.com/.well-known/openid-configuration",
    checkType: "http-json",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["passport-api"],
    impactDescription: "Social login breaks",
    description: "Google OAuth — social login for user authentication",
    richDescription:
      'Google OAuth 2.0 / OpenID Connect endpoint used for social login authentication in the Passport API. When users click "Sign in with Google," the authentication flow hits this endpoint for token exchange and identity verification. If Google OAuth is down (extremely rare), all Google-based sign-ups and logins fail — users must wait or use alternative login methods. The Passport API checks the OIDC discovery document on startup to cache signing keys. Contact Parth for OAuth client configuration or redirect URI changes.',
    owner: OWNERS.parth,
    links: {
      endpoint: "https://accounts.google.com/.well-known/openid-configuration",
    },
    commonIssues: [
      {
        cause: "Google OAuth platform outage (extremely rare)",
        fix: "Check https://www.google.com/appsstatus; wait for recovery — no action on our side",
      },
      {
        cause: "OAuth client ID or redirect URI misconfigured",
        fix: "Check Google Cloud Console for OAuth client settings; contact Parth for credential changes",
      },
    ],
    tags: ["OAuth", "OIDC"],
  },
  {
    id: "dicebear-api",
    name: "DiceBear Avatars",
    category: "external",
    environment: "prod",
    url: "https://api.dicebear.com/7.x/identicon/svg?seed=test",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["city-prod", "city-dev"],
    impactDescription: "City builder avatars break",
    description: "DiceBear — procedural avatar generation for city builder",
    richDescription:
      "DiceBear API v7 for procedural avatar generation in the City of Integra, creating unique identicon-style SVG avatars based on user wallet addresses or usernames. Both the production and dev City Builder frontends request avatars on-demand from this API. If DiceBear is down, avatar images fail to load and users see broken image placeholders in their city profiles and leaderboard entries. Low severity but visually noticeable. Contact Kalki for City Builder integration or consider caching avatars locally.",
    owner: OWNERS.kalki,
    links: { endpoint: "https://api.dicebear.com/7.x/identicon/svg?seed=test" },
    commonIssues: [
      {
        cause: "DiceBear API outage or rate limit",
        fix: "Check DiceBear status; consider caching generated avatars locally to reduce dependency",
      },
      {
        cause: "DiceBear API version deprecated",
        fix: "Check if /7.x/ endpoint is still supported; update to latest version if deprecated",
      },
    ],
    tags: ["API"],
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    category: "external",
    environment: "prod",
    url: "https://relay.walletconnect.com",
    checkType: "http-reachable",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["dashboard-prod"],
    impactDescription: "Wallet connections fail",
    description: "WalletConnect — external wallet connection relay",
    richDescription:
      "WalletConnect v2 relay server enabling external wallet connections (MetaMask, Trust Wallet, Rainbow, Coinbase Wallet, etc.) to the Integra Dashboard via QR code scanning or deep links. This is the bridge between mobile/browser wallets and the Dashboard — if the relay is down, users cannot connect their wallets to perform transactions, stake tokens, or sign messages. High impact because many users rely on external wallets rather than the embedded Passport wallet. Contact Tara for WalletConnect SDK integration or Parth for project ID configuration.",
    owner: OWNERS.parth,
    links: { endpoint: "https://relay.walletconnect.com" },
    commonIssues: [
      {
        cause: "WalletConnect relay server outage",
        fix: "Check https://status.walletconnect.com; no action on our side — wait for recovery",
      },
      {
        cause: "WalletConnect project ID expired or invalid",
        fix: "Check WalletConnect Cloud dashboard for project status; contact Parth for project ID updates",
      },
    ],
    tags: ["WebSocket"],
  },
  {
    id: "vercel",
    name: "Vercel Platform",
    category: "external",
    environment: "prod",
    url: "https://vercel.com",
    checkType: "http-get",
    timeout: 10000,
    enabled: true,
    dependsOn: [],
    impacts: ["docs-site", "main-website", "staking", "landing"],
    impactDescription: "Docs, staking, landing go down",
    description: "Vercel Platform — hosting for all frontend apps and docs",
    richDescription:
      "Vercel platform-level availability monitoring — Vercel hosts all Integra frontend applications (Dashboard, Explorer, City Builder, Portal, Staking), documentation, whitepaper, and static sites. This is a platform-level dependency with the widest blast radius of any external service: if Vercel experiences an outage, the majority of user-facing Integra services go down simultaneously. Vercel provides edge CDN, serverless functions, and automatic deployments from GitHub. Contact Adam for Vercel team access or billing, or Tara for deployment configuration.",
    owner: OWNERS.adam,
    links: { endpoint: "https://vercel.com" },
    commonIssues: [
      {
        cause: "Vercel platform-wide outage",
        fix: "Check https://www.vercelstatus.com; all Vercel-hosted services will be affected — no action, wait for recovery",
      },
      {
        cause: "Vercel billing or plan limit reached",
        fix: "Check Vercel dashboard for billing status; contact Adam for plan upgrade or billing resolution",
      },
      {
        cause: "Vercel edge network degraded in specific region",
        fix: "Check Vercel status for region-specific issues; may only affect users in certain geographies",
      },
    ],
    tags: ["CDN", "Edge"],
  },

  // -- Explorer Sync Monitoring -----------------------------------------------
  {
    id: "explorer-mainnet-sync",
    name: "Mainnet Explorer Sync",
    category: "blockchain",
    environment: "prod",
    url: "https://scan.integralayer.com/v1/graphql",
    checkType: "explorer-sync",
    chainRpcUrl: "https://adamboudj.integralayer.com/rpc",
    timeout: 15000,
    enabled: true,
    dependsOn: ["mainnet-evm-rpc", "explorer-v2"],
    impacts: ["explorer-v2"],
    impactDescription:
      "Explorer v2 shows stale data — blocks and transactions not updating",
    description:
      "Explorer v2 sync freshness — compares Callisto indexed block height with chain head",
    richDescription:
      "Monitors the Explorer v2 (Callisto/Hasura) sync status by querying the latest indexed block via GraphQL and comparing against the actual chain head from the EVM RPC. Detects Callisto indexer stalls, PostgreSQL issues, or chain node disconnections. A lag of >100 blocks triggers DOWN status. This is the early warning system for explorer data staleness.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://explorer.integralayer.com",
      repo: "https://github.com/Integra-layer/explorer",
    },
    commonIssues: explorerSyncIssues,
    tags: ["BullMQ", "Indexer"],
  },
  {
    id: "explorer-testnet-sync",
    name: "Testnet Explorer Sync",
    category: "blockchain",
    environment: "dev",
    url: "https://testnet.explorer.integralayer.com/api/status",
    checkType: "explorer-sync",
    chainRpcUrl: "https://testnet.integralayer.com/evm",
    timeout: 15000,
    enabled: false, // Ethernal API is auth-gated — no public block height endpoint
    dependsOn: ["testnet-evm-rpc", "explorer-testnet"],
    impacts: ["explorer-testnet"],
    impactDescription:
      "Testnet explorer shows stale data — blocks and transactions not updating",
    description:
      "Testnet explorer sync freshness — compares indexed block height with chain head",
    richDescription:
      "Monitors the testnet block explorer's indexer sync status by comparing its latest indexed block height against the Ormos testnet chain head. Same check logic as mainnet — detects stuck sync jobs and worker failures. Critical for the dev team to notice when testnet explorer data goes stale during active development and QA testing.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://testnet.explorer.integralayer.com",
      repo: "https://github.com/Integra-layer/explorer",
    },
    commonIssues: explorerSyncIssues,
    tags: ["BullMQ", "Indexer"],
  },
  {
    id: "explorer-mainnet-backend",
    name: "Mainnet Explorer Backend",
    category: "apis",
    environment: "prod",
    url: "https://explorer.integralayer.com/api/status",
    checkType: "http-reachable", // Returns 401 (auth-gated) but proves backend is alive
    timeout: 10000,
    enabled: true,
    dependsOn: ["explorer-mainnet"],
    impacts: [],
    description:
      "Mainnet explorer backend API — block indexing, transaction processing",
    richDescription:
      "The backend API service for the mainnet block explorer, built with Node.js and BullMQ. Handles block indexing, transaction processing, and serves the explorer frontend with blockchain data via REST endpoints. The /api/status endpoint returns sync state, worker health, and queue metrics. If this backend is down, the explorer frontend shows stale or no data.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://explorer.integralayer.com/api/status",
      repo: "https://github.com/Integra-layer/explorer",
    },
    commonIssues: explorerSyncIssues,
    tags: ["Node.js", "BullMQ", "Docker"],
  },
  {
    id: "explorer-testnet-backend",
    name: "Testnet Explorer Backend",
    category: "apis",
    environment: "dev",
    url: "https://testnet.explorer.integralayer.com/api/status",
    checkType: "http-reachable", // Returns 401 (auth-gated) but proves backend is alive
    timeout: 10000,
    enabled: true,
    dependsOn: ["explorer-testnet"],
    impacts: [],
    description:
      "Testnet explorer backend API — block indexing for Ormos testnet",
    richDescription:
      "The backend API service for the testnet block explorer, same stack as mainnet (Node.js + BullMQ). Indexes Ormos testnet blocks and transactions, serving the testnet explorer frontend. Used by the dev team for testing explorer features and verifying testnet chain activity.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://testnet.explorer.integralayer.com/api/status",
      repo: "https://github.com/Integra-layer/explorer",
    },
    commonIssues: explorerSyncIssues,
    tags: ["Node.js", "BullMQ", "Docker"],
  },

  // -- Explorer Deep Health (Callisto/Hasura integrity) ----------------------
  {
    id: "explorer-mainnet-deep-health",
    name: "Mainnet Explorer Deep Health",
    category: "blockchain",
    environment: "prod",
    url: "https://scan.integralayer.com/v1/graphql",
    checkType: "explorer-deep-health",
    timeout: 20000,
    enabled: true,
    dependsOn: ["explorer-mainnet-sync", "explorer-graphql"],
    impacts: ["explorer-v2"],
    impactDescription:
      "Explorer v2 data integrity issues — gaps, missing transactions, or stale indexer",
    description:
      "Deep integrity checks: block gaps, tx completeness, write freshness, receipt completeness",
    richDescription:
      "Runs 4 sub-checks against the Callisto/Hasura database via a single batched GraphQL query: (1) Block gap detection scans last 1000 blocks for missing heights, (2) Transaction completeness verifies num_txs matches actual indexed count, (3) Last write freshness detects hung indexers by checking block timestamp age (DOWN >10min, DEGRADED >5min), (4) Receipt completeness samples recent transactions for missing receipt data. The worst sub-check status becomes the endpoint status. Designed to catch the exact failure modes encountered in production: silent schema drift, crashed workers, and stale cached heights.",
    owner: OWNERS.adam,
    links: {
      endpoint: "https://scan.integralayer.com",
      repo: "https://github.com/Integra-layer/integra-explorer",
    },
    commonIssues: explorerDeepHealthIssues,
    tags: ["Callisto", "Hasura", "PostgreSQL", "Deep Health"],
  },
];

// ---------------------------------------------------------------------------
// Auto-fill external group with any external endpoints not claimed by others
// ---------------------------------------------------------------------------

(function fillExternalGroup() {
  const claimed = new Set<string>();
  for (const group of APP_GROUPS) {
    if (group.id === "external") continue;
    for (const epId of group.endpoints) {
      claimed.add(epId);
    }
  }
  const extGroup = APP_GROUPS.find((g) => g.id === "external");
  if (extGroup) {
    for (const ep of ENDPOINTS) {
      if (ep.category === "external" && !claimed.has(ep.id)) {
        extGroup.endpoints.push(ep.id);
      }
    }
  }
})();

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

type GetEndpointsOptions = {
  enabledOnly?: boolean;
  category?: Category;
  environment?: Environment;
};

export function getEndpoints(opts?: GetEndpointsOptions): Endpoint[] {
  let eps = ENDPOINTS;
  if (!opts || opts.enabledOnly !== false) {
    eps = eps.filter((e) => e.enabled);
  }
  if (opts?.category) {
    eps = eps.filter((e) => e.category === opts.category);
  }
  if (opts?.environment) {
    eps = eps.filter((e) => e.environment === opts.environment);
  }
  return eps;
}

export function getEndpoint(id: string): Endpoint | null {
  return ENDPOINTS.find((e) => e.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

type DependencyNode = {
  dependsOn: string[];
  requiredBy: string[];
};

/**
 * Build adjacency lists for the dependency graph.
 * Returns { [id]: { dependsOn: [...], requiredBy: [...] } }
 */
export function getDependencyGraph(): Record<string, DependencyNode> {
  const graph: Record<string, DependencyNode> = {};

  // Initialize every node
  for (const ep of ENDPOINTS) {
    if (!graph[ep.id]) graph[ep.id] = { dependsOn: [], requiredBy: [] };
  }

  // Build edges from dependsOn
  for (const ep of ENDPOINTS) {
    const deps = ep.dependsOn ?? [];
    for (const depId of deps) {
      graph[ep.id].dependsOn.push(depId);
      if (!graph[depId]) graph[depId] = { dependsOn: [], requiredBy: [] };
      graph[depId].requiredBy.push(ep.id);
    }
  }

  // Build edges from impacts
  for (const ep of ENDPOINTS) {
    const imps = ep.impacts ?? [];
    for (const impId of imps) {
      // Add to requiredBy if not already via dependsOn
      if (!graph[ep.id]) graph[ep.id] = { dependsOn: [], requiredBy: [] };
      if (!graph[ep.id].requiredBy.includes(impId)) {
        graph[ep.id].requiredBy.push(impId);
      }
      if (!graph[impId]) graph[impId] = { dependsOn: [], requiredBy: [] };
      if (!graph[impId].dependsOn.includes(ep.id)) {
        graph[impId].dependsOn.push(ep.id);
      }
    }
  }

  return graph;
}

/**
 * BFS: given a down endpoint ID, find all transitively impacted services.
 * Returns array of endpoint IDs that depend (directly or transitively) on downId.
 */
export function getImpactedServices(downId: string): string[] {
  const graph = getDependencyGraph();
  const visited = new Set<string>();
  const queue: string[] = [downId];
  visited.add(downId);
  const impacted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = graph[current];
    if (!node) continue;
    const dependents = node.requiredBy ?? [];
    for (const dep of dependents) {
      if (!visited.has(dep)) {
        visited.add(dep);
        impacted.push(dep);
        queue.push(dep);
      }
    }
  }

  return impacted;
}

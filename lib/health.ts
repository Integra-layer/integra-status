// lib/health.ts — Health check engine for Integra status page
import http from "http";
import https from "https";
import { URL } from "url";
import type { Endpoint, CheckResult, CheckType, Status } from "./types";
import { getEndpoints, CHAIN_HALT_THRESHOLD_SECONDS } from "./health-config";
import type { Category, Environment } from "./types";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

// Keep-alive agents reuse TCP connections across checks (~200ms savings)
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 20,
  keepAliveMsecs: 30_000,
});
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 20,
  keepAliveMsecs: 30_000,
  rejectUnauthorized: false,
});

type HttpResponse = {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  responseTimeMs: number;
};

type HttpRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
};

function httpRequest(
  url: string,
  opts: HttpRequestOptions = {},
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const mod = isHttps ? https : http;
    const timeout = opts.timeout || 10000;
    const reqOpts: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: opts.method || "GET",
      headers: { "User-Agent": "integra-health/1.0", ...(opts.headers || {}) },
      timeout,
      agent: isHttps ? httpsAgent : httpAgent,
    };
    const start = Date.now();
    const req = mod.request(reqOpts, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body,
          responseTimeMs: Date.now() - start,
        });
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.on("error", (err) => reject(err));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function jsonRpc(
  url: string,
  method: string,
  params: unknown[] = [],
  timeout?: number,
): Promise<HttpResponse> {
  return httpRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    timeout,
  });
}

// ---------------------------------------------------------------------------
// Result builder
// ---------------------------------------------------------------------------

function buildResult(
  ep: Endpoint,
  status: Status,
  responseTimeMs: number,
  details?: Record<string, unknown>,
  error?: string,
): CheckResult {
  return {
    id: ep.id,
    name: ep.name,
    url: ep.url,
    category: ep.category,
    environment: ep.environment || "prod",
    status,
    responseTimeMs,
    timestamp: new Date().toISOString(),
    details: details || {},
    error: error || null,
    dependsOn: ep.dependsOn || [],
    impacts: ep.impacts || [],
    impactDescription: ep.impactDescription || null,
    description: ep.description || null,
    richDescription: ep.richDescription || null,
    owner: ep.owner || null,
    links: ep.links,
    commonIssues: ep.commonIssues || [],
    tags: ep.tags || [],
  };
}

// ---------------------------------------------------------------------------
// Check functions — one per CheckType
// ---------------------------------------------------------------------------

async function checkEvmRpc(ep: Endpoint): Promise<CheckResult> {
  const details: Record<string, unknown> = {};
  const start = Date.now();

  // Run blockNumber + chainId in parallel (2 calls instead of 4)
  const [blockRes, chainRes] = await Promise.all([
    jsonRpc(ep.url, "eth_blockNumber", [], ep.timeout),
    jsonRpc(ep.url, "eth_chainId", [], ep.timeout),
  ]);

  const blockData = JSON.parse(blockRes.body);
  if (blockData.error)
    throw new Error(blockData.error.message || "eth_blockNumber failed");
  details.blockHeight = parseInt(blockData.result, 16);

  const chainData = JSON.parse(chainRes.body);
  details.chainId = chainData.result;
  if (ep.expectedChainId && chainData.result !== ep.expectedChainId) {
    return buildResult(
      ep,
      "DEGRADED",
      Date.now() - start,
      details,
      `Chain ID mismatch: expected ${ep.expectedChainId}, got ${chainData.result}`,
    );
  }

  return buildResult(ep, "UP", Date.now() - start, details);
}

async function checkCosmosRpc(ep: Endpoint): Promise<CheckResult> {
  const details: Record<string, unknown> = {};
  const start = Date.now();

  const statusRes = await httpRequest(`${ep.url}/status`, {
    timeout: ep.timeout,
  });
  if (statusRes.statusCode !== 200)
    throw new Error(`HTTP ${statusRes.statusCode}`);
  const statusData = JSON.parse(statusRes.body);
  const syncInfo = statusData.result
    ? statusData.result.sync_info
    : statusData.sync_info;

  if (syncInfo) {
    details.blockHeight = parseInt(syncInfo.latest_block_height, 10);
    details.latestBlockTime = syncInfo.latest_block_time;
    details.catchingUp = syncInfo.catching_up;

    const blockAge =
      (Date.now() - new Date(syncInfo.latest_block_time).getTime()) / 1000;
    details.blockAgeSec = Math.round(blockAge);

    if (blockAge > CHAIN_HALT_THRESHOLD_SECONDS) {
      return buildResult(
        ep,
        "DEGRADED",
        Date.now() - start,
        details,
        `Possible chain halt — last block ${Math.round(blockAge)}s ago`,
      );
    }
    if (syncInfo.catching_up) {
      return buildResult(
        ep,
        "DEGRADED",
        Date.now() - start,
        details,
        "Node is catching up",
      );
    }
  }

  try {
    const netRes = await httpRequest(`${ep.url}/net_info`, {
      timeout: ep.timeout,
    });
    if (netRes.statusCode === 200) {
      const netData = JSON.parse(netRes.body);
      const peers = netData.result ? netData.result.peers : netData.peers;
      details.peerCount = Array.isArray(peers)
        ? peers.length
        : parseInt(netData.result?.n_peers, 10) || null;
    }
  } catch (_) {
    // net_info is optional — swallow errors
  }

  return buildResult(ep, "UP", Date.now() - start, details);
}

async function checkCosmosRest(ep: Endpoint): Promise<CheckResult> {
  const details: Record<string, unknown> = {};
  const start = Date.now();

  const blockRes = await httpRequest(
    `${ep.url}/cosmos/base/tendermint/v1beta1/blocks/latest`,
    { timeout: ep.timeout },
  );
  if (blockRes.statusCode !== 200)
    throw new Error(`HTTP ${blockRes.statusCode}`);
  const blockData = JSON.parse(blockRes.body);
  const header = blockData.block?.header || blockData.sdk_block?.header;

  if (header) {
    details.blockHeight = parseInt(header.height, 10);
    details.latestBlockTime = header.time;
    details.chainId = header.chain_id;

    const blockAge = (Date.now() - new Date(header.time).getTime()) / 1000;
    details.blockAgeSec = Math.round(blockAge);

    if (blockAge > CHAIN_HALT_THRESHOLD_SECONDS) {
      return buildResult(
        ep,
        "DEGRADED",
        Date.now() - start,
        details,
        `Possible chain halt — last block ${Math.round(blockAge)}s ago`,
      );
    }
  }

  try {
    const valRes = await httpRequest(
      `${ep.url}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`,
      { timeout: ep.timeout },
    );
    if (valRes.statusCode === 200) {
      const valData = JSON.parse(valRes.body);
      details.bondedValidators = valData.validators
        ? valData.validators.length
        : null;
    }
  } catch (_) {
    // validator count is optional — swallow errors
  }

  return buildResult(ep, "UP", Date.now() - start, details);
}

async function checkHttpJson(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const res = await httpRequest(ep.url, { timeout: ep.timeout });
  if (res.statusCode < 200 || res.statusCode >= 400)
    throw new Error(`HTTP ${res.statusCode}`);

  const data = JSON.parse(res.body);
  const details: Record<string, unknown> = { statusCode: res.statusCode };

  if (ep.expectedField && !(ep.expectedField in data)) {
    return buildResult(
      ep,
      "DEGRADED",
      Date.now() - start,
      details,
      `Missing expected field: ${ep.expectedField}`,
    );
  }

  return buildResult(ep, "UP", Date.now() - start, details);
}

async function checkHttpGet(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const res = await httpRequest(ep.url, { timeout: ep.timeout });
  if (res.statusCode >= 200 && res.statusCode < 400) {
    return buildResult(ep, "UP", Date.now() - start, {
      statusCode: res.statusCode,
    });
  }
  throw new Error(`HTTP ${res.statusCode}`);
}

async function checkWebsocket(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const parsed = new URL(
      ep.url.replace("wss://", "https://").replace("ws://", "http://"),
    );
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname || "/",
        method: "GET",
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
          "Sec-WebSocket-Key": Buffer.from(Math.random().toString()).toString(
            "base64",
          ),
          "Sec-WebSocket-Version": "13",
        },
        timeout: ep.timeout,
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode < 400) {
          resolve(
            buildResult(ep, "UP", Date.now() - start, {
              statusCode: res.statusCode,
            }),
          );
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
    );
    req.on("upgrade", (_res, socket) => {
      socket.destroy();
      resolve(buildResult(ep, "UP", Date.now() - start, { upgraded: true }));
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.on("error", (err) => reject(err));
    req.end();
  });
}

async function checkApiHealth(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const res = await httpRequest(ep.url, { timeout: ep.timeout });
  const details: Record<string, unknown> = { statusCode: res.statusCode };

  if (res.statusCode >= 200 && res.statusCode < 400) {
    try {
      const data = JSON.parse(res.body);
      if (data.status) details.healthStatus = data.status;
      if (data.version) details.version = data.version;
    } catch (_) {
      // body may not be JSON — that's fine
    }
    return buildResult(ep, "UP", Date.now() - start, details);
  }
  throw new Error(`HTTP ${res.statusCode}`);
}

async function checkHttpReachable(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const res = await httpRequest(ep.url, { timeout: ep.timeout });
  const details: Record<string, unknown> = { statusCode: res.statusCode };
  if (res.statusCode < 500)
    return buildResult(ep, "UP", Date.now() - start, details);
  throw new Error(`HTTP ${res.statusCode}`);
}

async function checkGraphql(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const body = JSON.stringify({ query: "{ __typename }" });
  const res = await httpRequest(ep.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    timeout: ep.timeout,
  });
  const details: Record<string, unknown> = { statusCode: res.statusCode };

  if (res.statusCode >= 200 && res.statusCode < 400) {
    try {
      const data = JSON.parse(res.body);
      if (data.data) return buildResult(ep, "UP", Date.now() - start, details);
      if (data.errors) {
        return buildResult(
          ep,
          "DEGRADED",
          Date.now() - start,
          details,
          data.errors[0]?.message || "GraphQL errors",
        );
      }
    } catch (_) {
      // body may not be valid JSON
    }
    return buildResult(ep, "UP", Date.now() - start, details);
  }
  throw new Error(`HTTP ${res.statusCode}`);
}

async function checkDeepHealth(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const healthUrl = ep.healthUrl || ep.url + "/health";
  const res = await httpRequest(healthUrl, { timeout: ep.timeout });
  const details: Record<string, unknown> = { statusCode: res.statusCode };

  if (res.statusCode === 404) {
    const fallbackRes = await httpRequest(ep.url, { timeout: ep.timeout });
    if (fallbackRes.statusCode < 500) {
      return buildResult(ep, "UP", Date.now() - start, {
        statusCode: fallbackRes.statusCode,
        fallback: true,
      });
    }
    throw new Error("HTTP " + fallbackRes.statusCode);
  }

  if (res.statusCode >= 200 && res.statusCode < 400) {
    try {
      const data = JSON.parse(res.body);
      if (data.status) details.healthStatus = data.status;
      if (data.version) details.version = data.version;
      if (data.uptime) details.uptime = data.uptime;

      const components = data.components || data.checks || data.dependencies;
      if (components) {
        details.components = components;
        const keys = Object.keys(components as Record<string, unknown>);
        for (const key of keys) {
          const comp = (components as Record<string, unknown>)[key];
          const compStatus =
            typeof comp === "object" && comp !== null
              ? (comp as Record<string, unknown>).status ||
                (comp as Record<string, unknown>).state
              : comp;
          if (
            compStatus &&
            /down|unhealthy|error|fail/i.test(String(compStatus))
          ) {
            return buildResult(
              ep,
              "DEGRADED",
              Date.now() - start,
              details,
              key + " is unhealthy",
            );
          }
        }
      }

      if (data.status && /down|unhealthy|error/i.test(data.status)) {
        return buildResult(
          ep,
          "DEGRADED",
          Date.now() - start,
          details,
          "Health reports: " + data.status,
        );
      }
      return buildResult(ep, "UP", Date.now() - start, details);
    } catch (_) {
      return buildResult(ep, "UP", Date.now() - start, details);
    }
  }
  throw new Error("HTTP " + res.statusCode);
}

async function checkCosmosPeer(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const peerIp = ep.peerIp || new URL(ep.url).hostname;
  const publicRpc = ep.publicRpc || "https://mainnet.integralayer.com/rpc";

  const res = await httpRequest(`${publicRpc}/net_info`, {
    timeout: ep.timeout,
  });
  if (res.statusCode !== 200)
    throw new Error(`Public RPC returned HTTP ${res.statusCode}`);

  const data = JSON.parse(res.body);
  const peers: Array<{
    remote_ip: string;
    node_info?: { moniker?: string; id?: string };
  }> = (data.result && data.result.peers) || [];
  const details: Record<string, unknown> = { totalPeers: peers.length };

  for (const peer of peers) {
    if (peer.remote_ip === peerIp) {
      details.moniker = peer.node_info ? peer.node_info.moniker : null;
      details.peerId = peer.node_info ? peer.node_info.id : null;
      return buildResult(ep, "UP", Date.now() - start, details);
    }
  }

  return buildResult(
    ep,
    "DEGRADED",
    Date.now() - start,
    details,
    "Validator not found in peer list",
  );
}

/**
 * Meta-watchdog probe (D4 of integra-explorer's GOAL_TESTNET_STABILITY.md).
 *
 * Polls the explorer's `/api/health/alerter` endpoint and checks that
 * Telegram delivery has succeeded recently. The original goal: "fire if
 * the alerting system itself goes quiet for >15 minutes."
 *
 * Why this is a valid meta-watchdog:
 * - Runs on a different host (Vultr) from the explorer (Hetzner).
 * - Uses integra-status's own Telegram bot+token (separate auth domain).
 * - Cron-scheduled on the Vultr crontab (not GH Actions, not BullMQ).
 * - If the explorer's alerter has not delivered a Telegram message in
 *   the configured stale window, this probe trips DEGRADED → DOWN, and
 *   integra-status sends a Telegram alert via its OWN delivery path.
 *
 * Expected response shape (from explorer's run/api/healthSync.js):
 *   {
 *     "telegram": { "lastSuccessAt": "ISO", "consecutiveFailures": 0,
 *                   "totalSent": N, "configured": true },
 *     "opsgenieConfigured": false,
 *     "healthy": true
 *   }
 *
 * Thresholds (relaxed from 15min/60min on 2026-05-13 — see commit message):
 *   - DEGRADED if lastSuccessAt > 30 min stale or consecutiveFailures >= 3
 *   - DOWN if endpoint unreachable / 5xx / lastSuccessAt > 120 min stale
 *
 * Why relaxed: the alerter is structurally silent during periods when no
 * real incident occurs (the startup probe fires once at boot, real alerts
 * fire only on actual incidents). The 15-min DEGRADED threshold therefore
 * fired on every healthy quiet period, generating a ~22-min DEGRADED →
 * RECOVERED cycle that buried real alerts under self-noise. Restoring to
 * tighter values (15min/60min) becomes safe once the explorer adds a
 * periodic Telegram heartbeat (planned in companion PR — see
 * integra-explorer: `feat/telegram-heartbeat-getme`).
 */
async function checkExplorerAlerterLiveness(
  ep: Endpoint,
): Promise<CheckResult> {
  const start = Date.now();
  const details: Record<string, unknown> = {};
  const STALE_DEGRADED_MS = 30 * 60 * 1000;
  const STALE_DOWN_MS = 120 * 60 * 1000;

  let res;
  try {
    res = await httpRequest(ep.url, { timeout: ep.timeout });
  } catch (err: unknown) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Alerter endpoint unreachable: ${(err as Error).message}`,
    );
  }
  details.statusCode = res.statusCode;

  if (res.statusCode >= 500) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Alerter endpoint HTTP ${res.statusCode}`,
    );
  }

  let body: { telegram?: Record<string, unknown>; healthy?: boolean };
  try {
    body = JSON.parse(res.body);
  } catch {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      "Alerter endpoint returned non-JSON",
    );
  }

  const tg = body.telegram;
  if (!tg) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      "Alerter response missing telegram block",
    );
  }
  details.consecutiveFailures = tg.consecutiveFailures;
  details.totalSent = tg.totalSent;
  details.configured = tg.configured;

  // Configured-but-never-delivered is unhealthy by design (alerter is
  // expected to deliver the ALERTER ONLINE startup probe within seconds
  // of every backend restart).
  if (!tg.configured) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      "Telegram alerter is not configured (token/chat id missing)",
    );
  }
  if (typeof tg.consecutiveFailures === "number" && tg.consecutiveFailures >= 3) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Telegram delivery has ${tg.consecutiveFailures} consecutive failures`,
    );
  }
  if (!tg.lastSuccessAt) {
    return buildResult(
      ep,
      "DEGRADED",
      Date.now() - start,
      details,
      "No successful Telegram delivery yet (may be a fresh restart)",
    );
  }

  const lastSuccessMs = Date.parse(tg.lastSuccessAt as string);
  const ageMs = Date.now() - lastSuccessMs;
  details.lastSuccessAt = tg.lastSuccessAt;
  details.ageSeconds = Math.round(ageMs / 1000);

  if (ageMs > STALE_DOWN_MS) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Alerter silent for ${Math.round(ageMs / 60000)} min (>${STALE_DOWN_MS / 60000} min DOWN threshold)`,
    );
  }
  if (ageMs > STALE_DEGRADED_MS) {
    return buildResult(
      ep,
      "DEGRADED",
      Date.now() - start,
      details,
      `Alerter silent for ${Math.round(ageMs / 60000)} min (>${STALE_DEGRADED_MS / 60000} min DEGRADED threshold)`,
    );
  }

  return buildResult(ep, "UP", Date.now() - start, details);
}

async function checkExplorerSync(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const details: Record<string, unknown> = {};

  // 1. Get explorer's latest synced block
  // Supports: GraphQL (Hasura) or JSON API responses
  let explorerBlock: number | null = null;
  try {
    const isGraphql = ep.url.includes("/graphql");
    const reqOpts: HttpRequestOptions = { timeout: ep.timeout };

    if (isGraphql) {
      reqOpts.method = "POST";
      reqOpts.headers = { "Content-Type": "application/json" };
      reqOpts.body = JSON.stringify({
        query: "{ block(order_by:{height:desc}, limit:1) { height } }",
      });
    }

    const statusRes = await httpRequest(ep.url, reqOpts);
    if (statusRes.statusCode >= 200 && statusRes.statusCode < 400) {
      try {
        const data = JSON.parse(statusRes.body);
        if (isGraphql && data.data?.block?.[0]?.height) {
          explorerBlock = Number(data.data.block[0].height);
        } else if (Array.isArray(data.explorers)) {
          // INT-599 aggregate shape from /api/health/sync-status. The
          // endpoint returns one row per `shouldSync:true` explorer; we
          // take the first because integra-status configures a single
          // probe per environment. `lagSeconds` here is age-of-last-write,
          // not blocks-behind-tip — capture it directly so we can fall
          // back to it if no chain RPC is configured.
          const row = data.explorers[0];
          if (row) {
            if (row.lastIndexedBlock != null)
              explorerBlock = Number(row.lastIndexedBlock);
            if (typeof row.lagSeconds === "number")
              details.lagSecondsFromExplorer = row.lagSeconds;
            if (row.lastIndexedAt) details.lastIndexedAt = row.lastIndexedAt;
          }
        } else {
          explorerBlock =
            data.lastSyncedBlock ??
            data.latestBlock ??
            data.blockHeight ??
            data.height ??
            data.currentBlock ??
            null;
          if (explorerBlock !== null) explorerBlock = Number(explorerBlock);
        }
        details.explorerStatus = statusRes.statusCode;
      } catch (_) {
        // Not valid JSON
      }
    } else {
      return buildResult(
        ep,
        "DOWN",
        Date.now() - start,
        details,
        `Explorer API returned HTTP ${statusRes.statusCode}`,
      );
    }
  } catch (err: unknown) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Explorer unreachable: ${(err as Error).message}`,
    );
  }

  // 2. Get chain head from EVM RPC
  let chainBlock: number | null = null;
  if (ep.chainRpcUrl) {
    try {
      const rpcRes = await jsonRpc(
        ep.chainRpcUrl,
        "eth_blockNumber",
        [],
        ep.timeout,
      );
      const rpcData = JSON.parse(rpcRes.body);
      if (rpcData.result) {
        chainBlock = parseInt(rpcData.result, 16);
      }
    } catch (_) {
      details.chainRpcError = "Failed to query chain RPC";
    }
  }

  details.explorerBlock = explorerBlock;
  details.chainBlock = chainBlock;

  // 3. Compare
  if (explorerBlock !== null && chainBlock !== null) {
    const lag = chainBlock - explorerBlock;
    details.lag = lag;
    // Estimate lag in seconds (~2s per block for Integra)
    details.lagSeconds = lag * 2;

    if (lag <= 10) {
      return buildResult(ep, "UP", Date.now() - start, details);
    }
    if (lag <= 100) {
      return buildResult(
        ep,
        "DEGRADED",
        Date.now() - start,
        details,
        `Explorer ${lag} blocks behind chain`,
      );
    }
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Explorer ${lag} blocks behind chain (${Math.round((lag * 2) / 60)} min lag)`,
    );
  }

  // INT-599 fallback: when chain RPC didn't give us a tip but the
  // explorer surfaced `lagSeconds` (age of latest block write), classify
  // on freshness alone. The Integra block time is ~2s, so a healthy
  // indexer should never be more than ~3 min behind real time. Match
  // the band the chain-stall watchdog uses (~10 min hard fail).
  const lagFromExplorer = details.lagSecondsFromExplorer;
  if (typeof lagFromExplorer === "number") {
    details.lagSeconds = lagFromExplorer;
    if (lagFromExplorer < 180) {
      return buildResult(ep, "UP", Date.now() - start, details);
    }
    if (lagFromExplorer < 600) {
      return buildResult(
        ep,
        "DEGRADED",
        Date.now() - start,
        details,
        `Explorer ${Math.round(lagFromExplorer)}s since last indexed block`,
      );
    }
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Explorer ${Math.round(lagFromExplorer / 60)} min since last indexed block (likely wedged)`,
    );
  }

  // INT-638: empty explorers array means shouldSync=false on every row —
  // the indexer auto-disabled itself after 3 consecutive RPC failures.
  // This is user-impacting (zero data flowing), so report DOWN with an
  // actionable recovery command rather than the generic "could not determine"
  // message that obscures the root cause.
  if (
    details.explorerStatus != null &&
    details.explorerBlock === null &&
    details.lagSecondsFromExplorer === undefined
  ) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      "Explorer auto-disabled (shouldSync=false) — likely RPC failures. Recover with: UPDATE explorers SET \"shouldSync\"=true, \"syncFailedAttempts\"=0, \"syncDisabledAt\"=NULL WHERE id=1",
    );
  }

  // If we couldn't get explorer block but it responded, it's degraded
  if (explorerBlock === null) {
    return buildResult(
      ep,
      "DEGRADED",
      Date.now() - start,
      details,
      "Could not determine explorer sync height from API response",
    );
  }

  // Got explorer block but no chain comparison — report what we have
  return buildResult(ep, "UP", Date.now() - start, details);
}

async function checkExplorerDeepHealth(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const details: Record<string, unknown> = {};
  const subChecks: Array<{ name: string; status: Status; detail: string }> = [];

  // All 4 sub-checks run as a single batched GraphQL request to Hasura
  const query = `{
    block_gap: block(order_by: {height: desc}, limit: 1000) { height }
    tx_completeness: block(
      where: { num_txs: { _gt: 0 } }
      order_by: { height: desc }
      limit: 50
    ) { height num_txs transactions_aggregate { aggregate { count } } }
    last_write: block(order_by: {height: desc}, limit: 1) { height timestamp }
    log_check: transaction(
      where: { success: { _eq: true } }
      order_by: { height: desc }
      limit: 100
    ) { hash success gas_used raw_log }
  }`;

  let data: Record<string, unknown>;
  try {
    const res = await httpRequest(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      timeout: ep.timeout,
    });
    if (res.statusCode < 200 || res.statusCode >= 400)
      throw new Error(`HTTP ${res.statusCode}`);
    const parsed = JSON.parse(res.body);
    if (parsed.errors)
      throw new Error(parsed.errors[0]?.message || "GraphQL errors");
    data = parsed.data;
  } catch (err: unknown) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Hasura unreachable: ${(err as Error).message}`,
    );
  }

  // Sub-check 1: Block gap detection
  const blocks = data.block_gap as Array<{ height: number }>;
  if (blocks && blocks.length > 1) {
    let gaps = 0;
    const gapRanges: string[] = [];
    for (let i = 0; i < blocks.length - 1; i++) {
      const expected = blocks[i].height - 1;
      const actual = blocks[i + 1].height;
      if (expected !== actual) {
        gaps += expected - actual;
        if (gapRanges.length < 3) gapRanges.push(`${actual + 1}-${expected}`);
      }
    }
    details.gapsInLast1000 = gaps;
    if (gaps > 0) {
      subChecks.push({
        name: "block_gaps",
        status: "DEGRADED",
        detail: `${gaps} missing blocks in last 1000 (${gapRanges.join(", ")}${gapRanges.length < gaps ? "..." : ""})`,
      });
    } else {
      subChecks.push({
        name: "block_gaps",
        status: "UP",
        detail: "No gaps in last 1000 blocks",
      });
    }
  } else {
    subChecks.push({
      name: "block_gaps",
      status: "UP",
      detail: "Insufficient data to check gaps",
    });
  }

  // Sub-check 2: Transaction completeness
  const txBlocks = data.tx_completeness as Array<{
    height: number;
    num_txs: number;
    transactions_aggregate: { aggregate: { count: number } };
  }>;
  if (txBlocks && txBlocks.length > 0) {
    let mismatches = 0;
    for (const b of txBlocks) {
      const declared = b.num_txs;
      const actual = b.transactions_aggregate?.aggregate?.count ?? 0;
      if (declared !== actual) mismatches++;
    }
    details.txMismatches = mismatches;
    details.txBlocksChecked = txBlocks.length;
    if (mismatches > 0) {
      subChecks.push({
        name: "tx_completeness",
        status: "DEGRADED",
        detail: `${mismatches}/${txBlocks.length} blocks have tx count mismatch (num_txs != actual)`,
      });
    } else {
      subChecks.push({
        name: "tx_completeness",
        status: "UP",
        detail: `All ${txBlocks.length} sampled blocks have correct tx counts`,
      });
    }
  } else {
    subChecks.push({
      name: "tx_completeness",
      status: "UP",
      detail: "No blocks with txs to check",
    });
  }

  // Sub-check 3: Last write freshness
  const lastBlock = data.last_write as Array<{
    height: number;
    timestamp: string;
  }>;
  if (lastBlock && lastBlock.length > 0) {
    const blockTime = new Date(lastBlock[0].timestamp).getTime();
    const ageSec = (Date.now() - blockTime) / 1000;
    details.lastIndexedHeight = lastBlock[0].height;
    details.lastIndexedAgeSec = Math.round(ageSec);
    if (ageSec > 600) {
      subChecks.push({
        name: "write_freshness",
        status: "DOWN",
        detail: `Last indexed block is ${Math.round(ageSec / 60)} min old (height ${lastBlock[0].height})`,
      });
    } else if (ageSec > 300) {
      subChecks.push({
        name: "write_freshness",
        status: "DEGRADED",
        detail: `Last indexed block is ${Math.round(ageSec / 60)} min old`,
      });
    } else {
      subChecks.push({
        name: "write_freshness",
        status: "UP",
        detail: `Last indexed block ${Math.round(ageSec)}s ago (height ${lastBlock[0].height})`,
      });
    }
  } else {
    subChecks.push({
      name: "write_freshness",
      status: "DOWN",
      detail: "No blocks in database",
    });
  }

  // Sub-check 4: Log completeness (successful txs should have gas_used > 0)
  const txs = data.log_check as Array<{
    hash: string;
    success: boolean;
    gas_used: number;
    raw_log: string | null;
  }>;
  if (txs && txs.length > 0) {
    const incomplete = txs.filter((t) => t.success && t.gas_used === 0).length;
    const pct = Math.round((incomplete / txs.length) * 100);
    details.logIncomplete = incomplete;
    details.logsChecked = txs.length;
    details.logIncompletePct = pct;
    if (pct > 20) {
      subChecks.push({
        name: "log_completeness",
        status: "DEGRADED",
        detail: `${incomplete}/${txs.length} (${pct}%) successful txs have zero gas_used`,
      });
    } else {
      subChecks.push({
        name: "log_completeness",
        status: "UP",
        detail: `${txs.length - incomplete}/${txs.length} successful txs have valid gas data`,
      });
    }
  } else {
    subChecks.push({
      name: "log_completeness",
      status: "UP",
      detail: "No successful transactions to check",
    });
  }

  // Worst sub-check status becomes endpoint status
  details.subChecks = subChecks;
  let worstStatus: Status = "UP";
  for (const sc of subChecks) {
    if (sc.status === "DOWN") {
      worstStatus = "DOWN";
      break;
    }
    if (sc.status === "DEGRADED") worstStatus = "DEGRADED";
  }

  const failedChecks = subChecks.filter((sc) => sc.status !== "UP");
  const error =
    failedChecks.length > 0
      ? failedChecks.map((sc) => `${sc.name}: ${sc.detail}`).join("; ")
      : null;

  return buildResult(
    ep,
    worstStatus,
    Date.now() - start,
    details,
    error || undefined,
  );
}

// ---------------------------------------------------------------------------
// Chain-freshness check — user-facing staleness alert for explorer monitoring.
// Distinct from cosmos-rpc which trips at 120s; this trips at 5min DEGRADED /
// 30min DOWN so it pages on prolonged stalls without flapping on transient
// validator hiccups. Hits the Cosmos RPC /status endpoint and reads
// sync_info.latest_block_time.
// ---------------------------------------------------------------------------

const CHAIN_FRESHNESS_DEGRADED_SECONDS = 5 * 60; // 5 minutes
const CHAIN_FRESHNESS_DOWN_SECONDS = 30 * 60; // 30 minutes — Telegram alert fires here

async function checkChainFreshness(ep: Endpoint): Promise<CheckResult> {
  const details: Record<string, unknown> = {};
  const start = Date.now();

  const statusRes = await httpRequest(`${ep.url}/status`, {
    timeout: ep.timeout,
  });
  if (statusRes.statusCode !== 200)
    throw new Error(`HTTP ${statusRes.statusCode}`);

  const statusData = JSON.parse(statusRes.body);
  const syncInfo = statusData.result
    ? statusData.result.sync_info
    : statusData.sync_info;

  if (!syncInfo || !syncInfo.latest_block_time) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      "RPC returned no sync_info / latest_block_time",
    );
  }

  const blockTime = new Date(syncInfo.latest_block_time).getTime();
  const ageSec = Math.round((Date.now() - blockTime) / 1000);
  details.blockHeight = parseInt(syncInfo.latest_block_height, 10);
  details.latestBlockTime = syncInfo.latest_block_time;
  details.blockAgeSec = ageSec;

  if (ageSec >= CHAIN_FRESHNESS_DOWN_SECONDS) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Chain stalled — last block ${formatAge(ageSec)} ago`,
    );
  }
  if (ageSec >= CHAIN_FRESHNESS_DEGRADED_SECONDS) {
    return buildResult(
      ep,
      "DEGRADED",
      Date.now() - start,
      details,
      `Chain may be lagging — last block ${formatAge(ageSec)} ago`,
    );
  }
  return buildResult(ep, "UP", Date.now() - start, details);
}

function formatAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

// ---------------------------------------------------------------------------
// CometBFT mempool depth — early warning for tx spam or stuck mempool.
// A healthy testnet block produces ~5s with ~10-30 txs each, so the mempool
// drains as fast as it fills. Sustained elevated depth signals either a
// validator that can't include txs (stuck mempool, e.g. underpriced storm)
// or a spammer flooding faster than the chain can consume.
// ---------------------------------------------------------------------------

async function checkCometbftMempool(ep: Endpoint): Promise<CheckResult> {
  const start = Date.now();
  const degradedAt = ep.mempoolDegradedAt ?? 300;
  const downAt = ep.mempoolDownAt ?? 1000;

  const res = await httpRequest(`${ep.url}/num_unconfirmed_txs`, {
    timeout: ep.timeout,
  });
  if (res.statusCode !== 200)
    throw new Error(`HTTP ${res.statusCode}`);

  const data = JSON.parse(res.body);
  const payload = data.result ?? data;
  const nTxs = parseInt(payload.n_txs ?? "0", 10);
  const totalBytes = parseInt(payload.total_bytes ?? "0", 10);
  const details = { nTxs, totalBytes, degradedAt, downAt };

  if (nTxs >= downAt) {
    return buildResult(
      ep,
      "DOWN",
      Date.now() - start,
      details,
      `Mempool overloaded — ${nTxs} pending txs (≥${downAt})`,
    );
  }
  if (nTxs >= degradedAt) {
    return buildResult(
      ep,
      "DEGRADED",
      Date.now() - start,
      details,
      `Mempool elevated — ${nTxs} pending txs (≥${degradedAt})`,
    );
  }
  return buildResult(ep, "UP", Date.now() - start, details);
}

// ---------------------------------------------------------------------------
// Check dispatch
// ---------------------------------------------------------------------------

type CheckFn = (ep: Endpoint) => Promise<CheckResult>;

const CHECK_FNS: Record<CheckType, CheckFn> = {
  "evm-rpc": checkEvmRpc,
  "cosmos-rpc": checkCosmosRpc,
  "cosmos-rest": checkCosmosRest,
  "http-json": checkHttpJson,
  "http-get": checkHttpGet,
  websocket: checkWebsocket,
  "api-health": checkApiHealth,
  "http-reachable": checkHttpReachable,
  "deep-health": checkDeepHealth,
  graphql: checkGraphql,
  "cosmos-peer-check": checkCosmosPeer,
  "explorer-sync": checkExplorerSync,
  "explorer-alerter-liveness": checkExplorerAlerterLiveness,
  "explorer-deep-health": checkExplorerDeepHealth,
  "chain-freshness": checkChainFreshness,
  "cometbft-mempool": checkCometbftMempool,
};

export async function runCheck(ep: Endpoint): Promise<CheckResult> {
  const fn = CHECK_FNS[ep.checkType];
  if (!fn)
    return buildResult(
      ep,
      "DOWN",
      0,
      {},
      `Unknown check type: ${ep.checkType}`,
    );
  try {
    return await fn(ep);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    const isFirewall =
      error.code === "ECONNREFUSED" ||
      error.code === "ECONNRESET" ||
      error.code === "EHOSTUNREACH";
    const status: Status =
      ep.category === "validators" && isFirewall ? "DEGRADED" : "DOWN";
    const errMsg =
      ep.category === "validators" && isFirewall
        ? "Unreachable (likely firewalled)"
        : error.message || String(err);
    return buildResult(ep, status, 0, {}, errMsg);
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

type CheckAllOptions = {
  enabledOnly?: boolean;
  category?: Category;
  environment?: Environment;
};

export async function checkAll(opts?: CheckAllOptions): Promise<CheckResult[]> {
  const endpoints = getEndpoints({ enabledOnly: true, ...opts });
  const results = await Promise.allSettled(endpoints.map(runCheck));
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : buildResult(
          endpoints[i],
          "DOWN",
          0,
          {},
          r.reason?.message || "Check failed",
        ),
  );
}

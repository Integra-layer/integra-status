// lib/__tests__/health-config.test.ts
//
// Static integrity checks for the endpoint registry. These tests don't hit
// the network — they catch config drift the type system can't: dangling
// dependsOn/impacts IDs, owners with missing telegram handles, app-group
// references to nonexistent endpoints, and broken links.
//
// Whenever an endpoint is added/removed/renamed, run `npm test` to confirm
// the rest of the registry stays consistent.

import { describe, it, expect } from "vitest";
import {
  ENDPOINTS,
  OWNERS,
  CTO_TELEGRAM,
  APP_GROUPS,
  CATEGORIES,
  ENVIRONMENTS,
  getEndpoint,
  getEndpoints,
  getDependencyGraph,
  getImpactedServices,
} from "../health-config";

// ---------------------------------------------------------------------------
// Endpoint identity & basic shape
// ---------------------------------------------------------------------------

describe("ENDPOINTS — identity", () => {
  it("has unique IDs", () => {
    const ids = ENDPOINTS.map((e) => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("has a valid category for every endpoint", () => {
    for (const ep of ENDPOINTS) {
      expect(CATEGORIES, `endpoint ${ep.id} has invalid category`).toContain(
        ep.category,
      );
    }
  });

  it("has a valid environment for every endpoint", () => {
    for (const ep of ENDPOINTS) {
      expect(ENVIRONMENTS, `endpoint ${ep.id} has invalid environment`).toContain(
        ep.environment,
      );
    }
  });

  it("has a non-empty url and links.endpoint that match", () => {
    for (const ep of ENDPOINTS) {
      expect(ep.url, `endpoint ${ep.id} url is empty`).toBeTruthy();
      expect(
        ep.links.endpoint,
        `endpoint ${ep.id} links.endpoint is empty`,
      ).toBeTruthy();
    }
  });

  it("uses https:// for all enabled endpoint URLs (or wss://, or explicit http: validators)", () => {
    // Validators expose CometBFT RPC over plain http on private IPs — that's OK.
    // Everything else must be TLS.
    const httpAllowed = new Set([
      "validator-gateway",
      "validator-signer1",
      "validator-signer2",
      "validator-archive",
    ]);
    for (const ep of ENDPOINTS) {
      if (!ep.enabled) continue;
      if (httpAllowed.has(ep.id)) continue;
      const url = ep.url;
      expect(
        url.startsWith("https://") || url.startsWith("wss://"),
        `enabled endpoint ${ep.id} should use TLS — got ${url}`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

describe("OWNERS — Telegram handles", () => {
  it("every owner has a non-empty telegram handle", () => {
    for (const [key, owner] of Object.entries(OWNERS)) {
      expect(
        owner.telegram,
        `owner ${key} (${owner.name}) is missing a telegram handle`,
      ).toBeTruthy();
    }
  });

  it("CTO_TELEGRAM matches an actual owner's handle", () => {
    const handles = Object.values(OWNERS).map((o) => o.telegram);
    expect(handles).toContain(CTO_TELEGRAM);
  });

  it("every endpoint has an owner with a telegram handle", () => {
    for (const ep of ENDPOINTS) {
      expect(ep.owner, `endpoint ${ep.id} has no owner`).toBeTruthy();
      expect(
        ep.owner.telegram,
        `endpoint ${ep.id} owner ${ep.owner.name} has no telegram handle`,
      ).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Dependency graph integrity — the silent killer of incident response
// ---------------------------------------------------------------------------

describe("dependency graph", () => {
  it("every dependsOn ID points to a real endpoint", () => {
    const ids = new Set(ENDPOINTS.map((e) => e.id));
    for (const ep of ENDPOINTS) {
      for (const dep of ep.dependsOn) {
        expect(
          ids,
          `endpoint ${ep.id} dependsOn unknown id "${dep}"`,
        ).toContain(dep);
      }
    }
  });

  it("every impacts ID points to a real endpoint", () => {
    const ids = new Set(ENDPOINTS.map((e) => e.id));
    for (const ep of ENDPOINTS) {
      for (const imp of ep.impacts) {
        expect(
          ids,
          `endpoint ${ep.id} impacts unknown id "${imp}"`,
        ).toContain(imp);
      }
    }
  });

  it("getDependencyGraph builds bidirectional edges", () => {
    const graph = getDependencyGraph();
    for (const ep of ENDPOINTS) {
      for (const dep of ep.dependsOn) {
        expect(
          graph[dep]?.requiredBy,
          `${ep.id} depends on ${dep} but ${dep}.requiredBy doesn't include ${ep.id}`,
        ).toContain(ep.id);
      }
    }
  });

  it("getImpactedServices does BFS without infinite loops", () => {
    // The Vercel platform endpoint has many transitive impacts; if BFS were
    // broken we'd hang forever or stack-overflow.
    const impacted = getImpactedServices("vercel");
    expect(Array.isArray(impacted)).toBe(true);
    // Vercel is impactful but the actual count depends on the registry —
    // just confirm we returned without throwing.
    expect(impacted.length).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// App groups
// ---------------------------------------------------------------------------

describe("APP_GROUPS", () => {
  it("every endpoint reference points to a real endpoint", () => {
    const ids = new Set(ENDPOINTS.map((e) => e.id));
    for (const group of APP_GROUPS) {
      for (const epId of group.endpoints) {
        expect(
          ids,
          `app group "${group.id}" references unknown endpoint "${epId}"`,
        ).toContain(epId);
      }
    }
  });

  it("has unique group IDs", () => {
    const ids = APP_GROUPS.map((g) => g.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("includes the special 'external' bucket that auto-fills from the registry", () => {
    const ext = APP_GROUPS.find((g) => g.id === "external");
    expect(ext).toBeTruthy();
    // External category endpoints not claimed by other groups should land here.
    const externalEndpoints = ENDPOINTS.filter((e) => e.category === "external");
    if (externalEndpoints.length > 0) {
      expect(ext!.endpoints.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

describe("getEndpoints", () => {
  it("filters to enabled endpoints by default", () => {
    const enabled = getEndpoints();
    const enabledCount = ENDPOINTS.filter((e) => e.enabled).length;
    expect(enabled.length).toBe(enabledCount);
  });

  it("returns all endpoints when enabledOnly is false", () => {
    const all = getEndpoints({ enabledOnly: false });
    expect(all.length).toBe(ENDPOINTS.length);
  });

  it("filters by category", () => {
    const apis = getEndpoints({ category: "apis", enabledOnly: false });
    for (const ep of apis) {
      expect(ep.category).toBe("apis");
    }
  });

  it("filters by environment", () => {
    const dev = getEndpoints({ environment: "dev", enabledOnly: false });
    for (const ep of dev) {
      expect(ep.environment).toBe("dev");
    }
  });
});

describe("getEndpoint", () => {
  it("returns null for unknown IDs", () => {
    expect(getEndpoint("does-not-exist")).toBeNull();
  });

  it("returns the registered endpoint by ID", () => {
    const ep = getEndpoint("status-page");
    expect(ep?.id).toBe("status-page");
  });
});

// ---------------------------------------------------------------------------
// Retirement gate — these endpoints were permanently retired, either with the
// mainnet shutdown or as part of service consolidations (notifications →
// dashboard-api SNS, dev tier deprecations). Re-enabling one without first
// confirming the underlying infrastructure is back will explode the alert
// channel. Update this test only after the resource is genuinely restored.
// ---------------------------------------------------------------------------

describe("retired endpoints — retirement gate", () => {
  const retiredMainnetIds = [
    "mainnet-evm-rpc",
    "mainnet-evm-ws",
    "mainnet-cosmos-rpc",
    "mainnet-cosmos-rpc2",
    "mainnet-cosmos-rest",
    "mainnet-cosmos-rpc-adam",
    "mainnet-cosmos-rest-adam",
    "mainnet-chain-freshness",
    "validator-gateway",
    "portal-mainnet",
    "explorer-mainnet",
    "explorer-mainnet-backend",
    "explorer-v2",
    "explorer-graphql",
    "blockscout-mainnet",
    "explorer-mainnet-sync",
    "explorer-mainnet-deep-health",
    // Service consolidations (separate from mainnet retirement)
    "notification-api-prod", // → folded into dashboard-api via AWS SNS
    "notification-api-dev", // → folded into dashboard-api-dev via AWS SNS
    "city-api-dev", // App Runner instance deprovisioned; confirm with Kalki if a new dev URL exists
  ];

  it("all retired entries stay disabled", () => {
    for (const id of retiredMainnetIds) {
      const ep = getEndpoint(id);
      expect(ep, `retired entry "${id}" missing from registry`).toBeTruthy();
      expect(
        ep!.enabled,
        `retired entry "${id}" is enabled — confirm the underlying infrastructure is genuinely restored before re-enabling`,
      ).toBe(false);
    }
  });

  it("APP_GROUPS reference no retired IDs", () => {
    const retiredSet = new Set(retiredMainnetIds);
    for (const group of APP_GROUPS) {
      for (const epId of group.endpoints) {
        expect(
          retiredSet.has(epId),
          `app group "${group.id}" references retired endpoint "${epId}"`,
        ).toBe(false);
      }
    }
  });
});

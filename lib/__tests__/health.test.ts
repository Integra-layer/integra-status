// lib/__tests__/health.test.ts
//
// Unit tests for the explorer-sync parser logic in checkExplorerSync().
// These tests stub the outbound HTTPS requests via vi.spyOn so no network
// calls are made.
//
// INT-638: empty explorers array must return DOWN with the auto-disable
// message, not the generic "Could not determine" DEGRADED result that
// obscured the root cause in the 2026-05-25 05:07 UTC alert.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import https from "https";
import { EventEmitter } from "events";

// Import runCheck after setting up spies in each test via beforeEach.
import { runCheck } from "../health";

// ---------------------------------------------------------------------------
// Helper: build a fake https.ClientRequest + IncomingMessage pair
// ---------------------------------------------------------------------------

function makeFakeRequest(statusCode: number, body: string) {
  // The fake response emitter
  const res = new EventEmitter() as NodeJS.EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
  };
  res.statusCode = statusCode;
  res.headers = {};

  // The fake request object returned by https.request()
  const req = new EventEmitter() as NodeJS.EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  req.write = vi.fn();
  req.destroy = vi.fn();
  req.end = vi.fn().mockImplementation(() => {
    // Emit data + end on the response in the next microtask so the promise
    // resolves after httpRequest has attached its listeners.
    Promise.resolve().then(() => {
      res.emit("data", Buffer.from(body));
      res.emit("end");
    });
  });

  return { req, res };
}

// ---------------------------------------------------------------------------
// Minimal endpoint fixture matching the testnet explorer-sync config shape
// ---------------------------------------------------------------------------

const explorerSyncEp = {
  id: "explorer-testnet-sync",
  name: "Testnet Explorer Sync",
  category: "blockchain" as const,
  environment: "dev" as const,
  url: "https://testnet.explorer.integralayer.com/api/health/sync-status",
  checkType: "explorer-sync" as const,
  chainRpcUrl: "https://testnet.integralayer.com/evm",
  timeout: 15000,
  enabled: true,
  dependsOn: [],
  impacts: [],
  description: "Testnet explorer sync freshness",
  richDescription: "",
  owner: { name: "Adam", role: "CTO", contact: "", telegram: "" },
  links: { endpoint: "https://testnet.explorer.integralayer.com" },
  commonIssues: [],
  tags: [],
};

// ---------------------------------------------------------------------------
// Spy setup helpers
// ---------------------------------------------------------------------------

// We need to control two sequential HTTPS calls per test:
// 1. GET /api/health/sync-status  → explorer sync-status response
// 2. POST /evm                    → chain RPC response (eth_blockNumber)
// We use a call-count queue so each successive call returns the next stub.

function stubHttpsRequests(
  responses: Array<{ statusCode: number; body: string }>,
) {
  let callIndex = 0;
  return vi
    .spyOn(https, "request")
    .mockImplementation(
      ((_opts: unknown, cb?: (res: unknown) => void) => {
        const stub = responses[callIndex] ?? { statusCode: 200, body: "{}" };
        callIndex++;
        const { req, res } = makeFakeRequest(stub.statusCode, stub.body);
        if (cb) cb(res);
        return req as unknown as ReturnType<typeof https.request>;
      }) as typeof https.request,
    );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// INT-638: empty explorers array → DOWN with actionable auto-disable message
// ---------------------------------------------------------------------------

describe("checkExplorerSync — empty explorers array (INT-638)", () => {
  it("returns DOWN when explorers array is empty", async () => {
    stubHttpsRequests([
      {
        statusCode: 200,
        body: JSON.stringify({
          explorers: [],
          checkedAt: new Date().toISOString(),
        }),
      },
      // Chain RPC: no result (can't compare block heights)
      {
        statusCode: 200,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }),
      },
    ]);

    const result = await runCheck(explorerSyncEp);

    expect(result.status).toBe("DOWN");
  });

  it("includes shouldSync=false and SQL recovery command in the error message", async () => {
    stubHttpsRequests([
      {
        statusCode: 200,
        body: JSON.stringify({
          explorers: [],
          checkedAt: new Date().toISOString(),
        }),
      },
      {
        statusCode: 200,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }),
      },
    ]);

    const result = await runCheck(explorerSyncEp);

    expect(result.error).not.toBeNull();
    expect(result.error).toContain("shouldSync=false");
    expect(result.error).toContain("UPDATE explorers SET");
    expect(result.error).toContain("syncFailedAttempts");
  });

  it("does NOT return the generic 'Could not determine' message for empty array", async () => {
    stubHttpsRequests([
      {
        statusCode: 200,
        body: JSON.stringify({
          explorers: [],
          checkedAt: new Date().toISOString(),
        }),
      },
      {
        statusCode: 200,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }),
      },
    ]);

    const result = await runCheck(explorerSyncEp);

    expect(result.error ?? "").not.toContain("Could not determine");
  });
});

// ---------------------------------------------------------------------------
// Healthy / degraded paths — explorers array has a row with low/high lag
// ---------------------------------------------------------------------------

describe("checkExplorerSync — explorers array with data", () => {
  it("returns UP when lagSeconds is low and chain RPC returns no tip", async () => {
    stubHttpsRequests([
      {
        statusCode: 200,
        body: JSON.stringify({
          explorers: [
            {
              id: 1,
              lastIndexedBlock: 100_000,
              lagSeconds: 5,
              lastIndexedAt: new Date().toISOString(),
            },
          ],
          checkedAt: new Date().toISOString(),
        }),
      },
      {
        statusCode: 200,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }),
      },
    ]);

    const result = await runCheck(explorerSyncEp);

    expect(result.status).toBe("UP");
  });

  it("returns DEGRADED when lagSeconds is between 180 and 600", async () => {
    stubHttpsRequests([
      {
        statusCode: 200,
        body: JSON.stringify({
          explorers: [
            {
              id: 1,
              lastIndexedBlock: 100_000,
              lagSeconds: 300,
              lastIndexedAt: new Date().toISOString(),
            },
          ],
          checkedAt: new Date().toISOString(),
        }),
      },
      {
        statusCode: 200,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }),
      },
    ]);

    const result = await runCheck(explorerSyncEp);

    expect(result.status).toBe("DEGRADED");
  });

  it("returns DOWN when lagSeconds exceeds 600", async () => {
    stubHttpsRequests([
      {
        statusCode: 200,
        body: JSON.stringify({
          explorers: [
            {
              id: 1,
              lastIndexedBlock: 100_000,
              lagSeconds: 700,
              lastIndexedAt: new Date().toISOString(),
            },
          ],
          checkedAt: new Date().toISOString(),
        }),
      },
      {
        statusCode: 200,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }),
      },
    ]);

    const result = await runCheck(explorerSyncEp);

    expect(result.status).toBe("DOWN");
  });
});

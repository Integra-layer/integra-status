// lib/__tests__/incident-tracker.test.ts
//
// Pins the flap-collapsing state machine that turns a slow-flapping
// endpoint (the City of Integra API on 2026-05-21 — ~17 pages in 2h)
// into a single incident: one "entered" alert, an hourly digest, one
// "resolved" alert. All time is passed explicitly so the tests are
// deterministic without faking the clock.

import { describe, it, expect } from "vitest";
import {
  recordTransition,
  checkIncidentExit,
  FLAP_WINDOW_MS,
  FLAP_ENTER_THRESHOLD,
  INCIDENT_DIGEST_MS,
  INCIDENT_EXIT_STABLE_MS,
  type IncidentKv,
  type TransitionDecision,
} from "../incident-tracker";

// In-memory stand-in for lib/local-kv. The real store round-trips
// through JSON on disk, so copy on set — that stops a test sharing a
// mutable reference with the tracker and masking a missing persist.
function makeKv(): IncidentKv {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return store.has(key) ? (store.get(key) as T) : null;
    },
    async set(key: string, value: unknown): Promise<void> {
      store.set(key, JSON.parse(JSON.stringify(value)));
    },
    async del(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

const FIVE_MIN = 5 * 60 * 1000;

// Drive `n` confirmed transitions 5 min apart starting at `start`.
// Returns the decisions and the timestamp of the last transition.
async function flap(
  kv: IncidentKv,
  id: string,
  start: number,
  n: number,
): Promise<{ decisions: TransitionDecision[]; lastNow: number }> {
  const decisions: TransitionDecision[] = [];
  let now = start;
  for (let i = 0; i < n; i++) {
    decisions.push(await recordTransition(kv, id, now));
    if (i < n - 1) now += FIVE_MIN;
  }
  return { decisions, lastNow: now };
}

describe("recordTransition", () => {
  it("reports the first transitions normally, below the flap threshold", async () => {
    const kv = makeKv();
    const { decisions } = await flap(kv, "city-api", 1_000_000, FLAP_ENTER_THRESHOLD - 1);
    expect(decisions.every((d) => d.action === "alert")).toBe(true);
  });

  it("opens an incident on the Nth transition within the window", async () => {
    const kv = makeKv();
    const { decisions } = await flap(kv, "city-api", 1_000_000, FLAP_ENTER_THRESHOLD);
    const last = decisions[decisions.length - 1];
    expect(last.action).toBe("incident-start");
    if (last.action === "incident-start") {
      expect(last.flaps).toBe(FLAP_ENTER_THRESHOLD);
    }
  });

  it("suppresses per-transition alerts once an incident is open", async () => {
    const kv = makeKv();
    const { lastNow } = await flap(kv, "city-api", 1_000_000, FLAP_ENTER_THRESHOLD);
    let now = lastNow;
    for (let i = 0; i < 3; i++) {
      now += FIVE_MIN;
      const d = await recordTransition(kv, "city-api", now);
      expect(d.action).toBe("suppress");
    }
  });

  it("emits at most one digest per INCIDENT_DIGEST_MS while flapping", async () => {
    const kv = makeKv();
    const { lastNow } = await flap(kv, "city-api", 1_000_000, FLAP_ENTER_THRESHOLD);

    // A transition past the digest interval emits exactly one digest.
    const digest = await recordTransition(kv, "city-api", lastNow + INCIDENT_DIGEST_MS);
    expect(digest.action).toBe("incident-digest");
    if (digest.action === "incident-digest") {
      expect(digest.flaps).toBeGreaterThan(FLAP_ENTER_THRESHOLD);
    }

    // The very next transition is back to silent.
    const after = await recordTransition(kv, "city-api", lastNow + INCIDENT_DIGEST_MS + 60_000);
    expect(after.action).toBe("suppress");
  });

  it("does not count transitions older than the rolling window", async () => {
    const kv = makeKv();
    let now = 1_000_000;
    // Spaced wider than FLAP_WINDOW_MS — they never accumulate into an incident.
    for (let i = 0; i < FLAP_ENTER_THRESHOLD + 2; i++) {
      const d = await recordTransition(kv, "city-api", now);
      expect(d.action).toBe("alert");
      now += FLAP_WINDOW_MS + 60_000;
    }
  });
});

describe("checkIncidentExit", () => {
  it("does not exit while the endpoint has not yet held a stable status long enough", async () => {
    const kv = makeKv();
    const { lastNow } = await flap(kv, "city-api", 1_000_000, FLAP_ENTER_THRESHOLD);
    const r = await checkIncidentExit(kv, "city-api", lastNow, lastNow + 60_000);
    expect(r.exited).toBe(false);
  });

  it("exits once the endpoint has held one status for INCIDENT_EXIT_STABLE_MS", async () => {
    const kv = makeKv();
    const { lastNow } = await flap(kv, "city-api", 1_000_000, FLAP_ENTER_THRESHOLD);
    const r = await checkIncidentExit(
      kv,
      "city-api",
      lastNow,
      lastNow + INCIDENT_EXIT_STABLE_MS,
    );
    expect(r.exited).toBe(true);
    if (r.exited) {
      expect(r.stableForSec).toBe(INCIDENT_EXIT_STABLE_MS / 1000);
      expect(r.flaps).toBe(FLAP_ENTER_THRESHOLD);
    }
  });

  it("clears incident + flap state on exit so a later flap starts fresh", async () => {
    const kv = makeKv();
    const { lastNow } = await flap(kv, "city-api", 1_000_000, FLAP_ENTER_THRESHOLD);
    const exitAt = lastNow + INCIDENT_EXIT_STABLE_MS;
    await checkIncidentExit(kv, "city-api", lastNow, exitAt);

    // State wiped — the next transition is a normal alert again, not a suppress.
    const d = await recordTransition(kv, "city-api", exitAt + 60_000);
    expect(d.action).toBe("alert");
  });

  it("returns not-exited when there is no open incident", async () => {
    const kv = makeKv();
    const r = await checkIncidentExit(kv, "healthy-api", 1_000_000, 5_000_000);
    expect(r.exited).toBe(false);
  });
});

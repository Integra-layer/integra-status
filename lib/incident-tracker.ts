// lib/incident-tracker.ts — Flapping-incident collapser for endpoint alerts.
//
// Problem (2026-05-21): a genuinely unstable endpoint — the City of
// Integra API that afternoon — transitioned DOWN/UP every ~10-15 min.
// The old flap guard in app/api/cron/route.ts only suppressed >3
// transitions inside a 5-min window, so a slow flap dodged it entirely
// and paged on every single change: ~17 Telegram messages for what was
// operationally one ongoing incident.
//
// This module collapses a sustained flap into ONE incident: an
// "entered" alert, at most one digest per hour while it persists, and a
// single "resolved" alert once the endpoint holds steady again. It
// never goes silent on an unresolved problem — the 2026-05 five-day
// testnet stall was a silent-alerting failure — it just stops paging
// once per transition.

export type IncidentKv = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
};

// Rolling window over which confirmed transitions are counted toward a flap.
export const FLAP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
// Confirmed transitions within FLAP_WINDOW_MS that open an incident.
export const FLAP_ENTER_THRESHOLD = 4;
// While an incident is open, re-summarise at most this often.
export const INCIDENT_DIGEST_MS = 60 * 60 * 1000; // 1 hour
// An open incident closes once the endpoint holds one status this long.
export const INCIDENT_EXIT_STABLE_MS = 30 * 60 * 1000; // 30 min

export type IncidentState = {
  since: number; // epoch ms the incident opened
  flaps: number; // confirmed transitions counted since it opened
  lastDigestAt: number; // epoch ms of the last digest emitted (starts at `since`)
};

export type TransitionDecision =
  | { action: "alert" } // not flapping — report this transition normally
  | { action: "incident-start"; flaps: number } // threshold crossed — announce once
  | { action: "incident-digest"; flaps: number; sinceMs: number } // hourly update
  | { action: "suppress" }; // inside an open incident — say nothing

export type ExitResult =
  | { exited: false }
  | { exited: true; stableForSec: number; flaps: number };

const flapsKey = (id: string) => `flaps:${id}`;
const incidentKey = (id: string) => `incident:${id}`;

/**
 * Record a confirmed status transition for an endpoint and decide how it
 * should be reported. Call exactly once per confirmed transition (after
 * the 2-consecutive-check gate) — never for DEPLOYING transitions, which
 * are intentional restarts and must not count toward a flap.
 */
export async function recordTransition(
  kv: IncidentKv,
  id: string,
  now: number,
): Promise<TransitionDecision> {
  // Maintain the rolling window of recent transition timestamps. The TTL
  // lets a long-quiet endpoint's entry self-clean.
  const raw = (await kv.get<number[]>(flapsKey(id))) ?? [];
  const flaps = raw.filter((t) => t > now - FLAP_WINDOW_MS);
  flaps.push(now);
  await kv.set(flapsKey(id), flaps, { ex: Math.ceil(FLAP_WINDOW_MS / 1000) });

  const incident = await kv.get<IncidentState>(incidentKey(id));

  if (incident) {
    // Already collapsed — count the flap, emit at most one digest/hour.
    incident.flaps += 1;
    if (now - incident.lastDigestAt >= INCIDENT_DIGEST_MS) {
      incident.lastDigestAt = now;
      await kv.set(incidentKey(id), incident);
      return {
        action: "incident-digest",
        flaps: incident.flaps,
        sinceMs: now - incident.since,
      };
    }
    await kv.set(incidentKey(id), incident);
    return { action: "suppress" };
  }

  if (flaps.length >= FLAP_ENTER_THRESHOLD) {
    // Threshold crossed — open an incident and announce it once.
    const state: IncidentState = {
      since: now,
      flaps: flaps.length,
      lastDigestAt: now,
    };
    await kv.set(incidentKey(id), state);
    return { action: "incident-start", flaps: flaps.length };
  }

  // Not flapping (yet) — report this transition normally.
  return { action: "alert" };
}

/**
 * Check whether an open incident for `id` has resolved — i.e. the
 * endpoint has held a single status for INCIDENT_EXIT_STABLE_MS. Call
 * once per cron tick for every endpoint whose status was unchanged this
 * tick. Clears incident + flap state on exit so a later flap starts
 * from a clean slate.
 *
 * @param statusSince epoch ms the endpoint's current (stable) status began
 */
export async function checkIncidentExit(
  kv: IncidentKv,
  id: string,
  statusSince: number,
  now: number,
): Promise<ExitResult> {
  const incident = await kv.get<IncidentState>(incidentKey(id));
  if (!incident) return { exited: false };
  if (now - statusSince < INCIDENT_EXIT_STABLE_MS) return { exited: false };

  await kv.del(incidentKey(id));
  await kv.del(flapsKey(id));
  return {
    exited: true,
    stableForSec: Math.round((now - statusSince) / 1000),
    flaps: incident.flaps,
  };
}

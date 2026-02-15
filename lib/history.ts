// lib/history.ts — Ring buffer for historical snapshots, sparklines, uptimes, incidents
import fs from "fs";
import path from "path";
import type { CheckResult } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SnapshotEntry = { s: number; ms: number };
type Snapshot = { t: number; ep: Record<string, SnapshotEntry> };
type History = { snapshots: Snapshot[] };
export type Incident = { id: string; fromStatus: string; toStatus: string; at: number };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_FILE = path.join("/tmp", "integra-history.json");
export const MAX_SNAPSHOTS = 120;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function loadHistory(): History {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.snapshots)) return data as History;
  } catch (_) {
    // file doesn't exist yet or is corrupt — start fresh
  }
  return { snapshots: [] };
}

export function saveHistory(history: History): void {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history), "utf8");
  } catch (_) {
    // /tmp write failure — non-fatal
  }
}

// ---------------------------------------------------------------------------
// Record a snapshot
// ---------------------------------------------------------------------------

export function recordSnapshot(history: History, results: CheckResult[]): History {
  const endpoints: Record<string, SnapshotEntry> = {};
  for (const r of results) {
    endpoints[r.id] = {
      s: r.status === "UP" ? 1 : r.status === "DEGRADED" ? 2 : 0,
      ms: r.responseTimeMs || 0,
    };
  }
  history.snapshots.push({ t: Date.now(), ep: endpoints });
  if (history.snapshots.length > MAX_SNAPSHOTS) {
    history.snapshots = history.snapshots.slice(-MAX_SNAPSHOTS);
  }
  return history;
}

// ---------------------------------------------------------------------------
// Sparklines — per-endpoint response time series (or -1 for DOWN)
// ---------------------------------------------------------------------------

export function getSparklines(history: History): Record<string, (number | null)[]> {
  const sparklines: Record<string, (number | null)[]> = {};
  const snapshots = history.snapshots;
  if (snapshots.length === 0) return sparklines;

  const latest = snapshots[snapshots.length - 1];
  const ids = Object.keys(latest.ep);

  for (const id of ids) {
    const points: (number | null)[] = [];
    for (const snap of snapshots) {
      const ep = snap.ep[id];
      if (ep) {
        points.push(ep.s === 0 ? -1 : ep.ms);
      } else {
        points.push(null);
      }
    }
    sparklines[id] = points;
  }
  return sparklines;
}

// ---------------------------------------------------------------------------
// Uptimes — percentage of UP snapshots per endpoint
// ---------------------------------------------------------------------------

export function getUptimes(history: History): Record<string, number> {
  const uptimes: Record<string, number> = {};
  const snapshots = history.snapshots;
  if (snapshots.length === 0) return uptimes;

  const latest = snapshots[snapshots.length - 1];
  const ids = Object.keys(latest.ep);

  for (const id of ids) {
    let total = 0;
    let up = 0;
    for (const snap of snapshots) {
      const ep = snap.ep[id];
      if (ep) {
        total++;
        if (ep.s === 1) up++;
      }
    }
    uptimes[id] = total > 0 ? Math.round((up / total) * 10000) / 100 : 100;
  }
  return uptimes;
}

// ---------------------------------------------------------------------------
// Incidents — status transitions between consecutive snapshots
// ---------------------------------------------------------------------------

const STATUS_NAMES: Record<number, string> = { 0: "DOWN", 1: "UP", 2: "DEGRADED" };

export function getIncidents(history: History): Incident[] {
  const snapshots = history.snapshots;
  if (snapshots.length < 2) return [];

  const incidents: Incident[] = [];
  const currentStatus: Record<string, number> = {};
  const first = snapshots[0];

  for (const id of Object.keys(first.ep)) {
    currentStatus[id] = first.ep[id].s;
  }

  for (let i = 1; i < snapshots.length; i++) {
    const snap = snapshots[i];
    for (const id of Object.keys(snap.ep)) {
      const prev = currentStatus[id];
      const curr = snap.ep[id].s;
      if (prev !== undefined && prev !== curr) {
        incidents.push({
          id,
          fromStatus: STATUS_NAMES[prev] || "UNKNOWN",
          toStatus: STATUS_NAMES[curr] || "UNKNOWN",
          at: snap.t,
        });
      }
      currentStatus[id] = curr;
    }
  }

  incidents.sort((a, b) => b.at - a.at);
  return incidents;
}

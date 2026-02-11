// lib/history.js — Ring buffer for historical snapshots, sparklines, uptimes, incidents
'use strict';

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join('/tmp', 'integra-history.json');
const MAX_SNAPSHOTS = 120; // 1 hour at 30s intervals

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function loadHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.snapshots)) return data;
  } catch (_) { /* cold start — no file yet */ }
  return { snapshots: [] };
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history), 'utf8');
  } catch (_) { /* /tmp write failed — non-fatal */ }
}

// ---------------------------------------------------------------------------
// Record a snapshot
// ---------------------------------------------------------------------------

function recordSnapshot(history, results) {
  const endpoints = {};
  for (const r of results) {
    endpoints[r.id] = {
      s: r.status === 'UP' ? 1 : r.status === 'DEGRADED' ? 2 : 0, // 1=UP, 2=DEGRADED, 0=DOWN
      ms: r.responseTimeMs || 0,
    };
  }
  history.snapshots.push({
    t: Date.now(),
    ep: endpoints,
  });
  // Ring buffer: keep only last MAX_SNAPSHOTS
  if (history.snapshots.length > MAX_SNAPSHOTS) {
    history.snapshots = history.snapshots.slice(-MAX_SNAPSHOTS);
  }
  return history;
}

// ---------------------------------------------------------------------------
// Sparklines — response time arrays per endpoint
// ---------------------------------------------------------------------------

function getSparklines(history) {
  const sparklines = {};
  const snapshots = history.snapshots;
  if (snapshots.length === 0) return sparklines;

  // Collect all endpoint IDs from most recent snapshot
  const latest = snapshots[snapshots.length - 1];
  const ids = Object.keys(latest.ep);

  for (const id of ids) {
    const points = [];
    for (const snap of snapshots) {
      const ep = snap.ep[id];
      if (ep) {
        // Use -1 for DOWN endpoints so sparkline can show drops
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

function getUptimes(history) {
  const uptimes = {};
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
// Incidents — status transitions
// ---------------------------------------------------------------------------

function getIncidents(history) {
  const snapshots = history.snapshots;
  if (snapshots.length < 2) return [];

  const STATUS_NAMES = { 0: 'DOWN', 1: 'UP', 2: 'DEGRADED' };
  const incidents = [];

  // Track ongoing status per endpoint
  const currentStatus = {};

  // Initialize from first snapshot
  const first = snapshots[0];
  for (const id of Object.keys(first.ep)) {
    currentStatus[id] = first.ep[id].s;
  }

  // Scan for transitions
  for (let i = 1; i < snapshots.length; i++) {
    const snap = snapshots[i];
    for (const id of Object.keys(snap.ep)) {
      const prev = currentStatus[id];
      const curr = snap.ep[id].s;
      if (prev !== undefined && prev !== curr) {
        incidents.push({
          id,
          fromStatus: STATUS_NAMES[prev] || 'UNKNOWN',
          toStatus: STATUS_NAMES[curr] || 'UNKNOWN',
          at: snap.t,
        });
      }
      currentStatus[id] = curr;
    }
  }

  // Sort newest first
  incidents.sort((a, b) => b.at - a.at);
  return incidents;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadHistory,
  saveHistory,
  recordSnapshot,
  getSparklines,
  getUptimes,
  getIncidents,
  MAX_SNAPSHOTS,
};

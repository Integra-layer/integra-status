// app/api/cron/route.ts — Vercel Cron handler for polling + alerts

import { NextResponse } from "next/server";
import { localKv as kv } from "@/lib/local-kv";
import { checkAll } from "@/lib/health";
import { APP_GROUPS, CATEGORIES } from "@/lib/health-config";
import {
  loadHistory,
  saveHistory,
  recordSnapshot,
  getSparklines,
  getUptimes,
  getIncidents,
} from "@/lib/history";
import { sendMessage } from "@/lib/telegram";
import {
  formatAlert,
  formatRecovery,
  formatGroupedAlert,
  formatDailyDigest,
  formatFlapStart,
  formatFlapDigest,
  formatIncidentResolved,
} from "@/lib/telegram-messages";
import { overviewKeyboard } from "@/lib/telegram-keyboards";
import { recordTransition, checkIncidentExit } from "@/lib/incident-tracker";
import type { CheckResult, HealthSummary } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

type StoredStatus = {
  status: string;
  at: number;
  consecutive: number; // consecutive checks showing a DIFFERENT status than stored
};

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends Authorization header)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawResults = await checkAll();

    // Override status to DEPLOYING for endpoints with active deploy flag
    const results: CheckResult[] = [];
    for (const r of rawResults) {
      const deployFlag = await kv.get<{ at: number }>(`deploying:${r.id}`);
      if (deployFlag && r.status !== "UP") {
        results.push({ ...r, status: "DEPLOYING" as CheckResult["status"] });
      } else {
        results.push(r);
      }
    }

    // Record history
    let hist = loadHistory();
    hist = recordSnapshot(hist, results);
    saveHistory(hist);

    // Detect transitions and collapse slow flaps into incidents.
    // `transitions` are per-change DOWN/UP alerts; `incidentEvents` are
    // the rare lifecycle messages for an endpoint that flaps so much its
    // per-change alerts get collapsed (see lib/incident-tracker.ts).
    const transitions: Array<{
      result: CheckResult;
      fromStatus: string;
      toStatus: string;
      fromAt: number;
    }> = [];
    const incidentEvents: Array<
      | { kind: "start"; result: CheckResult; flaps: number }
      | { kind: "digest"; result: CheckResult; flaps: number; sinceMs: number }
      | { kind: "resolved"; result: CheckResult; stableForSec: number }
    > = [];

    for (const r of results) {
      const now = Date.now();
      const key = `status:${r.id}`;
      const prev = await kv.get<StoredStatus>(key);
      const prevStatus = prev?.status ?? "UP";
      const consecutive = prev?.consecutive ?? 0;

      if (prevStatus !== r.status) {
        // Require 2 consecutive checks showing the new status before acting.
        if (consecutive + 1 >= 2) {
          // Confirmed transition. Capture the previous status's start
          // time (`fromAt`) BEFORE overwriting the key — the recovery
          // message needs it to report real downtime. Reading it back
          // after the overwrite was the "Downtime: 0s" bug.
          const fromAt = prev?.at ?? now;
          await kv.set(key, { status: r.status, at: now, consecutive: 0 });

          if (r.status === "DEPLOYING" || prevStatus === "DEPLOYING") {
            // Intentional restart — never alerts, never counts as a flap.
            transitions.push({
              result: r,
              fromStatus: prevStatus,
              toStatus: r.status,
              fromAt,
            });
            continue;
          }

          const decision = await recordTransition(kv, r.id, now);
          if (decision.action === "alert") {
            transitions.push({
              result: r,
              fromStatus: prevStatus,
              toStatus: r.status,
              fromAt,
            });
          } else if (decision.action === "incident-start") {
            incidentEvents.push({
              kind: "start",
              result: r,
              flaps: decision.flaps,
            });
          } else if (decision.action === "incident-digest") {
            incidentEvents.push({
              kind: "digest",
              result: r,
              flaps: decision.flaps,
              sinceMs: decision.sinceMs,
            });
          }
          // decision.action === "suppress" → emit nothing.
        } else {
          // First check showing the new status — wait for confirmation.
          await kv.set(key, {
            status: prevStatus,
            at: prev?.at ?? now,
            consecutive: consecutive + 1,
          });
        }
      } else {
        // Same status — reset the consecutive counter and, if an
        // incident is open for this endpoint, see whether it has now
        // held steady long enough to declare resolved.
        const statusSince = prev?.at ?? now;
        await kv.set(key, { status: r.status, at: statusSince, consecutive: 0 });

        const exit = await checkIncidentExit(kv, r.id, statusSince, now);
        if (exit.exited) {
          incidentEvents.push({
            kind: "resolved",
            result: r,
            stableForSec: exit.stableForSec,
          });
        }
      }
    }

    // Send per-change alerts (DEPLOYING transitions are intentional
    // restarts — never alerted).
    const alertable = transitions.filter(
      (t) => t.toStatus !== "DEPLOYING" && t.fromStatus !== "DEPLOYING",
    );
    if (alertable.length > 0 && CHANNEL_ID) {
      if (alertable.length === 1) {
        const t = alertable[0];
        if (t.toStatus === "UP") {
          // Downtime = how long the endpoint sat in its previous status,
          // captured before the status key was overwritten this tick.
          const downtimeSec = Math.round((Date.now() - t.fromAt) / 1000);
          await sendMessage(CHANNEL_ID, formatRecovery(t.result, downtimeSec));
        } else {
          await sendMessage(
            CHANNEL_ID,
            formatAlert(
              { fromStatus: t.fromStatus, toStatus: t.toStatus },
              t.result,
            ),
          );
        }
      } else {
        await sendMessage(CHANNEL_ID, formatGroupedAlert(alertable));
      }
    }

    // Send flapping-incident lifecycle messages. Rare by design (one per
    // incident stage), so each goes out as its own message.
    if (CHANNEL_ID) {
      for (const ev of incidentEvents) {
        if (ev.kind === "start") {
          await sendMessage(CHANNEL_ID, formatFlapStart(ev.result, ev.flaps));
        } else if (ev.kind === "digest") {
          await sendMessage(
            CHANNEL_ID,
            formatFlapDigest(
              ev.result,
              ev.flaps,
              Math.round(ev.sinceMs / 1000),
            ),
          );
        } else {
          await sendMessage(
            CHANNEL_ID,
            formatIncidentResolved(ev.result, ev.stableForSec),
          );
        }
      }
    }

    // Daily digest check (08:00 UTC)
    const now = new Date();
    if (now.getUTCHours() === 8 && now.getUTCMinutes() < 2) {
      const lastDigest = await kv.get<number>("digest:last");
      const today = now.toISOString().slice(0, 10);
      const lastDay = lastDigest
        ? new Date(lastDigest).toISOString().slice(0, 10)
        : null;

      if (lastDay !== today && CHANNEL_ID) {
        const sparklines = getSparklines(hist);
        const uptimes = getUptimes(hist);
        const summary: HealthSummary = {
          timestamp: new Date().toISOString(),
          total: results.length,
          up: results.filter((r) => r.status === "UP").length,
          degraded: results.filter((r) => r.status === "DEGRADED").length,
          down: results.filter((r) => r.status === "DOWN").length,
          deploying: results.filter((r) => r.status === "DEPLOYING").length,
          appGroups: APP_GROUPS,
          dependencyGraph: {},
          impactMap: {},
          results,
          history: {
            sparklines,
            uptimes,
            incidents: getIncidents(hist),
            dataPoints: hist.snapshots.length,
            spanMinutes: 0,
          },
        };

        const categoryCounts: Record<string, { up: number; total: number }> =
          {};
        for (const cat of CATEGORIES) {
          const catResults = results.filter((r) => r.category === cat);
          categoryCounts[cat] = {
            up: catResults.filter((r) => r.status === "UP").length,
            total: catResults.length,
          };
        }

        await sendMessage(
          CHANNEL_ID,
          formatDailyDigest(summary),
          "HTML",
          overviewKeyboard(categoryCounts),
        );
        await kv.set("digest:last", Date.now());
      }
    }

    return NextResponse.json({
      ok: true,
      checked: results.length,
      transitions: transitions.length,
      incidents: incidentEvents.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

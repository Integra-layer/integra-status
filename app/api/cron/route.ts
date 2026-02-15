// app/api/cron/route.ts — Vercel Cron handler for polling + alerts

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
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
  formatStatusOverview,
} from "@/lib/telegram-messages";
import { overviewKeyboard } from "@/lib/telegram-keyboards";
import type { CheckResult, HealthSummary } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

type StoredStatus = {
  status: string;
  at: number;
  consecutiveUp: number;
};

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends Authorization header)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await checkAll();

    // Record history
    let hist = loadHistory();
    hist = recordSnapshot(hist, results);
    saveHistory(hist);

    // Detect transitions
    const transitions: Array<{
      result: CheckResult;
      fromStatus: string;
      toStatus: string;
    }> = [];

    for (const r of results) {
      const key = `status:${r.id}`;
      const prev = await kv.get<StoredStatus>(key);
      const prevStatus = prev?.status ?? "UP";
      const consecutiveUp = prev?.consecutiveUp ?? 0;

      if (prevStatus !== r.status) {
        // Check flap protection: >3 transitions in 5min -> suppress
        const flapKey = `flap:${r.id}`;
        const flapCount = (await kv.get<number>(flapKey)) ?? 0;

        if (flapCount < 3) {
          // Recovery delay: only send recovery after 2 consecutive UP checks
          if (r.status === "UP") {
            if (consecutiveUp + 1 >= 2) {
              transitions.push({
                result: r,
                fromStatus: prevStatus,
                toStatus: r.status,
              });
              await kv.set(key, {
                status: r.status,
                at: Date.now(),
                consecutiveUp: 0,
              });
            } else {
              await kv.set(key, {
                status: prevStatus,
                at: prev?.at ?? Date.now(),
                consecutiveUp: consecutiveUp + 1,
              });
              continue;
            }
          } else {
            transitions.push({
              result: r,
              fromStatus: prevStatus,
              toStatus: r.status,
            });
            await kv.set(key, {
              status: r.status,
              at: Date.now(),
              consecutiveUp: 0,
            });
          }

          // Increment flap counter (TTL 5 min)
          await kv.set(flapKey, flapCount + 1, { ex: 300 });
        } else {
          // Flapping — suppress alerts, still update status
          await kv.set(key, {
            status: r.status,
            at: Date.now(),
            consecutiveUp: 0,
          });
        }
      } else {
        // Same status — update consecutive UP counter
        const newConsecutive = r.status === "UP" ? consecutiveUp + 1 : 0;
        await kv.set(key, {
          status: r.status,
          at: prev?.at ?? Date.now(),
          consecutiveUp: newConsecutive,
        });
      }
    }

    // Send alerts
    if (transitions.length > 0 && CHANNEL_ID) {
      if (transitions.length === 1) {
        const t = transitions[0];
        if (t.toStatus === "UP") {
          const prev = await kv.get<StoredStatus>(`status:${t.result.id}`);
          const downtimeSec = prev?.at
            ? Math.round((Date.now() - prev.at) / 1000)
            : 0;
          await sendMessage(
            CHANNEL_ID,
            formatRecovery(t.result, downtimeSec),
          );
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
        await sendMessage(CHANNEL_ID, formatGroupedAlert(transitions));
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

        const categoryCounts: Record<
          string,
          { up: number; total: number }
        > = {};
        for (const cat of CATEGORIES) {
          const catResults = results.filter((r) => r.category === cat);
          categoryCounts[cat] = {
            up: catResults.filter((r) => r.status === "UP").length,
            total: catResults.length,
          };
        }

        await sendMessage(
          CHANNEL_ID,
          formatStatusOverview(summary),
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

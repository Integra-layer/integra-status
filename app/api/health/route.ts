import { NextResponse } from "next/server";
import { checkAll } from "@/lib/health";
import {
  getEndpoint,
  getImpactedServices,
  getDependencyGraph,
  APP_GROUPS,
} from "@/lib/health-config";
import {
  loadHistory,
  saveHistory,
  recordSnapshot,
  getSparklines,
  getUptimes,
  getIncidents,
} from "@/lib/history";
import type { Category, Environment, HealthSummary } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const envFilter = searchParams.get("env") as Environment | null;
    const catFilter = searchParams.get("category") as Category | null;

    const opts: { environment?: Environment; category?: Category } = {};
    if (envFilter) opts.environment = envFilter;
    if (catFilter) opts.category = catFilter;

    const results = await checkAll(opts);

    // Build impact map
    const impactMap: Record<string, Array<{ id: string; name: string }>> = {};
    for (const r of results) {
      if (r.status === "DOWN" || r.status === "DEGRADED") {
        const impacted = getImpactedServices(r.id);
        if (impacted.length > 0) {
          impactMap[r.id] = impacted.map((id) => {
            const ep = getEndpoint(id);
            return { id, name: ep ? ep.name : id };
          });
        }
      }
    }

    // Record history
    let hist = loadHistory();
    hist = recordSnapshot(hist, results);
    saveHistory(hist);

    const sparklines = getSparklines(hist);
    const uptimes = getUptimes(hist);
    const incidents = getIncidents(hist);

    const summary: HealthSummary = {
      timestamp: new Date().toISOString(),
      total: results.length,
      up: results.filter((r) => r.status === "UP").length,
      degraded: results.filter((r) => r.status === "DEGRADED").length,
      down: results.filter((r) => r.status === "DOWN").length,
      appGroups: APP_GROUPS,
      dependencyGraph: getDependencyGraph(),
      impactMap,
      results,
      history: {
        sparklines,
        uptimes,
        incidents,
        dataPoints: hist.snapshots.length,
        spanMinutes:
          hist.snapshots.length > 1
            ? Math.round(
                (hist.snapshots[hist.snapshots.length - 1].t -
                  hist.snapshots[0].t) /
                  60000,
              )
            : 0,
      },
    };

    return NextResponse.json(summary, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "s-maxage=10, stale-while-revalidate=20",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

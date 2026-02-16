import { checkAll } from "@/lib/health";
import {
  getEndpoint,
  getImpactedServices,
  getDependencyGraph,
  APP_GROUPS,
  CATEGORIES,
} from "@/lib/health-config";
import {
  loadHistory,
  saveHistory,
  recordSnapshot,
  getSparklines,
  getUptimes,
  getIncidents,
} from "@/lib/history";
import { DashboardClient } from "@/components/dashboard-client";
import type { HealthSummary } from "@/lib/types";

export const revalidate = 60;

export default async function DashboardPage() {
  const results = await checkAll();

  // Build impact map: for each DOWN/DEGRADED endpoint, find what it impacts
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

  // Record history snapshot (fire-and-forget — don't block render on file I/O)
  let hist = loadHistory();
  hist = recordSnapshot(hist, results);
  void Promise.resolve().then(() => saveHistory(hist));

  const data: HealthSummary = {
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
      sparklines: getSparklines(hist),
      uptimes: getUptimes(hist),
      incidents: getIncidents(hist),
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

  return <DashboardClient data={data} categories={CATEGORIES} />;
}

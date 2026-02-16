"use client";

import { useMemo } from "react";
import { Activity, Zap, AlertCircle, Radio } from "lucide-react";
import { getAllBlastRadii } from "@/lib/graph-utils";
import { HealthRing } from "./simple/health-ring";
import { StatCard } from "./simple/stat-card";
import { DependencyFlow } from "./simple/dependency-flow";
import { CategoryCard, type CategoryStats } from "./simple/category-card";
import type { HealthSummary, Category } from "@/lib/types";

type SimpleViewProps = {
  data: HealthSummary;
  categories: Category[];
};

export function SimpleView({ data, categories }: SimpleViewProps) {
  const allUp = data.down === 0 && data.degraded === 0;
  const hasDown = data.down > 0;

  // Per-category stats
  const categoryStats: CategoryStats[] = useMemo(
    () =>
      categories
        .map((cat) => {
          const results = data.results.filter((r) => r.category === cat);
          if (results.length === 0) return null;
          return {
            category: cat,
            total: results.length,
            up: results.filter((r) => r.status === "UP").length,
            degraded: results.filter((r) => r.status === "DEGRADED").length,
            down: results.filter((r) => r.status === "DOWN").length,
            results,
          };
        })
        .filter((s): s is CategoryStats => s !== null),
    [data.results, categories],
  );

  // Quick stats
  const quickStats = useMemo(() => {
    const uptimeValues = Object.values(data.history.uptimes);
    const avgUptime =
      uptimeValues.length > 0
        ? uptimeValues.reduce((a, b) => a + b, 0) / uptimeValues.length
        : 100;

    const upResults = data.results.filter(
      (r) => r.status === "UP" && r.responseTimeMs > 0,
    );
    const avgResponse =
      upResults.length > 0
        ? Math.round(
            upResults.reduce((a, r) => a + r.responseTimeMs, 0) /
              upResults.length,
          )
        : 0;

    const activeIncidents = data.down + data.degraded;

    return { avgUptime, avgResponse, activeIncidents };
  }, [data]);

  // Blast radii
  const blastRadii = useMemo(
    () => getAllBlastRadii(data.dependencyGraph),
    [data.dependencyGraph],
  );

  // Category-level dependency edges
  const categoryEdges = useMemo(() => {
    const edges = new Set<string>();
    const resultMap = new Map(data.results.map((r) => [r.id, r]));

    for (const [id, node] of Object.entries(data.dependencyGraph)) {
      const sourceResult = resultMap.get(id);
      if (!sourceResult) continue;

      for (const depId of node.requiredBy) {
        const targetResult = resultMap.get(depId);
        if (!targetResult) continue;
        if (sourceResult.category === targetResult.category) continue;

        const key = `${sourceResult.category}->${targetResult.category}`;
        edges.add(key);
      }
    }

    return Array.from(edges).map((e) => {
      const [source, target] = e.split("->") as [Category, Category];
      return { source, target };
    });
  }, [data.dependencyGraph, data.results]);

  // Category sparklines (averaged per category)
  const categorySparklines = useMemo(() => {
    const result: Record<string, number[]> = {};

    for (const stat of categoryStats) {
      const sparkArrays = stat.results
        .map((r) => data.history.sparklines[r.id])
        .filter((s): s is (number | null)[] => !!s && s.length > 0);

      if (sparkArrays.length === 0) {
        result[stat.category] = [];
        continue;
      }

      const len = Math.max(...sparkArrays.map((s) => s.length));
      const averaged: number[] = [];

      for (let i = 0; i < len; i++) {
        let sum = 0;
        let count = 0;
        for (const arr of sparkArrays) {
          const val = arr[i];
          if (val !== null && val !== undefined && val >= 0) {
            sum += val;
            count++;
          }
        }
        averaged.push(count > 0 ? sum / count : 0);
      }

      result[stat.category] = averaged;
    }

    return result;
  }, [categoryStats, data.history.sparklines]);

  // Category uptimes (averaged per category)
  const categoryUptimes = useMemo(() => {
    const result: Record<string, number> = {};
    for (const stat of categoryStats) {
      const uptimes = stat.results
        .map((r) => data.history.uptimes[r.id])
        .filter((u): u is number => u !== undefined);
      result[stat.category] =
        uptimes.length > 0
          ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length
          : 100;
    }
    return result;
  }, [categoryStats, data.history.uptimes]);

  // Category blast radii (sum per category)
  const categoryBlastRadii = useMemo(() => {
    const result: Record<string, number> = {};
    for (const stat of categoryStats) {
      result[stat.category] = stat.results.reduce(
        (sum, r) => sum + (blastRadii[r.id] ?? 0),
        0,
      );
    }
    return result;
  }, [categoryStats, blastRadii]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Health Ring + Status */}
      <div className="mb-10 flex flex-col items-center text-center">
        <HealthRing
          up={data.up}
          degraded={data.degraded}
          down={data.down}
          total={data.total}
        />
        <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
          {allUp
            ? "All Systems Operational"
            : hasDown
              ? "Service Disruption"
              : "Partial Degradation"}
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          {allUp
            ? `All ${data.total} services are running normally.`
            : hasDown
              ? `${data.down} service${data.down !== 1 ? "s" : ""} down${data.degraded > 0 ? `, ${data.degraded} degraded` : ""}.`
              : `${data.degraded} service${data.degraded !== 1 ? "s" : ""} experiencing issues.`}
        </p>
      </div>

      {/* Quick Stats Row */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Overall Uptime"
          value={`${quickStats.avgUptime.toFixed(1)}%`}
          tint={
            quickStats.avgUptime >= 99
              ? "success"
              : quickStats.avgUptime >= 95
                ? "warning"
                : "danger"
          }
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Avg Response"
          value={`${quickStats.avgResponse}ms`}
          tint={
            quickStats.avgResponse < 300
              ? "success"
              : quickStats.avgResponse < 800
                ? "warning"
                : "danger"
          }
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Active Incidents"
          value={String(quickStats.activeIncidents)}
          tint={quickStats.activeIncidents === 0 ? "success" : "danger"}
          pulse={quickStats.activeIncidents > 0}
        />
        <StatCard
          icon={<Radio className="h-4 w-4" />}
          label="Endpoints"
          value={String(data.total)}
          tint="neutral"
        />
      </div>

      {/* Dependency Flow Diagram */}
      <DependencyFlow
        categoryStats={categoryStats}
        edges={categoryEdges}
      />

      {/* Category Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
        {categoryStats.map((stat, index) => (
          <CategoryCard
            key={stat.category}
            stat={stat}
            sparkline={categorySparklines[stat.category] ?? []}
            uptime={categoryUptimes[stat.category] ?? 100}
            blastRadius={categoryBlastRadii[stat.category] ?? 0}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

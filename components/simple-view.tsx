"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Blocks, Shield, Server, Globe, Link2 } from "lucide-react";
import type { HealthSummary, Category } from "@/lib/types";

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string }> = {
  blockchain: { icon: <Blocks className="h-5 w-5" />, label: "Blockchain" },
  validators: { icon: <Shield className="h-5 w-5" />, label: "Validators" },
  apis: { icon: <Server className="h-5 w-5" />, label: "APIs" },
  frontends: { icon: <Globe className="h-5 w-5" />, label: "Frontends" },
  external: { icon: <Link2 className="h-5 w-5" />, label: "External" },
};

type SimpleViewProps = {
  data: HealthSummary;
  categories: Category[];
};

type CategoryStats = {
  category: Category;
  total: number;
  up: number;
  degraded: number;
  down: number;
};

export function SimpleView({ data, categories }: SimpleViewProps) {
  const allUp = data.down === 0 && data.degraded === 0;
  const hasDown = data.down > 0;

  // Compute per-category stats
  const categoryStats: CategoryStats[] = categories
    .map((cat) => {
      const results = data.results.filter((r) => r.category === cat);
      if (results.length === 0) return null;
      return {
        category: cat,
        total: results.length,
        up: results.filter((r) => r.status === "UP").length,
        degraded: results.filter((r) => r.status === "DEGRADED").length,
        down: results.filter((r) => r.status === "DOWN").length,
      };
    })
    .filter((s): s is CategoryStats => s !== null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Status hero */}
      <div className="mb-8 flex flex-col items-center text-center">
        {allUp ? (
          <>
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">All Systems Operational</h2>
            <p className="mt-2 text-sm text-text-muted">
              All {data.total} services are running normally.
            </p>
          </>
        ) : hasDown ? (
          <>
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">Service Disruption</h2>
            <p className="mt-2 text-sm text-text-muted">
              {data.down} service{data.down !== 1 ? "s" : ""} down
              {data.degraded > 0 ? `, ${data.degraded} degraded` : ""}.
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">Partial Degradation</h2>
            <p className="mt-2 text-sm text-text-muted">
              {data.degraded} service{data.degraded !== 1 ? "s" : ""} experiencing issues.
            </p>
          </>
        )}
      </div>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoryStats.map((stat) => {
          const meta = CATEGORY_META[stat.category] ?? { icon: <Server className="h-5 w-5" />, label: stat.category };
          const pct = Math.round((stat.up / stat.total) * 100);
          const catAllUp = stat.down === 0 && stat.degraded === 0;
          const catHasDown = stat.down > 0;

          return (
            <CategoryCard
              key={stat.category}
              icon={meta.icon}
              label={meta.label}
              stat={stat}
              pct={pct}
              allUp={catAllUp}
              hasDown={catHasDown}
              results={data.results.filter((r) => r.category === stat.category)}
            />
          );
        })}
      </div>
    </div>
  );
}

type CategoryCardProps = {
  icon: React.ReactNode;
  label: string;
  stat: CategoryStats;
  pct: number;
  allUp: boolean;
  hasDown: boolean;
  results: HealthSummary["results"];
};

function CategoryCard({ icon, label, stat, pct, allUp, hasDown, results }: CategoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const barColor = allUp
    ? "bg-emerald-500"
    : hasDown
      ? "bg-red-500"
      : "bg-amber-500";

  const borderColor = allUp
    ? "border-emerald-500/20"
    : hasDown
      ? "border-red-500/20"
      : "border-amber-500/20";

  return (
    <div className={`rounded-xl border ${borderColor} bg-surface-card dark:bg-surface-dark-card overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full p-4 text-left cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-text-muted">{icon}</span>
            <span className="font-semibold">{label}</span>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {stat.up}/{stat.total} up
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>

      {/* Expanded service list */}
      {expanded && (
        <div className="border-t border-border-strong/20 px-4 py-2">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    r.status === "UP"
                      ? "bg-emerald-500"
                      : r.status === "DEGRADED"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="text-sm">{r.name}</span>
              </div>
              {r.status === "UP" && r.responseTimeMs > 0 && (
                <span className="text-xs text-text-muted tabular-nums">
                  {r.responseTimeMs}ms
                </span>
              )}
              {r.status !== "UP" && r.error && (
                <span className="text-xs text-red-500 max-w-[180px] truncate">
                  {r.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

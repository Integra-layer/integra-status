"use client";

import { useState, memo } from "react";
import {
  Blocks,
  Shield,
  Server,
  Globe,
  Link2,
  ChevronDown,
} from "lucide-react";
import { MiniSparkline } from "./mini-sparkline";
import type { Category, CheckResult } from "@/lib/types";

const CATEGORY_META: Record<
  string,
  { icon: React.ReactNode; label: string }
> = {
  blockchain: { icon: <Blocks className="h-4 w-4" />, label: "Blockchain" },
  validators: { icon: <Shield className="h-4 w-4" />, label: "Validators" },
  apis: { icon: <Server className="h-4 w-4" />, label: "APIs" },
  frontends: { icon: <Globe className="h-4 w-4" />, label: "Frontends" },
  external: { icon: <Link2 className="h-4 w-4" />, label: "External" },
};

export type CategoryStats = {
  category: Category;
  total: number;
  up: number;
  degraded: number;
  down: number;
  results: CheckResult[];
};

type CategoryCardProps = {
  stat: CategoryStats;
  sparkline: number[];
  uptime: number;
  blastRadius: number;
  index: number;
};

export const CategoryCard = memo(function CategoryCard({
  stat,
  sparkline,
  uptime,
  blastRadius,
  index,
}: CategoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[stat.category] ?? {
    icon: <Server className="h-4 w-4" />,
    label: stat.category,
  };

  const pct = Math.round((stat.up / stat.total) * 100);
  const allUp = stat.down === 0 && stat.degraded === 0;
  const hasDown = stat.down > 0;

  const borderColor = allUp
    ? "border-emerald-500/20"
    : hasDown
      ? "border-red-500/20"
      : "border-amber-500/20";

  const barColor = allUp
    ? "bg-emerald-500"
    : hasDown
      ? "bg-red-500"
      : "bg-amber-500";

  const tintClass = allUp
    ? "category-tint-up"
    : hasDown
      ? "category-tint-down"
      : "category-tint-degraded";

  const responseTimes = stat.results
    .filter((r) => r.status === "UP" && r.responseTimeMs > 0)
    .map((r) => r.responseTimeMs);
  const avgResponse =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

  return (
    <div
      className={`rounded-xl border ${borderColor} ${tintClass} bg-surface-card dark:bg-surface-dark-card overflow-hidden card-hover gradient-border-hover`}
      style={{
        animation: `fade-slide-up 400ms ease-out ${index * 80}ms both`,
      }}
    >
      {/* Compact single-row header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full px-4 py-3 text-left cursor-pointer hover:bg-muted/30 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          {/* Icon + label */}
          <span className="text-text-muted flex-shrink-0">{meta.icon}</span>
          <span className="font-semibold text-sm w-20 sm:w-24 flex-shrink-0">
            {meta.label}
          </span>

          {/* Inline progress bar (desktop) */}
          <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden hidden sm:block">
            <div
              className={`h-full rounded-full ${barColor} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Sparkline (desktop) */}
          {sparkline.length > 1 && (
            <div className="hidden md:block flex-shrink-0">
              <MiniSparkline data={sparkline} width={64} height={18} />
            </div>
          )}

          {/* Stats cluster */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {avgResponse > 0 && (
              <span className="text-xs tabular-nums text-text-muted hidden lg:inline">
                {avgResponse}ms
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                uptime >= 99
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : uptime >= 95
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {uptime.toFixed(1)}%
            </span>
            <span className="text-xs font-medium tabular-nums text-text-muted">
              {stat.up}/{stat.total}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {/* Mobile progress bar (below header) */}
        <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-2 sm:hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>

      {/* Expanded: full-width horizontal service pills */}
      {expanded && (
        <div className="border-t border-border-strong/20 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {stat.results.map((r) => (
              <div
                key={r.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  r.status === "UP"
                    ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : r.status === "DEGRADED"
                      ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                      : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                }`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    r.status === "UP"
                      ? "bg-emerald-500"
                      : r.status === "DEGRADED"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="whitespace-nowrap">{r.name}</span>
                {r.status === "UP" && r.responseTimeMs > 0 && (
                  <span className="text-text-muted tabular-nums">
                    {r.responseTimeMs}ms
                  </span>
                )}
                {r.status !== "UP" && r.error && (
                  <span className="text-red-500 max-w-[40vw] truncate">
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

"use client";

import { useState, useMemo } from "react";
import {
  Blocks,
  Shield,
  Server,
  Globe,
  Link2,
  Activity,
  Zap,
  AlertCircle,
  Radio,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { getAllBlastRadii } from "@/lib/graph-utils";
import type { HealthSummary, Category, CheckResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  blockchain: {
    icon: <Blocks className="h-4 w-4" />,
    label: "Blockchain",
    color: "var(--color-brand)",
  },
  validators: {
    icon: <Shield className="h-4 w-4" />,
    label: "Validators",
    color: "var(--color-brand-teal)",
  },
  apis: {
    icon: <Server className="h-4 w-4" />,
    label: "APIs",
    color: "var(--color-info)",
  },
  frontends: {
    icon: <Globe className="h-4 w-4" />,
    label: "Frontends",
    color: "var(--color-brand-pink)",
  },
  external: {
    icon: <Link2 className="h-4 w-4" />,
    label: "External",
    color: "var(--color-brand-gold)",
  },
};

// Dependency flow order (left to right)
const CATEGORY_ORDER: Category[] = [
  "blockchain",
  "validators",
  "apis",
  "frontends",
  "external",
];

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
  results: CheckResult[];
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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

      {/* Enhanced Category Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
        {categoryStats.map((stat, index) => (
          <EnhancedCategoryCard
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

// ---------------------------------------------------------------------------
// Health Ring (SVG donut)
// ---------------------------------------------------------------------------

function HealthRing({
  up,
  degraded,
  down,
  total,
}: {
  up: number;
  degraded: number;
  down: number;
  total: number;
}) {
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Each segment length proportional to count
  const upLen = total > 0 ? circumference * (up / total) : circumference;
  const degradedLen = total > 0 ? circumference * (degraded / total) : 0;
  const downLen = total > 0 ? circumference * (down / total) : 0;

  const degradedOffset = upLen;
  const downOffset = upLen + degradedLen;

  const displayPct = total > 0 ? Math.round((up / total) * 100) : 100;
  const allUp = down === 0 && degraded === 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label={`${displayPct}% of services operational`}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-gray-200)"
          strokeWidth={strokeWidth}
          className="dark:opacity-20"
        />

        {/* UP segment (green) */}
        {upLen > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-success)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${upLen} ${circumference - upLen}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              transition: "stroke-dasharray 800ms ease-out",
            }}
          />
        )}

        {/* DEGRADED segment (amber) */}
        {degradedLen > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-warning)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${degradedLen} ${circumference - degradedLen}`}
            strokeDashoffset={-degradedOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              transition: "stroke-dasharray 800ms ease-out",
            }}
          />
        )}

        {/* DOWN segment (red) */}
        {downLen > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${downLen} ${circumference - downLen}`}
            strokeDashoffset={-downOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              transition: "stroke-dasharray 800ms ease-out",
            }}
          />
        )}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{displayPct}%</span>
        <span className="text-xs text-text-muted">
          {allUp ? "Operational" : "Disrupted"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

const TINT_CLASSES: Record<string, string> = {
  success: "bg-emerald-500/5 dark:bg-emerald-500/10",
  warning: "bg-amber-500/5 dark:bg-amber-500/10",
  danger: "bg-red-500/5 dark:bg-red-500/10",
  neutral: "bg-gray-500/5 dark:bg-gray-500/10",
};

const TINT_ICON_CLASSES: Record<string, string> = {
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-red-500",
  neutral: "text-text-muted",
};

function StatCard({
  icon,
  label,
  value,
  tint,
  pulse = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
  pulse?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border-strong/20 p-4 ${TINT_CLASSES[tint] ?? TINT_CLASSES.neutral}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={TINT_ICON_CLASSES[tint] ?? "text-text-muted"}>
          {icon}
        </span>
        <span className="text-xs text-text-muted">{label}</span>
        {pulse && (
          <span className="relative flex h-2 w-2 ml-auto">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dependency Flow Diagram (pure SVG, category-level)
// ---------------------------------------------------------------------------

function DependencyFlow({
  categoryStats,
  edges,
}: {
  categoryStats: CategoryStats[];
  edges: Array<{ source: Category; target: Category }>;
}) {
  const [expanded, setExpanded] = useState(true);

  // Map categories to ordered positions
  const presentCategories = CATEGORY_ORDER.filter((cat) =>
    categoryStats.some((s) => s.category === cat),
  );

  const statMap = new Map(categoryStats.map((s) => [s.category, s]));

  if (presentCategories.length < 2 || edges.length === 0) return null;

  // Layout constants
  const nodeW = 130;
  const nodeH = 56;
  const gapX = 36;
  const totalW = presentCategories.length * nodeW + (presentCategories.length - 1) * gapX;
  const svgH = nodeH + 40; // extra space for arrows
  const svgW = totalW + 20; // padding

  const nodePositions: Record<string, { x: number; y: number }> = {};
  presentCategories.forEach((cat, i) => {
    nodePositions[cat] = {
      x: 10 + i * (nodeW + gapX),
      y: 20,
    };
  });

  return (
    <div className="mb-8 rounded-xl border border-border-strong/20 bg-surface-card dark:bg-surface-dark-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-text-muted" />
          Infrastructure Flow
        </h3>
        <ChevronDown
          className={`h-4 w-4 text-text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border-strong/20 p-4 overflow-x-auto">
          {/* Desktop: horizontal SVG */}
          <div className="hidden sm:block">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              width="100%"
              height={svgH}
              className="max-w-full"
              role="img"
              aria-label="Infrastructure dependency flow"
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 8 3, 0 6"
                    fill="var(--color-text-subtle)"
                    opacity="0.5"
                  />
                </marker>
              </defs>

              {/* Edges */}
              {edges.map((edge) => {
                const src = nodePositions[edge.source];
                const tgt = nodePositions[edge.target];
                if (!src || !tgt) return null;

                const srcStat = statMap.get(edge.source);
                const edgeColor =
                  srcStat && srcStat.down > 0
                    ? "var(--color-danger)"
                    : srcStat && srcStat.degraded > 0
                      ? "var(--color-warning)"
                      : "var(--color-text-subtle)";

                const x1 = src.x + nodeW;
                const y1 = src.y + nodeH / 2;
                const x2 = tgt.x;
                const y2 = tgt.y + nodeH / 2;

                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={edgeColor}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}

              {/* Nodes */}
              {presentCategories.map((cat) => {
                const pos = nodePositions[cat];
                const stat = statMap.get(cat);
                const meta = CATEGORY_META[cat];
                if (!pos || !stat || !meta) return null;

                const borderColor =
                  stat.down > 0
                    ? "var(--color-danger)"
                    : stat.degraded > 0
                      ? "var(--color-warning)"
                      : "var(--color-success)";

                return (
                  <g key={cat}>
                    <rect
                      x={pos.x}
                      y={pos.y}
                      width={nodeW}
                      height={nodeH}
                      rx={10}
                      fill="var(--color-surface-card)"
                      stroke={borderColor}
                      strokeWidth={1.5}
                      className="dark:fill-[var(--color-surface-dark-card)]"
                    />
                    {/* Status dot */}
                    <circle
                      cx={pos.x + 14}
                      cy={pos.y + nodeH / 2 - 6}
                      r={4}
                      fill={borderColor}
                    />
                    {/* Label */}
                    <text
                      x={pos.x + 24}
                      y={pos.y + nodeH / 2 - 2}
                      fontSize={12}
                      fontWeight={600}
                      fill="var(--color-text)"
                      className="dark:fill-[var(--color-text-light)]"
                    >
                      {meta.label}
                    </text>
                    {/* Count */}
                    <text
                      x={pos.x + 14}
                      y={pos.y + nodeH / 2 + 14}
                      fontSize={10}
                      fill="var(--color-text-muted)"
                      className="dark:fill-[var(--color-text-light-muted)]"
                    >
                      {stat.up}/{stat.total} up
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Mobile: stacked vertical list with arrows */}
          <div className="flex flex-col gap-2 sm:hidden">
            {presentCategories.map((cat, i) => {
              const stat = statMap.get(cat);
              const meta = CATEGORY_META[cat];
              if (!stat || !meta) return null;

              const borderColor =
                stat.down > 0
                  ? "border-red-500/40"
                  : stat.degraded > 0
                    ? "border-amber-500/40"
                    : "border-emerald-500/40";

              const hasEdgeToNext =
                i < presentCategories.length - 1 &&
                edges.some(
                  (e) =>
                    e.source === cat &&
                    e.target === presentCategories[i + 1],
                );

              return (
                <div key={cat}>
                  <div
                    className={`flex items-center gap-3 rounded-lg border ${borderColor} bg-surface-card dark:bg-surface-dark-card p-3`}
                  >
                    <span className="text-text-muted">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{meta.label}</div>
                      <div className="text-xs text-text-muted">
                        {stat.up}/{stat.total} up
                      </div>
                    </div>
                    <StatusDot stat={stat} />
                  </div>
                  {hasEdgeToNext && (
                    <div className="flex justify-center py-1">
                      <ArrowRight className="h-4 w-4 rotate-90 text-text-subtle opacity-40" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ stat }: { stat: CategoryStats }) {
  const color =
    stat.down > 0
      ? "bg-red-500"
      : stat.degraded > 0
        ? "bg-amber-500"
        : "bg-emerald-500";

  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

// ---------------------------------------------------------------------------
// Enhanced Category Card
// ---------------------------------------------------------------------------

function EnhancedCategoryCard({
  stat,
  sparkline,
  uptime,
  blastRadius,
  index,
}: {
  stat: CategoryStats;
  sparkline: number[];
  uptime: number;
  blastRadius: number;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[stat.category] ?? {
    icon: <Server className="h-4 w-4" />,
    label: stat.category,
    color: "var(--color-text-muted)",
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

  // Response time range for UP endpoints
  const responseTimes = stat.results
    .filter((r) => r.status === "UP" && r.responseTimeMs > 0)
    .map((r) => r.responseTimeMs);
  const minResponse = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
  const maxResponse = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

  return (
    <div
      className={`rounded-xl border ${borderColor} ${tintClass} bg-surface-card dark:bg-surface-dark-card overflow-hidden card-hover gradient-border-hover`}
      style={{
        animation: `fade-slide-up 400ms ease-out ${index * 80}ms both`,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full p-4 text-left cursor-pointer hover:bg-muted/30 transition-colors"
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-text-muted">{meta.icon}</span>
            <span className="font-semibold text-sm">{meta.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Uptime badge */}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${
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

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-3">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Stats row: sparkline + metadata */}
        <div className="flex items-end justify-between gap-3">
          {/* Mini sparkline */}
          {sparkline.length > 1 && (
            <MiniSparkline data={sparkline} width={80} height={20} />
          )}

          {/* Metadata pills */}
          <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-text-muted">
            {responseTimes.length > 0 && (
              <span className="tabular-nums">
                {minResponse === maxResponse
                  ? `${minResponse}ms`
                  : `${minResponse}–${maxResponse}ms`}
              </span>
            )}
            {blastRadius > 0 && (
              <span className="tabular-nums opacity-70">
                {blastRadius} impacted
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded service list — horizontal flow */}
      {expanded && (
        <div className="border-t border-border-strong/20 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {stat.results.map((r) => (
              <div
                key={r.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  r.status === "UP"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : r.status === "DEGRADED"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-red-500/30 bg-red-500/5"
                }`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
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
                  <span className="text-red-500 max-w-[120px] truncate">
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
}

// ---------------------------------------------------------------------------
// Mini Sparkline (inline SVG, no interactivity)
// ---------------------------------------------------------------------------

function MiniSparkline({
  data,
  width,
  height,
}: {
  data: number[];
  width: number;
  height: number;
}) {
  const { polylinePoints, strokeColor, areaPoints } = useMemo(() => {
    const max = Math.max(...data, 1);
    const padding = 1;
    const plotW = width - padding * 2;
    const plotH = height - padding * 2;

    const pts = data.map((value, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * plotW;
      const y = padding + plotH * (1 - value / max);
      return { x, y };
    });

    const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");

    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const ratio = Math.min(avg / 1000, 1);
    const color =
      ratio < 0.3
        ? "var(--color-success)"
        : ratio < 0.7
          ? "var(--color-warning)"
          : "var(--color-danger)";

    const lastX = pts[pts.length - 1]?.x ?? width;
    const firstX = pts[0]?.x ?? 0;
    const bottom = height - 1;
    const area = `${polyline} ${lastX},${bottom} ${firstX},${bottom}`;

    return { polylinePoints: polyline, strokeColor: color, areaPoints: area };
  }, [data, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="flex-shrink-0 opacity-70"
      aria-hidden="true"
    >
      <polygon points={areaPoints} fill={strokeColor} opacity={0.1} />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

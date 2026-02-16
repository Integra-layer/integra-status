"use client";

import { useState } from "react";
import {
  Blocks,
  Shield,
  Server,
  Globe,
  Link2,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import type { Category } from "@/lib/types";

type CategoryStats = {
  category: Category;
  total: number;
  up: number;
  degraded: number;
  down: number;
};

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

const CATEGORY_ORDER: Category[] = [
  "blockchain",
  "validators",
  "apis",
  "frontends",
  "external",
];

type DependencyFlowProps = {
  categoryStats: CategoryStats[];
  edges: Array<{ source: Category; target: Category }>;
};

export function DependencyFlow({ categoryStats, edges }: DependencyFlowProps) {
  const [expanded, setExpanded] = useState(true);

  const presentCategories = CATEGORY_ORDER.filter((cat) =>
    categoryStats.some((s) => s.category === cat),
  );

  const statMap = new Map(categoryStats.map((s) => [s.category, s]));

  if (presentCategories.length < 2 || edges.length === 0) return null;

  const nodeW = 130;
  const nodeH = 56;
  const gapX = 36;
  const totalW = presentCategories.length * nodeW + (presentCategories.length - 1) * gapX;
  const svgH = nodeH + 40;
  const svgW = totalW + 20;

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

                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={src.x + nodeW}
                    y1={src.y + nodeH / 2}
                    x2={tgt.x}
                    y2={tgt.y + nodeH / 2}
                    stroke={edgeColor}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}

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
                    <circle
                      cx={pos.x + 14}
                      cy={pos.y + nodeH / 2 - 6}
                      r={4}
                      fill={borderColor}
                    />
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

          {/* Mobile: stacked vertical list */}
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
                    className={`flex items-center gap-3 rounded-xl border ${borderColor} bg-surface-card dark:bg-surface-dark-card p-4`}
                  >
                    <span className="text-text-muted">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{meta.label}</div>
                      <div className="text-xs text-text-muted">
                        {stat.up}/{stat.total} up
                      </div>
                    </div>
                    <StatusDot down={stat.down} degraded={stat.degraded} />
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

function StatusDot({ down, degraded }: { down: number; degraded: number }) {
  const color =
    down > 0
      ? "bg-red-500"
      : degraded > 0
        ? "bg-amber-500"
        : "bg-emerald-500";

  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

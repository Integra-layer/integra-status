"use client";

import { useEffect, useState, useCallback } from "react";

export type StatusFilter = "all" | "UP" | "DEGRADED" | "DOWN";

interface SummaryBarProps {
  up: number;
  degraded: number;
  down: number;
  deploying?: number;
  /** Active status filter — drives which card is highlighted. */
  statusFilter?: StatusFilter;
  /** Click handler for the cards. Cards are inert if omitted. */
  onStatusFilterChange?: (filter: StatusFilter) => void;
}

function useAnimatedCounter(target: number, durationMs = 600): number {
  const [value, setValue] = useState(0);

  const animate = useCallback(() => {
    const start = performance.now();
    let rafId: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  useEffect(() => {
    const cleanup = animate();
    return cleanup;
  }, [animate]);

  return value;
}

function getOverallStatus(
  up: number,
  degraded: number,
  down: number,
  deploying: number,
): { text: string; bg: string; textColor: string } {
  if (down > 0) {
    return {
      text: "Service Disruption",
      bg: "bg-red-500",
      textColor: "text-white",
    };
  }
  if (degraded > 0) {
    return {
      text: "Partial Degradation",
      bg: "bg-amber-500",
      textColor: "text-white",
    };
  }
  if (deploying > 0) {
    return {
      text: `Deployment in Progress (${deploying} service${deploying > 1 ? "s" : ""})`,
      bg: "bg-blue-500",
      textColor: "text-white",
    };
  }
  return {
    text: "All Systems Operational",
    bg: "bg-emerald-500",
    textColor: "text-white",
  };
}

type CardKey = "up" | "degraded" | "down" | "total";

const CARDS: Array<{
  key: CardKey;
  label: string;
  filter: StatusFilter;
  accent: string;
  dotColor: string;
  dotAnim: string;
  ringColor: string;
  activeBg: string;
}> = [
  {
    key: "up",
    label: "Operational",
    filter: "UP",
    accent: "border-t-emerald-500",
    dotColor: "bg-emerald-500",
    dotAnim: "pulse-green 4s ease-in-out infinite",
    ringColor: "ring-emerald-500",
    activeBg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    key: "degraded",
    label: "Degraded",
    filter: "DEGRADED",
    accent: "border-t-amber-500",
    dotColor: "bg-amber-500",
    dotAnim: "pulse-amber 2.5s ease-in-out infinite",
    ringColor: "ring-amber-500",
    activeBg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    key: "down",
    label: "Down",
    filter: "DOWN",
    accent: "border-t-red-500",
    dotColor: "bg-red-500",
    dotAnim: "pulse-red 1.5s ease-in-out infinite",
    ringColor: "ring-red-500",
    activeBg: "bg-red-50 dark:bg-red-950/30",
  },
  {
    key: "total",
    label: "Total",
    filter: "all",
    accent: "border-t-blue-500",
    dotColor: "bg-blue-500",
    dotAnim: "none",
    ringColor: "ring-blue-500",
    activeBg: "bg-blue-50 dark:bg-blue-950/30",
  },
];

export function SummaryBar({
  up,
  degraded,
  down,
  deploying = 0,
  statusFilter = "all",
  onStatusFilterChange,
}: SummaryBarProps) {
  const total = up + degraded + down + deploying;
  const values: Record<CardKey, number> = { up, degraded, down, total };

  const animUp = useAnimatedCounter(up);
  const animDegraded = useAnimatedCounter(degraded);
  const animDown = useAnimatedCounter(down);
  const animTotal = useAnimatedCounter(total);
  const animValues: Record<CardKey, number> = {
    up: animUp,
    degraded: animDegraded,
    down: animDown,
    total: animTotal,
  };

  const overall = getOverallStatus(up, degraded, down, deploying);

  // Click handler: clicking the active card clears the filter back to "all".
  // Clicking "Total" always clears (its filter value IS "all").
  const handleCardClick = useCallback(
    (filter: StatusFilter) => {
      if (!onStatusFilterChange) return;
      onStatusFilterChange(statusFilter === filter ? "all" : filter);
    },
    [onStatusFilterChange, statusFilter],
  );

  return (
    <div className="sticky top-0 z-40 w-full">
      {/* Overall status banner strip */}
      <div
        className={`${overall.bg} ${overall.textColor} text-center py-1.5 text-sm font-semibold tracking-wide`}
        role="status"
        aria-live="polite"
      >
        {overall.text}
      </div>

      {/* 4-column counter cards (clickable filter chips) */}
      <div className="border-b border-border-strong/50 backdrop-blur-xl bg-white/70 dark:bg-neutral-900/70">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            role="group"
            aria-label="Filter by status"
          >
            {CARDS.map((card) => {
              const isActive = statusFilter === card.filter;
              const clickable = !!onStatusFilterChange;
              const baseClasses = `relative rounded-xl border border-border-strong/20 bg-surface-card dark:bg-surface-dark-card p-3 border-t-[3px] ${card.accent} text-center transition-all duration-150`;
              const interactiveClasses = clickable
                ? "cursor-pointer hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                : "";
              const activeClasses = isActive
                ? `ring-2 ring-offset-2 ring-offset-background ${card.ringColor} ${card.activeBg}`
                : "";

              const inner = (
                <>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {card.key !== "total" && (
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${card.dotColor}`}
                        style={{
                          animation: card.dotAnim,
                          boxShadow:
                            values[card.key] > 0
                              ? `0 0 8px 2px ${card.key === "up" ? "rgba(16,185,129,0.4)" : card.key === "degraded" ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)"}`
                              : "none",
                        }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-2xl font-bold tabular-nums">
                      {animValues[card.key]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {card.label}
                    {isActive && card.filter !== "all" && (
                      <span className="ml-1 text-[10px] opacity-70">
                        (filtering)
                      </span>
                    )}
                  </p>
                </>
              );

              return clickable ? (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => handleCardClick(card.filter)}
                  aria-pressed={isActive}
                  aria-label={`Filter to ${card.label} (${values[card.key]}). ${
                    isActive ? "Currently selected — click to clear." : ""
                  }`}
                  className={`${baseClasses} ${interactiveClasses} ${activeClasses}`}
                >
                  {inner}
                </button>
              ) : (
                <div key={card.key} className={baseClasses}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

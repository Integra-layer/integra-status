"use client";

import { useEffect, useState, useCallback } from "react";

interface SummaryBarProps {
  up: number;
  degraded: number;
  down: number;
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
  return {
    text: "All Systems Operational",
    bg: "bg-emerald-500",
    textColor: "text-white",
  };
}

const CARDS = [
  {
    key: "up" as const,
    label: "Operational",
    accent: "border-t-emerald-500",
    dotColor: "bg-emerald-500",
    dotAnim: "pulse-green 4s ease-in-out infinite",
  },
  {
    key: "degraded" as const,
    label: "Degraded",
    accent: "border-t-amber-500",
    dotColor: "bg-amber-500",
    dotAnim: "pulse-amber 2.5s ease-in-out infinite",
  },
  {
    key: "down" as const,
    label: "Down",
    accent: "border-t-red-500",
    dotColor: "bg-red-500",
    dotAnim: "pulse-red 1.5s ease-in-out infinite",
  },
  {
    key: "total" as const,
    label: "Total",
    accent: "border-t-blue-500",
    dotColor: "bg-blue-500",
    dotAnim: "none",
  },
] as const;

export function SummaryBar({ up, degraded, down }: SummaryBarProps) {
  const total = up + degraded + down;
  const values = { up, degraded, down, total };

  const animUp = useAnimatedCounter(up);
  const animDegraded = useAnimatedCounter(degraded);
  const animDown = useAnimatedCounter(down);
  const animTotal = useAnimatedCounter(total);
  const animValues = { up: animUp, degraded: animDegraded, down: animDown, total: animTotal };

  const overall = getOverallStatus(up, degraded, down);

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

      {/* 4-column counter cards */}
      <div className="border-b border-border-strong/50 backdrop-blur-xl bg-white/70 dark:bg-neutral-900/70">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CARDS.map((card) => (
              <div
                key={card.key}
                className={`relative rounded-xl border border-border-strong/20 bg-surface-card dark:bg-surface-dark-card p-3 border-t-[3px] ${card.accent} text-center`}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  {card.key !== "total" && (
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${card.dotColor}`}
                      style={{
                        animation: card.dotAnim,
                        boxShadow: values[card.key] > 0
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
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

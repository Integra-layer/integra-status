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
      // ease-out: 1 - (1 - t)^3
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
  down: number
): { text: string; className: string } {
  if (down > 0) {
    return {
      text: "Service Disruption",
      className: "text-red-900 dark:text-red-400",
    };
  }
  if (degraded > 0) {
    return {
      text: "Partial Degradation",
      className: "text-amber-900 dark:text-amber-400",
    };
  }
  return {
    text: "All Systems Operational",
    className: "text-emerald-900 dark:text-emerald-400",
  };
}

export function SummaryBar({ up, degraded, down }: SummaryBarProps) {
  const animUp = useAnimatedCounter(up);
  const animDegraded = useAnimatedCounter(degraded);
  const animDown = useAnimatedCounter(down);

  const overall = getOverallStatus(up, degraded, down);

  return (
    <div className="sticky top-0 z-40 w-full border-b border-border-strong/50 backdrop-blur-xl bg-white/70 dark:bg-neutral-900/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Status pills */}
        <div className="flex items-center gap-2">
          {/* Green: always visible */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300">
            <span
              className="inline-block h-2 w-2 rounded-full bg-emerald-500"
              style={{ animation: "pulse-green 2s ease-in-out infinite" }}
              aria-hidden="true"
            />
            {animUp} Operational
          </span>

          {/* Amber: only if degraded > 0 */}
          {degraded > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
              <span
                className="inline-block h-2 w-2 rounded-full bg-amber-500"
                style={{ animation: "pulse-amber 1.5s ease-in-out infinite" }}
                aria-hidden="true"
              />
              {animDegraded} Degraded
            </span>
          )}

          {/* Red: only if down > 0 */}
          {down > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-sm font-medium text-red-900 dark:bg-red-900/30 dark:text-red-300">
              <span
                className="inline-block h-2 w-2 rounded-full bg-red-500"
                style={{ animation: "pulse-red 1s ease-in-out infinite" }}
                aria-hidden="true"
              />
              {animDown} Down
            </span>
          )}
        </div>

        {/* Overall status */}
        <p
          role="status"
          aria-live="polite"
          className={`text-sm font-semibold ${overall.className}`}
        >
          {overall.text}
        </p>
      </div>
    </div>
  );
}

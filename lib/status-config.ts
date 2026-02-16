// lib/status-config.ts — Centralized status color and config definitions
// Single source of truth for UP/DEGRADED/DOWN visual properties.

export type Status = "UP" | "DEGRADED" | "DOWN";

export const STATUS_COLORS = {
  UP: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/5 dark:bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-400",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/30",
    badgeText: "text-emerald-900 dark:text-emerald-200",
    animation: "pulse-green 4s ease-in-out infinite",
    glow: "0 0 8px 2px rgba(16,185,129,0.4)",
  },
  DEGRADED: {
    dot: "bg-amber-500",
    bg: "bg-amber-500/5 dark:bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-700 dark:text-amber-400",
    badgeBg: "bg-amber-100 dark:bg-amber-900/30",
    badgeText: "text-amber-900 dark:text-amber-200",
    animation: "pulse-amber 2.5s ease-in-out infinite",
    glow: "0 0 8px 2px rgba(245,158,11,0.4)",
  },
  DOWN: {
    dot: "bg-red-500",
    bg: "bg-red-500/5 dark:bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-700 dark:text-red-400",
    badgeBg: "bg-red-100 dark:bg-red-900/30",
    badgeText: "text-red-900 dark:text-red-200",
    animation: "pulse-red 1.5s ease-in-out infinite",
    glow: "0 0 8px 2px rgba(239,68,68,0.4)",
  },
} as const;

export function getWorstStatus(statuses: Status[]): Status {
  if (statuses.includes("DOWN")) return "DOWN";
  if (statuses.includes("DEGRADED")) return "DEGRADED";
  return "UP";
}

import type { Status } from "@/lib/types";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    bg: string;
    dotColor: string;
    animation: string;
    glow: string;
  }
> = {
  UP: {
    label: "Operational",
    bg: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
    animation: "pulse-green 4s ease-in-out infinite",
    glow: "0 0 6px 2px rgba(16,185,129,0.4)",
  },
  DEGRADED: {
    label: "Degraded",
    bg: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
    dotColor: "bg-amber-500",
    animation: "pulse-amber 2.5s ease-in-out infinite",
    glow: "0 0 6px 2px rgba(245,158,11,0.4)",
  },
  DOWN: {
    label: "Down",
    bg: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-300",
    dotColor: "bg-red-500",
    animation: "pulse-red 1.5s ease-in-out infinite",
    glow: "0 0 6px 2px rgba(239,68,68,0.4)",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${className}`}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotColor}`}
        style={{
          animation: config.animation,
          boxShadow: config.glow,
        }}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

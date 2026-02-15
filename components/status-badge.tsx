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
  }
> = {
  UP: {
    label: "Operational",
    bg: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
    animation: "pulse-green 2s ease-in-out infinite",
  },
  DEGRADED: {
    label: "Degraded",
    bg: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
    dotColor: "bg-amber-500",
    animation: "pulse-amber 1.5s ease-in-out infinite",
  },
  DOWN: {
    label: "Down",
    bg: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-300",
    dotColor: "bg-red-500",
    animation: "pulse-red 1s ease-in-out infinite",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${className}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${config.dotColor}`}
        style={{ animation: config.animation }}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

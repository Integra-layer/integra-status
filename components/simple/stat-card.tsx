"use client";

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

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
  pulse?: boolean;
};

export function StatCard({ icon, label, value, tint, pulse = false }: StatCardProps) {
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

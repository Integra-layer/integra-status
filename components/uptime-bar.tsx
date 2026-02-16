"use client";

interface UptimeBarProps {
  /** Array of status values per time bucket: true = UP, false = DOWN/DEGRADED, null = no data */
  buckets: (boolean | null)[];
  className?: string;
}

const BUCKET_COLORS = {
  up: "bg-emerald-500",
  down: "bg-red-500",
  empty: "bg-gray-200 dark:bg-gray-700",
} as const;

export function UptimeBar({ buckets, className = "" }: UptimeBarProps) {
  if (buckets.length === 0) return null;

  const upCount = buckets.filter((b) => b === true).length;
  const totalWithData = buckets.filter((b) => b !== null).length;
  const uptimePct = totalWithData > 0 ? (upCount / totalWithData) * 100 : 100;

  return (
    <div className={className}>
      <div className="flex items-center gap-[2px]" role="img" aria-label={`${uptimePct.toFixed(1)}% uptime over ${buckets.length} checks`}>
        {buckets.map((bucket, i) => (
          <div
            key={i}
            className={`h-6 flex-1 rounded-[2px] transition-colors duration-200 ${
              bucket === null
                ? BUCKET_COLORS.empty
                : bucket
                  ? BUCKET_COLORS.up
                  : BUCKET_COLORS.down
            }`}
            title={
              bucket === null
                ? "No data"
                : bucket
                  ? `Check ${i + 1}: UP`
                  : `Check ${i + 1}: DOWN`
            }
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground">{buckets.length} checks ago</span>
        <span className="text-xs text-muted-foreground">Now</span>
      </div>
    </div>
  );
}

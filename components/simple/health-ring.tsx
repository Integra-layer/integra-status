"use client";

type HealthRingProps = {
  up: number;
  degraded: number;
  down: number;
  total: number;
};

export function HealthRing({ up, degraded, down, total }: HealthRingProps) {
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

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
        viewBox={`0 0 ${size} ${size}`}
        className="w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] overflow-visible"
        role="img"
        aria-label={`${displayPct}% of services operational`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-gray-200)"
          strokeWidth={strokeWidth}
          className="dark:opacity-20"
        />

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
            style={{ transition: "stroke-dasharray 800ms ease-out" }}
          />
        )}

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
            style={{ transition: "stroke-dasharray 800ms ease-out" }}
          />
        )}

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
            style={{ transition: "stroke-dasharray 800ms ease-out" }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl sm:text-3xl font-bold tabular-nums">{displayPct}%</span>
        <span className="text-xs text-text-muted">
          {allUp ? "Operational" : "Disrupted"}
        </span>
      </div>
    </div>
  );
}

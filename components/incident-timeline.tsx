"use client";

import { useState, useMemo } from "react";

type Incident = {
  id: string;
  fromStatus: string;
  toStatus: string;
  at: number;
};

type IncidentTimelineProps = {
  incidents: Incident[];
};

const STATUS_DOT_COLORS: Record<string, string> = {
  UP: "bg-emerald-500",
  DEGRADED: "bg-amber-500",
  DOWN: "bg-red-500",
};

const PAGE_SIZE = 5;

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function transitionLabel(from: string, to: string): string {
  return `${from} \u2192 ${to}`;
}

export function IncidentTimeline({ incidents }: IncidentTimelineProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sort by most recent first
  const sorted = useMemo(
    () => [...incidents].sort((a, b) => b.at - a.at),
    [incidents],
  );

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div
        className="absolute left-[9px] top-2 bottom-2 w-px bg-border-strong/40"
        aria-hidden="true"
      />

      <ul className="space-y-4" role="list" aria-label="Incident timeline">
        {visible.map((incident, i) => {
          const dotColor =
            STATUS_DOT_COLORS[incident.toStatus] ?? "bg-gray-400";

          return (
            <li key={`${incident.at}-${i}`} className="relative flex gap-4 pl-6">
              {/* Timeline dot */}
              <span
                className={`absolute left-[5px] top-1.5 h-[10px] w-[10px] rounded-full border-2 border-white dark:border-gray-900 ${dotColor}`}
                aria-hidden="true"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-text">
                    {transitionLabel(incident.fromStatus, incident.toStatus)}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatTimestamp(incident.at)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Show more button */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-4 ml-6 text-sm text-brand hover:text-brand/80 transition-colors font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none rounded"
        >
          Show more ({sorted.length - visibleCount} remaining)
        </button>
      )}

      {sorted.length === 0 && (
        <p className="text-sm text-text-muted pl-6">No incidents recorded.</p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Sparkline } from "@/components/sparkline";
import { EndpointLinks } from "@/components/endpoint-links";
import { TroubleshootingHint } from "@/components/troubleshooting-hint";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import type { CheckResult } from "@/lib/types";

type EndpointCardProps = {
  result: CheckResult;
  sparklineData?: (number | null)[];
  uptime?: number;
  index?: number;
};

const STATUS_DOT_CONFIG = {
  UP: {
    color: "bg-emerald-500",
    animation: "pulse-green 2s ease-in-out infinite",
  },
  DEGRADED: {
    color: "bg-amber-500",
    animation: "pulse-amber 1.5s ease-in-out infinite",
  },
  DOWN: {
    color: "bg-red-500",
    animation: "pulse-red 1s ease-in-out infinite",
  },
} as const;

export function EndpointCard({
  result,
  sparklineData,
  uptime,
  index = 0,
}: EndpointCardProps) {
  const dotConfig = STATUS_DOT_CONFIG[result.status];
  const delay = Math.min(index * 50, 1000);
  const description = result.richDescription || result.description;

  return (
    <Link
      href={`/service/${result.id}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
    >
      <Card
        className="group relative p-4 gap-3 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 opacity-0"
        style={{
          animation: `fade-slide-up 400ms ease-out ${delay}ms forwards`,
        }}
      >
        {/* Top row: status dot + name + response time */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            {/* Status dot */}
            <span
              className={`mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${dotConfig.color}`}
              style={{ animation: dotConfig.animation }}
              aria-hidden="true"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">
                  {result.name}
                </h3>
                <StatusBadge status={result.status} />
              </div>

              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Response time */}
          <span className="flex-shrink-0 font-mono text-sm text-muted-foreground">
            {result.responseTimeMs > 0
              ? `${result.responseTimeMs}ms`
              : "timeout"}
          </span>
        </div>

        {/* Middle row: sparkline + uptime */}
        {(sparklineData || uptime !== undefined) && (
          <div className="flex items-center justify-between gap-3">
            {sparklineData && <Sparkline data={sparklineData} />}
            {uptime !== undefined && (
              <span className="flex-shrink-0 text-xs text-muted-foreground">
                {uptime.toFixed(1)}% uptime
              </span>
            )}
          </div>
        )}

        {/* Endpoint links — visible on hover and focus-within */}
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
          <EndpointLinks links={result.links} />
        </div>

        {/* Troubleshooting hint — only when DOWN or DEGRADED */}
        <TroubleshootingHint
          issues={result.commonIssues}
          status={result.status}
        />
      </Card>
    </Link>
  );
}

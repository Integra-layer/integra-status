"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { Sparkline } from "@/components/sparkline";
import { EndpointLinks } from "@/components/endpoint-links";
import { TroubleshootingHint } from "@/components/troubleshooting-hint";
import { StatusBadge } from "@/components/status-badge";
import { ImpactWarning } from "@/components/impact-warning";
import { Card } from "@/components/ui/card";
import type { CheckResult } from "@/lib/types";

type EndpointCardProps = {
  result: CheckResult;
  sparklineData?: (number | null)[];
  uptime?: number;
  index?: number;
  blastRadius?: number;
  impactedServices?: Array<{ id: string; name: string }>;
  dependencyGraph?: Record<
    string,
    { dependsOn: string[]; requiredBy: string[] }
  >;
  allResults?: CheckResult[];
  flashClass?: string;
};

const STATUS_DOT_CONFIG = {
  UP: {
    color: "bg-emerald-500",
    animation: "pulse-green 4s ease-in-out infinite",
    glow: "0 0 8px 2px rgba(16,185,129,0.4)",
  },
  DEGRADED: {
    color: "bg-amber-500",
    animation: "pulse-amber 2.5s ease-in-out infinite",
    glow: "0 0 8px 2px rgba(245,158,11,0.4)",
  },
  DOWN: {
    color: "bg-red-500",
    animation: "pulse-red 1.5s ease-in-out infinite",
    glow: "0 0 8px 2px rgba(239,68,68,0.4)",
  },
  DEPLOYING: {
    color: "bg-blue-500",
    animation: "pulse-blue 1s ease-in-out infinite",
    glow: "0 0 8px 2px rgba(59,130,246,0.4)",
  },
} as const;

export function EndpointCard({
  result,
  sparklineData,
  uptime,
  index = 0,
  blastRadius = 0,
  impactedServices,
  dependencyGraph,
  allResults,
  flashClass,
}: EndpointCardProps) {
  const dotConfig = STATUS_DOT_CONFIG[result.status];
  const delay = Math.min(index * 50, 1000);
  const description = result.richDescription || result.description;
  const isDown = result.status === "DOWN" || result.status === "DEGRADED";

  return (
    <Link
      href={`/service/${result.id}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
    >
      <Card
        className={`group relative p-4 gap-3 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 opacity-0 gradient-border-hover ${
          result.status === "DOWN"
            ? "card-tint-down"
            : result.status === "DEGRADED"
              ? "card-tint-degraded"
              : ""
        } ${flashClass ?? ""}`}
        style={{
          animation: `fade-slide-up 400ms ease-out ${delay}ms forwards`,
        }}
      >
        {/* Top row: status dot + name + blast radius + response time */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            {/* Status dot — 10px with glow */}
            <span
              className={`mt-1 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotConfig.color}`}
              style={{
                animation: dotConfig.animation,
                boxShadow: dotConfig.glow,
              }}
              aria-hidden="true"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">
                  {result.name}
                </h3>
                <StatusBadge status={result.status} />
                {blastRadius > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300"
                    title={`${blastRadius} downstream service${blastRadius !== 1 ? "s" : ""} affected if this goes down`}
                  >
                    <Zap className="h-3 w-3" />
                    {blastRadius}
                  </span>
                )}
              </div>

              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {description}
                </p>
              )}
              {result.owner && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <span aria-hidden="true">👤</span> {result.owner.name}
                  {result.owner.telegram && (
                    <>
                      {" · "}
                      <a
                        href={`https://t.me/${result.owner.telegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        @{result.owner.telegram}
                      </a>
                    </>
                  )}
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

        {/* Impact warning — only when DOWN or DEGRADED with impacted services */}
        {isDown &&
          impactedServices &&
          impactedServices.length > 0 &&
          dependencyGraph &&
          allResults && (
            <ImpactWarning
              endpointId={result.id}
              impactedServices={impactedServices}
              dependencyGraph={dependencyGraph}
              results={allResults}
            />
          )}

        {/* Endpoint links — always visible on touch devices, hover-reveal on desktop */}
        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-200">
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

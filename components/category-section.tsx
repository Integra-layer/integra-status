"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EndpointCard } from "@/components/endpoint-card";
import { ProgressRing } from "@/components/progress-ring";
import type { CheckResult } from "@/lib/types";

type CategorySectionProps = {
  name: string;
  icon: React.ReactNode;
  results: CheckResult[];
  sparklines: Record<string, (number | null)[]>;
  uptimes: Record<string, number>;
  defaultOpen?: boolean;
  blastRadii?: Record<string, number>;
  impactMap?: Record<string, Array<{ id: string; name: string }>>;
  dependencyGraph?: Record<
    string,
    { dependsOn: string[]; requiredBy: string[] }
  >;
  allResults?: CheckResult[];
  flashClasses?: Record<string, string>;
};

function getWorstStatus(results: CheckResult[]): "UP" | "DEGRADED" | "DOWN" {
  if (results.some((r) => r.status === "DOWN")) return "DOWN";
  if (results.some((r) => r.status === "DEGRADED")) return "DEGRADED";
  return "UP";
}

const BORDER_COLOR = {
  UP: "border-l-emerald-500",
  DEGRADED: "border-l-amber-500",
  DOWN: "border-l-red-500",
  DEPLOYING: "border-l-blue-500",
} as const;

const SEGMENT_COLOR = {
  UP: "bg-emerald-500",
  DEGRADED: "bg-amber-500",
  DOWN: "bg-red-500",
  DEPLOYING: "bg-blue-500",
} as const;

export function CategorySection({
  name,
  icon,
  results,
  sparklines,
  uptimes,
  defaultOpen,
  blastRadii,
  impactMap,
  dependencyGraph,
  allResults,
  flashClasses,
}: CategorySectionProps) {
  const hasDown = results.some((r) => r.status === "DOWN");
  const [isOpen, setIsOpen] = useState(defaultOpen ?? hasDown);

  const worstStatus = getWorstStatus(results);
  const upCount = results.filter((r) => r.status === "UP").length;
  const totalCount = results.length;
  const borderColor = BORDER_COLOR[worstStatus];

  return (
    <div
      id={`category-${name.toLowerCase()}`}
      className={`border-l-4 ${borderColor} rounded-xl bg-card ${
        worstStatus === "DOWN"
          ? "category-tint-down"
          : worstStatus === "DEGRADED"
            ? "category-tint-degraded"
            : "category-tint-up"
      }`}
    >
      {/* Clickable header */}
      <button
        type="button"
        id={`category-${name.toLowerCase()}-btn`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 rounded-r-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none"
        aria-expanded={isOpen}
        aria-controls={`category-${name.toLowerCase()}-content`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex-shrink-0 text-muted-foreground"
            aria-hidden="true"
          >
            {icon}
          </span>
          <h2 className="text-base font-semibold">{name}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Status segments bar */}
          <div
            className="hidden sm:flex items-center gap-0.5"
            aria-label={`${upCount} of ${totalCount} operational`}
          >
            {results.map((r) => (
              <span
                key={r.id}
                className={`inline-block h-2 w-3 rounded-sm ${SEGMENT_COLOR[r.status]}`}
                title={`${r.name}: ${r.status}`}
              />
            ))}
          </div>

          <ProgressRing
            value={(upCount / totalCount) * 100}
            size={28}
            strokeWidth={2.5}
          />
          <span className="text-sm text-muted-foreground">
            {upCount}/{totalCount} operational
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Collapsible content area */}
      <div
        id={`category-${name.toLowerCase()}-content`}
        role="region"
        aria-labelledby={`category-${name.toLowerCase()}-btn`}
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-4 pb-4 pt-1">
            {results.map((result, i) => (
              <EndpointCard
                key={result.id}
                result={result}
                sparklineData={sparklines[result.id]}
                uptime={uptimes[result.id]}
                index={i}
                blastRadius={blastRadii?.[result.id]}
                impactedServices={impactMap?.[result.id]}
                dependencyGraph={dependencyGraph}
                allResults={allResults}
                flashClass={flashClasses?.[result.id]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

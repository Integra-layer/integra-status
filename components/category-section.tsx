"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EndpointCard } from "@/components/endpoint-card";
import type { CheckResult } from "@/lib/types";

type CategorySectionProps = {
  name: string;
  icon: React.ReactNode;
  results: CheckResult[];
  sparklines: Record<string, (number | null)[]>;
  uptimes: Record<string, number>;
  defaultOpen?: boolean;
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
} as const;

export function CategorySection({
  name,
  icon,
  results,
  sparklines,
  uptimes,
  defaultOpen,
}: CategorySectionProps) {
  const hasDown = results.some((r) => r.status === "DOWN");
  const [isOpen, setIsOpen] = useState(defaultOpen ?? hasDown);

  const worstStatus = getWorstStatus(results);
  const upCount = results.filter((r) => r.status === "UP").length;
  const totalCount = results.length;
  const borderColor = BORDER_COLOR[worstStatus];

  return (
    <div className={`border-l-4 ${borderColor} rounded-lg bg-card`}>
      {/* Clickable header */}
      <button
        type="button"
        id={`category-${name.toLowerCase()}-btn`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 rounded-r-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none"
        aria-expanded={isOpen}
        aria-controls={`category-${name.toLowerCase()}-content`}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex-shrink-0 text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
          <h2 className="text-base font-semibold">{name}</h2>
        </div>

        <div className="flex items-center gap-3">
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
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

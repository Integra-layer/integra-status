"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { CascadeTree } from "@/components/cascade-tree";
import type { CheckResult } from "@/lib/types";

type ImpactWarningProps = {
  endpointId: string;
  impactedServices: Array<{ id: string; name: string }>;
  dependencyGraph: Record<string, { dependsOn: string[]; requiredBy: string[] }>;
  results: CheckResult[];
};

export function ImpactWarning({
  endpointId,
  impactedServices,
  dependencyGraph,
  results,
}: ImpactWarningProps) {
  const [showTree, setShowTree] = useState(false);

  if (impactedServices.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/50 p-3"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1.5">
            {impactedServices.length} service{impactedServices.length !== 1 ? "s" : ""} affected
          </p>
          <div className="flex flex-wrap gap-1.5">
            {impactedServices.slice(0, 5).map((svc) => (
              <Link
                key={svc.id}
                href={`/service/${svc.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                {svc.name}
              </Link>
            ))}
            {impactedServices.length > 5 && (
              <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                +{impactedServices.length - 5} more
              </span>
            )}
          </div>

          {/* Cascade tree toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTree((prev) => !prev);
            }}
            className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors cursor-pointer"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${showTree ? "rotate-180" : ""}`}
            />
            {showTree ? "Hide" : "Show"} cascade tree
          </button>

          {showTree && (
            <div className="mt-2 pl-1">
              <CascadeTree
                rootId={endpointId}
                dependencyGraph={dependencyGraph}
                results={results}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

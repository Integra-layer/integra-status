"use client";

import Link from "next/link";
import { buildCascadeTree, type CascadeNode } from "@/lib/graph-utils";
import type { CheckResult } from "@/lib/types";

type CascadeTreeProps = {
  rootId: string;
  dependencyGraph: Record<string, { dependsOn: string[]; requiredBy: string[] }>;
  results: CheckResult[];
};

const STATUS_COLORS: Record<string, string> = {
  UP: "text-emerald-600 dark:text-emerald-400",
  DEGRADED: "text-amber-600 dark:text-amber-400",
  DOWN: "text-red-600 dark:text-red-400",
};

const STATUS_DOTS: Record<string, string> = {
  UP: "bg-emerald-500",
  DEGRADED: "bg-amber-500",
  DOWN: "bg-red-500",
};

function TreeNode({ node, isLast }: { node: CascadeNode; isLast: boolean }) {
  const connector = isLast ? "\u2514\u2500" : "\u251C\u2500";
  const dotColor = STATUS_DOTS[node.status] ?? "bg-gray-400";
  const textColor = STATUS_COLORS[node.status] ?? "text-muted-foreground";

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {node.depth > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground select-none">
            {"\u00A0".repeat((node.depth - 1) * 3)}{connector}
          </span>
        )}
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor} flex-shrink-0`}
          aria-hidden="true"
        />
        <Link
          href={`/service/${node.id}`}
          onClick={(e) => e.stopPropagation()}
          className={`text-[11px] font-medium ${textColor} hover:underline`}
        >
          {node.name}
        </Link>
        {node.depth > 0 && (
          <span className="text-[10px] text-muted-foreground">
            L{node.depth}
          </span>
        )}
      </div>
      {node.children.map((child, i) => (
        <TreeNode
          key={child.id}
          node={child}
          isLast={i === node.children.length - 1}
        />
      ))}
    </div>
  );
}

export function CascadeTree({
  rootId,
  dependencyGraph,
  results,
}: CascadeTreeProps) {
  const tree = buildCascadeTree(rootId, dependencyGraph, results);

  if (tree.children.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No downstream dependencies.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      <TreeNode node={tree} isLast={true} />
    </div>
  );
}

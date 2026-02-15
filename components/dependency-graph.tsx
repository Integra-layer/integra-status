"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CheckResult, Status } from "@/lib/types";

type DependencyGraphProps = {
  currentId: string;
  dependsOn: string[];
  requiredBy: string[];
  results: CheckResult[];
};

const STATUS_COLORS: Record<Status, { fill: string; stroke: string }> = {
  UP: { fill: "#d1fae5", stroke: "#10b981" },
  DEGRADED: { fill: "#fef3c7", stroke: "#f59e0b" },
  DOWN: { fill: "#fee2e2", stroke: "#ef4444" },
};

const NODE_WIDTH = 140;
const NODE_HEIGHT = 36;
const COL_GAP = 180;
const ROW_GAP = 52;
const PADDING = 20;

type GraphNode = {
  id: string;
  name: string;
  status: Status;
  col: number;
  row: number;
  x: number;
  y: number;
};

export function DependencyGraph({
  currentId,
  dependsOn,
  requiredBy,
  results,
}: DependencyGraphProps) {
  const { nodes, edges, viewBox } = useMemo(() => {
    const resultMap = new Map(results.map((r) => [r.id, r]));

    // Build nodes in 3 columns: left (dependsOn), center (current), right (requiredBy)
    const graphNodes: GraphNode[] = [];

    // Left column: upstream dependencies
    dependsOn.forEach((depId, i) => {
      const r = resultMap.get(depId);
      graphNodes.push({
        id: depId,
        name: r?.name ?? depId,
        status: r?.status ?? "DOWN",
        col: 0,
        row: i,
        x: PADDING,
        y: PADDING + i * ROW_GAP,
      });
    });

    // Center column: current node
    const currentResult = resultMap.get(currentId);
    const centerRow = Math.max(dependsOn.length, requiredBy.length, 1);
    const centerY =
      PADDING + ((centerRow - 1) * ROW_GAP) / 2;
    graphNodes.push({
      id: currentId,
      name: currentResult?.name ?? currentId,
      status: currentResult?.status ?? "DOWN",
      col: 1,
      row: 0,
      x: PADDING + COL_GAP,
      y: centerY,
    });

    // Right column: downstream dependents
    requiredBy.forEach((depId, i) => {
      const r = resultMap.get(depId);
      graphNodes.push({
        id: depId,
        name: r?.name ?? depId,
        status: r?.status ?? "DOWN",
        col: 2,
        row: i,
        x: PADDING + COL_GAP * 2,
        y: PADDING + i * ROW_GAP,
      });
    });

    // Build edges
    const graphEdges: Array<{
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }> = [];

    const centerNode = graphNodes.find((n) => n.id === currentId)!;

    // Edges from dependsOn -> current
    for (const depId of dependsOn) {
      const depNode = graphNodes.find((n) => n.id === depId);
      if (depNode) {
        graphEdges.push({
          fromX: depNode.x + NODE_WIDTH,
          fromY: depNode.y + NODE_HEIGHT / 2,
          toX: centerNode.x,
          toY: centerNode.y + NODE_HEIGHT / 2,
        });
      }
    }

    // Edges from current -> requiredBy
    for (const depId of requiredBy) {
      const depNode = graphNodes.find((n) => n.id === depId);
      if (depNode) {
        graphEdges.push({
          fromX: centerNode.x + NODE_WIDTH,
          fromY: centerNode.y + NODE_HEIGHT / 2,
          toX: depNode.x,
          toY: depNode.y + NODE_HEIGHT / 2,
        });
      }
    }

    // Compute viewBox
    const maxX =
      PADDING * 2 +
      COL_GAP * (requiredBy.length > 0 ? 2 : dependsOn.length > 0 ? 1 : 0) +
      NODE_WIDTH;
    const maxRows = Math.max(dependsOn.length, requiredBy.length, 1);
    const maxY = PADDING * 2 + (maxRows - 1) * ROW_GAP + NODE_HEIGHT;

    return {
      nodes: graphNodes,
      edges: graphEdges,
      viewBox: `0 0 ${maxX} ${maxY}`,
    };
  }, [currentId, dependsOn, requiredBy, results]);

  if (nodes.length <= 1) {
    return (
      <p className="text-sm text-text-muted">
        No upstream or downstream dependencies.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Column labels */}
      <div className="flex justify-between mb-2 px-1 text-xs text-text-muted">
        {dependsOn.length > 0 && <span>Depends on</span>}
        <span className={dependsOn.length === 0 ? "" : ""}>&nbsp;</span>
        {requiredBy.length > 0 && <span>Required by</span>}
      </div>

      <svg
        viewBox={viewBox}
        className="w-full max-w-full"
        style={{ minWidth: 400 }}
        role="img"
        aria-label="Service dependency graph"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 8 3, 0 6"
              fill="var(--color-text-muted, #9ca3af)"
            />
          </marker>
        </defs>

        {/* Edges with animated dash */}
        {edges.map((edge, i) => {
          const dx = edge.toX - edge.fromX;
          const dy = edge.toY - edge.fromY;
          const len = Math.sqrt(dx * dx + dy * dy);

          return (
            <line
              key={i}
              x1={edge.fromX}
              y1={edge.fromY}
              x2={edge.toX}
              y2={edge.toY}
              stroke="var(--color-text-muted, #9ca3af)"
              strokeWidth={1.5}
              strokeDasharray={len}
              strokeDashoffset={len}
              markerEnd="url(#arrowhead)"
              opacity={0.6}
              style={{
                animation: `dep-edge-draw 600ms ease-out ${i * 100}ms forwards`,
              }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const colors = STATUS_COLORS[node.status];
          const isCurrent = node.id === currentId;

          return (
            <g key={node.id}>
              <a href={`/service/${node.id}`} aria-label={`${node.name} — ${node.status}`}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                />
                {/* Status dot */}
                <circle
                  cx={node.x + 14}
                  cy={node.y + NODE_HEIGHT / 2}
                  r={4}
                  fill={colors.stroke}
                />
                {/* Label */}
                <text
                  x={node.x + 26}
                  y={node.y + NODE_HEIGHT / 2 + 1}
                  fontSize={11}
                  fontFamily="var(--font-geist-sans, system-ui)"
                  fill="currentColor"
                  dominantBaseline="middle"
                  className="text-text"
                >
                  {node.name.length > 14
                    ? node.name.slice(0, 13) + "\u2026"
                    : node.name}
                </text>
              </a>
            </g>
          );
        })}
      </svg>

      {/* CSS animation for edge drawing */}
      <style jsx>{`
        @keyframes dep-edge-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { getBlastRadius } from "@/lib/graph-utils";
import type { CheckResult, Status } from "@/lib/types";

type DependencyGraphProps = {
  currentId: string;
  dependsOn: string[];
  requiredBy: string[];
  results: CheckResult[];
  dependencyGraph?: Record<
    string,
    { dependsOn: string[]; requiredBy: string[] }
  >;
};

const STATUS_COLORS: Record<
  Status,
  { fill: string; stroke: string; glow: string }
> = {
  UP: { fill: "#d1fae5", stroke: "#10b981", glow: "rgba(16,185,129,0.3)" },
  DEGRADED: {
    fill: "#fef3c7",
    stroke: "#f59e0b",
    glow: "rgba(245,158,11,0.3)",
  },
  DOWN: { fill: "#fee2e2", stroke: "#ef4444", glow: "rgba(239,68,68,0.3)" },
  DEPLOYING: {
    fill: "#dbeafe",
    stroke: "#3b82f6",
    glow: "rgba(59,130,246,0.3)",
  },
};

const NODE_WIDTH = 150;
const NODE_HEIGHT = 40;
const COL_GAP = 200;
const ROW_GAP = 56;
const PADDING = 24;

type GraphNode = {
  id: string;
  name: string;
  status: Status;
  col: number;
  row: number;
  x: number;
  y: number;
  blastRadius: number;
};

export function DependencyGraph({
  currentId,
  dependsOn,
  requiredBy,
  results,
  dependencyGraph,
}: DependencyGraphProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { nodes, edges, viewBox } = useMemo(() => {
    const resultMap = new Map(results.map((r) => [r.id, r]));

    const graphNodes: GraphNode[] = [];

    // Left column: upstream dependencies
    dependsOn.forEach((depId, i) => {
      const r = resultMap.get(depId);
      const br = dependencyGraph
        ? getBlastRadius(depId, dependencyGraph).length
        : 0;
      graphNodes.push({
        id: depId,
        name: r?.name ?? depId,
        status: r?.status ?? "DOWN",
        col: 0,
        row: i,
        x: PADDING,
        y: PADDING + i * ROW_GAP,
        blastRadius: br,
      });
    });

    // Center column: current node
    const currentResult = resultMap.get(currentId);
    const centerRow = Math.max(dependsOn.length, requiredBy.length, 1);
    const centerY = PADDING + ((centerRow - 1) * ROW_GAP) / 2;
    const currentBr = dependencyGraph
      ? getBlastRadius(currentId, dependencyGraph).length
      : 0;
    graphNodes.push({
      id: currentId,
      name: currentResult?.name ?? currentId,
      status: currentResult?.status ?? "DOWN",
      col: 1,
      row: 0,
      x: PADDING + COL_GAP,
      y: centerY,
      blastRadius: currentBr,
    });

    // Right column: downstream dependents
    requiredBy.forEach((depId, i) => {
      const r = resultMap.get(depId);
      const br = dependencyGraph
        ? getBlastRadius(depId, dependencyGraph).length
        : 0;
      graphNodes.push({
        id: depId,
        name: r?.name ?? depId,
        status: r?.status ?? "DOWN",
        col: 2,
        row: i,
        x: PADDING + COL_GAP * 2,
        y: PADDING + i * ROW_GAP,
        blastRadius: br,
      });
    });

    // Build bezier curve edges
    const graphEdges: Array<{
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      path: string;
    }> = [];

    const centerNode = graphNodes.find((n) => n.id === currentId)!;

    for (const depId of dependsOn) {
      const depNode = graphNodes.find((n) => n.id === depId);
      if (depNode) {
        const sx = depNode.x + NODE_WIDTH;
        const sy = depNode.y + NODE_HEIGHT / 2;
        const ex = centerNode.x;
        const ey = centerNode.y + NODE_HEIGHT / 2;
        const cpx = sx + (ex - sx) * 0.5;
        graphEdges.push({
          fromX: sx,
          fromY: sy,
          toX: ex,
          toY: ey,
          path: `M ${sx} ${sy} C ${cpx} ${sy}, ${cpx} ${ey}, ${ex} ${ey}`,
        });
      }
    }

    for (const depId of requiredBy) {
      const depNode = graphNodes.find((n) => n.id === depId);
      if (depNode) {
        const sx = centerNode.x + NODE_WIDTH;
        const sy = centerNode.y + NODE_HEIGHT / 2;
        const ex = depNode.x;
        const ey = depNode.y + NODE_HEIGHT / 2;
        const cpx = sx + (ex - sx) * 0.5;
        graphEdges.push({
          fromX: sx,
          fromY: sy,
          toX: ex,
          toY: ey,
          path: `M ${sx} ${sy} C ${cpx} ${sy}, ${cpx} ${ey}, ${ex} ${ey}`,
        });
      }
    }

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
  }, [currentId, dependsOn, requiredBy, results, dependencyGraph]);

  if (nodes.length <= 1) {
    return (
      <p className="text-sm text-text-muted">
        No upstream or downstream dependencies.
      </p>
    );
  }

  // Check if a node is connected to hovered
  function isHighlighted(nodeId: string): boolean {
    if (!hoveredId) return true;
    if (nodeId === hoveredId) return true;
    // Check if there's an edge between them
    return edges.some(
      (e) =>
        (nodes.find((n) => n.x === e.fromX - NODE_WIDTH || n.x === e.fromX)
          ?.id === hoveredId &&
          nodes.find((n) => n.x === e.toX)?.id === nodeId) ||
        (nodes.find((n) => n.x === e.toX)?.id === hoveredId &&
          nodes.find((n) => n.x === e.fromX - NODE_WIDTH || n.x === e.fromX)
            ?.id === nodeId),
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-between mb-2 px-1 text-xs text-text-muted">
        {dependsOn.length > 0 && <span>Depends on</span>}
        <span>&nbsp;</span>
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
            id="arrowhead-dep"
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

        {/* Bezier curve edges with marching ants animation */}
        {edges.map((edge, i) => (
          <path
            key={i}
            d={edge.path}
            fill="none"
            stroke="var(--color-text-muted, #9ca3af)"
            strokeWidth={1.5}
            markerEnd="url(#arrowhead-dep)"
            opacity={0.6}
            strokeDasharray="6 3"
            className="animate-marching-ants"
          />
        ))}

        {/* Nodes */}
        {nodes.map((node) => {
          const colors = STATUS_COLORS[node.status];
          const isCurrent = node.id === currentId;
          const isHover = hoveredId === node.id;

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer" }}
            >
              <a
                href={`/service/${node.id}`}
                aria-label={`${node.name} — ${node.status}`}
              >
                {/* Glow effect */}
                {(isCurrent || isHover) && (
                  <rect
                    x={node.x - 3}
                    y={node.y - 3}
                    width={NODE_WIDTH + 6}
                    height={NODE_HEIGHT + 6}
                    rx={11}
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth={2}
                    opacity={0.25}
                  />
                )}
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
                {/* Blast radius badge */}
                {node.blastRadius > 0 && (
                  <>
                    <circle
                      cx={node.x + NODE_WIDTH - 14}
                      cy={node.y + 10}
                      r={8}
                      fill={colors.stroke}
                      opacity={0.2}
                    />
                    <text
                      x={node.x + NODE_WIDTH - 14}
                      y={node.y + 11}
                      fontSize={8}
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={colors.stroke}
                    >
                      {node.blastRadius}
                    </text>
                  </>
                )}
              </a>
            </g>
          );
        })}
      </svg>

      <style jsx>{`
        @keyframes marching-ants {
          to {
            stroke-dashoffset: -18;
          }
        }
        .animate-marching-ants {
          animation: marching-ants 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

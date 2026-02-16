"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { buildNetworkData, type NetworkNode, type NetworkEdge } from "@/lib/graph-utils";
import type { HealthSummary } from "@/lib/types";

type NetworkGraphProps = {
  data: HealthSummary;
};

type SimNode = NetworkNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { source: SimNode; target: SimNode };

const STATUS_COLORS: Record<string, { fill: string; stroke: string }> = {
  UP: { fill: "var(--color-success-bg, #d1fae5)", stroke: "var(--color-success, #10b981)" },
  DEGRADED: { fill: "var(--color-warning-bg, #fef3c7)", stroke: "var(--color-warning, #f59e0b)" },
  DOWN: { fill: "var(--color-danger-bg, #fee2e2)", stroke: "var(--color-danger, #ef4444)" },
};

const CATEGORY_OFFSETS: Record<string, { x: number; y: number }> = {
  blockchain: { x: -0.3, y: -0.3 },
  validators: { x: 0.3, y: -0.3 },
  apis: { x: 0, y: 0 },
  frontends: { x: -0.3, y: 0.3 },
  external: { x: 0.3, y: 0.3 },
};

export function NetworkGraph({ data }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);

  const WIDTH = 800;
  const HEIGHT = 500;

  const { rawNodes, rawEdges } = useMemo(() => {
    const { nodes: n, edges: e } = buildNetworkData(data);
    return { rawNodes: n, rawEdges: e };
  }, [data]);

  // Connected node set for hover highlighting
  const connectedMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const edge of rawEdges) {
      if (!map[edge.source]) map[edge.source] = new Set();
      if (!map[edge.target]) map[edge.target] = new Set();
      map[edge.source].add(edge.target);
      map[edge.target].add(edge.source);
    }
    return map;
  }, [rawEdges]);

  const isConnected = useCallback(
    (id: string) => {
      if (!hoveredId) return true;
      if (id === hoveredId) return true;
      return connectedMap[hoveredId]?.has(id) ?? false;
    },
    [hoveredId, connectedMap],
  );

  useEffect(() => {
    if (!isOpen) return;

    const simNodes: SimNode[] = rawNodes.map((n) => {
      const offset = CATEGORY_OFFSETS[n.category] ?? { x: 0, y: 0 };
      return {
        ...n,
        x: WIDTH / 2 + offset.x * WIDTH * 0.3 + (Math.random() - 0.5) * 50,
        y: HEIGHT / 2 + offset.y * HEIGHT * 0.3 + (Math.random() - 0.5) * 50,
      };
    });

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = rawEdges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
      }));

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80),
      )
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collide", forceCollide<SimNode>().radius((d) => getNodeRadius(d) + 4))
      .alpha(0.8)
      .alphaDecay(0.02);

    sim.on("tick", () => {
      // Clamp nodes within bounds
      for (const node of simNodes) {
        const r = getNodeRadius(node);
        node.x = Math.max(r, Math.min(WIDTH - r, node.x ?? WIDTH / 2));
        node.y = Math.max(r, Math.min(HEIGHT - r, node.y ?? HEIGHT / 2));
      }
      setNodes([...simNodes]);
      setLinks([...simLinks]);
    });

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [isOpen, rawNodes, rawEdges]);

  function getNodeRadius(node: SimNode | NetworkNode): number {
    return Math.max(8, Math.min(20, 8 + (node.blastRadius ?? 0) * 2));
  }

  return (
    <div className="rounded-xl border border-border-strong/30 bg-surface-card dark:bg-surface-dark-card overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <h2 className="text-sm font-semibold">Dependency Network</h2>
        <span className="text-xs text-muted-foreground">
          {rawNodes.length} nodes &middot; {rawEdges.length} edges
          <span className="ml-2">{isOpen ? "▲" : "▼"}</span>
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border-strong/20 p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            style={{ maxHeight: 500 }}
          >
            <defs>
              <marker
                id="net-arrow"
                markerWidth="6"
                markerHeight="4"
                refX="6"
                refY="2"
                orient="auto"
              >
                <polygon points="0 0, 6 2, 0 4" fill="#9ca3af" opacity={0.5} />
              </marker>
            </defs>

            {/* Edges */}
            {links.map((link, i) => {
              const srcConnected = isConnected(link.source.id);
              const tgtConnected = isConnected(link.target.id);
              const opacity = srcConnected && tgtConnected ? 0.5 : 0.08;

              return (
                <line
                  key={i}
                  x1={link.source.x}
                  y1={link.source.y}
                  x2={link.target.x}
                  y2={link.target.y}
                  stroke="#9ca3af"
                  strokeWidth={1}
                  opacity={opacity}
                  markerEnd="url(#net-arrow)"
                  style={{ transition: "opacity 200ms" }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const colors = STATUS_COLORS[node.status] ?? STATUS_COLORS.DOWN;
              const r = getNodeRadius(node);
              const connected = isConnected(node.id);
              const isHovered = hoveredId === node.id;

              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ cursor: "pointer", transition: "opacity 200ms" }}
                  opacity={connected ? 1 : 0.15}
                >
                  <a href={`/service/${node.id}`}>
                    {/* Glow ring on hover */}
                    {isHovered && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={r + 4}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={2}
                        opacity={0.3}
                      />
                    )}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                    {/* Label — only on hover or for large nodes */}
                    {(isHovered || r >= 14) && (
                      <text
                        x={node.x}
                        y={(node.y ?? 0) + r + 12}
                        textAnchor="middle"
                        fontSize={9}
                        fill="currentColor"
                        className="text-muted-foreground pointer-events-none"
                      >
                        {node.name.length > 16 ? node.name.slice(0, 15) + "\u2026" : node.name}
                      </text>
                    )}
                  </a>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 px-4 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> UP
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Degraded
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Down
            </span>
            <span className="text-muted-foreground/60">|</span>
            <span>Node size = blast radius</span>
          </div>
        </div>
      )}
    </div>
  );
}

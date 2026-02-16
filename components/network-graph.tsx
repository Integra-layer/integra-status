"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ChevronDown,
  Blocks,
  Shield,
  Server,
  Globe,
  Link2,
} from "lucide-react";
import { buildNetworkData, type NetworkNode } from "@/lib/graph-utils";
import type { HealthSummary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SimNode = NetworkNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & {
  source: SimNode;
  target: SimNode;
};

type ViewTransform = { x: number; y: number; k: number };

type NetworkGraphProps = {
  data: HealthSummary;
  compact?: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<
  string,
  { fill: string; stroke: string; label: string }
> = {
  blockchain: { fill: "#FF6D49", stroke: "#FC4E23", label: "Blockchain" },
  validators: { fill: "#F34499", stroke: "#D63384", label: "Validators" },
  apis: { fill: "#335CFF", stroke: "#2548CC", label: "APIs" },
  frontends: { fill: "#00A186", stroke: "#008571", label: "Frontends" },
  external: { fill: "#FFC17A", stroke: "#D4983E", label: "External" },
};

const STATUS_RING: Record<string, string> = {
  UP: "#1FC16B",
  DEGRADED: "#FA7319",
  DOWN: "#FA3748",
};

const CATEGORY_OFFSETS: Record<string, { x: number; y: number }> = {
  blockchain: { x: -0.3, y: -0.3 },
  validators: { x: 0.3, y: -0.3 },
  apis: { x: 0, y: 0 },
  frontends: { x: -0.3, y: 0.3 },
  external: { x: 0.3, y: 0.3 },
};

const CATEGORY_ICONS = [
  { key: "blockchain", label: "Blockchain", Icon: Blocks },
  { key: "validators", label: "Validators", Icon: Shield },
  { key: "apis", label: "APIs", Icon: Server },
  { key: "frontends", label: "Frontends", Icon: Globe },
  { key: "external", label: "External", Icon: Link2 },
];

const VB_W = 900;
const VB_H = 550;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeRadius(node: SimNode | NetworkNode): number {
  return Math.max(10, Math.min(24, 10 + (node.blastRadius ?? 0) * 2));
}

function edgePath(link: SimLink): string {
  const sx = link.source.x ?? 0;
  const sy = link.source.y ?? 0;
  const tx = link.target.x ?? 0;
  const ty = link.target.y ?? 0;
  const dx = tx - sx;
  const dy = ty - sy;
  const dr = Math.sqrt(dx * dx + dy * dy) * 0.7;
  return `M${sx},${sy} A${dr},${dr} 0 0,1 ${tx},${ty}`;
}

/** Convert client coords → SVG viewBox coords */
function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NetworkGraph({ data, compact = false }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("integra-graph-open");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem("integra-graph-open", String(next));
      return next;
    });
  }, []);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transform, setTransform] = useState<ViewTransform>({
    x: 0,
    y: 0,
    k: 1,
  });
  const simulationRef =
    useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const router = useRouter();
  const dragRef = useRef<{ nodeId: string; startCX: number; startCY: number; moved: boolean } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);

  // Build network data
  const { rawNodes, rawEdges } = useMemo(() => {
    const { nodes: n, edges: e } = buildNetworkData(data);
    return { rawNodes: n, rawEdges: e };
  }, [data]);

  // Connectivity map for hover highlighting
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

  const isHighlighted = useCallback(
    (id: string) => {
      const focusId = hoveredId || selectedId;
      if (!focusId) return true;
      if (id === focusId) return true;
      return connectedMap[focusId]?.has(id) ?? false;
    },
    [hoveredId, selectedId, connectedMap],
  );

  // ── Force simulation ──
  useEffect(() => {
    const simNodes: SimNode[] = rawNodes.map((n) => {
      const offset = CATEGORY_OFFSETS[n.category] ?? { x: 0, y: 0 };
      return {
        ...n,
        x:
          VB_W / 2 +
          offset.x * VB_W * 0.3 +
          (Math.random() - 0.5) * 40,
        y:
          VB_H / 2 +
          offset.y * VB_H * 0.3 +
          (Math.random() - 0.5) * 40,
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
          .distance(compact ? 55 : 75),
      )
      .force("charge", forceManyBody().strength(compact ? -80 : -130))
      .force("center", forceCenter(VB_W / 2, VB_H / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => getNodeRadius(d) + 6),
      )
      .alpha(0.8)
      .alphaDecay(0.02);

    sim.on("tick", () => {
      for (const node of simNodes) {
        const r = getNodeRadius(node) + 10;
        node.x = Math.max(r, Math.min(VB_W - r, node.x ?? VB_W / 2));
        node.y = Math.max(r, Math.min(VB_H - r, node.y ?? VB_H / 2));
      }
      setNodes([...simNodes]);
      setLinks([...simLinks]);
    });

    simulationRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [rawNodes, rawEdges, compact]);

  // ── Non-passive wheel listener for zoom ──
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;

      setTransform((prev) => {
        const newK = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, prev.k * (1 + delta)),
        );
        const svgPt = clientToSvg(svg!, e.clientX, e.clientY);
        const ratio = newK / prev.k;
        return {
          k: newK,
          x: svgPt.x - (svgPt.x - prev.x) * ratio,
          y: svgPt.y - (svgPt.y - prev.y) * ratio,
        };
      });
    }

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // ── Drag handlers ──
  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);

      dragRef.current = { nodeId, startCX: e.clientX, startCY: e.clientY, moved: false };

      const sim = simulationRef.current;
      if (sim) {
        const node = sim.nodes().find((n) => n.id === nodeId);
        if (node) {
          node.fx = node.x;
          node.fy = node.y;
          sim.alphaTarget(0.3).restart();
        }
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startCX;
        const dy = e.clientY - dragRef.current.startCY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragRef.current.moved = true;
        }

        const svgPt = clientToSvg(svg, e.clientX, e.clientY);
        const x = (svgPt.x - transform.x) / transform.k;
        const y = (svgPt.y - transform.y) / transform.k;

        const sim = simulationRef.current;
        if (sim) {
          const node = sim
            .nodes()
            .find((n) => n.id === dragRef.current!.nodeId);
          if (node) {
            node.fx = x;
            node.fy = y;
          }
        }
        return;
      }

      if (panRef.current) {
        const svgRect = svg.getBoundingClientRect();
        const scaleX = VB_W / svgRect.width;
        const scaleY = VB_H / svgRect.height;
        const dx = (e.clientX - panRef.current.startX) * scaleX;
        const dy = (e.clientY - panRef.current.startY) * scaleY;
        setTransform({
          k: transform.k,
          x: panRef.current.startTx + dx,
          y: panRef.current.startTy + dy,
        });
      }
    },
    [transform],
  );

  const handlePointerUp = useCallback(() => {
    if (dragRef.current) {
      const { nodeId, moved } = dragRef.current;
      const sim = simulationRef.current;
      if (sim) {
        const node = sim
          .nodes()
          .find((n) => n.id === nodeId);
        if (node) {
          node.fx = null;
          node.fy = null;
        }
        sim.alphaTarget(0);
      }
      dragRef.current = null;

      // Click (no drag) → navigate to service detail page
      if (!moved) {
        router.push(`/service/${nodeId}`);
      }
      return;
    }
    panRef.current = null;
  }, [router]);

  // ── Pan on background drag ──
  const handleBgPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as Element;
      const tag = target.tagName.toLowerCase();
      // Only pan when clicking on SVG background or the background rect
      if (tag !== "svg" && !target.classList.contains("graph-bg")) return;

      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startTx: transform.x,
        startTy: transform.y,
      };
      setSelectedId(null);
    },
    [transform],
  );

  // ── Zoom controls ──
  const zoomIn = useCallback(
    () =>
      setTransform((t) => ({ ...t, k: Math.min(MAX_ZOOM, t.k * 1.3) })),
    [],
  );
  const zoomOut = useCallback(
    () =>
      setTransform((t) => ({ ...t, k: Math.max(MIN_ZOOM, t.k / 1.3) })),
    [],
  );
  const resetView = useCallback(
    () => setTransform({ x: 0, y: 0, k: 1 }),
    [],
  );
  const fitView = useCallback(() => {
    if (nodes.length === 0) return;
    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const pad = 40;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const w = maxX - minX;
    const h = maxY - minY;
    const k = Math.min(VB_W / w, VB_H / h, 2);
    setTransform({
      k,
      x: (VB_W - w * k) / 2 - minX * k,
      y: (VB_H - h * k) / 2 - minY * k,
    });
  }, [nodes]);

  // ── Render ──
  const graphHeight = compact ? 340 : 480;

  const controlBtnClass =
    "flex items-center justify-center h-8 w-8 rounded-lg border border-border-strong/30 bg-surface-card dark:bg-surface-dark-card hover:bg-muted/50 transition-colors cursor-pointer text-muted-foreground hover:text-foreground";

  return (
    <div className="rounded-xl border border-border-strong/30 bg-surface-card dark:bg-surface-dark-card overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Dependency Network</h2>
          <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5 tabular-nums">
            {rawNodes.length} nodes &middot; {rawEdges.length} edges
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
      {/* Controls */}
      <div className="flex items-center justify-end gap-1 px-4 py-1.5 border-t border-border-strong/20">
        <button
          type="button"
          onClick={zoomIn}
          className={controlBtnClass}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className={controlBtnClass}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={fitView}
          className={controlBtnClass}
          title="Fit to view"
          aria-label="Fit to view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className={controlBtnClass}
          title="Reset view"
          aria-label="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Graph canvas */}
      <div className="relative" style={{ height: graphHeight }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-full"
          style={{ touchAction: "none", cursor: "grab" }}
          onPointerDown={handleBgPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="img"
          aria-label={`Dependency network graph showing ${rawNodes.length} services and ${rawEdges.length} connections`}
        >
          <defs>
            {/* Edge gradients per category */}
            {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
              <linearGradient
                key={cat}
                id={`edge-g-${cat}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor={colors.fill} stopOpacity={0.7} />
                <stop
                  offset="100%"
                  stopColor={colors.fill}
                  stopOpacity={0.15}
                />
              </linearGradient>
            ))}
            {/* Glow filter */}
            <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Arrow marker */}
            <marker
              id="net-arrow-new"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                fill="var(--color-text-muted, #9ca3af)"
                opacity={0.4}
              />
            </marker>
          </defs>

          {/* Transparent background rect for pan capture */}
          <rect
            className="graph-bg"
            x={0}
            y={0}
            width={VB_W}
            height={VB_H}
            fill="transparent"
          />

          <g
            transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
          >
            {/* Edges — curved arcs, category-colored */}
            {links.map((link, i) => {
              const srcHL = isHighlighted(link.source.id);
              const tgtHL = isHighlighted(link.target.id);
              const highlighted = srcHL && tgtHL;
              const catKey = link.source.category;

              return (
                <path
                  key={i}
                  d={edgePath(link)}
                  fill="none"
                  stroke={
                    highlighted ? `url(#edge-g-${catKey})` : "#9ca3af"
                  }
                  strokeWidth={highlighted ? 1.5 : 0.5}
                  opacity={highlighted ? 0.7 : 0.08}
                  markerEnd={highlighted ? "url(#net-arrow-new)" : undefined}
                  style={{ transition: "opacity 200ms, stroke-width 200ms" }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const catC =
                CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.apis;
              const statusColor = STATUS_RING[node.status] ?? STATUS_RING.DOWN;
              const r = getNodeRadius(node);
              const highlighted = isHighlighted(node.id);
              const isActive =
                hoveredId === node.id || selectedId === node.id;
              const showLabel =
                isActive || r >= 16 || node.status !== "UP";
              const nx = node.x ?? 0;
              const ny = node.y ?? 0;
              const truncName =
                node.name.length > 18
                  ? node.name.slice(0, 17) + "\u2026"
                  : node.name;

              return (
                <g
                  key={node.id}
                  onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    cursor: "pointer",
                    transition: "opacity 200ms",
                    opacity: highlighted ? 1 : 0.1,
                  }}
                >
                  {/* DOWN pulse ring */}
                  {node.status === "DOWN" && (
                    <circle cx={nx} cy={ny} r={r + 6} fill="none" stroke="#FA3748" strokeWidth={1}>
                      <animate
                        attributeName="r"
                        values={`${r + 3};${r + 14}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.5;0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* DEGRADED pulse ring */}
                  {node.status === "DEGRADED" && (
                    <circle cx={nx} cy={ny} r={r + 5} fill="none" stroke="#FA7319" strokeWidth={1}>
                      <animate
                        attributeName="r"
                        values={`${r + 3};${r + 10}`}
                        dur="3s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.4;0"
                        dur="3s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Status ring */}
                  <circle
                    cx={nx}
                    cy={ny}
                    r={r + 3}
                    fill="none"
                    stroke={statusColor}
                    strokeWidth={
                      node.status === "DOWN"
                        ? 3
                        : node.status === "DEGRADED"
                          ? 2.5
                          : 1.5
                    }
                    opacity={isActive ? 1 : 0.7}
                    filter={isActive ? "url(#node-glow)" : undefined}
                  />

                  {/* Node circle — status-colored when DOWN/DEGRADED, category-colored when UP */}
                  <circle
                    cx={nx}
                    cy={ny}
                    r={r}
                    fill={
                      node.status === "DOWN"
                        ? "#FA3748"
                        : node.status === "DEGRADED"
                          ? "#FA7319"
                          : catC.fill
                    }
                    stroke={
                      node.status === "DOWN"
                        ? "#D12030"
                        : node.status === "DEGRADED"
                          ? "#D45F10"
                          : catC.stroke
                    }
                    strokeWidth={isActive ? 2 : 1.5}
                    opacity={0.9}
                  />

                  {/* Inner icon dot for visual richness */}
                  <circle
                    cx={nx}
                    cy={ny}
                    r={r * 0.35}
                    fill="white"
                    opacity={0.4}
                  />

                  {/* Label */}
                  {showLabel && (
                    <text
                      x={nx}
                      y={ny + r + 16}
                      textAnchor="middle"
                      fontSize={compact ? 8 : 9}
                      fontWeight={isActive ? 600 : 400}
                      fill="currentColor"
                      className="pointer-events-none select-none"
                      paintOrder="stroke"
                      stroke="var(--color-surface-card, white)"
                      strokeWidth={3}
                      strokeLinejoin="round"
                    >
                      {truncName}
                    </text>
                  )}

                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom indicator */}
        {transform.k !== 1 && (
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-surface-card/80 dark:bg-surface-dark-card/80 backdrop-blur-sm rounded-md px-2 py-0.5 tabular-nums pointer-events-none">
            {Math.round(transform.k * 100)}%
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2.5 border-t border-border-strong/20 text-xs text-muted-foreground">
        {/* Category colors */}
        {CATEGORY_ICONS.map(({ key, label }) => {
          const c = CATEGORY_COLORS[key];
          return (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: c.fill }}
              />
              {label}
            </span>
          );
        })}
        <span className="text-muted-foreground/30">|</span>
        {/* Status rings */}
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: STATUS_RING.UP }}
          />
          UP
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: STATUS_RING.DEGRADED }}
          />
          Degraded
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: STATUS_RING.DOWN }}
          />
          Down
        </span>
        <span className="text-muted-foreground/30 hidden sm:inline">|</span>
        <span className="hidden sm:inline">
          Drag to move &middot; Scroll to zoom &middot; Click to open
        </span>
      </div>
        </>
      )}
    </div>
  );
}

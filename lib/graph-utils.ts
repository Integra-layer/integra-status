// lib/graph-utils.ts — Client-side graph utilities for blast radius, cascade trees, and network data

import type { CheckResult, HealthSummary } from "@/lib/types";

type DepGraph = Record<string, { dependsOn: string[]; requiredBy: string[] }>;

/**
 * BFS blast radius: count of all transitively downstream services.
 */
export function getBlastRadius(id: string, graph: DepGraph): string[] {
  const visited = new Set<string>();
  const queue: string[] = [id];
  visited.add(id);
  const impacted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = graph[current];
    if (!node) continue;
    for (const dep of node.requiredBy) {
      if (!visited.has(dep)) {
        visited.add(dep);
        impacted.push(dep);
        queue.push(dep);
      }
    }
  }

  return impacted;
}

/**
 * Build a cascade tree structure for visualization.
 */
export type CascadeNode = {
  id: string;
  name: string;
  status: string;
  depth: number;
  children: CascadeNode[];
};

export function buildCascadeTree(
  rootId: string,
  graph: DepGraph,
  results: CheckResult[],
  maxDepth = 3,
): CascadeNode {
  const resultMap = new Map(results.map((r) => [r.id, r]));

  function build(id: string, depth: number, visited: Set<string>): CascadeNode {
    const r = resultMap.get(id);
    const node: CascadeNode = {
      id,
      name: r?.name ?? id,
      status: r?.status ?? "DOWN",
      depth,
      children: [],
    };

    if (depth >= maxDepth) return node;

    const graphNode = graph[id];
    if (!graphNode) return node;

    for (const childId of graphNode.requiredBy) {
      if (!visited.has(childId)) {
        visited.add(childId);
        node.children.push(build(childId, depth + 1, visited));
      }
    }

    return node;
  }

  const visited = new Set<string>([rootId]);
  return build(rootId, 0, visited);
}

/**
 * Compute blast radius counts for all endpoints.
 */
export function getAllBlastRadii(graph: DepGraph): Record<string, number> {
  const radii: Record<string, number> = {};
  for (const id of Object.keys(graph)) {
    radii[id] = getBlastRadius(id, graph).length;
  }
  return radii;
}

/**
 * Assemble data for the force-directed network graph.
 */
export type NetworkNode = {
  id: string;
  name: string;
  status: string;
  category: string;
  blastRadius: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

export type NetworkEdge = {
  source: string;
  target: string;
};

export function buildNetworkData(
  data: HealthSummary,
): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const radii = getAllBlastRadii(data.dependencyGraph);
  const resultMap = new Map(data.results.map((r) => [r.id, r]));

  const nodes: NetworkNode[] = data.results.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    category: r.category,
    blastRadius: radii[r.id] ?? 0,
  }));

  const edges: NetworkEdge[] = [];
  const seen = new Set<string>();

  for (const [id, node] of Object.entries(data.dependencyGraph)) {
    for (const dep of node.requiredBy) {
      const key = `${id}->${dep}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ source: id, target: dep });
      }
    }
  }

  return { nodes, edges };
}

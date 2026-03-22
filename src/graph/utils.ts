import type { Graph, EdgeAttributes, Node } from './types.js';
import { EDGE_ATTRIBUTE_NAMES } from './types.js';

/**
 * Forward edge relations used for orphan-finding detection.
 * Shared between getHealth() and checkConsolidation().
 */
export const FORWARD_RELATIONS = new Set(['spawns', 'answers', 'extends']);

/**
 * Collect IDs of all DEFERRED nodes in the graph.
 * Shared between getHealth() and checkConsolidation().
 */
export function collectDeferredIds(graph: Graph): string[] {
  const ids: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.status === 'DEFERRED') ids.push(id);
  }
  return ids;
}

/**
 * BFS connected components — returns node ID groups.
 * Used for cluster-scoped checks (pivot ceremony, stale knowledge).
 */
export function getConnectedComponents(graph: Graph): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const node of graph.nodes.values()) {
    if (!adj.has(node.id)) adj.set(node.id, new Set());
    for (const link of node.links) {
      if (graph.nodes.has(link.target)) {
        adj.get(node.id)!.add(link.target);
        if (!adj.has(link.target)) adj.set(link.target, new Set());
        adj.get(link.target)!.add(node.id);
      }
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const nodeId of graph.nodes.keys()) {
    if (visited.has(nodeId)) continue;
    const component: string[] = [];
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const neighbor of (adj.get(current) ?? new Set())) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

/**
 * Build node-to-component-index map from connected components.
 */
export function buildNodeToComponent(graph: Graph): Map<string, number> {
  const components = getConnectedComponents(graph);
  const map = new Map<string, number>();
  components.forEach((comp, idx) => comp.forEach(id => map.set(id, idx)));
  return map;
}

export interface IncomingEdge extends Partial<EdgeAttributes> {
  sourceId: string;
  sourceConfidence: number;
  relation: string;
}

const reverseEdgeCache = new WeakMap<Graph, Map<string, IncomingEdge[]>>();

export function buildReverseEdgeIndex(graph: Graph): Map<string, IncomingEdge[]> {
  const cached = reverseEdgeCache.get(graph);
  if (cached) return cached;

  const index = new Map<string, IncomingEdge[]>();

  for (const [sourceId, node] of graph.nodes) {
    for (const link of node.links) {
      const edge: IncomingEdge = {
        sourceId,
        sourceConfidence: node.confidence ?? 0,
        relation: link.relation,
      };
      for (const attr of EDGE_ATTRIBUTE_NAMES) {
        const val = (link as unknown as Record<string, unknown>)[attr];
        if (val !== undefined) (edge as unknown as Record<string, unknown>)[attr] = val;
      }

      const existing = index.get(link.target);
      if (existing) {
        existing.push(edge);
      } else {
        index.set(link.target, [edge]);
      }
    }
  }

  reverseEdgeCache.set(graph, index);
  return index;
}

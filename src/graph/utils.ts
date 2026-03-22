import type { Graph, EdgeAttributes } from './types.js';
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

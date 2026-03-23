import type { Graph, EdgeAttributes, Node } from './types.js';
import { EDGE_ATTRIBUTE_NAMES, STATUS } from './types.js';
import { toGraphologyGraph } from './graphology-bridge.js';
import graphologyComponentsDefault from 'graphology-components';

// ESM interop — graphology-components export shape varies by bundler
const graphologyComponents =
  (graphologyComponentsDefault as any).default ?? graphologyComponentsDefault;
const _connectedComponents: (graph: any) => string[][] =
  graphologyComponents.connectedComponents;

/**
 * Collect IDs of all DEFERRED nodes in the graph.
 * Shared between getHealth() and checkConsolidation().
 */
export function collectDeferredIds(graph: Graph): string[] {
  const ids: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.status === STATUS.DEFERRED) ids.push(id);
  }
  return ids;
}

/**
 * BFS connected components — returns node ID groups.
 * Used for cluster-scoped checks (pivot ceremony, stale knowledge).
 */
export function getConnectedComponents(graph: Graph): string[][] {
  const g = toGraphologyGraph(graph);
  return _connectedComponents(g);
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

import type { Node, Graph } from './types.js';
import { buildReverseEdgeIndex, type IncomingEdge } from './utils.js';

export interface PresetResult {
  met: boolean;
  matchedNodeIds: string[];
}

export type PresetFn = (
  node: Node,
  graph: Graph,
  args: Record<string, unknown>,
) => PresetResult;

/**
 * has_linked — checks whether the node has linked nodes matching criteria.
 * Args: type?, status?, relation?, min_strength?, direction? ('incoming'|'outgoing'|'any', default 'any')
 * Uses buildReverseEdgeIndex() for incoming edges.
 */
function hasLinked(node: Node, graph: Graph, args: Record<string, unknown>): PresetResult {
  const type = args.type as string | undefined;
  const status = args.status as string | undefined;
  const relation = args.relation as string | undefined;
  const minStrength = args.min_strength as number | undefined;
  const direction = (args.direction as string) ?? 'any';

  const matchedNodeIds: string[] = [];

  // Check outgoing links
  if (direction === 'outgoing' || direction === 'any') {
    for (const link of node.links) {
      const target = graph.nodes.get(link.target);
      if (!target) continue;
      if (type && target.type !== type) continue;
      if (status && target.status !== status) continue;
      if (relation && link.relation !== relation) continue;
      if (minStrength !== undefined && (link.strength ?? 0) < minStrength) continue;
      if (!matchedNodeIds.includes(target.id)) {
        matchedNodeIds.push(target.id);
      }
    }
  }

  // Check incoming links
  if (direction === 'incoming' || direction === 'any') {
    const reverseIndex = buildReverseEdgeIndex(graph);
    const incoming = reverseIndex.get(node.id) ?? [];
    for (const edge of incoming) {
      const source = graph.nodes.get(edge.sourceId);
      if (!source) continue;
      if (type && source.type !== type) continue;
      if (status && source.status !== status) continue;
      if (relation && edge.relation !== relation) continue;
      if (minStrength !== undefined && (edge.strength ?? 0) < minStrength) continue;
      if (!matchedNodeIds.includes(source.id)) {
        matchedNodeIds.push(source.id);
      }
    }
  }

  return { met: matchedNodeIds.length > 0, matchedNodeIds };
}

/**
 * field_present — checks node.meta[name] exists and is non-empty.
 * Args: name (required)
 */
function fieldPresent(node: Node, _graph: Graph, args: Record<string, unknown>): PresetResult {
  const name = args.name as string;
  if (!name) {
    throw new Error('field_present preset requires "name" arg');
  }
  const value = node.meta[name];
  const met = value !== undefined && value !== null && value !== '';
  return { met, matchedNodeIds: [] };
}

/**
 * min_linked_count — checks >= count linked nodes of given type.
 * Args: type (required), count (required)
 */
function minLinkedCount(node: Node, graph: Graph, args: Record<string, unknown>): PresetResult {
  const type = args.type as string;
  const count = args.count as number;
  if (!type || count === undefined) {
    throw new Error('min_linked_count preset requires "type" and "count" args');
  }

  const matchedNodeIds: string[] = [];

  // Check outgoing
  for (const link of node.links) {
    const target = graph.nodes.get(link.target);
    if (target && target.type === type && !matchedNodeIds.includes(target.id)) {
      matchedNodeIds.push(target.id);
    }
  }

  // Check incoming
  const reverseIndex = buildReverseEdgeIndex(graph);
  const incoming = reverseIndex.get(node.id) ?? [];
  for (const edge of incoming) {
    const source = graph.nodes.get(edge.sourceId);
    if (source && source.type === type && !matchedNodeIds.includes(source.id)) {
      matchedNodeIds.push(source.id);
    }
  }

  return { met: matchedNodeIds.length >= count, matchedNodeIds };
}

/**
 * all_linked_with — all incoming nodes with given relation have given status.
 * Returns false if 0 matches (no vacuous truth).
 * Args: relation (required), status (required)
 */
function allLinkedWith(node: Node, graph: Graph, args: Record<string, unknown>): PresetResult {
  const relation = args.relation as string;
  const status = args.status as string;
  if (!relation || !status) {
    throw new Error('all_linked_with preset requires "relation" and "status" args');
  }

  const reverseIndex = buildReverseEdgeIndex(graph);
  const incoming = reverseIndex.get(node.id) ?? [];
  const matching = incoming.filter(e => e.relation === relation);

  if (matching.length === 0) {
    return { met: false, matchedNodeIds: [] };
  }

  const matchedNodeIds: string[] = [];
  for (const edge of matching) {
    const source = graph.nodes.get(edge.sourceId);
    if (!source || source.status !== status) {
      return { met: false, matchedNodeIds: [] };
    }
    matchedNodeIds.push(source.id);
  }

  return { met: true, matchedNodeIds };
}

export const PRESET_REGISTRY: Record<string, PresetFn> = {
  has_linked: hasLinked,
  field_present: fieldPresent,
  min_linked_count: minLinkedCount,
  all_linked_with: allLinkedWith,
};

/**
 * EMDD graph presets for @beomjk/state-engine.
 *
 * These presets implement graph-traversal conditions using the
 * PresetFn<Graph> signature. The engine passes Entity (id, type, status, meta)
 * and Graph as context; presets look up the full Node from graph.nodes
 * to access links.
 */
import type { PresetFn } from '@beomjk/state-engine/engine';
import type { Graph, Node } from './types.js';
import { buildReverseEdgeIndex } from './utils.js';
export { EMDD_PRESET_NAMES } from '../schema/preset-names.js';

/** Helper: get the full Node from graph (Entity doesn't have links). */
function getNode(entityId: string, graph: Graph): Node {
  const node = graph.nodes.get(entityId);
  if (!node) {
    throw new Error(`Node not found: ${entityId}`);
  }
  return node;
}

/**
 * has_linked — checks whether the node has linked nodes matching criteria.
 * Args: type?, status?, relation?, min_strength?, direction? ('incoming'|'outgoing'|'any', default 'any')
 */
export const hasLinked: PresetFn<Graph> = (entity, graph, args) => {
  const node = getNode(entity.id, graph);
  const type = args.type as string | undefined;
  const status = args.status as string | undefined;
  const relation = args.relation as string | undefined;
  const minStrength = args.min_strength as number | undefined;
  const direction = (args.direction as string) ?? 'any';

  const matchedIds: string[] = [];

  // Check outgoing links
  if (direction === 'outgoing' || direction === 'any') {
    for (const link of node.links) {
      const target = graph.nodes.get(link.target);
      if (!target) continue;
      if (type && target.type !== type) continue;
      if (status && target.status !== status) continue;
      if (relation && link.relation !== relation) continue;
      if (minStrength !== undefined && (link.strength ?? 0) < minStrength) continue;
      if (!matchedIds.includes(target.id)) {
        matchedIds.push(target.id);
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
      if (!matchedIds.includes(source.id)) {
        matchedIds.push(source.id);
      }
    }
  }

  return { met: matchedIds.length > 0, matchedIds };
};

/**
 * min_linked_count — checks >= count linked nodes of given type.
 * Args: type (required), count (required)
 */
export const minLinkedCount: PresetFn<Graph> = (entity, graph, args) => {
  const node = getNode(entity.id, graph);
  const type = args.type as string;
  const count = args.count as number;
  if (!type || count === undefined) {
    throw new Error('min_linked_count preset requires "type" and "count" args');
  }

  const matchedIds: string[] = [];

  // Check outgoing
  for (const link of node.links) {
    const target = graph.nodes.get(link.target);
    if (target && target.type === type && !matchedIds.includes(target.id)) {
      matchedIds.push(target.id);
    }
  }

  // Check incoming
  const reverseIndex = buildReverseEdgeIndex(graph);
  const incoming = reverseIndex.get(node.id) ?? [];
  for (const edge of incoming) {
    const source = graph.nodes.get(edge.sourceId);
    if (source && source.type === type && !matchedIds.includes(source.id)) {
      matchedIds.push(source.id);
    }
  }

  return { met: matchedIds.length >= count, matchedIds };
};

/**
 * all_linked_with — all incoming nodes with given relation have given status.
 * Returns false if 0 matches (no vacuous truth).
 * Args: relation (required), status (required)
 */
export const allLinkedWith: PresetFn<Graph> = (entity, graph, args) => {
  const relation = args.relation as string;
  const status = args.status as string;
  if (!relation || !status) {
    throw new Error('all_linked_with preset requires "relation" and "status" args');
  }

  const reverseIndex = buildReverseEdgeIndex(graph);
  const incoming = reverseIndex.get(entity.id) ?? [];
  const matching = incoming.filter(e => e.relation === relation);

  if (matching.length === 0) {
    return { met: false, matchedIds: [] };
  }

  const matchedIds: string[] = [];
  for (const edge of matching) {
    const source = graph.nodes.get(edge.sourceId);
    if (!source || source.status !== status) {
      return { met: false, matchedIds: [] };
    }
    matchedIds.push(source.id);
  }

  return { met: true, matchedIds };
};

/** EMDD graph presets keyed by name, for engine registration. */
export const emddPresets: Record<string, PresetFn<Graph>> = {
  has_linked: hasLinked,
  min_linked_count: minLinkedCount,
  all_linked_with: allLinkedWith,
};

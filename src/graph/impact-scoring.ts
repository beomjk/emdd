/**
 * impact-scoring.ts — Pure scoring functions for impact analysis.
 *
 * Contains edge factor computation, Noisy-OR aggregation, and BFS
 * impact traversal. No I/O — operates on in-memory Graph data.
 */
import type { Link, Graph, ImpactScoringState } from './types.js';
import type { EdgeClassificationEntry } from './derive-constants.js';
import { EDGE_CLASSIFICATION as _EDGE_CLASSIFICATION, IMPACT_THRESHOLD as _IMPACT_THRESHOLD, ATTRIBUTE_MODIFIERS, RELATION_DEFINITIONS } from './derive-constants.js';
export { EDGE_CLASSIFICATION, IMPACT_THRESHOLD } from './derive-constants.js';

// ── computeEdgeFactor ───────────────────────────────────────────────

/**
 * Compute the effective propagation factor for an edge.
 * factor = baseFactor × attributeModifier(link)
 */
export function computeEdgeFactor(
  link: Pick<Link, 'relation'> & Partial<Pick<Link, 'strength' | 'severity' | 'impact' | 'dependencyType' | 'completeness'>>,
  edgeClassification: Record<string, EdgeClassificationEntry>,
): number {
  const entry = edgeClassification[link.relation];
  if (!entry) return 0;

  let factor = entry.baseFactor;

  if (link.strength !== undefined) {
    factor *= link.strength;
  }
  if (link.severity !== undefined) {
    const mod = (ATTRIBUTE_MODIFIERS.severity as Record<string, number>)[link.severity];
    if (mod !== undefined) factor *= mod;
  }
  if (link.impact !== undefined) {
    const mod = (ATTRIBUTE_MODIFIERS.impact as Record<string, number>)[link.impact];
    if (mod !== undefined) factor *= mod;
  }
  if (link.dependencyType !== undefined) {
    const mod = (ATTRIBUTE_MODIFIERS.dependencyType as Record<string, number>)[link.dependencyType];
    if (mod !== undefined) factor *= mod;
  }
  if (link.completeness !== undefined) {
    factor *= link.completeness;
  }

  return Math.max(0, Math.min(1, factor));
}

// ── aggregateNoisyOr ────────────────────────────────────────────────

/**
 * Incrementally update Noisy-OR aggregate: 1 - ∏(1 - pᵢ).
 * @param complementProduct Current ∏(1 - pᵢ) value (starts at 1.0)
 * @param newPathScore Score of the new path (pᵢ)
 * @returns Updated complementProduct and aggregateScore
 */
export function aggregateNoisyOr(
  complementProduct: number,
  newPathScore: number,
): { aggregateScore: number; complementProduct: number } {
  const newComplement = complementProduct * (1 - newPathScore);
  return {
    aggregateScore: 1 - newComplement,
    complementProduct: newComplement,
  };
}

// ── computeImpactScores (BFS) ───────────────────────────────────────

export interface ComputeImpactOptions {
  threshold?: number;
  edgeClassification?: Record<string, EdgeClassificationEntry>;
}

/** Set of edge relations with reverse direction (impact flows target→source). Derived from schema. */
const REVERSE_DIRECTION_EDGES: Set<string> = new Set(
  RELATION_DEFINITIONS.filter(r => r.direction === 'reverse').map(r => r.name),
);

/**
 * BFS multi-hop impact scoring from a seed node.
 * Returns a Map of nodeId → ImpactScoringState for all reachable nodes
 * above the threshold.
 *
 * Propagation rules:
 * - Forward-direction edges (most): impact flows source→target (outgoing links)
 * - Reverse-direction edges (depends_on): impact flows target→source (incoming links)
 */
export function computeImpactScores(
  graph: Graph,
  seedId: string,
  options?: ComputeImpactOptions,
): Map<string, ImpactScoringState> {
  const threshold = options?.threshold ?? _IMPACT_THRESHOLD;
  const classification = options?.edgeClassification ?? _EDGE_CLASSIFICATION;

  const states = new Map<string, ImpactScoringState>();

  // Build reverse adjacency: targetId → [{sourceId, link}]
  // Used for reverse-direction edges (depends_on): A depends_on B (A→B link),
  // impact flows B→A, so from B we look up incoming depends_on links.
  const reverseAdj = new Map<string, Array<{ sourceId: string; link: Link }>>();
  for (const node of graph.nodes.values()) {
    for (const link of node.links) {
      if (!REVERSE_DIRECTION_EDGES.has(link.relation)) continue;
      if (!reverseAdj.has(link.target)) reverseAdj.set(link.target, []);
      reverseAdj.get(link.target)!.push({ sourceId: node.id, link });
    }
  }

  type QueueItem = [string, number, string[], string[], number];
  const queue: QueueItem[] = [];

  const seedNode = graph.nodes.get(seedId);
  if (!seedNode) return states;

  // Enqueue neighbors reachable from seed
  enqueueNeighbors(seedId, seedNode, 1.0, [seedId], [], 0, queue, graph, reverseAdj, classification, threshold);

  while (queue.length > 0) {
    const [nodeId, pathScore, path, pathEdges, depth] = queue.shift()!;

    if (nodeId === seedId) continue;
    if (pathScore < threshold) continue;

    const existing = states.get(nodeId);
    let shouldPropagate = false;

    if (existing) {
      const prev = existing.complementProduct;
      const { complementProduct } = aggregateNoisyOr(prev, pathScore);
      existing.complementProduct = complementProduct;
      existing.pathCount++;

      if (pathScore > existing.bestPathScore) {
        existing.bestPathScore = pathScore;
        existing.bestPath = path;
        existing.bestPathEdges = pathEdges;
      }
      if (depth < existing.depth) {
        existing.depth = depth;
      }

      // Relaxation: only re-propagate if aggregate meaningfully increased
      const newAggregate = 1 - complementProduct;
      const oldAggregate = 1 - prev;
      shouldPropagate = newAggregate > oldAggregate + 1e-10;
    } else {
      const { complementProduct } = aggregateNoisyOr(1.0, pathScore);
      states.set(nodeId, {
        complementProduct,
        bestPathScore: pathScore,
        bestPath: path,
        bestPathEdges: pathEdges,
        depth,
        pathCount: 1,
      });
      shouldPropagate = true;
    }

    if (!shouldPropagate) continue;

    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    enqueueNeighbors(nodeId, node, pathScore, path, pathEdges, depth, queue, graph, reverseAdj, classification, threshold);
  }

  return states;
}

function enqueueNeighbors(
  nodeId: string,
  node: { links: Link[] },
  pathScore: number,
  path: string[],
  pathEdges: string[],
  depth: number,
  queue: [string, number, string[], string[], number][],
  graph: Graph,
  reverseAdj: Map<string, Array<{ sourceId: string; link: Link }>>,
  classification: Record<string, EdgeClassificationEntry>,
  threshold: number,
): void {
  // 1. Outgoing edges with forward direction → targets affected
  for (const link of node.links) {
    if (REVERSE_DIRECTION_EDGES.has(link.relation)) continue; // skip reverse-direction outgoing
    const factor = computeEdgeFactor(link, classification);
    if (factor <= 0) continue;
    const newScore = pathScore * factor;
    if (newScore < threshold) continue;
    queue.push([link.target, newScore, [...path, link.target], [...pathEdges, link.relation], depth + 1]);
  }

  // 2. Incoming reverse-direction edges → sources affected
  //    (e.g., A depends_on X: A→X link; X changing affects A)
  const incoming = reverseAdj.get(nodeId) ?? [];
  for (const { sourceId, link } of incoming) {
    const factor = computeEdgeFactor(link, classification);
    if (factor <= 0) continue;
    const newScore = pathScore * factor;
    if (newScore < threshold) continue;
    queue.push([sourceId, newScore, [...path, sourceId], [...pathEdges, link.relation], depth + 1]);
  }
}

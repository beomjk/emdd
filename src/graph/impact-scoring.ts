/**
 * impact-scoring.ts — Pure scoring functions for impact analysis.
 *
 * Contains edge factor computation, Noisy-OR aggregation, and BFS
 * impact traversal. No I/O — operates on in-memory Graph data.
 */
import type { Link, Graph, ImpactScoringState } from './types.js';
import type { EdgeClassificationEntry } from './derive-constants.js';
export { EDGE_CLASSIFICATION, IMPACT_THRESHOLD } from './derive-constants.js';

// ── Attribute Modifier Maps ─────────────────────────────────────────

const SEVERITY_MODIFIER: Record<string, number> = {
  FATAL: 1.0, WEAKENING: 0.7, TENSION: 0.4,
};

const IMPACT_MODIFIER: Record<string, number> = {
  DECISIVE: 1.0, SIGNIFICANT: 0.7, MINOR: 0.3,
};

const DEPENDENCY_TYPE_MODIFIER: Record<string, number> = {
  LOGICAL: 1.0, PRACTICAL: 0.7, TEMPORAL: 0.5,
};

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
    const mod = SEVERITY_MODIFIER[link.severity];
    if (mod !== undefined) factor *= mod;
  }
  if (link.impact !== undefined) {
    const mod = IMPACT_MODIFIER[link.impact];
    if (mod !== undefined) factor *= mod;
  }
  if (link.dependencyType !== undefined) {
    const mod = DEPENDENCY_TYPE_MODIFIER[link.dependencyType];
    if (mod !== undefined) factor *= mod;
  }
  if (link.completeness !== undefined) {
    factor *= link.completeness;
  }

  return factor;
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

/**
 * BFS multi-hop impact scoring from a seed node.
 * Returns a Map of nodeId → ImpactScoringState for all reachable nodes
 * above the threshold.
 */
export function computeImpactScores(
  graph: Graph,
  seedId: string,
  options?: ComputeImpactOptions,
): Map<string, ImpactScoringState> {
  const { EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = require('./derive-constants.js') as
    { EDGE_CLASSIFICATION: Record<string, EdgeClassificationEntry>; IMPACT_THRESHOLD: number };
  const threshold = options?.threshold ?? IMPACT_THRESHOLD;
  const classification = options?.edgeClassification ?? EDGE_CLASSIFICATION;

  const states = new Map<string, ImpactScoringState>();

  // Build reverse adjacency map for depends_on etc.
  const reverseAdj = new Map<string, Array<{ sourceId: string; link: Link }>>();
  for (const node of graph.nodes.values()) {
    for (const link of node.links) {
      if (!reverseAdj.has(link.target)) reverseAdj.set(link.target, []);
      reverseAdj.get(link.target)!.push({ sourceId: node.id, link });
    }
  }

  // BFS queue: [nodeId, pathScore, path, pathEdges, depth]
  type QueueItem = [string, number, string[], string[], number];
  const queue: QueueItem[] = [];

  // Seed outgoing edges
  const seedNode = graph.nodes.get(seedId);
  if (!seedNode) return states;

  for (const link of seedNode.links) {
    const factor = computeEdgeFactor(link, classification);
    if (factor > 0) {
      queue.push([link.target, factor, [seedId, link.target], [link.relation], 1]);
    }
  }

  // Seed as target: incoming edges from other nodes that point to seed — skip
  // Instead: nodes that have the seed as a target via reverse direction edges
  const incomingToSeed = reverseAdj.get(seedId) ?? [];
  for (const { sourceId, link } of incomingToSeed) {
    // For reverse-direction edges (like depends_on), propagate FROM seed TO source
    const entry = classification[link.relation];
    if (!entry) continue;
    // depends_on: A depends_on B means A→B link, but impact flows B→A
    // We handle this by checking if the relation has reverse direction semantics
    // For now, we propagate through incoming links as well (bidirectional BFS)
    const factor = computeEdgeFactor(link, classification);
    if (factor > 0) {
      queue.push([sourceId, factor, [seedId, sourceId], [link.relation], 1]);
    }
  }

  while (queue.length > 0) {
    const [nodeId, pathScore, path, pathEdges, depth] = queue.shift()!;

    if (nodeId === seedId) continue; // skip self-loop back to seed
    if (pathScore < threshold) continue;

    const existing = states.get(nodeId);
    if (existing) {
      // Update with Noisy-OR
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

      // Relaxation: if aggregate score increased, re-enqueue neighbors
      const newAggregate = 1 - complementProduct;
      const oldAggregate = 1 - prev;
      if (newAggregate <= oldAggregate + 1e-10) continue;
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
    }

    // Propagate to neighbors
    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    // Outgoing edges
    for (const link of node.links) {
      const factor = computeEdgeFactor(link, classification);
      if (factor <= 0) continue;
      const newScore = pathScore * factor;
      if (newScore < threshold) continue;
      queue.push([
        link.target,
        newScore,
        [...path, link.target],
        [...pathEdges, link.relation],
        depth + 1,
      ]);
    }

    // Incoming edges (reverse propagation)
    const incoming = reverseAdj.get(nodeId) ?? [];
    for (const { sourceId, link } of incoming) {
      if (sourceId === seedId) continue;
      const factor = computeEdgeFactor(link, classification);
      if (factor <= 0) continue;
      const newScore = pathScore * factor;
      if (newScore < threshold) continue;
      queue.push([
        sourceId,
        newScore,
        [...path, sourceId],
        [...pathEdges, link.relation],
        depth + 1,
      ]);
    }
  }

  return states;
}

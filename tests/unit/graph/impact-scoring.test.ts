import { describe, it, expect } from 'vitest';
import type { Graph, Node, Link } from '../../../src/graph/types.js';

// T003: Edge classification constant tests
describe('EDGE_CLASSIFICATION', () => {
  // Lazy import to allow tests to be written before implementation
  let EDGE_CLASSIFICATION: Record<string, { classification: string; baseFactor: number }>;
  let IMPACT_THRESHOLD: number;

  it('imports successfully', async () => {
    const mod = await import('../../../src/graph/types.js');
    EDGE_CLASSIFICATION = mod.EDGE_CLASSIFICATION;
    IMPACT_THRESHOLD = mod.IMPACT_THRESHOLD;
    expect(EDGE_CLASSIFICATION).toBeDefined();
    expect(IMPACT_THRESHOLD).toBeDefined();
  });

  it('classifies all 16 forward edges', async () => {
    const { EDGE_CLASSIFICATION } = await import('../../../src/graph/types.js');
    expect(Object.keys(EDGE_CLASSIFICATION).length).toBe(16);
  });

  it('has 6 conducts edges with baseFactor 0.8', async () => {
    const { EDGE_CLASSIFICATION } = await import('../../../src/graph/types.js');
    const conducts = Object.entries(EDGE_CLASSIFICATION)
      .filter(([, v]) => v.classification === 'conducts');
    expect(conducts.length).toBe(6);
    const expected = ['supports', 'contradicts', 'confirms', 'depends_on', 'revises', 'tests'];
    expect(conducts.map(([k]) => k).sort()).toEqual(expected.sort());
    for (const [, v] of conducts) {
      expect(v.baseFactor).toBe(0.8);
    }
  });

  it('has 7 attenuates edges with baseFactor 0.4', async () => {
    const { EDGE_CLASSIFICATION } = await import('../../../src/graph/types.js');
    const attenuates = Object.entries(EDGE_CLASSIFICATION)
      .filter(([, v]) => v.classification === 'attenuates');
    expect(attenuates.length).toBe(7);
    const expected = ['informs', 'extends', 'produces', 'spawns', 'answers', 'promotes', 'resolves'];
    expect(attenuates.map(([k]) => k).sort()).toEqual(expected.sort());
    for (const [, v] of attenuates) {
      expect(v.baseFactor).toBe(0.4);
    }
  });

  it('has 3 blocks edges with baseFactor 0', async () => {
    const { EDGE_CLASSIFICATION } = await import('../../../src/graph/types.js');
    const blocks = Object.entries(EDGE_CLASSIFICATION)
      .filter(([, v]) => v.classification === 'blocks');
    expect(blocks.length).toBe(3);
    const expected = ['relates_to', 'part_of', 'context_for'];
    expect(blocks.map(([k]) => k).sort()).toEqual(expected.sort());
    for (const [, v] of blocks) {
      expect(v.baseFactor).toBe(0);
    }
  });

  it('IMPACT_THRESHOLD is 0.01', async () => {
    const { IMPACT_THRESHOLD } = await import('../../../src/graph/types.js');
    expect(IMPACT_THRESHOLD).toBe(0.01);
  });
});

// T004: computeEdgeFactor() tests
describe('computeEdgeFactor', () => {
  it('returns baseFactor for conducts edge without attributes', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports' };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBe(0.8);
  });

  it('returns baseFactor for attenuates edge without attributes', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'informs' };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBe(0.4);
  });

  it('returns 0 for blocks edge', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'relates_to' };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBe(0);
  });

  it('multiplies strength attribute', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports', strength: 0.5 };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8 * 0.5);
  });

  it('multiplies severity FATAL modifier (1.0)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'contradicts', severity: 'FATAL' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8 * 1.0);
  });

  it('multiplies severity WEAKENING modifier (0.7)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'contradicts', severity: 'WEAKENING' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8 * 0.7);
  });

  it('multiplies severity TENSION modifier (0.4)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'contradicts', severity: 'TENSION' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8 * 0.4);
  });

  it('multiplies impact DECISIVE modifier (1.0)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'informs', impact: 'DECISIVE' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.4 * 1.0);
  });

  it('multiplies impact SIGNIFICANT modifier (0.7)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'informs', impact: 'SIGNIFICANT' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.4 * 0.7);
  });

  it('multiplies impact MINOR modifier (0.3)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'informs', impact: 'MINOR' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.4 * 0.3);
  });

  it('multiplies dependencyType LOGICAL modifier (1.0)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'depends_on', dependencyType: 'LOGICAL' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8 * 1.0);
  });

  it('multiplies dependencyType PRACTICAL modifier (0.7)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'depends_on', dependencyType: 'PRACTICAL' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8 * 0.7);
  });

  it('multiplies dependencyType TEMPORAL modifier (0.5)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'depends_on', dependencyType: 'TEMPORAL' as const };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8 * 0.5);
  });

  it('multiplies completeness attribute', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'answers', completeness: 0.6 };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.4 * 0.6);
  });

  it('returns baseFactor when no recognized attributes', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports' };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBe(0.8);
  });

  it('returns 0 for unknown relation not in classification', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'unknown_edge_type' };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBe(0);
  });

  it('multiplies multiple attributes simultaneously', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports', strength: 0.5, severity: 'WEAKENING' as const, completeness: 0.6 };
    // baseFactor(0.8) * strength(0.5) * severity(0.7) * completeness(0.6)
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8 * 0.5 * 0.7 * 0.6);
  });

  it('strength boundary: 0.0 zeros out factor', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports', strength: 0.0 };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBe(0);
  });

  it('strength boundary: 1.0 preserves baseFactor', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports', strength: 1.0 };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8);
  });

  it('completeness boundary: 0.0 zeros out factor', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'answers', completeness: 0.0 };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBe(0);
  });

  it('completeness boundary: 1.0 preserves baseFactor', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'answers', completeness: 1.0 };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.4);
  });

  it('clamps result to 1.0 when custom baseFactor exceeds 1', async () => {
    const { computeEdgeFactor } = await import('../../../src/graph/impact-scoring.js');
    const customClassification = { supports: { classification: 'conducts' as const, baseFactor: 1.5 } };
    const link = { target: 'b', relation: 'supports' };
    expect(computeEdgeFactor(link, customClassification)).toBe(1.0);
  });

  it('clamps result to 0 when strength is negative', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports', strength: -0.5 };
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBe(0);
  });

  it('unknown attribute modifier value falls back to 1.0 (no attenuation)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    // 'UNKNOWN_SEVERITY' is not in ATTRIBUTE_MODIFIERS.severity → fallback 1.0
    const link = { target: 'b', relation: 'supports', severity: 'UNKNOWN_SEVERITY' as any };
    // baseFactor(0.8) × lookupModifier('severity', 'UNKNOWN_SEVERITY') = 0.8 × 1.0
    expect(computeEdgeFactor(link, EDGE_CLASSIFICATION)).toBeCloseTo(0.8);
  });
});

// T005: aggregateNoisyOr() tests
describe('aggregateNoisyOr', () => {
  it('single path: aggregate equals path score', async () => {
    const { aggregateNoisyOr } = await import('../../../src/graph/impact-scoring.js');
    // complementProduct starts at 1.0 (no paths yet)
    const result = aggregateNoisyOr(1.0, 0.6);
    expect(result.aggregateScore).toBeCloseTo(0.6);
    expect(result.complementProduct).toBeCloseTo(0.4);
  });

  it('two paths: Noisy-OR formula 1 - (1-p1)(1-p2)', async () => {
    const { aggregateNoisyOr } = await import('../../../src/graph/impact-scoring.js');
    // After first path (0.6): complementProduct = 0.4
    const result = aggregateNoisyOr(0.4, 0.3);
    // 1 - 0.4 * 0.7 = 1 - 0.28 = 0.72
    expect(result.aggregateScore).toBeCloseTo(0.72);
    expect(result.complementProduct).toBeCloseTo(0.28);
  });

  it('path score 0 does not change aggregate', async () => {
    const { aggregateNoisyOr } = await import('../../../src/graph/impact-scoring.js');
    const result = aggregateNoisyOr(0.4, 0);
    expect(result.aggregateScore).toBeCloseTo(0.6); // 1 - 0.4
    expect(result.complementProduct).toBeCloseTo(0.4);
  });

  it('path score 1 makes aggregate 1', async () => {
    const { aggregateNoisyOr } = await import('../../../src/graph/impact-scoring.js');
    const result = aggregateNoisyOr(0.4, 1.0);
    expect(result.aggregateScore).toBeCloseTo(1.0);
    expect(result.complementProduct).toBeCloseTo(0);
  });

  it('aggregate >= bestPath invariant', async () => {
    const { aggregateNoisyOr } = await import('../../../src/graph/impact-scoring.js');
    // After two paths: 0.6 and 0.3
    let cp = 1.0;
    let bestPath = 0;
    for (const score of [0.6, 0.3]) {
      const r = aggregateNoisyOr(cp, score);
      cp = r.complementProduct;
      bestPath = Math.max(bestPath, score);
    }
    const aggregate = 1 - cp;
    expect(aggregate).toBeGreaterThanOrEqual(bestPath);
  });
});

// ── T012: computeImpactScores BFS tests ──────────────────────────────

function makeNode(id: string, type: string, status: string, links: Link[] = []): Node {
  return { id, type: type as Node['type'], title: id, path: '', status, confidence: 0.5, tags: [], links, meta: {} };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

describe('computeImpactScores BFS traversal', () => {
  it('linear chain A→B→C', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'C', relation: 'supports' }]),
      makeNode('C', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.has('B')).toBe(true);
    expect(scores.has('C')).toBe(true);
    const bState = scores.get('B')!;
    const cState = scores.get('C')!;
    // B: direct, factor=0.8
    expect(1 - bState.complementProduct).toBeCloseTo(0.8);
    expect(bState.depth).toBe(1);
    // C: 0.8 * 0.8 = 0.64
    expect(1 - cState.complementProduct).toBeCloseTo(0.64);
    expect(cState.depth).toBe(2);
  });

  it('diamond A→B→D, A→C→D (Noisy-OR aggregation)', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },
        { target: 'C', relation: 'supports' },
      ]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'D', relation: 'supports' }]),
      makeNode('C', 'hypothesis', 'TESTING', [{ target: 'D', relation: 'supports' }]),
      makeNode('D', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    const dState = scores.get('D')!;
    // Two paths to D, each 0.8*0.8 = 0.64
    // Noisy-OR: 1 - (1-0.64)(1-0.64) = 1 - 0.36*0.36 = 1 - 0.1296 = 0.8704
    const aggregate = 1 - dState.complementProduct;
    expect(aggregate).toBeGreaterThan(0.64); // aggregate > bestPath
    expect(dState.bestPathScore).toBeCloseTo(0.64);
    expect(dState.pathCount).toBe(2);
  });

  it('fan-out A→B,C,D', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },
        { target: 'C', relation: 'confirms' },
        { target: 'D', relation: 'informs' },
      ]),
      makeNode('B', 'hypothesis', 'TESTING'),
      makeNode('C', 'hypothesis', 'TESTING'),
      makeNode('D', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.has('B')).toBe(true);
    expect(scores.has('C')).toBe(true);
    expect(scores.has('D')).toBe(true);
    expect(1 - scores.get('B')!.complementProduct).toBeCloseTo(0.8); // conducts
    expect(1 - scores.get('C')!.complementProduct).toBeCloseTo(0.8); // conducts
    expect(1 - scores.get('D')!.complementProduct).toBeCloseTo(0.4); // attenuates
  });

  it('cycle A→B→C→A converges', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'C', relation: 'supports' }]),
      makeNode('C', 'hypothesis', 'TESTING', [{ target: 'A', relation: 'supports' }]),
    ]);
    // Should not infinite loop; scores should converge
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.has('B')).toBe(true);
    expect(scores.has('C')).toBe(true);
    // Seed is excluded from results
    expect(scores.has('A')).toBe(false);
  });

  it('blocks edge stops propagation: A→B→(relates_to)→C', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'C', relation: 'relates_to' }]),
      makeNode('C', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.has('B')).toBe(true);
    expect(scores.has('C')).toBe(false);
  });

  it('isolated node: no impact', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING'),
      makeNode('B', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.size).toBe(0);
  });

  it('self-loop: seed node links to itself', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'A', relation: 'supports' }, // self-loop
        { target: 'B', relation: 'supports' },
      ]),
      makeNode('B', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.has('A')).toBe(false); // seed excluded
    expect(scores.has('B')).toBe(true);
  });

  it('non-seed self-loop does not cause infinite loop', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' }, // self-loop on B
        { target: 'C', relation: 'supports' },
      ]),
      makeNode('C', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.has('B')).toBe(true);
    expect(scores.has('C')).toBe(true);
  });

  it('nodes without status field are included in scoring', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const noStatusNode = { id: 'B', type: 'hypothesis' as const, title: 'B', path: '', tags: [], links: [] as Link[], meta: {} } as Node;
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      noStatusNode,
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.has('B')).toBe(true);
  });

  it('reverse-direction edge (depends_on): impact propagates target→source', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    // C depends_on A (C→A link), so A changing should affect C (reverse propagation)
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'PROPOSED'),
      makeNode('C', 'hypothesis', 'PROPOSED', [{ target: 'A', relation: 'depends_on' }]),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    // B: forward propagation via supports (conducts, factor=0.8)
    expect(scores.has('B')).toBe(true);
    expect(1 - scores.get('B')!.complementProduct).toBeCloseTo(0.8);
    // C: reverse propagation via depends_on (conducts, factor=0.8)
    expect(scores.has('C')).toBe(true);
    expect(1 - scores.get('C')!.complementProduct).toBeCloseTo(0.8);
    expect(scores.get('C')!.bestPath).toEqual(['A', 'C']);
    expect(scores.get('C')!.bestPathEdges).toEqual(['depends_on']);
  });

  it('returns empty map for non-existent seed node', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING'),
    ]);
    const scores = computeImpactScores(graph, 'non-existent', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    expect(scores.size).toBe(0);
  });

  it('dangling link target: link to non-existent node does not propagate further', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    // A→missing (dangling) and A→B (valid)
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'missing-node', relation: 'supports' },
        { target: 'B', relation: 'supports' },
      ]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'C', relation: 'supports' }]),
      makeNode('C', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    // missing-node gets a scoring entry but cannot propagate (graph.nodes.get returns undefined)
    expect(scores.has('missing-node')).toBe(true);
    // Valid path A→B→C still works
    expect(scores.has('B')).toBe(true);
    expect(scores.has('C')).toBe(true);
  });

  it('maxDepth: stops propagation at specified depth', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    // A→B→C→D chain, maxDepth=2 should include B(1), C(2) but exclude D(3)
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'C', relation: 'supports' }]),
      makeNode('C', 'hypothesis', 'TESTING', [{ target: 'D', relation: 'supports' }]),
      makeNode('D', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD, maxDepth: 2 });
    expect(scores.has('B')).toBe(true);
    expect(scores.get('B')!.depth).toBe(1);
    expect(scores.has('C')).toBe(true);
    expect(scores.get('C')!.depth).toBe(2);
    expect(scores.has('D')).toBe(false);
  });

  it('maxDepth: 0 returns empty results (no neighbors at depth 0)', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD, maxDepth: 0 });
    expect(scores.size).toBe(0);
  });

  it('maxDepth: 1 includes only direct neighbors', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'C', relation: 'supports' }]),
      makeNode('C', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD, maxDepth: 1 });
    expect(scores.has('B')).toBe(true);
    expect(scores.has('C')).toBe(false);
  });

  it('threshold: high value prunes low-score paths', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    // A→B (conducts, 0.8) → C (conducts, 0.64). Threshold 0.7 should include B but exclude C.
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'C', relation: 'supports' }]),
      makeNode('C', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: 0.7 });
    expect(scores.has('B')).toBe(true);
    expect(1 - scores.get('B')!.complementProduct).toBeCloseTo(0.8);
    expect(scores.has('C')).toBe(false);
  });

  it('threshold: 0 accepts all paths', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'informs' }]),
      makeNode('B', 'hypothesis', 'TESTING', [{ target: 'C', relation: 'informs' }]),
      makeNode('C', 'hypothesis', 'PROPOSED'),
    ]);
    // attenuates: 0.4, second hop: 0.16 — would be pruned by default 0.01 threshold only at deeper hops
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: 0 });
    expect(scores.has('B')).toBe(true);
    expect(scores.has('C')).toBe(true);
  });

  it('threshold: 1 accepts no paths (all scores < 1)', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'PROPOSED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: 1 });
    expect(scores.size).toBe(0);
  });

  it('immutability: graph not modified after BFS', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [{ target: 'B', relation: 'supports' }]),
      makeNode('B', 'hypothesis', 'TESTING'),
    ]);
    const nodesBefore = JSON.stringify([...graph.nodes.entries()]);
    computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION, threshold: IMPACT_THRESHOLD });
    const nodesAfter = JSON.stringify([...graph.nodes.entries()]);
    expect(nodesAfter).toBe(nodesBefore);
  });
});

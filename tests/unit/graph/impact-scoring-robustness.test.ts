import { describe, it, expect } from 'vitest';
import type { Graph, Node, Link } from '../../../src/graph/types.js';

// ── Helpers (per-file convention, no shared test utilities) ──────────

function makeNode(id: string, type: string, status: string, links: Link[] = []): Node {
  return { id, type: type as Node['type'], title: id, path: '', status, confidence: 0.5, tags: [], links, meta: {} };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Quick Wins
// ═══════════════════════════════════════════════════════════════════════

// T1: NaN Poison — computeEdgeFactor NaN defense
describe('computeEdgeFactor NaN handling', () => {
  it('returns 0 for NaN strength (defensive guard)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports', strength: NaN };
    const factor = computeEdgeFactor(link, EDGE_CLASSIFICATION);
    // NaN should be treated as 0, not propagated
    expect(factor).toBe(0);
    expect(Number.isFinite(factor)).toBe(true);
  });

  it('returns 0 for NaN completeness (defensive guard)', async () => {
    const { computeEdgeFactor, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const link = { target: 'b', relation: 'supports', completeness: NaN };
    const factor = computeEdgeFactor(link, EDGE_CLASSIFICATION);
    expect(factor).toBe(0);
    expect(Number.isFinite(factor)).toBe(true);
  });

  it('does not pollute BFS results with NaN scores', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION, IMPACT_THRESHOLD } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports', strength: NaN },
        { target: 'C', relation: 'supports' }, // normal edge
      ]),
      makeNode('B', 'finding', 'VALIDATED'),
      makeNode('C', 'finding', 'VALIDATED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { threshold: IMPACT_THRESHOLD, edgeClassification: EDGE_CLASSIFICATION });
    // C should be reachable normally; B should not be poisoned by NaN
    for (const [, state] of scores) {
      const aggregate = 1 - state.complementProduct;
      expect(Number.isFinite(aggregate)).toBe(true);
      expect(aggregate).toBeGreaterThanOrEqual(0);
      expect(aggregate).toBeLessThanOrEqual(1);
    }
  });
});

// T2: Duplicate Edges — same target/relation Noisy-OR amplification
describe('duplicate edges amplification', () => {
  it('treats duplicate edges as independent paths via Noisy-OR', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },
        { target: 'B', relation: 'supports' },
      ]),
      makeNode('B', 'finding', 'VALIDATED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });
    const b = scores.get('B')!;
    expect(b).toBeDefined();
    expect(b.pathCount).toBe(2);
    expect(b.bestPathScore).toBeCloseTo(0.8);
    // Noisy-OR(0.8, 0.8) = 1 - (1-0.8)(1-0.8) = 1 - 0.04 = 0.96
    expect(1 - b.complementProduct).toBeCloseTo(0.96);
  });
});

// T3: Mixed-Classification Parallel Edges
describe('mixed-classification parallel edges', () => {
  it('aggregates conducts+attenuates, excludes blocks on same pair', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },    // conducts: 0.8
        { target: 'B', relation: 'informs' },      // attenuates: 0.4
        { target: 'B', relation: 'relates_to' },   // blocks: 0.0
      ]),
      makeNode('B', 'finding', 'VALIDATED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });
    const b = scores.get('B')!;
    expect(b).toBeDefined();
    expect(b.pathCount).toBe(2); // blocks edge doesn't count
    expect(b.bestPathScore).toBeCloseTo(0.8);
    // Noisy-OR(0.8, 0.4) = 1 - (0.2)(0.6) = 0.88
    expect(1 - b.complementProduct).toBeCloseTo(0.88);
  });
});

// T4: Noisy-OR Monotonicity Invariant
describe('aggregateNoisyOr monotonicity', () => {
  it('aggregate is monotonically non-decreasing over 10 diverse pathScores', async () => {
    const { aggregateNoisyOr } = await import('../../../src/graph/impact-scoring.js');
    const scores = [0.1, 0.05, 0.3, 0.001, 0.9, 0.4, 0.2, 0.7, 0.01, 0.5];

    let complement = 1.0;
    let prevAggregate = 0;
    for (const score of scores) {
      const result = aggregateNoisyOr(complement, score);
      complement = result.complementProduct;
      expect(result.aggregateScore).toBeGreaterThanOrEqual(prevAggregate);
      prevAggregate = result.aggregateScore;
    }
    // Final aggregate >= max individual score
    expect(prevAggregate).toBeGreaterThanOrEqual(0.9);
    // Final aggregate < 1.0
    expect(prevAggregate).toBeLessThan(1.0);
    // complementProduct > 0
    expect(complement).toBeGreaterThan(0);
  });
});

// T5: Threshold Knife-Edge — pathScore == 0.01 boundary
describe('threshold knife-edge', () => {
  it('includes nodes with pathScore exactly at threshold', async () => {
    const { computeImpactScores } = await import('../../../src/graph/impact-scoring.js');
    // Custom classification with baseFactor=0.01 to produce exactly threshold score
    const customClassification = {
      supports: { classification: 'conducts' as const, baseFactor: 0.01 },
    };
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },
      ]),
      makeNode('B', 'finding', 'VALIDATED', [
        { target: 'C', relation: 'supports' },
      ]),
      makeNode('C', 'knowledge', 'ACTIVE'),
    ]);
    const scores = computeImpactScores(graph, 'A', {
      threshold: 0.01,
      edgeClassification: customClassification,
    });
    // B: pathScore = 0.01 (exactly at threshold) → included (pathScore < threshold is false)
    expect(scores.has('B')).toBe(true);
    // C: pathScore = 0.01 * 0.01 = 0.0001 < 0.01 → excluded
    expect(scores.has('C')).toBe(false);
  });
});

// T6: Reverse Edge Chain 3-hop (depends_on)
describe('reverse edge chain (depends_on multi-hop)', () => {
  it('propagates impact through 3-hop depends_on reverse chain', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    // D depends_on C depends_on B depends_on A
    // Impact flows: A → B → C → D (reverse direction)
    const graph = makeGraph([
      makeNode('A', 'knowledge', 'ACTIVE'),
      makeNode('B', 'hypothesis', 'TESTING', [
        { target: 'A', relation: 'depends_on' },
      ]),
      makeNode('C', 'hypothesis', 'PROPOSED', [
        { target: 'B', relation: 'depends_on' },
      ]),
      makeNode('D', 'experiment', 'PLANNED', [
        { target: 'C', relation: 'depends_on' },
      ]),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });

    const b = scores.get('B')!;
    expect(b).toBeDefined();
    expect(b.bestPathScore).toBeCloseTo(0.8);
    expect(b.depth).toBe(1);
    expect(b.bestPath).toEqual(['A', 'B']);
    expect(b.bestPathEdges).toEqual(['depends_on']);

    const c = scores.get('C')!;
    expect(c).toBeDefined();
    expect(c.bestPathScore).toBeCloseTo(0.64);
    expect(c.depth).toBe(2);

    const d = scores.get('D')!;
    expect(d).toBeDefined();
    expect(d.bestPathScore).toBeCloseTo(0.512);
    expect(d.depth).toBe(3);
    expect(d.bestPath).toEqual(['A', 'B', 'C', 'D']);
    expect(d.bestPathEdges).toEqual(['depends_on', 'depends_on', 'depends_on']);
  });
});

// T7: Blocks Edge Firewall — direct blocked but bypass exists
describe('blocks edge firewall with bypass', () => {
  it('reaches node via bypass when direct path is blocked', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'C', relation: 'relates_to' },  // blocked (factor=0)
        { target: 'B', relation: 'supports' },     // conducts: 0.8
      ]),
      makeNode('B', 'finding', 'VALIDATED', [
        { target: 'C', relation: 'supports' },     // conducts: 0.8
      ]),
      makeNode('C', 'knowledge', 'ACTIVE'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });

    expect(scores.has('C')).toBe(true);
    const c = scores.get('C')!;
    expect(c.bestPathScore).toBeCloseTo(0.64); // A→B→C: 0.8×0.8
    expect(c.pathCount).toBe(1); // only bypass path counts
    expect(c.bestPath).toEqual(['A', 'B', 'C']);
  });
});

// T8: Blocks Transitive Isolation
describe('blocks transitive isolation', () => {
  it('isolates all nodes beyond a blocks edge', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },    // conducts: 0.8
      ]),
      makeNode('B', 'finding', 'VALIDATED', [
        { target: 'C', relation: 'relates_to' },  // blocks: 0
      ]),
      makeNode('C', 'knowledge', 'ACTIVE', [
        { target: 'D', relation: 'supports' },    // conducts: 0.8
      ]),
      makeNode('D', 'experiment', 'RUNNING'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });

    expect(scores.has('B')).toBe(true);
    expect(scores.get('B')!.bestPathScore).toBeCloseTo(0.8);
    // C and D are transitively isolated
    expect(scores.has('C')).toBe(false);
    expect(scores.has('D')).toBe(false);
  });
});

// T9: MAX_CASCADE_DEPTH Boundary — depth 10/11
describe('MAX_CASCADE_DEPTH boundary', () => {
  it('includes depth 10, excludes depth 11', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const { MAX_CASCADE_DEPTH } = await import('../../../src/graph/types.js');

    // Build 12-node chain: N0 → N1 → ... → N11
    const nodes: Node[] = [];
    for (let i = 0; i <= 11; i++) {
      const links: Link[] = i < 11 ? [{ target: `N${i + 1}`, relation: 'supports' }] : [];
      nodes.push(makeNode(`N${i}`, 'hypothesis', 'TESTING', links));
    }
    const graph = makeGraph(nodes);

    expect(MAX_CASCADE_DEPTH).toBe(10);
    const scores = computeImpactScores(graph, 'N0', { edgeClassification: EDGE_CLASSIFICATION });

    // N10 (depth=10): included, score = 0.8^10
    expect(scores.has('N10')).toBe(true);
    expect(scores.get('N10')!.depth).toBe(10);
    expect(scores.get('N10')!.bestPathScore).toBeCloseTo(Math.pow(0.8, 10), 8);

    // N11 (depth=11): excluded by depth > maxDepth
    expect(scores.has('N11')).toBe(false);

    // Exactly 10 nodes in result (N1 through N10)
    expect(scores.size).toBe(10);
  });
});

// T10: Seed Node Exclusion — cycle + self-loop
describe('seed node exclusion', () => {
  it('excludes seed from results even with cycle and self-loop', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },
        { target: 'A', relation: 'supports' }, // self-loop
      ]),
      makeNode('B', 'finding', 'VALIDATED', [
        { target: 'A', relation: 'supports' }, // cycle back to seed
      ]),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });

    expect(scores.has('A')).toBe(false); // seed always excluded
    expect(scores.has('B')).toBe(true);
    expect(scores.get('B')!.bestPathScore).toBeCloseTo(0.8);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Phase 2: Topology Extensions
// ═══════════════════════════════════════════════════════════════════════

// T11: Deep Cycle (seed-free) — relaxation convergence
describe('deep cycle without seed — relaxation convergence', () => {
  it('converges with seed-free cycle B→C→D→B', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },
      ]),
      makeNode('B', 'finding', 'VALIDATED', [
        { target: 'C', relation: 'supports' },
      ]),
      makeNode('C', 'knowledge', 'ACTIVE', [
        { target: 'D', relation: 'supports' },
      ]),
      makeNode('D', 'experiment', 'RUNNING', [
        { target: 'B', relation: 'supports' }, // cycle: D→B (seed not involved)
      ]),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });

    const b = scores.get('B')!;
    const c = scores.get('C')!;
    const d = scores.get('D')!;

    // B boosted by cycle return (aggregate > initial 0.8)
    const bAggregate = 1 - b.complementProduct;
    expect(bAggregate).toBeGreaterThan(0.8);

    // All aggregates in valid range
    for (const [, state] of scores) {
      const agg = 1 - state.complementProduct;
      expect(agg).toBeGreaterThan(0);
      expect(agg).toBeLessThanOrEqual(1);
      // Noisy-OR invariant: aggregate >= bestPathScore
      expect(agg).toBeGreaterThanOrEqual(state.bestPathScore - 1e-10);
    }

    // B visited multiple times via cycle
    expect(b.pathCount).toBeGreaterThanOrEqual(2);

    // Depth ordering: B < C < D (shortest path)
    expect(b.depth).toBeLessThan(c.depth);
    expect(c.depth).toBeLessThan(d.depth);
  });
});

// T12: Bowtie (Star-to-Star) — pathScore vs aggregate propagation
describe('bowtie topology — pathScore propagation', () => {
  it('propagates pathScore (not aggregate) through hub node', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B1', relation: 'supports' },
        { target: 'B2', relation: 'supports' },
      ]),
      makeNode('B1', 'finding', 'VALIDATED', [
        { target: 'H', relation: 'supports' },
      ]),
      makeNode('B2', 'finding', 'VALIDATED', [
        { target: 'H', relation: 'supports' },
      ]),
      makeNode('H', 'knowledge', 'ACTIVE', [
        { target: 'C1', relation: 'supports' },
        { target: 'C2', relation: 'supports' },
      ]),
      makeNode('C1', 'experiment', 'RUNNING'),
      makeNode('C2', 'experiment', 'PLANNED'),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });

    // Hub H: 2 paths, each 0.8×0.8=0.64
    const h = scores.get('H')!;
    expect(h.pathCount).toBe(2);
    // Noisy-OR(0.64, 0.64) = 1 - (0.36)^2 = 0.8704
    expect(1 - h.complementProduct).toBeCloseTo(0.8704);

    // C1/C2: each has 2 paths through H
    // pathScores are 0.64×0.8=0.512 each (pathScore, not aggregate)
    const c1 = scores.get('C1')!;
    expect(c1.pathCount).toBe(2);
    // Noisy-OR(0.512, 0.512) = 1 - (0.488)^2 ≈ 0.7619
    expect(1 - c1.complementProduct).toBeCloseTo(1 - 0.488 * 0.488, 3);

    // Key assertion: C1 aggregate < H aggregate (pathScore attenuates, not aggregate)
    expect(1 - c1.complementProduct).toBeLessThan(1 - h.complementProduct);
  });
});

// T13: Lattice Grid (3×3 DAG) — combinatorial path explosion
describe('lattice grid 3×3 — combinatorial paths', () => {
  it('correctly aggregates paths through 3×3 grid', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');

    // Build 3×3 grid: each node links right and down
    const nodes: Node[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const links: Link[] = [];
        if (c < 2) links.push({ target: `n${r}${c + 1}`, relation: 'supports' }); // right
        if (r < 2) links.push({ target: `n${r + 1}${c}`, relation: 'supports' }); // down
        nodes.push(makeNode(`n${r}${c}`, 'hypothesis', 'TESTING', links));
      }
    }
    const graph = makeGraph(nodes);
    const scores = computeImpactScores(graph, 'n00', { edgeClassification: EDGE_CLASSIFICATION });

    // Symmetry: (0,2) and (2,0) should have identical scores (single path, 0.8^2)
    const n02 = scores.get('n02')!;
    const n20 = scores.get('n20')!;
    expect(n02.bestPathScore).toBeCloseTo(n20.bestPathScore);
    expect(1 - n02.complementProduct).toBeCloseTo(1 - n20.complementProduct);

    // (1,1): 2 paths (→↓ and ↓→), each 0.8^2=0.64
    const n11 = scores.get('n11')!;
    expect(n11.pathCount).toBe(2);
    // Noisy-OR(0.64, 0.64) = 1-(0.36)^2 = 0.8704
    expect(1 - n11.complementProduct).toBeCloseTo(0.8704);

    // (2,2): 6 paths C(4,2), each 0.8^4=0.4096
    const n22 = scores.get('n22')!;
    expect(n22.pathCount).toBeGreaterThanOrEqual(6);
    // Noisy-OR of 6 paths at 0.4096: 1 - (1-0.4096)^6 = 1 - (0.5904)^6
    const expected = 1 - Math.pow(0.5904, 6);
    expect(1 - n22.complementProduct).toBeCloseTo(expected, 2);

    // All 8 non-seed nodes should be reachable
    expect(scores.size).toBe(8);
  });
});

// T14: Disconnected Components + Reverse Bridge
describe('disconnected components with reverse bridge', () => {
  it('bridges disconnected components via depends_on reverse edge', async () => {
    const { computeImpactScores, EDGE_CLASSIFICATION } = await import('../../../src/graph/impact-scoring.js');
    const graph = makeGraph([
      // Component 1
      makeNode('A', 'hypothesis', 'TESTING', [
        { target: 'B', relation: 'supports' },
      ]),
      makeNode('B', 'knowledge', 'ACTIVE'),
      // Component 2: D depends_on B (reverse bridge), D→E (forward)
      makeNode('D', 'experiment', 'RUNNING', [
        { target: 'B', relation: 'depends_on' }, // reverse: impact flows B→D
        { target: 'E', relation: 'supports' },
      ]),
      makeNode('E', 'finding', 'VALIDATED'),
      // C links forward to D (but no reverse impact C←D)
      makeNode('C', 'question', 'OPEN', [
        { target: 'D', relation: 'supports' },
      ]),
    ]);
    const scores = computeImpactScores(graph, 'A', { edgeClassification: EDGE_CLASSIFICATION });

    // B: direct from A, score=0.8
    expect(scores.get('B')!.bestPathScore).toBeCloseTo(0.8);

    // D: via reverse bridge B→D, score=0.8×0.8=0.64
    expect(scores.has('D')).toBe(true);
    expect(scores.get('D')!.bestPathScore).toBeCloseTo(0.64);

    // E: via D→E forward, score=0.64×0.8=0.512
    expect(scores.has('E')).toBe(true);
    expect(scores.get('E')!.bestPathScore).toBeCloseTo(0.512);

    // C: not reachable (C→D is forward, impact doesn't flow D→C)
    expect(scores.has('C')).toBe(false);
  });
});

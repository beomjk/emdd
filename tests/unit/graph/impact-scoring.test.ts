import { describe, it, expect } from 'vitest';

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

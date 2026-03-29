import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = resolve(__dirname, '../../fixtures/sample-graph');

// T013: traceImpact current-status mode tests
describe('traceImpact current-status mode', () => {
  it('returns ImpactReport for knw-001', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    const report = await traceImpact(SAMPLE_GRAPH, 'knw-001');
    expect(report).toBeDefined();
    expect(report.seed.nodeId).toBe('knw-001');
    expect(report.seed.nodeType).toBe('knowledge');
    expect(report.seed.currentStatus).toBe('ACTIVE');
    expect(report.seed.whatIfStatus).toBeUndefined();
  });

  it('cascadeTrace is undefined in current-status mode', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    const report = await traceImpact(SAMPLE_GRAPH, 'knw-001');
    expect(report.cascadeTrace).toBeUndefined();
  });

  it('impactedNodes sorted by score descending', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    const report = await traceImpact(SAMPLE_GRAPH, 'knw-001');
    for (let i = 1; i < report.impactedNodes.length; i++) {
      expect(report.impactedNodes[i - 1].aggregateScore)
        .toBeGreaterThanOrEqual(report.impactedNodes[i].aggregateScore);
    }
  });

  it('summary statistics are accurate', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    const report = await traceImpact(SAMPLE_GRAPH, 'knw-001');
    expect(report.summary.totalAffected).toBe(report.impactedNodes.length);
    if (report.impactedNodes.length > 0) {
      const maxScore = Math.max(...report.impactedNodes.map(n => n.aggregateScore));
      expect(report.summary.maxScore).toBeCloseTo(maxScore);
      const avg = report.impactedNodes.reduce((s, n) => s + n.aggregateScore, 0) / report.impactedNodes.length;
      expect(report.summary.avgScore).toBeCloseTo(avg);
    }
  });

  it('throws for non-existent node ID', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    await expect(traceImpact(SAMPLE_GRAPH, 'xyz-999')).rejects.toThrow();
  });

  it('all impactedNodes have valid structure', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    const report = await traceImpact(SAMPLE_GRAPH, 'knw-001');
    for (const node of report.impactedNodes) {
      expect(node.nodeId).toBeTruthy();
      expect(node.nodeType).toBeTruthy();
      expect(node.aggregateScore).toBeGreaterThanOrEqual(0);
      expect(node.aggregateScore).toBeLessThanOrEqual(1);
      expect(node.bestPathScore).toBeLessThanOrEqual(node.aggregateScore);
      expect(node.depth).toBeGreaterThanOrEqual(1);
      expect(node.bestPath[0]).toBe('knw-001');
      expect(node.bestPath[node.bestPath.length - 1]).toBe(node.nodeId);
      expect(node.pathCount).toBeGreaterThanOrEqual(1);
    }
  });
});

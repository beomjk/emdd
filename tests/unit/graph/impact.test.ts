import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Glob } from 'glob';

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

// ── T016: traceImpact what-if mode tests ─────────────────────────────

function hashAllFiles(dir: string): string {
  const files = new Glob('**/*.md', { cwd: dir, absolute: true });
  const hashes: string[] = [];
  for (const f of files) {
    const content = readFileSync(f);
    hashes.push(createHash('sha256').update(content).digest('hex'));
  }
  return hashes.sort().join(',');
}

describe('traceImpact what-if mode', () => {
  it('returns cascadeTrace fields when whatIf is specified', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    const report = await traceImpact(SAMPLE_GRAPH, 'knw-001', { whatIf: 'RETRACTED' });
    expect(report.seed.whatIfStatus).toBe('RETRACTED');
    expect(report.cascadeTrace).toBeDefined();
    const ct = report.cascadeTrace!;
    expect(ct.trigger).toBeDefined();
    expect(ct.trigger.entityId).toBe('knw-001');
    expect(ct.steps).toBeInstanceOf(Array);
    expect(ct.unresolved).toBeInstanceOf(Array);
    expect(ct.availableManualTransitions).toBeInstanceOf(Array);
    expect(ct.affected).toBeInstanceOf(Array);
    expect(ct.finalStates).toBeDefined();
    expect(typeof ct.converged).toBe('boolean');
    expect(typeof ct.rounds).toBe('number');
  });

  it('original files unchanged after what-if (immutability)', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    const hashBefore = hashAllFiles(SAMPLE_GRAPH);
    await traceImpact(SAMPLE_GRAPH, 'knw-001', { whatIf: 'RETRACTED' });
    const hashAfter = hashAllFiles(SAMPLE_GRAPH);
    expect(hashAfter).toBe(hashBefore);
  });

  it('throws for invalid what-if status', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    await expect(traceImpact(SAMPLE_GRAPH, 'knw-001', { whatIf: 'INVALID_STATUS' }))
      .rejects.toThrow();
  });

  it('what-if == current status results in no cascade changes', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    const report = await traceImpact(SAMPLE_GRAPH, 'knw-001', { whatIf: 'ACTIVE' });
    // Current status is ACTIVE, what-if is also ACTIVE — no trigger change
    expect(report.cascadeTrace).toBeDefined();
    expect(report.cascadeTrace!.steps.length).toBe(0);
  });
});

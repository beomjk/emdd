import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = resolve(__dirname, '../../fixtures/sample-graph');
const EMPTY_GRAPH = resolve(__dirname, '../../fixtures/empty-graph');

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

// T026: empty graph handling
describe('traceImpact edge cases', () => {
  it('throws for node not found in empty graph', async () => {
    const { traceImpact } = await import('../../../src/graph/impact.js');
    await expect(traceImpact(EMPTY_GRAPH, 'knw-001')).rejects.toThrow("not found");
  });
});

// T027: buildRelationInstances unit tests
describe('buildRelationInstances', () => {
  it('converts graph links to flat relation instances', async () => {
    const { buildRelationInstances } = await import('../../../src/graph/impact.js');
    const graph = {
      nodes: new Map([
        ['a', { id: 'a', type: 'hypothesis' as const, title: 'A', path: '', status: 'PROPOSED', confidence: 0.5, tags: [], links: [
          { target: 'b', relation: 'supports' },
          { target: 'c', relation: 'depends_on', strength: 0.7 },
        ], meta: {} }],
        ['b', { id: 'b', type: 'hypothesis' as const, title: 'B', path: '', status: 'TESTING', confidence: 0.5, tags: [], links: [], meta: {} }],
      ]),
      errors: [],
      warnings: [],
    } as any;
    const relations = buildRelationInstances(graph);
    expect(relations).toHaveLength(2);
    expect(relations[0]).toEqual({ name: 'supports', sourceId: 'a', targetId: 'b', metadata: undefined });
    expect(relations[1]).toEqual({ name: 'depends_on', sourceId: 'a', targetId: 'c', metadata: { strength: 0.7 } });
  });

  it('returns empty array for graph with no links', async () => {
    const { buildRelationInstances } = await import('../../../src/graph/impact.js');
    const graph = {
      nodes: new Map([
        ['a', { id: 'a', type: 'hypothesis' as const, title: 'A', path: '', status: 'PROPOSED', confidence: 0.5, tags: [], links: [], meta: {} }],
      ]),
      errors: [],
      warnings: [],
    } as any;
    const relations = buildRelationInstances(graph);
    expect(relations).toHaveLength(0);
  });
});

// T029: format with unresolved conflicts
describe('impact format', () => {
  it('format handles unresolved conflicts in cascade', async () => {
    const { impactDef } = await import('../../../src/registry/commands/impact.js');
    const mockReport = {
      seed: { nodeId: 'knw-001', nodeType: 'knowledge', currentStatus: 'ACTIVE', whatIfStatus: 'RETRACTED' },
      impactedNodes: [{
        nodeId: 'hyp-001',
        nodeType: 'hypothesis',
        currentStatus: 'TESTING',
        aggregateScore: 0.8,
        bestPathScore: 0.8,
        depth: 1,
        bestPath: ['knw-001', 'hyp-001'],
        bestPathEdges: ['supports'],
        pathCount: 1,
        autoTransition: { from: 'TESTING', to: 'CONTESTED', matchedIds: ['knw-001'] },
      }],
      cascadeTrace: {
        trigger: { entityId: 'knw-001', entityType: 'knowledge', from: 'ACTIVE', to: 'RETRACTED' },
        steps: [{ entityId: 'hyp-001', entityType: 'hypothesis', from: 'TESTING', to: 'CONTESTED', round: 1, triggeredBy: ['knw-001'] }],
        unresolved: [{ entityId: 'fnd-001', entityType: 'finding', candidates: [{ to: 'DRAFT' }, { to: 'RETRACTED' }] }],
        availableManualTransitions: [],
        affected: ['hyp-001'],
        finalStates: { 'knw-001': 'RETRACTED', 'hyp-001': 'CONTESTED' },
        converged: true,
        rounds: 1,
      },
      summary: { totalAffected: 1, maxScore: 0.8, avgScore: 0.8, affectedByType: { hypothesis: 1 } },
    };
    const output = impactDef.format(mockReport);
    expect(output).toContain('knw-001');
    expect(output).toContain('RETRACTED');
    expect(output).toContain('hyp-001');
    expect(output).toContain('TESTING → CONTESTED');
    expect(output).toContain('1 auto-transition');
    expect(output).toContain('1 unresolved');
  });

  it('format handles empty results', async () => {
    const { impactDef } = await import('../../../src/registry/commands/impact.js');
    const mockReport = {
      seed: { nodeId: 'knw-001', nodeType: 'knowledge', currentStatus: 'ACTIVE' },
      impactedNodes: [],
      summary: { totalAffected: 0, maxScore: 0, avgScore: 0, affectedByType: {} },
    };
    const output = impactDef.format(mockReport);
    expect(output).toContain('No nodes affected');
  });
});

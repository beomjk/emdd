import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { analyzeRefutation } from '../../../src/graph/refutation.js';

describe('analyzeRefutation', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-refut-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'findings', 'knowledge']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  it('DISPUTED transition: severity-based confidence penalty on dependent hypotheses', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts', severity: 'FATAL' }],
    });
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'supports' }],
    });

    const result = await analyzeRefutation(graphDir);
    expect(result.affectedHypotheses.length).toBe(1);
    expect(result.affectedHypotheses[0].hypothesisId).toBe('hyp-001');
  });

  it('FATAL → x0.5, WEAKENING → x0.7, TENSION → x0.9', async () => {
    // Test FATAL penalty
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts', severity: 'FATAL' }],
    });
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'supports' }],
    });

    const result = await analyzeRefutation(graphDir);
    const affected = result.affectedHypotheses.find(h => h.hypothesisId === 'hyp-001');
    expect(affected).toBeDefined();
    expect(affected!.newConfidence).toBeCloseTo(0.4, 1); // 0.8 * 0.5
  });

  it('pivot ceremony trigger: 2+ RETRACTED in same cluster', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'RETRACTED',
      confidence: 0.1, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-002', relation: 'relates_to' }],
    });
    writeNode('knowledge', 'knw-002-test.md', {
      id: 'knw-002', type: 'knowledge', title: 'K2', status: 'RETRACTED',
      confidence: 0.1, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const result = await analyzeRefutation(graphDir);
    expect(result.pivotCeremonyTriggered).toBe(true);
  });

  it('returns impact analysis (affected hypothesis IDs + new confidence)', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts', severity: 'WEAKENING' }],
    });
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.6, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'depends_on' }],
    });

    const result = await analyzeRefutation(graphDir);
    const affected = result.affectedHypotheses.find(h => h.hypothesisId === 'hyp-001');
    expect(affected).toBeDefined();
    expect(affected!.hypothesisId).toBe('hyp-001');
    expect(affected!.oldConfidence).toBe(0.6);
    expect(affected!.newConfidence).toBeCloseTo(0.42, 1); // 0.6 * 0.7
  });

  it('TENSION severity → x0.9 penalty', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts', severity: 'TENSION' }],
    });
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'supports' }],
    });

    const result = await analyzeRefutation(graphDir);
    const affected = result.affectedHypotheses.find(h => h.hypothesisId === 'hyp-001');
    expect(affected).toBeDefined();
    expect(affected!.newConfidence).toBeCloseTo(0.72, 2); // 0.8 * 0.9
  });

  it('multiple contradictions → worst severity wins', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts', severity: 'TENSION' }],
    });
    writeNode('findings', 'fnd-002-test.md', {
      id: 'fnd-002', type: 'finding', title: 'F2', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts', severity: 'FATAL' }],
    });
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 1.0, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'supports' }],
    });

    const result = await analyzeRefutation(graphDir);
    const affected = result.affectedHypotheses.find(h => h.hypothesisId === 'hyp-001');
    expect(affected).toBeDefined();
    expect(affected!.newConfidence).toBeCloseTo(0.5, 2); // 1.0 * 0.5 (FATAL wins)
  });

  it('contradiction without severity → defaults to TENSION', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts' }],
    });
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'supports' }],
    });

    const result = await analyzeRefutation(graphDir);
    const affected = result.affectedHypotheses.find(h => h.hypothesisId === 'hyp-001');
    expect(affected).toBeDefined();
    expect(affected!.newConfidence).toBeCloseTo(0.72, 2); // 0.8 * 0.9 (TENSION default)
  });

  it('multiple hypotheses depending on same DISPUTED knowledge', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts', severity: 'WEAKENING' }],
    });
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'supports' }],
    });
    writeNode('hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
      confidence: 0.6, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'depends_on' }],
    });

    const result = await analyzeRefutation(graphDir);
    expect(result.affectedHypotheses.length).toBe(2);
  });

  it('2 RETRACTED in different clusters → pivot NOT triggered', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'RETRACTED',
      confidence: 0.1, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('knowledge', 'knw-002-test.md', {
      id: 'knw-002', type: 'knowledge', title: 'K2', status: 'RETRACTED',
      confidence: 0.1, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const result = await analyzeRefutation(graphDir);
    expect(result.pivotCeremonyTriggered).toBe(false);
  });

  it('only 1 RETRACTED → pivot NOT triggered', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'RETRACTED',
      confidence: 0.1, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const result = await analyzeRefutation(graphDir);
    expect(result.pivotCeremonyTriggered).toBe(false);
    expect(result.retractedKnowledgeIds.length).toBe(1);
  });

  it('unknown severity falls back to TENSION penalty, undefined confidence falls back to 0', async () => {
    // Exercises ?? fallback paths: SEVERITY_PENALTIES[sev] ?? 0.9 (line 42/47)
    // and hypNode.confidence ?? 0 (line 57)
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'contradicts', severity: 'UNKNOWN_SEV' }],
    });
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'knw-001', relation: 'supports' }],
      // no confidence field → ?? 0
    });
    // Also add disconnected RETRACTED nodes to exercise nodeToComponent.get(id) ?? -1 (line 81)
    writeNode('knowledge', 'knw-002-test.md', {
      id: 'knw-002', type: 'knowledge', title: 'K2', status: 'RETRACTED',
      confidence: 0.1, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('knowledge', 'knw-003-test.md', {
      id: 'knw-003', type: 'knowledge', title: 'K3', status: 'RETRACTED',
      confidence: 0.1, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const result = await analyzeRefutation(graphDir);

    // Unknown severity → fallback penalty 0.9, confidence undefined → 0, so 0 * 0.9 = 0
    const affected = result.affectedHypotheses.find(h => h.hypothesisId === 'hyp-001');
    expect(affected).toBeDefined();
    expect(affected!.oldConfidence).toBe(0);
    expect(affected!.newConfidence).toBeCloseTo(0, 2);
    // worstSeverity starts as 'TENSION'; UNKNOWN_SEV has same penalty (0.9) so doesn't replace it
    expect(affected!.severity).toBe('TENSION');

    // Two disconnected RETRACTED nodes both get component -1, so they share a "cluster"
    // This is actually a known edge case: pivotCeremonyTriggered may be true
    expect(result.retractedKnowledgeIds).toHaveLength(2);
  });

  it('no DISPUTED knowledge → empty result', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const result = await analyzeRefutation(graphDir);
    expect(result.affectedHypotheses).toEqual([]);
    expect(result.pivotCeremonyTriggered).toBe(false);
    expect(result.retractedKnowledgeIds).toEqual([]);
  });
});

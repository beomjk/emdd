import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { computeConfidence, propagateConfidence } from '../../../src/graph/confidence.js';

describe('computeConfidence — pure formula', () => {
  // @spec §6.7.1
  it('worked example from spec: initial=0.40, SUPPORTS(0.90,0.80) + CONTRADICTS(0.70,WEAKENING) → ~0.42', () => {
    const result = computeConfidence(0.40, [
      { type: 'supports', sourceConfidence: 0.90, strength: 0.80 },
      { type: 'contradicts', sourceConfidence: 0.70, severity: 'WEAKENING' },
    ]);
    expect(result).toBeCloseTo(0.4184, 3);
  });

  it('single SUPPORTS increases confidence', () => {
    const result = computeConfidence(0.5, [
      { type: 'supports', sourceConfidence: 0.8, strength: 0.7 },
    ]);
    expect(result).toBeGreaterThan(0.5);
  });

  it('single CONTRADICTS decreases confidence', () => {
    const result = computeConfidence(0.5, [
      { type: 'contradicts', sourceConfidence: 0.8, severity: 'FATAL' },
    ]);
    expect(result).toBeLessThan(0.5);
  });

  // @spec §6.7.3
  it('CONFIRMS treated as SUPPORTS with strength=1.0', () => {
    const withConfirms = computeConfidence(0.5, [
      { type: 'confirms', sourceConfidence: 0.8 },
    ]);
    const withSupports = computeConfidence(0.5, [
      { type: 'supports', sourceConfidence: 0.8, strength: 1.0 },
    ]);
    expect(withConfirms).toBeCloseTo(withSupports, 10);
  });

  it('no evidential edges → returns initial confidence unchanged', () => {
    expect(computeConfidence(0.6, [])).toBe(0.6);
  });

  it('clamps to [0.0, 1.0]', () => {
    // Many strong supports should not exceed 1.0
    const result = computeConfidence(0.99, [
      { type: 'supports', sourceConfidence: 1.0, strength: 1.0 },
      { type: 'supports', sourceConfidence: 1.0, strength: 1.0 },
      { type: 'supports', sourceConfidence: 1.0, strength: 1.0 },
    ]);
    expect(result).toBeLessThanOrEqual(1.0);
    expect(result).toBeGreaterThanOrEqual(0.0);
  });

  // @spec §6.7.2
  it('severity weights: FATAL=0.9, WEAKENING=0.6, TENSION=0.3', () => {
    const fatal = computeConfidence(0.5, [
      { type: 'contradicts', sourceConfidence: 1.0, severity: 'FATAL' },
    ]);
    const weakening = computeConfidence(0.5, [
      { type: 'contradicts', sourceConfidence: 1.0, severity: 'WEAKENING' },
    ]);
    const tension = computeConfidence(0.5, [
      { type: 'contradicts', sourceConfidence: 1.0, severity: 'TENSION' },
    ]);
    // FATAL should reduce most, TENSION least
    expect(fatal).toBeLessThan(weakening);
    expect(weakening).toBeLessThan(tension);
  });

  it('severity undefined falls back to VALID_SEVERITIES last element (TENSION)', () => {
    const withUndefined = computeConfidence(0.5, [
      { type: 'contradicts', sourceConfidence: 1.0, severity: undefined },
    ]);
    const withTension = computeConfidence(0.5, [
      { type: 'contradicts', sourceConfidence: 1.0, severity: 'TENSION' },
    ]);
    expect(withUndefined).toBe(withTension);
  });
});

describe('propagateConfidence — graph-wide', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-conf-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'findings']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  it('returns map of nodeId → { old, new } for all hypothesis nodes', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.4, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });

    const results = await propagateConfidence(graphDir);
    expect(results.length).toBe(1);
    expect(results[0].nodeId).toBe('hyp-001');
    expect(results[0].oldConfidence).toBe(0.4);
    expect(results[0].newConfidence).toBeGreaterThan(0.4);
  });

  it('skips nodes without incoming evidential edges', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const results = await propagateConfidence(graphDir);
    expect(results.length).toBe(0);
  });

  it('does not modify files (read-only operation)', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.4, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });

    const fileBefore = require('node:fs').readFileSync(join(graphDir, 'hypotheses/hyp-001-test.md'), 'utf-8');
    await propagateConfidence(graphDir);
    const fileAfter = require('node:fs').readFileSync(join(graphDir, 'hypotheses/hyp-001-test.md'), 'utf-8');
    expect(fileAfter).toBe(fileBefore);
  });
});

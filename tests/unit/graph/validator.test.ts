import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadNode, loadGraph } from '../../../src/graph/loader.js';
import { lintNode, lintGraph } from '../../../src/graph/validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../fixtures');

describe('lintNode', () => {
  it('returns empty array for valid hypothesis node', async () => {
    const node = await loadNode(path.join(FIXTURES, 'sample-graph/hypotheses/hyp-001-surface-defect-detection.md'));
    expect(node).not.toBeNull();
    const errors = lintNode(node!);
    expect(errors).toEqual([]);
  });

  it('returns empty array for valid experiment node (no confidence required)', async () => {
    const node = await loadNode(path.join(FIXTURES, 'sample-graph/experiments/exp-001-cnn-baseline.md'));
    expect(node).not.toBeNull();
    const errors = lintNode(node!);
    expect(errors).toEqual([]);
  });

  it('detects missing type field', async () => {
    const node = await loadNode(path.join(FIXTURES, 'invalid-nodes/missing-type.md'));
    // loadNode returns null for missing type, so we construct a synthetic node
    const syntheticNode = {
      id: 'bad-001',
      type: '' as any,
      title: 'Missing Type',
      path: '/fake/path.md',
      status: 'PROPOSED',
      tags: [],
      links: [],
      meta: {},
    };
    const errors = lintNode(syntheticNode);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'type')).toBe(true);
  });

  it('detects invalid status for node type', async () => {
    const node = await loadNode(path.join(FIXTURES, 'invalid-nodes/bad-status.md'));
    expect(node).not.toBeNull();
    const errors = lintNode(node!);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'status')).toBe(true);
  });

  it('detects confidence out of range (>1.0)', async () => {
    const node = await loadNode(path.join(FIXTURES, 'invalid-nodes/confidence-out-range.md'));
    expect(node).not.toBeNull();
    const errors = lintNode(node!);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'confidence')).toBe(true);
  });

  it('detects confidence out of range (<0.0)', () => {
    const node = {
      id: 'test-001',
      type: 'hypothesis' as const,
      title: 'Test',
      path: '/fake/path.md',
      status: 'PROPOSED',
      confidence: -0.1,
      tags: [],
      links: [],
      meta: {},
    };
    const errors = lintNode(node);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'confidence')).toBe(true);
  });

  it('detects invalid link relation', async () => {
    const node = await loadNode(path.join(FIXTURES, 'invalid-nodes/bad-link-relation.md'));
    expect(node).not.toBeNull();
    const errors = lintNode(node!);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'links')).toBe(true);
  });

  it('warns about missing confidence for hypothesis/finding', () => {
    const node = {
      id: 'hyp-test',
      type: 'hypothesis' as const,
      title: 'Test Hypothesis',
      path: '/fake/path.md',
      status: 'PROPOSED',
      confidence: undefined,
      tags: [],
      links: [],
      meta: { created: '2026-01-01', updated: '2026-01-01' },
    };
    const errors = lintNode(node);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'confidence' && e.severity === 'warning')).toBe(true);
  });
});

describe('lintGraph', () => {
  it('detects broken link target (nonexistent node)', async () => {
    const graph = await loadGraph(path.join(FIXTURES, 'graph-with-broken-link'));
    const errors = lintGraph(graph);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'links' && e.message.includes('nonexistent-999'))).toBe(true);
  });

  it('returns no errors for valid sample-graph', async () => {
    const graph = await loadGraph(path.join(FIXTURES, 'sample-graph'));
    const errors = lintGraph(graph);
    expect(errors).toEqual([]);
  });
});

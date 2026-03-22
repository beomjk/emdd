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

  it('accepts CONTESTED as valid hypothesis status', () => {
    const node = {
      id: 'hyp-test',
      type: 'hypothesis' as const,
      title: 'Contested Hypothesis',
      path: '/fake/path.md',
      status: 'CONTESTED',
      confidence: 0.5,
      tags: [],
      links: [],
      meta: { created: '2026-01-01', updated: '2026-01-01' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'status')).toBe(false);
  });

  it('accepts CONTESTED as valid decision status', () => {
    const node = {
      id: 'dec-test',
      type: 'decision' as const,
      title: 'Contested Decision',
      path: '/fake/path.md',
      status: 'CONTESTED',
      tags: [],
      links: [],
      meta: { created: '2026-01-01', updated: '2026-01-01' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'status')).toBe(false);
  });

  it('accepts resolves as valid edge relation', () => {
    const node = {
      id: 'hyp-test',
      type: 'hypothesis' as const,
      title: 'Test',
      path: '/fake/path.md',
      status: 'PROPOSED',
      confidence: 0.5,
      tags: [],
      links: [{ target: 'qst-001', relation: 'resolves' }],
      meta: { created: '2026-01-01', updated: '2026-01-01' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'links')).toBe(false);
  });

  it('rejects CONVERGED as question status (branch group only)', () => {
    const node = {
      id: 'qst-test',
      type: 'question' as const,
      title: 'Converged Question',
      path: '/fake/path.md',
      status: 'CONVERGED',
      tags: [],
      links: [],
      meta: { created: '2026-01-01', updated: '2026-01-01' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'status')).toBe(true);
  });

  it('rejects MERGED as question status (branch group only)', () => {
    const node = {
      id: 'qst-test',
      type: 'question' as const,
      title: 'Merged Question',
      path: '/fake/path.md',
      status: 'MERGED',
      tags: [],
      links: [],
      meta: { created: '2026-01-01', updated: '2026-01-01' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'status')).toBe(true);
  });

  it('rejects ABANDONED as question status (branch group only)', () => {
    const node = {
      id: 'qst-test',
      type: 'question' as const,
      title: 'Abandoned Question',
      path: '/fake/path.md',
      status: 'ABANDONED',
      tags: [],
      links: [],
      meta: { created: '2026-01-01', updated: '2026-01-01' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'status')).toBe(true);
  });
});

describe('edge attribute validation', () => {
  it('warns on strength outside 0.0-1.0', () => {
    const node = {
      id: 'test-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], meta: {},
      links: [{ target: 'hyp-001', relation: 'supports', strength: 1.5 }],
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'links' && e.severity === 'warning' && e.message.includes('strength'))).toBe(true);
  });

  it('warns on invalid severity value', () => {
    const node = {
      id: 'test-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], meta: {},
      links: [{ target: 'hyp-001', relation: 'contradicts', severity: 'INVALID' as any }],
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'links' && e.severity === 'warning' && e.message.includes('severity'))).toBe(true);
  });

  it('warns on completeness outside 0.0-1.0', () => {
    const node = {
      id: 'test-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], meta: {},
      links: [{ target: 'qst-001', relation: 'answers', completeness: -0.1 }],
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'links' && e.severity === 'warning' && e.message.includes('completeness'))).toBe(true);
  });

  it('warns on invalid dependencyType', () => {
    const node = {
      id: 'test-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], meta: {},
      links: [{ target: 'fnd-002', relation: 'depends_on', dependencyType: 'INVALID' as any }],
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'links' && e.severity === 'warning' && e.message.includes('dependencyType'))).toBe(true);
  });

  it('warns on invalid impact value', () => {
    const node = {
      id: 'test-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], meta: {},
      links: [{ target: 'hyp-001', relation: 'informs', impact: 'INVALID' as any }],
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'links' && e.severity === 'warning' && e.message.includes('impact'))).toBe(true);
  });

  it('no warning for valid attributes', () => {
    const node = {
      id: 'test-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], meta: {},
      links: [
        { target: 'hyp-001', relation: 'supports', strength: 0.8 },
        { target: 'hyp-002', relation: 'contradicts', severity: 'FATAL' as const },
        { target: 'qst-001', relation: 'answers', completeness: 0.7 },
        { target: 'fnd-002', relation: 'depends_on', dependencyType: 'LOGICAL' as const },
        { target: 'hyp-003', relation: 'informs', impact: 'DECISIVE' as const },
      ],
    };
    const errors = lintNode(node);
    expect(errors.filter(e => e.severity === 'warning')).toEqual([]);
  });

  it('no warning for absent attributes (optional)', () => {
    const node = {
      id: 'test-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], meta: {},
      links: [{ target: 'hyp-001', relation: 'supports' }],
    };
    const errors = lintNode(node);
    expect(errors.filter(e => e.severity === 'warning')).toEqual([]);
  });

  it('warns on NaN strength value', () => {
    const node = {
      id: 'test-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], meta: {},
      links: [{ target: 'hyp-001', relation: 'supports', strength: NaN }],
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.field === 'links' && e.severity === 'warning' && e.message.includes('strength'))).toBe(true);
  });
});

describe('type-specific meta validation', () => {
  it('warns on invalid finding_type value', () => {
    const node = {
      id: 'fnd-001', type: 'finding' as const, title: 'Test', path: '/fake.md',
      status: 'DRAFT', confidence: 0.5, tags: [], links: [],
      meta: { finding_type: 'invalid' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.severity === 'warning' && e.message.includes('finding_type'))).toBe(true);
  });

  it('warns on invalid urgency value', () => {
    const node = {
      id: 'qst-001', type: 'question' as const, title: 'Test', path: '/fake.md',
      status: 'OPEN', tags: [], links: [],
      meta: { urgency: 'CRITICAL' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.severity === 'warning' && e.message.includes('urgency'))).toBe(true);
  });

  it('warns on invalid risk_level value', () => {
    const node = {
      id: 'hyp-001', type: 'hypothesis' as const, title: 'Test', path: '/fake.md',
      status: 'PROPOSED', confidence: 0.5, tags: [], links: [],
      meta: { risk_level: 'critical' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.severity === 'warning' && e.message.includes('risk_level'))).toBe(true);
  });

  it('warns on invalid reversibility value', () => {
    const node = {
      id: 'dec-001', type: 'decision' as const, title: 'Test', path: '/fake.md',
      status: 'PROPOSED', tags: [], links: [],
      meta: { reversibility: 'none' },
    };
    const errors = lintNode(node);
    expect(errors.some(e => e.severity === 'warning' && e.message.includes('reversibility'))).toBe(true);
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

// ── Affinity validation in lintNode/lintGraph (T022) ──

describe('lintNode — edge attribute affinity', () => {
  it('returns no affinity errors for valid edge attributes', async () => {
    const node = await loadNode(path.join(FIXTURES, 'sample-graph/findings/fnd-002-augmentation-helps.md'));
    expect(node).not.toBeNull();
    const errors = lintNode(node!);
    // fnd-002 has supports + strength (valid affinity)
    expect(errors.filter(e => e.message.includes('affinity'))).toEqual([]);
  });

  it('reports error for supports edge with disallowed attribute (severity)', async () => {
    const node = await loadNode(path.join(FIXTURES, 'affinity-violations/findings/fnd-001-bad-supports.md'));
    expect(node).not.toBeNull();
    const errors = lintNode(node!);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('affinity'))).toBe(true);
  });

  it('reports error for relates_to edge with any attribute (no affinity entry)', async () => {
    const node = await loadNode(path.join(FIXTURES, 'affinity-violations/findings/fnd-002-bad-relates.md'));
    expect(node).not.toBeNull();
    const errors = lintNode(node!);
    expect(errors.some(e => e.severity === 'error' && e.message.includes('affinity'))).toBe(true);
  });
});

describe('lintGraph — edge attribute affinity', () => {
  it('detects affinity violations across graph', async () => {
    const graph = await loadGraph(path.join(FIXTURES, 'affinity-violations'));
    const errors = lintGraph(graph);
    const affinityErrors = errors.filter(e => e.message.includes('affinity'));
    expect(affinityErrors.length).toBeGreaterThan(0);
  });
});

describe('lintNode — NaN guard for numeric edge attributes', () => {
  it('rejects NaN values for numeric edge attributes', () => {
    const node = {
      id: 'hyp-001', type: 'hypothesis' as const, title: 'Test',
      path: '/tmp/test.md', status: 'PROPOSED', confidence: 0.5,
      tags: [], links: [{ target: 'fnd-001', relation: 'supports', strength: NaN }],
      meta: {},
    };
    const errors = lintNode(node as Parameters<typeof lintNode>[0]);
    expect(errors.some(e => e.field === 'links')).toBe(true);
  });
});

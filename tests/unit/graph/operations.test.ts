import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import matter from 'gray-matter';
import { writeFileSync, readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../fixtures');
const SAMPLE_GRAPH = path.join(FIXTURES, 'sample-graph');
const EMPTY_GRAPH = path.join(FIXTURES, 'empty-graph');

// Import operations (will be created in GREEN phase)
import {
  listNodes,
  readNode,
  createNode,
  createEdge,
  getHealth,
  checkConsolidation,
  getPromotionCandidates,
} from '../../../src/graph/operations.js';

// Helper to create a minimal EMDD project with nodes
function setupProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'emdd-ops-'));
  const graph = join(dir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graph, sub), { recursive: true });
  }
  return dir;
}

function writeNode(dir: string, subdir: string, filename: string, frontmatter: Record<string, unknown>, body: string = '') {
  const content = matter.stringify(body, frontmatter);
  writeFileSync(join(dir, 'graph', subdir, filename), content);
}

describe('listNodes', () => {
  it('returns all nodes from a valid graph directory', async () => {
    const nodes = await listNodes(SAMPLE_GRAPH);
    expect(nodes.length).toBe(14);
  });

  it('filters nodes by type', async () => {
    const findings = await listNodes(SAMPLE_GRAPH, { type: 'finding' });
    expect(findings.length).toBe(5);
    expect(findings.every(n => n.type === 'finding')).toBe(true);
  });

  it('filters nodes by status', async () => {
    const validated = await listNodes(SAMPLE_GRAPH, { status: 'VALIDATED' });
    expect(validated.length).toBeGreaterThan(0);
    expect(validated.every(n => n.status === 'VALIDATED')).toBe(true);
  });

  it('returns empty array for empty directory', async () => {
    const nodes = await listNodes(EMPTY_GRAPH);
    expect(nodes).toEqual([]);
  });
});

describe('readNode', () => {
  it('returns full node data by ID', async () => {
    const detail = await readNode(SAMPLE_GRAPH, 'hyp-001');
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe('hyp-001');
    expect(detail!.type).toBe('hypothesis');
    expect(detail!.title).toBe('Surface Defect Detection via CNN');
  });

  it('returns null for non-existent node ID', async () => {
    const detail = await readNode(SAMPLE_GRAPH, 'nonexistent-999');
    expect(detail).toBeNull();
  });

  it('includes parsed frontmatter and body', async () => {
    const detail = await readNode(SAMPLE_GRAPH, 'hyp-001');
    expect(detail).not.toBeNull();
    expect(detail!.body).toContain('Hypothesis');
    expect(detail!.body).toContain('Rationale');
    expect(detail!.status).toBe('TESTING');
    expect(detail!.confidence).toBe(0.6);
  });
});

describe('createNode', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates a hypothesis node with correct template', async () => {
    const result = await createNode(join(tmpDir, 'graph'), 'hypothesis', 'test-idea');
    expect(result.id).toMatch(/^hyp-\d{3}$/);
    expect(result.type).toBe('hypothesis');
    expect(result.path).toContain('hypotheses');
    // Verify file was actually created
    const content = readFileSync(result.path, 'utf-8');
    expect(content).toContain('hypothesis');
  });

  it('creates a node with auto-incremented ID', async () => {
    const r1 = await createNode(join(tmpDir, 'graph'), 'finding', 'first');
    const r2 = await createNode(join(tmpDir, 'graph'), 'finding', 'second');
    expect(r1.id).toBe('fnd-001');
    expect(r2.id).toBe('fnd-002');
  });

  it('respects lang parameter for template body', async () => {
    const result = await createNode(join(tmpDir, 'graph'), 'hypothesis', 'korean-test', 'ko');
    const content = readFileSync(result.path, 'utf-8');
    expect(content).toContain('가설');
  });

  it('throws on invalid node type', async () => {
    await expect(
      createNode(join(tmpDir, 'graph'), 'invalid_type' as any, 'test')
    ).rejects.toThrow();
  });
});

describe('createEdge', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('adds SUPPORTS edge between two nodes', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'Test Exp',
      status: 'COMPLETED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await createEdge(join(tmpDir, 'graph'), 'exp-001', 'hyp-001', 'supports');
    expect(result.source).toBe('exp-001');
    expect(result.target).toBe('hyp-001');
    expect(result.relation).toBe('supports');

    // Verify the link was actually written
    const content = readFileSync(join(tmpDir, 'graph', 'experiments', 'exp-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.links).toContainEqual(
      expect.objectContaining({ target: 'hyp-001', relation: 'supports' })
    );
  });

  it('fails when source node does not exist', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await expect(
      createEdge(join(tmpDir, 'graph'), 'nonexistent-001', 'hyp-001', 'supports')
    ).rejects.toThrow();
  });

  it('fails when target node does not exist', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await expect(
      createEdge(join(tmpDir, 'graph'), 'hyp-001', 'nonexistent-001', 'supports')
    ).rejects.toThrow();
  });

  it('fails on invalid relation type', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await expect(
      createEdge(join(tmpDir, 'graph'), 'hyp-001', 'hyp-001', 'invalid_relation')
    ).rejects.toThrow();
  });
});

describe('getHealth', () => {
  it('returns health report with node/edge counts', async () => {
    const report = await getHealth(SAMPLE_GRAPH);
    expect(report.totalNodes).toBe(14);
    expect(report.totalEdges).toBeGreaterThan(0);
    expect(typeof report.linkDensity).toBe('number');
  });

  it('includes status distribution', async () => {
    const report = await getHealth(SAMPLE_GRAPH);
    expect(report.statusDistribution).toBeDefined();
    expect(report.statusDistribution['hypothesis']).toBeDefined();
    expect(report.statusDistribution['hypothesis']['TESTING']).toBeGreaterThan(0);
  });

  it('flags structural gaps', async () => {
    const report = await getHealth(SAMPLE_GRAPH);
    // gaps is an array of string descriptions
    expect(Array.isArray(report.gaps)).toBe(true);
  });
});

describe('checkConsolidation', () => {
  it('triggers when finding count exceeds threshold', async () => {
    // sample-graph has 5 findings, threshold is 5 unpromoted
    const result = await checkConsolidation(SAMPLE_GRAPH);
    expect(result.triggers.some(t => t.type === 'findings')).toBe(true);
  });

  it('does not trigger below threshold', async () => {
    const result = await checkConsolidation(EMPTY_GRAPH);
    expect(result.triggers).toEqual([]);
  });

  it('includes episode count in result', async () => {
    // sample-graph has 3 episodes, threshold is 3
    const result = await checkConsolidation(SAMPLE_GRAPH);
    const episodeTrigger = result.triggers.find(t => t.type === 'episodes');
    expect(episodeTrigger).toBeDefined();
    expect(episodeTrigger!.count).toBe(3);
  });
});

describe('getPromotionCandidates', () => {
  it('identifies hypotheses with sufficient evidence', async () => {
    // fnd-002 has confidence 0.82 and 2 supports links
    const candidates = await getPromotionCandidates(SAMPLE_GRAPH);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some(c => c.id === 'fnd-002')).toBe(true);
  });

  it('returns empty when no candidates exist', async () => {
    const candidates = await getPromotionCandidates(EMPTY_GRAPH);
    expect(candidates).toEqual([]);
  });

  it('includes confidence scores', async () => {
    const candidates = await getPromotionCandidates(SAMPLE_GRAPH);
    for (const c of candidates) {
      expect(typeof c.confidence).toBe('number');
      expect(c.confidence).toBeGreaterThanOrEqual(0.8);
      expect(typeof c.supports).toBe('number');
      expect(c.supports).toBeGreaterThanOrEqual(2);
    }
  });
});

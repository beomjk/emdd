import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
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
  planCreateNode,
  planCreateEdge,
  executeOps,
  getHealth,
  checkConsolidation,
  getPromotionCandidates,
  getNeighbors,
  updateNode,
  deleteEdge,
  markDone,
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

  it('creates edge with strength attribute', async () => {
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

    const result = await createEdge(join(tmpDir, 'graph'), 'exp-001', 'hyp-001', 'supports', { strength: 0.8 });
    expect(result.strength).toBe(0.8);

    const content = readFileSync(join(tmpDir, 'graph', 'experiments', 'exp-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.links[0].strength).toBe(0.8);
  });

  it('creates edge with severity attribute', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test Finding',
      status: 'VALIDATED', confidence: 0.7,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'TESTING', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await createEdge(join(tmpDir, 'graph'), 'fnd-001', 'hyp-001', 'contradicts', { severity: 'FATAL' });
    expect(result.severity).toBe('FATAL');

    const content = readFileSync(join(tmpDir, 'graph', 'findings', 'fnd-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.links[0].severity).toBe('FATAL');
  });

  it('creates edge with multiple attributes', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test Finding',
      status: 'VALIDATED', confidence: 0.7,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'questions', 'qst-001-test.md', {
      id: 'qst-001', type: 'question', title: 'Test Q',
      status: 'OPEN',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await createEdge(join(tmpDir, 'graph'), 'fnd-001', 'qst-001', 'answers', { completeness: 0.7 });
    expect(result.completeness).toBe(0.7);
    expect(result.relation).toBe('answers');
  });

  it('throws on invalid strength range', async () => {
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

    await expect(
      createEdge(join(tmpDir, 'graph'), 'exp-001', 'hyp-001', 'supports', { strength: 1.5 })
    ).rejects.toThrow(/strength/);
  });

  it('throws on invalid severity value', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test Finding',
      status: 'VALIDATED', confidence: 0.7,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'TESTING', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await expect(
      createEdge(join(tmpDir, 'graph'), 'fnd-001', 'hyp-001', 'contradicts', { severity: 'INVALID' as any })
    ).rejects.toThrow(/severity/);
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

// @spec §6.8.1
describe('getHealth — structural gaps §6.8', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('detects untested hypotheses (PROPOSED + created N+ days ago)', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: oldDate, updated: oldDate, tags: [], links: [],
    });

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(true);
  });

  it('detects blocking questions (OPEN + urgency=BLOCKING + N+ days)', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'questions', 'qst-001-test.md', {
      id: 'qst-001', type: 'question', title: 'Test', status: 'OPEN',
      urgency: 'BLOCKING', created: oldDate, updated: oldDate, tags: [], links: [],
    });

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'blocking_question')).toBe(true);
  });

  it('detects orphan findings (0 outgoing spawns/answers/extends)', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test', status: 'DRAFT',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'orphan_finding')).toBe(true);
  });

  it('detects stale knowledge (source date > N days + newer knowledge exists)', async () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recentDate = new Date().toISOString().slice(0, 10);
    writeNode(tmpDir, 'knowledge', 'knw-001-old.md', {
      id: 'knw-001', type: 'knowledge', title: 'Old', status: 'ACTIVE',
      confidence: 0.9, created: oldDate, updated: oldDate, tags: [], links: [],
    });
    writeNode(tmpDir, 'knowledge', 'knw-002-new.md', {
      id: 'knw-002', type: 'knowledge', title: 'New', status: 'ACTIVE',
      confidence: 0.9, created: recentDate, updated: recentDate, tags: [], links: [],
    });

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'stale_knowledge')).toBe(true);
  });

  it('detects disconnected clusters', async () => {
    // Two nodes with no links between them
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'PROPOSED',
      confidence: 0.5, created: '2026-03-17', updated: '2026-03-17', tags: [], links: [],
    });
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'DRAFT',
      confidence: 0.5, created: '2026-03-17', updated: '2026-03-17', tags: [], links: [],
    });

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'disconnected_cluster')).toBe(true);
  });

  it('uses default thresholds when no .emdd.yml', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: oldDate, updated: oldDate, tags: [], links: [],
    });

    // No .emdd.yml exists, should use defaults (untested_days: 5)
    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(true);
  });

  it('uses custom thresholds from config', async () => {
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: oldDate, updated: oldDate, tags: [], links: [],
    });

    // Create config with low threshold (2 days)
    writeFileSync(join(tmpDir, '.emdd.yml'), 'gaps:\n  untested_days: 2\n');

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(true);
  });

  it('existing 4 basic gaps still work', async () => {
    const report = await getHealth(SAMPLE_GRAPH);
    expect(Array.isArray(report.gaps)).toBe(true);
    expect(Array.isArray(report.gapDetails)).toBe(true);
  });

  it('includes deferred items in health report', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-deferred.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Deferred H',
      status: 'DEFERRED', confidence: 0.3,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode(tmpDir, 'questions', 'qst-001-deferred.md', {
      id: 'qst-001', type: 'question', title: 'Deferred Q',
      status: 'DEFERRED',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.deferredItems).toBeDefined();
    expect(report.deferredItems).toContain('hyp-001');
    expect(report.deferredItems).toContain('qst-001');
    expect(report.deferredItems.length).toBe(2);
  });

  it('returns empty deferredItems when none exist', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-active.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Active H',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-03-17', updated: '2026-03-17', tags: [], links: [],
    });

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.deferredItems).toBeDefined();
    expect(report.deferredItems).toEqual([]);
  });

  // ── Episode-based dual-trigger gap detection ──────────────────────

  it('detects untested_hypothesis via episode trigger only', async () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: recentDate, updated: recentDate, tags: [], links: [],
    });
    // 4 episodes created after hypothesis updated date
    const afterDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (let i = 1; i <= 4; i++) {
      writeNode(tmpDir, 'episodes', `ep-00${i}-test.md`, {
        id: `ep-00${i}`, type: 'episode', title: `Ep ${i}`,
        created: afterDate, updated: afterDate, tags: [], links: [],
      });
    }
    writeFileSync(join(tmpDir, '.emdd.yml'), 'gaps:\n  untested_episodes: 3\n  untested_days: 5\n');

    const report = await getHealth(join(tmpDir, 'graph'));
    const gap = report.gapDetails.find(g => g.type === 'untested_hypothesis');
    expect(gap).toBeDefined();
    expect(gap!.triggerType).toBe('episodes');
  });

  it('detects untested_hypothesis via day trigger only (no episodes)', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: oldDate, updated: oldDate, tags: [], links: [],
    });
    // No episodes

    const report = await getHealth(join(tmpDir, 'graph'));
    const gap = report.gapDetails.find(g => g.type === 'untested_hypothesis');
    expect(gap).toBeDefined();
    expect(gap!.triggerType).toBe('days');
  });

  it('reports triggerType=both when day and episode triggers both met', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: oldDate, updated: oldDate, tags: [], links: [],
    });
    const afterDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (let i = 1; i <= 4; i++) {
      writeNode(tmpDir, 'episodes', `ep-00${i}-test.md`, {
        id: `ep-00${i}`, type: 'episode', title: `Ep ${i}`,
        created: afterDate, updated: afterDate, tags: [], links: [],
      });
    }
    writeFileSync(join(tmpDir, '.emdd.yml'), 'gaps:\n  untested_episodes: 3\n');

    const report = await getHealth(join(tmpDir, 'graph'));
    const gap = report.gapDetails.find(g => g.type === 'untested_hypothesis');
    expect(gap).toBeDefined();
    expect(gap!.triggerType).toBe('both');
  });

  it('reports no gap when neither trigger is met', async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: recentDate, updated: recentDate, tags: [], links: [],
    });
    // 1 episode (below threshold of 5)
    writeNode(tmpDir, 'episodes', 'ep-001-test.md', {
      id: 'ep-001', type: 'episode', title: 'Ep 1',
      created: recentDate, updated: recentDate, tags: [], links: [],
    });
    writeFileSync(join(tmpDir, '.emdd.yml'), 'gaps:\n  untested_episodes: 5\n  untested_days: 5\n');

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(false);
  });

  it('detects blocking_question via episode trigger', async () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'questions', 'qst-001-test.md', {
      id: 'qst-001', type: 'question', title: 'Blocker', status: 'OPEN',
      urgency: 'BLOCKING', created: recentDate, updated: recentDate, tags: [], links: [],
    });
    const afterDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (let i = 1; i <= 4; i++) {
      writeNode(tmpDir, 'episodes', `ep-00${i}-test.md`, {
        id: `ep-00${i}`, type: 'episode', title: `Ep ${i}`,
        created: afterDate, updated: afterDate, tags: [], links: [],
      });
    }
    writeFileSync(join(tmpDir, '.emdd.yml'), 'gaps:\n  blocking_episodes: 3\n  blocking_days: 10\n');

    const report = await getHealth(join(tmpDir, 'graph'));
    const gap = report.gapDetails.find(g => g.type === 'blocking_question');
    expect(gap).toBeDefined();
    expect(gap!.triggerType).toBe('episodes');
  });

  it('stale_knowledge ignores episodes (day-only)', async () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recentDate = new Date().toISOString().slice(0, 10);
    writeNode(tmpDir, 'knowledge', 'knw-001-old.md', {
      id: 'knw-001', type: 'knowledge', title: 'Old', status: 'ACTIVE',
      confidence: 0.9, created: oldDate, updated: oldDate, tags: [], links: [],
    });
    writeNode(tmpDir, 'knowledge', 'knw-002-new.md', {
      id: 'knw-002', type: 'knowledge', title: 'New', status: 'ACTIVE',
      confidence: 0.9, created: recentDate, updated: recentDate, tags: [], links: [],
    });
    // No episodes

    const report = await getHealth(join(tmpDir, 'graph'));
    const gap = report.gapDetails.find(g => g.type === 'stale_knowledge');
    expect(gap).toBeDefined();
    expect(gap!.triggerType).toBeUndefined();
  });

  it('uses default episode thresholds when no .emdd.yml', async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: recentDate, updated: recentDate, tags: [], links: [],
    });
    // 4 episodes (default untested_episodes: 3, so >= 3 met)
    const afterDate = new Date().toISOString().slice(0, 10);
    for (let i = 1; i <= 4; i++) {
      writeNode(tmpDir, 'episodes', `ep-00${i}-test.md`, {
        id: `ep-00${i}`, type: 'episode', title: `Ep ${i}`,
        created: afterDate, updated: afterDate, tags: [], links: [],
      });
    }
    // No .emdd.yml — should use default untested_episodes: 3

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(true);
  });

  it('respects custom episode threshold from .emdd.yml', async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: recentDate, updated: recentDate, tags: [], links: [],
    });
    const afterDate = new Date().toISOString().slice(0, 10);
    for (let i = 1; i <= 2; i++) {
      writeNode(tmpDir, 'episodes', `ep-00${i}-test.md`, {
        id: `ep-00${i}`, type: 'episode', title: `Ep ${i}`,
        created: afterDate, updated: afterDate, tags: [], links: [],
      });
    }
    writeFileSync(join(tmpDir, '.emdd.yml'), 'gaps:\n  untested_episodes: 2\n  untested_days: 99\n');

    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(true);
  });

  it('only counts episodes created after node updated date', async () => {
    const updatedDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: updatedDate, updated: updatedDate, tags: [], links: [],
    });
    // 1 episode BEFORE updated date
    const beforeDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'episodes', 'ep-001-old.md', {
      id: 'ep-001', type: 'episode', title: 'Old Ep',
      created: beforeDate, updated: beforeDate, tags: [], links: [],
    });
    // 2 episodes AFTER updated date
    const afterDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (let i = 2; i <= 3; i++) {
      writeNode(tmpDir, 'episodes', `ep-00${i}-new.md`, {
        id: `ep-00${i}`, type: 'episode', title: `New Ep ${i}`,
        created: afterDate, updated: afterDate, tags: [], links: [],
      });
    }
    writeFileSync(join(tmpDir, '.emdd.yml'), 'gaps:\n  untested_episodes: 3\n  untested_days: 99\n');

    // Only 2 episodes after updated, threshold is 3 → not detected
    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(false);
  });

  it('skips episodes without created field in count', async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test', status: 'PROPOSED',
      confidence: 0.5, created: recentDate, updated: recentDate, tags: [], links: [],
    });
    // Episode without created field
    writeNode(tmpDir, 'episodes', 'ep-001-nocreated.md', {
      id: 'ep-001', type: 'episode', title: 'No Created',
      updated: recentDate, tags: [], links: [],
    });
    writeFileSync(join(tmpDir, '.emdd.yml'), 'gaps:\n  untested_episodes: 1\n  untested_days: 99\n');

    // Episode has no created → count 0, threshold 1 → not detected, no error
    const report = await getHealth(join(tmpDir, 'graph'));
    expect(report.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(false);
  });
});

// @spec §6.9.1
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

  it('includes promotion evaluation for each unpromoted finding', async () => {
    const result = await checkConsolidation(SAMPLE_GRAPH);
    expect(result.promotionCandidates).toBeDefined();
    expect(Array.isArray(result.promotionCandidates)).toBe(true);
  });

  it('includes orphan cleanup suggestions', async () => {
    const result = await checkConsolidation(SAMPLE_GRAPH);
    expect(result.orphanFindings).toBeDefined();
    expect(Array.isArray(result.orphanFindings)).toBe(true);
  });

  it('includes deferred items review', async () => {
    const result = await checkConsolidation(SAMPLE_GRAPH);
    expect(result.deferredItems).toBeDefined();
    expect(Array.isArray(result.deferredItems)).toBe(true);
  });

  it('does not trigger experiment_overload when produces < 5', async () => {
    // sample-graph exp-001 has only 1 produces link
    const result = await checkConsolidation(SAMPLE_GRAPH);
    expect(result.triggers.some(t => t.type === 'experiment_overload')).toBe(false);
  });

  it('triggers experiment_overload when experiment has 5+ findings', async () => {
    const tmpDir = setupProject();
    try {
      writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
        id: 'exp-001', type: 'experiment', title: 'Big Exp', status: 'COMPLETED',
        created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [
          { target: 'fnd-001', relation: 'produces' },
          { target: 'fnd-002', relation: 'produces' },
          { target: 'fnd-003', relation: 'produces' },
          { target: 'fnd-004', relation: 'produces' },
          { target: 'fnd-005', relation: 'produces' },
        ],
      });
      for (let i = 1; i <= 5; i++) {
        writeNode(tmpDir, 'findings', `fnd-00${i}-test.md`, {
          id: `fnd-00${i}`, type: 'finding', title: `F${i}`, status: 'VALIDATED',
          confidence: 0.7, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
        });
      }

      const result = await checkConsolidation(join(tmpDir, 'graph'));
      const overload = result.triggers.find(t => t.type === 'experiment_overload');
      expect(overload).toBeDefined();
      expect(overload!.count).toBe(5);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('getPromotionCandidates', () => {
  it('returns empty when no candidates exist', async () => {
    const candidates = await getPromotionCandidates(EMPTY_GRAPH);
    expect(candidates).toEqual([]);
  });

  it('threshold is 0.9 (not 0.8) — spec §6.2', async () => {
    let tmpDir2 = setupProject();
    try {
      writeNode(tmpDir2, 'findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.85, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [
          { target: 'hyp-001', relation: 'supports' },
          { target: 'hyp-002', relation: 'supports' },
        ],
      });
      writeNode(tmpDir2, 'hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode(tmpDir2, 'hypotheses', 'hyp-002-test.md', {
        id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });

      const candidates = await getPromotionCandidates(join(tmpDir2, 'graph'));
      // 0.85 < 0.9, so should NOT be a candidate by confidence alone
      expect(candidates.some(c => c.id === 'fnd-001' && c.reason === 'confidence')).toBe(false);
    } finally {
      rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  it('candidate with active CONTRADICTS edge is excluded', async () => {
    let tmpDir2 = setupProject();
    try {
      writeNode(tmpDir2, 'findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.95, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [
          { target: 'hyp-001', relation: 'supports' },
          { target: 'hyp-002', relation: 'supports' },
        ],
      });
      writeNode(tmpDir2, 'hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode(tmpDir2, 'hypotheses', 'hyp-002-test.md', {
        id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      // Something contradicts fnd-001
      writeNode(tmpDir2, 'findings', 'fnd-002-test.md', {
        id: 'fnd-002', type: 'finding', title: 'F2', status: 'VALIDATED',
        confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [
          { target: 'fnd-001', relation: 'contradicts', severity: 'WEAKENING' },
        ],
      });

      const candidates = await getPromotionCandidates(join(tmpDir2, 'graph'));
      expect(candidates.some(c => c.id === 'fnd-001')).toBe(false);
    } finally {
      rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  it('de facto candidate (referenced as premise) qualifies even below 0.9', async () => {
    let tmpDir2 = setupProject();
    try {
      writeNode(tmpDir2, 'findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.85, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [
          { target: 'hyp-001', relation: 'supports' },
          { target: 'hyp-002', relation: 'supports' },
        ],
      });
      writeNode(tmpDir2, 'hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'fnd-001', relation: 'depends_on' }],
      });
      writeNode(tmpDir2, 'hypotheses', 'hyp-002-test.md', {
        id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });

      const candidates = await getPromotionCandidates(join(tmpDir2, 'graph'));
      // fnd-001 is de facto in use (hyp-001 depends_on it), so should qualify
      expect(candidates.some(c => c.id === 'fnd-001')).toBe(true);
    } finally {
      rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  it('at least one criterion met → included (OR logic)', async () => {
    let tmpDir2 = setupProject();
    try {
      // High confidence, qualifies by confidence criterion
      writeNode(tmpDir2, 'findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.95, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [
          { target: 'hyp-001', relation: 'supports' },
          { target: 'hyp-002', relation: 'supports' },
        ],
      });
      writeNode(tmpDir2, 'hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode(tmpDir2, 'hypotheses', 'hyp-002-test.md', {
        id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });

      const candidates = await getPromotionCandidates(join(tmpDir2, 'graph'));
      expect(candidates.some(c => c.id === 'fnd-001')).toBe(true);
    } finally {
      rmSync(tmpDir2, { recursive: true, force: true });
    }
  });
});

describe('planCreateNode', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns plan without creating files', () => {
    const plan = planCreateNode(join(tmpDir, 'graph'), 'hypothesis', 'test-idea');
    expect(plan.id).toMatch(/^hyp-\d{3}$/);
    expect(plan.type).toBe('hypothesis');
    expect(plan.ops.length).toBeGreaterThan(0);
    // File should NOT exist yet
    expect(existsSync(plan.path)).toBe(false);
  });

  it('sanitizes slug in the plan', () => {
    const plan = planCreateNode(join(tmpDir, 'graph'), 'hypothesis', '../../bad-path');
    expect(plan.path).not.toContain('..');
    expect(plan.path).toContain('bad-path');
  });

  it('creates files after executeOps', async () => {
    const plan = planCreateNode(join(tmpDir, 'graph'), 'finding', 'my-finding');
    await executeOps(plan.ops);
    expect(existsSync(plan.path)).toBe(true);
    const content = readFileSync(plan.path, 'utf-8');
    expect(content).toContain('finding');
  });
});

describe('planCreateEdge', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns plan with write operation', async () => {
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

    const plan = await planCreateEdge(join(tmpDir, 'graph'), 'exp-001', 'hyp-001', 'supports');
    expect(plan.source).toBe('exp-001');
    expect(plan.target).toBe('hyp-001');
    expect(plan.relation).toBe('supports');
    expect(plan.ops.length).toBe(1);
    expect(plan.ops[0].kind).toBe('write');
  });

  it('creates link after executeOps', async () => {
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

    const plan = await planCreateEdge(join(tmpDir, 'graph'), 'exp-001', 'hyp-001', 'supports');
    await executeOps(plan.ops);

    const content = readFileSync(join(tmpDir, 'graph', 'experiments', 'exp-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.links).toContainEqual(
      expect.objectContaining({ target: 'hyp-001', relation: 'supports' })
    );
  });
});

describe('getNeighbors', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = setupProject();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns directly connected neighbors at depth=1', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [{ target: 'exp-001', relation: 'tests' }],
    });
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'E1', status: 'RUNNING',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const neighbors = await getNeighbors(join(tmpDir, 'graph'), 'hyp-001');
    expect(neighbors.length).toBe(1);
    expect(neighbors[0].id).toBe('exp-001');
    expect(neighbors[0].direction).toBe('outgoing');
  });

  it('returns 2-hop neighbors at depth=2', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [{ target: 'exp-001', relation: 'tests' }],
    });
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'E1', status: 'COMPLETED',
      created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'fnd-001', relation: 'produces' }],
    });
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const neighbors = await getNeighbors(join(tmpDir, 'graph'), 'hyp-001', 2);
    expect(neighbors.length).toBe(2);
    expect(neighbors.some(n => n.id === 'exp-001' && n.depth === 1)).toBe(true);
    expect(neighbors.some(n => n.id === 'fnd-001' && n.depth === 2)).toBe(true);
  });

  it('throws error for non-existent node', async () => {
    await expect(
      getNeighbors(join(tmpDir, 'graph'), 'hyp-999')
    ).rejects.toThrow('Node not found: hyp-999');
  });

  it('returns incoming neighbors', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });

    const neighbors = await getNeighbors(join(tmpDir, 'graph'), 'hyp-001');
    expect(neighbors.length).toBe(1);
    expect(neighbors[0].id).toBe('fnd-001');
    expect(neighbors[0].direction).toBe('incoming');
  });
});

describe('updateNode', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('updates frontmatter fields and returns result', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await updateNode(join(tmpDir, 'graph'), 'hyp-001', { status: 'TESTING' });
    expect(result.nodeId).toBe('hyp-001');
    expect(result.updatedFields).toEqual(['status']);
    expect(result.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const content = readFileSync(join(tmpDir, 'graph', 'hypotheses', 'hyp-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.status).toBe('TESTING');
  });

  it('parses confidence as number', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await updateNode(join(tmpDir, 'graph'), 'hyp-001', { confidence: '0.8' });
    const content = readFileSync(join(tmpDir, 'graph', 'hypotheses', 'hyp-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.confidence).toBe(0.8);
  });

  it('throws on invalid confidence', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await expect(
      updateNode(join(tmpDir, 'graph'), 'hyp-001', { confidence: '1.5' })
    ).rejects.toThrow(/confidence/);
  });

  it('throws on nonexistent node', async () => {
    await expect(
      updateNode(join(tmpDir, 'graph'), 'hyp-999', { status: 'TESTING' })
    ).rejects.toThrow(/not found/);
  });
});

describe('deleteEdge', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('deletes a specific link by relation', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.7, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const result = await deleteEdge(join(tmpDir, 'graph'), 'fnd-001', 'hyp-001', 'supports');
    expect(result.deletedCount).toBe(1);
    expect(result.deletedRelations).toEqual(['supports']);

    const content = readFileSync(join(tmpDir, 'graph', 'findings', 'fnd-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.links).toEqual([]);
  });

  it('deletes all links to target when relation omitted', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.7, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [
        { target: 'hyp-001', relation: 'supports' },
        { target: 'hyp-001', relation: 'informs' },
        { target: 'hyp-002', relation: 'supports' },
      ],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const result = await deleteEdge(join(tmpDir, 'graph'), 'fnd-001', 'hyp-001');
    expect(result.deletedCount).toBe(2);

    const content = readFileSync(join(tmpDir, 'graph', 'findings', 'fnd-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.links).toHaveLength(1);
    expect(parsed.data.links[0].target).toBe('hyp-002');
  });

  it('normalizes reverse labels', async () => {
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'E1', status: 'COMPLETED',
      created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'tests' }],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    // 'tested_by' is a reverse label of 'tests'
    const result = await deleteEdge(join(tmpDir, 'graph'), 'exp-001', 'hyp-001', 'tested_by');
    expect(result.deletedCount).toBe(1);
  });

  it('throws when no matching link found', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.7, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-002', relation: 'supports' }],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    await expect(
      deleteEdge(join(tmpDir, 'graph'), 'fnd-001', 'hyp-001', 'supports')
    ).rejects.toThrow(/No matching link/);
  });

  it('throws on nonexistent source', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    await expect(
      deleteEdge(join(tmpDir, 'graph'), 'fnd-999', 'hyp-001', 'supports')
    ).rejects.toThrow(/Source node not found/);
  });

  it('auto-updates the updated field', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.7, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports' }],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    await deleteEdge(join(tmpDir, 'graph'), 'fnd-001', 'hyp-001', 'supports');
    const content = readFileSync(join(tmpDir, 'graph', 'findings', 'fnd-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.updated).not.toBe('2026-01-01');
  });
});

describe('markDone', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('marks a checklist item and returns result', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    }, '## Checklist\n- [ ] Do something\n- [ ] Do another thing\n');

    const result = await markDone(join(tmpDir, 'graph'), 'epi-001', 'Do something');
    expect(result.episodeId).toBe('epi-001');
    expect(result.item).toBe('Do something');
    expect(result.marker).toBe('done');

    const content = readFileSync(join(tmpDir, 'graph', 'episodes', 'epi-001-test.md'), 'utf-8');
    expect(content).toContain('- [done] Do something');
    expect(content).toContain('- [ ] Do another thing');
  });

  it('supports different markers', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    }, '## Checklist\n- [ ] Deferred task\n');

    const result = await markDone(join(tmpDir, 'graph'), 'epi-001', 'Deferred task', 'deferred');
    expect(result.marker).toBe('deferred');

    const content = readFileSync(join(tmpDir, 'graph', 'episodes', 'epi-001-test.md'), 'utf-8');
    expect(content).toContain('- [deferred] Deferred task');
  });

  it('throws on already marked item', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    }, '## Checklist\n- [done] Already done\n');

    await expect(
      markDone(join(tmpDir, 'graph'), 'epi-001', 'Already done')
    ).rejects.toThrow(/already marked/);
  });

  it('throws on item not found', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    }, '## Checklist\n- [ ] Some task\n');

    await expect(
      markDone(join(tmpDir, 'graph'), 'epi-001', 'Nonexistent task')
    ).rejects.toThrow(/not found/);
  });

  it('throws on nonexistent node', async () => {
    await expect(
      markDone(join(tmpDir, 'graph'), 'epi-999', 'Some task')
    ).rejects.toThrow(/not found/);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

import { listNodesDef } from '../../../src/registry/commands/list-nodes.js';
import { readNodeDef } from '../../../src/registry/commands/read-node.js';
import { healthDef } from '../../../src/registry/commands/health.js';
import { checkDef } from '../../../src/registry/commands/check.js';
import { lintDef } from '../../../src/registry/commands/lint.js';
import { neighborsDef } from '../../../src/registry/commands/neighbors.js';
import { backlogDef } from '../../../src/registry/commands/backlog.js';
import { readNodesDef } from '../../../src/registry/commands/read-nodes.js';
import { gapsDef } from '../../../src/registry/commands/gaps.js';
import { promoteDef } from '../../../src/registry/commands/promote.js';
import { analyzeRefutationDef } from '../../../src/registry/commands/analyze-refutation.js';
import { branchGroupsDef } from '../../../src/registry/commands/branch-groups.js';
import { confidencePropagateDef } from '../../../src/registry/commands/confidence-propagate.js';
import { transitionsDef } from '../../../src/registry/commands/transitions.js';
import { killCheckDef } from '../../../src/registry/commands/kill-check.js';
import { createNodeDef } from '../../../src/registry/commands/create-node.js';
import { createEdgeDef } from '../../../src/registry/commands/create-edge.js';
import { updateNodeDef } from '../../../src/registry/commands/update-node.js';
import { deleteEdgeDef } from '../../../src/registry/commands/delete-edge.js';
import { markDoneDef } from '../../../src/registry/commands/mark-done.js';
import { markConsolidatedDef } from '../../../src/registry/commands/mark-consolidated.js';
import { indexGraphDef } from '../../../src/registry/commands/index-graph.js';

function setupProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'emdd-exec-'));
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

describe('command execute() wiring', () => {
  it('list-nodes returns all nodes from sample graph', async () => {
    const result = await listNodesDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(14);
    expect(result.some((n: { id: string }) => n.id === 'hyp-001')).toBe(true);
  });

  it('list-nodes filters by type', async () => {
    const result = await listNodesDef.execute({ graphDir: SAMPLE_GRAPH, type: 'finding' });
    expect(result.every((n: { type: string }) => n.type === 'finding')).toBe(true);
    expect(result.length).toBe(5);
  });

  it('read-node returns detail for existing node', async () => {
    const result = await readNodeDef.execute({ graphDir: SAMPLE_GRAPH, nodeId: 'hyp-001' });
    expect(result.id).toBe('hyp-001');
    expect(result.type).toBe('hypothesis');
    expect(result.title).toBeTruthy();
  });

  it('read-node throws for missing node', async () => {
    await expect(readNodeDef.execute({ graphDir: SAMPLE_GRAPH, nodeId: 'hyp-999' }))
      .rejects.toThrow();
  });

  it('health returns valid report', async () => {
    const result = await healthDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(result.totalNodes).toBe(14);
    expect(typeof result.linkDensity).toBe('number');
    expect(result.byType).toBeDefined();
  });

  it('check returns valid consolidation result', async () => {
    const result = await checkDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result.triggers)).toBe(true);
    expect(Array.isArray(result.promotionCandidates)).toBe(true);
    expect(Array.isArray(result.orphanFindings)).toBe(true);
  });

  it('lint returns clean result for sample graph', async () => {
    const result = await lintDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(result.errorCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  // --- Read-only commands using SAMPLE_GRAPH fixture ---

  it('neighbors returns neighbor nodes for hyp-001', async () => {
    const result = await neighborsDef.execute({ graphDir: SAMPLE_GRAPH, nodeId: 'hyp-001', depth: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('direction');
    expect(result[0]).toHaveProperty('relation');
  });

  it('backlog returns backlog items', async () => {
    const result = await backlogDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('read-nodes returns details for multiple nodes', async () => {
    const result = await readNodesDef.execute({ graphDir: SAMPLE_GRAPH, nodeIds: ['hyp-001', 'fnd-001'] });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    const ids = result.map((n: { id: string }) => n.id).sort();
    expect(ids).toEqual(['fnd-001', 'hyp-001']);
  });

  it('gaps returns gap analysis', async () => {
    const result = await gapsDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(result).toHaveProperty('gaps');
    expect(result).toHaveProperty('gapDetails');
    expect(Array.isArray(result.gaps)).toBe(true);
    expect(Array.isArray(result.gapDetails)).toBe(true);
  });

  it('promote returns promotion candidates', async () => {
    const result = await promoteDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result)).toBe(true);
    // Each candidate should have id, confidence, supports, reason
    for (const c of result) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('confidence');
      expect(c).toHaveProperty('supports');
      expect(c).toHaveProperty('reason');
    }
  });

  it('analyze-refutation returns refutation analysis', async () => {
    const result = await analyzeRefutationDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(result).toHaveProperty('affectedHypotheses');
    expect(result).toHaveProperty('pivotCeremonyTriggered');
    expect(result).toHaveProperty('retractedKnowledgeIds');
    expect(Array.isArray(result.affectedHypotheses)).toBe(true);
  });

  it('branch-groups returns branch group array', async () => {
    const result = await branchGroupsDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result)).toBe(true);
  });

  it('confidence-propagate returns confidence results', async () => {
    const result = await confidencePropagateDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result)).toBe(true);
  });

  it('transitions returns transition recommendations', async () => {
    const result = await transitionsDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result)).toBe(true);
  });

  it('kill-check returns kill criterion alerts', async () => {
    const result = await killCheckDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result)).toBe(true);
  });
});

// --- Write commands using tmpDir ---

describe('command execute() wiring — write commands', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = setupProject();
    graphDir = join(tmpDir, 'graph');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('create-node creates a hypothesis node', async () => {
    const result = await createNodeDef.execute({
      graphDir,
      type: 'hypothesis',
      slug: 'test-hyp',
    });
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('path');
    expect(result.type).toBe('hypothesis');
    expect(result.id).toMatch(/^hyp-\d+$/);
  });

  it('create-edge creates an edge between two nodes', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'Test Exp',
      status: 'PLANNED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await createEdgeDef.execute({
      graphDir,
      source: 'exp-001',
      target: 'hyp-001',
      relation: 'supports',
    });
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('target');
    expect(result).toHaveProperty('relation');
    expect(result.source).toBe('exp-001');
    expect(result.target).toBe('hyp-001');
    expect(result.relation).toBe('supports');
  });

  it('update-node updates a node field', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await updateNodeDef.execute({
      graphDir,
      nodeId: 'hyp-001',
      set: { title: 'Updated Title' },
    });
    expect(result).toHaveProperty('nodeId');
    expect(result).toHaveProperty('updatedFields');
    expect(result.nodeId).toBe('hyp-001');
    expect(result.updatedFields).toContain('title');
  });

  it('delete-edge removes an edge between nodes', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'Test Exp',
      status: 'PLANNED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [],
      links: [{ target: 'hyp-001', relation: 'supports' }],
    });

    const result = await deleteEdgeDef.execute({
      graphDir,
      source: 'exp-001',
      target: 'hyp-001',
      relation: 'supports',
    });
    expect(result).toHaveProperty('deletedCount');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('target');
    expect(result.deletedCount).toBe(1);
  });

  it('mark-done marks a checklist item in an episode', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'IN_PROGRESS',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] task one\n- [ ] task two\n');

    const result = await markDoneDef.execute({
      graphDir,
      episodeId: 'epi-001',
      item: 'task one',
    });
    expect(result).toHaveProperty('episodeId');
    expect(result).toHaveProperty('item');
    expect(result).toHaveProperty('marker');
    expect(result.episodeId).toBe('epi-001');
    expect(result.item).toBe('task one');
    expect(result.marker).toBe('done');
  });

  it('mark-consolidated records a consolidation date', async () => {
    const result = await markConsolidatedDef.execute({
      graphDir,
      date: '2026-03-01',
    });
    expect(result).toHaveProperty('date');
    expect(result.date).toBe('2026-03-01');
  });

  it('index-graph generates index file', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await indexGraphDef.execute({ graphDir });
    expect(result).toHaveProperty('nodeCount');
    expect(result.nodeCount).toBe(1);
  });
});

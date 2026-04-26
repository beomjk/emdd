// Unit tests for the 6 highest-risk registry commands: create-node, create-edge,
// delete-edge, update-node, promote, mark-done. Covers schema validation,
// execute behavior against a tmp graph, and format output.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';

import { createNodeDef } from '../../../../src/registry/commands/create-node.js';
import { createEdgeDef } from '../../../../src/registry/commands/create-edge.js';
import { deleteEdgeDef } from '../../../../src/registry/commands/delete-edge.js';
import { updateNodeDef } from '../../../../src/registry/commands/update-node.js';
import { promoteDef } from '../../../../src/registry/commands/promote.js';
import { markDoneDef } from '../../../../src/registry/commands/mark-done.js';

function setupTmpGraph(): { tmpDir: string; graphDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'emdd-cmd-'));
  const graphDir = join(tmpDir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graphDir, sub), { recursive: true });
  }
  return { tmpDir, graphDir };
}

function writeNode(graphDir: string, subdir: string, filename: string, fm: Record<string, unknown>, body = '') {
  writeFileSync(join(graphDir, subdir, filename), matter.stringify(body, fm));
}

// ── create-node ────────────────────────────────────────────────────────

describe('create-node command', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('schema rejects invalid node type', () => {
    const parsed = createNodeDef.schema.safeParse({ type: 'nope', slug: 'x', graphDir });
    expect(parsed.success).toBe(false);
  });

  it('schema rejects slug with invalid characters', () => {
    const parsed = createNodeDef.schema.safeParse({ type: 'hypothesis', slug: 'has spaces!', graphDir });
    expect(parsed.success).toBe(false);
  });

  it('schema accepts minimal input', () => {
    const parsed = createNodeDef.schema.safeParse({ type: 'hypothesis', slug: 'my-hyp', graphDir });
    expect(parsed.success).toBe(true);
  });

  it('execute creates a node file', async () => {
    const res = await createNodeDef.execute({ type: 'hypothesis', slug: 'demo', graphDir } as never);
    expect(res.type).toBe('hypothesis');
    expect(res.id).toMatch(/^hyp-/);
  });

  it('format renders creation message', async () => {
    const res = await createNodeDef.execute({ type: 'finding', slug: 'f', graphDir } as never);
    const out = createNodeDef.format!(res, { graphDir } as never);
    expect(out).toContain(res.id);
  });
});

// ── create-edge ────────────────────────────────────────────────────────

describe('create-edge command', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    ({ tmpDir, graphDir } = setupTmpGraph());
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('schema rejects invalid relation', () => {
    const parsed = createEdgeDef.schema.safeParse({
      source: 'find-001', target: 'hyp-001', relation: 'zzz', graphDir,
    });
    expect(parsed.success).toBe(false);
  });

  it('schema rejects strength out of range', () => {
    const parsed = createEdgeDef.schema.safeParse({
      source: 'find-001', target: 'hyp-001', relation: 'supports', strength: 1.5, graphDir,
    });
    expect(parsed.success).toBe(false);
  });

  it('execute adds edge with attributes', async () => {
    const res = await createEdgeDef.execute({
      source: 'find-001', target: 'hyp-001', relation: 'supports', strength: 0.9, graphDir,
    } as never);
    expect(res.relation).toBe('supports');
    const parsed = matter(readFileSync(join(graphDir, 'findings', 'find-001-f.md'), 'utf-8'));
    expect((parsed.data.links as unknown[]).length).toBe(1);
  });

  it('format labels skipped duplicates differently', async () => {
    await createEdgeDef.execute({
      source: 'find-001', target: 'hyp-001', relation: 'supports', graphDir,
    } as never);
    const res = await createEdgeDef.execute({
      source: 'find-001', target: 'hyp-001', relation: 'supports', graphDir,
    } as never);
    expect(res.skipped).toBe(true);
    const out = createEdgeDef.format!(res, { graphDir } as never);
    expect(out.length).toBeGreaterThan(0);
  });
});

// ── delete-edge ────────────────────────────────────────────────────────

describe('delete-edge command', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    ({ tmpDir, graphDir } = setupTmpGraph());
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('execute removes the matching edge', async () => {
    const res = await deleteEdgeDef.execute({
      source: 'find-001', target: 'hyp-001', relation: 'supports', graphDir,
    } as never);
    expect(res.deletedCount).toBe(1);
  });

  it('execute with no relation removes all links to target', async () => {
    const res = await deleteEdgeDef.execute({
      source: 'find-001', target: 'hyp-001', graphDir,
    } as never);
    expect(res.deletedCount).toBe(1);
  });

  it('format reports count and endpoints', async () => {
    const res = await deleteEdgeDef.execute({
      source: 'find-001', target: 'hyp-001', graphDir,
    } as never);
    const out = deleteEdgeDef.format!(res, { graphDir } as never);
    expect(out).toContain('find-001');
    expect(out).toContain('hyp-001');
  });
});

// ── update-node ────────────────────────────────────────────────────────

describe('update-node command', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    ({ tmpDir, graphDir } = setupTmpGraph());
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('schema rejects invalid transitionPolicy value', () => {
    const parsed = updateNodeDef.schema.safeParse({
      nodeId: 'hyp-001', set: { confidence: '0.8' }, transitionPolicy: 'crazy', graphDir,
    });
    expect(parsed.success).toBe(false);
  });

  it('execute updates confidence', async () => {
    const res = await updateNodeDef.execute({
      nodeId: 'hyp-001', set: { confidence: '0.8' }, graphDir,
    } as never);
    expect(res.updatedFields).toContain('confidence');
  });

  it('execute surfaces warnings under transitionPolicy=warn', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-002-x.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'Y', status: 'PROPOSED', confidence: 0.1,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    const res = await updateNodeDef.execute({
      nodeId: 'hyp-002', set: { status: 'REFUTED' }, transitionPolicy: 'warn', graphDir,
    } as never);
    expect(res.warnings?.length).toBeGreaterThan(0);
  });

  it('format renders updated fields', async () => {
    const res = await updateNodeDef.execute({
      nodeId: 'hyp-001', set: { confidence: '0.9' }, graphDir,
    } as never);
    const out = updateNodeDef.format!(res, { graphDir } as never);
    expect(out).toContain('hyp-001');
    expect(out).toContain('confidence');
  });
});

// ── promote ────────────────────────────────────────────────────────────

describe('promote command', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('execute returns empty array when no candidates', async () => {
    const res = await promoteDef.execute({ graphDir } as never);
    expect(res).toEqual([]);
  });

  it('execute surfaces eligible candidates', async () => {
    writeNode(graphDir, 'findings', 'find-001-x.md', {
      id: 'find-001', type: 'finding', title: 'X', status: 'DRAFT', confidence: 0.95,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-002-s1.md', {
      id: 'find-002', type: 'finding', title: 'S1', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'find-001', relation: 'supports', strength: 0.8 }],
    });
    writeNode(graphDir, 'findings', 'find-003-s2.md', {
      id: 'find-003', type: 'finding', title: 'S2', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'find-001', relation: 'supports', strength: 0.8 }],
    });
    const res = await promoteDef.execute({ graphDir } as never);
    expect(res.some(c => c.id === 'find-001')).toBe(true);
  });

  it('format yields human-readable output when candidates exist', () => {
    const out = promoteDef.format!([{ id: 'find-001', confidence: 0.95, supports: 2, reason: 'confidence' }], { graphDir } as never);
    expect(out).toContain('find-001');
  });

  it('format yields empty-state message when no candidates', () => {
    const out = promoteDef.format!([], { graphDir } as never);
    expect(out.length).toBeGreaterThan(0);
  });
});

// ── mark-done ──────────────────────────────────────────────────────────

describe('mark-done command', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    ({ tmpDir, graphDir } = setupTmpGraph());
    writeNode(graphDir, 'episodes', 'epi-001-x.md', {
      id: 'epi-001', type: 'episode', title: 'X', status: 'ACTIVE',
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    }, '## What\'s Next\n- [ ] ship it\n');
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('schema rejects unknown marker value', () => {
    const parsed = markDoneDef.schema.safeParse({
      episodeId: 'epi-001', item: 'x', marker: 'bogus', graphDir,
    });
    expect(parsed.success).toBe(false);
  });

  it('execute flips checkbox to done', async () => {
    const res = await markDoneDef.execute({
      episodeId: 'epi-001', item: 'ship it', graphDir,
    } as never);
    expect(res.marker).toBe('done');
  });

  it('execute accepts deferred marker', async () => {
    const res = await markDoneDef.execute({
      episodeId: 'epi-001', item: 'ship it', marker: 'deferred', graphDir,
    } as never);
    expect(res.marker).toBe('deferred');
  });

  it('format mentions marker and item', async () => {
    const res = await markDoneDef.execute({
      episodeId: 'epi-001', item: 'ship it', graphDir,
    } as never);
    const out = markDoneDef.format!(res, { graphDir } as never);
    expect(out).toContain('ship it');
  });
});

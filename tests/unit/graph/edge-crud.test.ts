import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { planCreateEdge, createEdge, deleteEdge } from '../../../src/graph/edge-crud.js';

function setupTmpGraph(): { tmpDir: string; graphDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'emdd-ecrud-'));
  const graphDir = join(tmpDir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions']) {
    mkdirSync(join(graphDir, sub), { recursive: true });
  }
  return { tmpDir, graphDir };
}

function writeNode(graphDir: string, subdir: string, filename: string, fm: Record<string, unknown>) {
  writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
}

function seedPair(graphDir: string) {
  writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
    id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
    created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
  });
  writeNode(graphDir, 'experiments', 'exp-001-y.md', {
    id: 'exp-001', type: 'experiment', title: 'Y', status: 'PLANNED',
    created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
  });
}

describe('planCreateEdge', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('plans a write op with link appended to source frontmatter', async () => {
    seedPair(graphDir);
    const plan = await planCreateEdge(graphDir, 'exp-001', 'hyp-001', 'tests');
    expect(plan.source).toBe('exp-001');
    expect(plan.target).toBe('hyp-001');
    expect(plan.relation).toBe('tests');
    expect(plan.ops).toHaveLength(1);
    expect(plan.ops[0].kind).toBe('write');
  });

  it('normalizes reverse labels to canonical forward edge', async () => {
    seedPair(graphDir);
    // `tested_by` is reverse of `tests`; plan should emit canonical `tests` from reverse source.
    writeNode(graphDir, 'hypotheses', 'hyp-002-z.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'Z', status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    const plan = await planCreateEdge(graphDir, 'hyp-002', 'exp-001', 'tested_by');
    // reverse label gets normalized to canonical 'tests'
    expect(plan.relation).toBe('tests');
  });

  it('returns skipped=true on duplicate without --force', async () => {
    seedPair(graphDir);
    await createEdge(graphDir, 'exp-001', 'hyp-001', 'tests');
    const plan = await planCreateEdge(graphDir, 'exp-001', 'hyp-001', 'tests');
    expect(plan.skipped).toBe(true);
    expect(plan.ops).toHaveLength(0);
  });

  it('allows duplicate with force=true', async () => {
    seedPair(graphDir);
    await createEdge(graphDir, 'exp-001', 'hyp-001', 'tests');
    const plan = await planCreateEdge(graphDir, 'exp-001', 'hyp-001', 'tests', undefined, { force: true });
    expect(plan.skipped).toBeUndefined();
    expect(plan.ops.length).toBe(1);
  });

  it('throws on unknown source', async () => {
    seedPair(graphDir);
    await expect(planCreateEdge(graphDir, 'nonexistent', 'hyp-001', 'tests')).rejects.toThrow(/nonexistent/);
  });

  it('throws on unknown target', async () => {
    seedPair(graphDir);
    await expect(planCreateEdge(graphDir, 'exp-001', 'ghost', 'tests')).rejects.toThrow(/ghost/);
  });

  it('throws on invalid relation with suggestion', async () => {
    seedPair(graphDir);
    await expect(planCreateEdge(graphDir, 'exp-001', 'hyp-001', 'suport')).rejects.toThrow(/supports/);
  });
});

describe('createEdge', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('writes the edge with attributes', async () => {
    seedPair(graphDir);
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    const res = await createEdge(graphDir, 'find-001', 'hyp-001', 'supports', { strength: 0.9 });
    expect(res.relation).toBe('supports');
    const parsed = matter(readFileSync(join(graphDir, 'findings', 'find-001-f.md'), 'utf-8'));
    const links = parsed.data.links as Array<Record<string, unknown>>;
    expect(links).toHaveLength(1);
    expect(links[0].relation).toBe('supports');
    expect(links[0].strength).toBe(0.9);
  });

  it('rejects attribute not allowed on edge type', async () => {
    seedPair(graphDir);
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    // `supports` takes `strength`, not `severity`
    await expect(
      createEdge(graphDir, 'find-001', 'hyp-001', 'supports', { severity: 'FATAL' }),
    ).rejects.toThrow();
  });

  it('rejects strength out of [0,1]', async () => {
    seedPair(graphDir);
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    await expect(
      createEdge(graphDir, 'find-001', 'hyp-001', 'supports', { strength: 1.5 }),
    ).rejects.toThrow();
  });

  it('rejects invalid severity enum value', async () => {
    seedPair(graphDir);
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    await expect(
      createEdge(graphDir, 'find-001', 'hyp-001', 'contradicts', { severity: 'BOGUS' as never }),
    ).rejects.toThrow();
  });
});

describe('deleteEdge', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('removes a matching link', async () => {
    seedPair(graphDir);
    await createEdge(graphDir, 'exp-001', 'hyp-001', 'tests');
    const res = await deleteEdge(graphDir, 'exp-001', 'hyp-001', 'tests');
    expect(res.deletedCount).toBe(1);
    expect(res.deletedRelations).toEqual(['tests']);
    const parsed = matter(readFileSync(join(graphDir, 'experiments', 'exp-001-y.md'), 'utf-8'));
    expect(parsed.data.links).toEqual([]);
  });

  it('removes all links from source to target when relation omitted', async () => {
    seedPair(graphDir);
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    await createEdge(graphDir, 'find-001', 'hyp-001', 'supports', { strength: 0.9 });
    await createEdge(graphDir, 'find-001', 'hyp-001', 'informs', { impact: 'MINOR' });
    const res = await deleteEdge(graphDir, 'find-001', 'hyp-001');
    expect(res.deletedCount).toBe(2);
  });

  it('throws when no matching link exists', async () => {
    seedPair(graphDir);
    await expect(deleteEdge(graphDir, 'exp-001', 'hyp-001', 'tests')).rejects.toThrow();
  });

  it('throws on unknown source', async () => {
    seedPair(graphDir);
    await expect(deleteEdge(graphDir, 'ghost', 'hyp-001', 'tests')).rejects.toThrow();
  });
});

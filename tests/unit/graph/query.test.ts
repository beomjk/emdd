import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { listNodes, readNode, readNodes, getNeighbors } from '../../../src/graph/query.js';

function setupTmpGraph(): { tmpDir: string; graphDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'emdd-query-'));
  const graphDir = join(tmpDir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings']) {
    mkdirSync(join(graphDir, sub), { recursive: true });
  }
  return { tmpDir, graphDir };
}

function writeNode(graphDir: string, subdir: string, filename: string, fm: Record<string, unknown>, body = '') {
  writeFileSync(join(graphDir, subdir, filename), matter.stringify(body, fm));
}

describe('listNodes', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns all nodes when no filter given', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    const nodes = await listNodes(graphDir);
    expect(nodes).toHaveLength(2);
  });

  it('filters by type', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    const nodes = await listNodes(graphDir, { type: 'hypothesis' });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('hyp-001');
  });

  it('filters by status', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'hypotheses', 'hyp-002-y.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'Y', status: 'TESTING', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    const nodes = await listNodes(graphDir, { status: 'TESTING' });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('hyp-002');
  });

  it('filters by since date', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    });
    writeNode(graphDir, 'hypotheses', 'hyp-002-y.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'Y', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-15', updated: '2026-04-15', tags: [], links: [],
    });
    const nodes = await listNodes(graphDir, { since: '2026-04-01' });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('hyp-002');
  });

  it('throws on invalid since date', async () => {
    await expect(listNodes(graphDir, { since: 'not-a-date' })).rejects.toThrow();
  });
});

describe('readNode', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns node detail with body', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    }, '# Body\n\nSome content.');
    const detail = await readNode(graphDir, 'hyp-001');
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe('hyp-001');
    expect(detail!.body).toContain('Some content');
  });

  it('returns null on missing node', async () => {
    const detail = await readNode(graphDir, 'ghost');
    expect(detail).toBeNull();
  });
});

describe('readNodes (batch)', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('reads multiple nodes and skips missing ids', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'hypotheses', 'hyp-002-y.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'Y', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    const results = await readNodes(graphDir, ['hyp-001', 'hyp-002', 'ghost']);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.id).sort()).toEqual(['hyp-001', 'hyp-002']);
  });
});

describe('getNeighbors', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns direct outgoing and incoming neighbors at depth 1', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });
    const neighbors = await getNeighbors(graphDir, 'hyp-001', 1);
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].id).toBe('find-001');
    expect(neighbors[0].direction).toBe('incoming');
    expect(neighbors[0].depth).toBe(1);
  });

  it('walks deeper with depth=2', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });
    writeNode(graphDir, 'experiments', 'exp-001-e.md', {
      id: 'exp-001', type: 'experiment', title: 'E', status: 'COMPLETED',
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'find-001', relation: 'produces' }],
    });
    const neighbors = await getNeighbors(graphDir, 'hyp-001', 2);
    const ids = neighbors.map(n => n.id).sort();
    expect(ids).toEqual(['exp-001', 'find-001']);
  });

  it('throws on unknown starting node', async () => {
    await expect(getNeighbors(graphDir, 'ghost', 1)).rejects.toThrow();
  });
});

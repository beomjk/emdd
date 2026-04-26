import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import {
  planCreateNode,
  createNode,
  updateNode,
  markDone,
  writeIndex,
  markConsolidated,
} from '../../../src/graph/node-crud.js';

function setupTmpGraph(): { tmpDir: string; graphDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'emdd-ncrud-'));
  const graphDir = join(tmpDir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graphDir, sub), { recursive: true });
  }
  return { tmpDir, graphDir };
}

function writeNode(graphDir: string, subdir: string, filename: string, fm: Record<string, unknown>, body = '') {
  writeFileSync(join(graphDir, subdir, filename), matter.stringify(body, fm));
}

describe('planCreateNode', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns ops to mkdir + write with a fresh sequential id', () => {
    const plan = planCreateNode(graphDir, 'hypothesis', 'my-first', 'en');
    expect(plan.id).toBe('hyp-001');
    expect(plan.type).toBe('hypothesis');
    expect(plan.path.endsWith('hyp-001-my-first.md')).toBe(true);
    expect(plan.ops.map(o => o.kind)).toEqual(['mkdir', 'write']);
  });

  it('sanitizes the slug', () => {
    const plan = planCreateNode(graphDir, 'hypothesis', 'Messy Title/With Slashes!', 'en');
    expect(plan.path).not.toContain('/Messy Title');
    expect(plan.path).not.toContain('!');
  });

  it('increments id based on existing nodes', () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-a.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'A', status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    const plan = planCreateNode(graphDir, 'hypothesis', 'b', 'en');
    expect(plan.id).toBe('hyp-002');
  });

  it('throws with suggestion on unknown type', () => {
    expect(() => planCreateNode(graphDir, 'hypothesiz', 's', 'en')).toThrow(/hypothesis/);
  });
});

describe('createNode', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('writes a markdown file with valid frontmatter', async () => {
    const res = await createNode(graphDir, 'question', 'what-next', 'en', 'What next?', 'body text');
    expect(res.id).toMatch(/^qst-001$|^q-001$/);
    expect(existsSync(res.path)).toBe(true);
    const parsed = matter(readFileSync(res.path, 'utf-8'));
    expect(parsed.data.id).toBe(res.id);
    expect(parsed.data.type).toBe('question');
    expect(parsed.data.title).toBe('What next?');
    expect(parsed.content).toContain('body text');
  });
});

describe('updateNode', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('updates confidence and touches updated date', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    const res = await updateNode(graphDir, 'hyp-001', { confidence: '0.8' });
    expect(res.updatedFields).toContain('confidence');
    const parsed = matter(readFileSync(join(graphDir, 'hypotheses', 'hyp-001-x.md'), 'utf-8'));
    expect(parsed.data.confidence).toBe(0.8);
    expect(parsed.data.updated).not.toBe('2026-01-01');
  });

  it('rejects confidence outside [0,1]', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    await expect(updateNode(graphDir, 'hyp-001', { confidence: '1.5' })).rejects.toThrow();
  });

  it('rejects invalid status with suggestion', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    await expect(updateNode(graphDir, 'hyp-001', { status: 'TESTNG' })).rejects.toThrow(/TESTING/);
  });

  it('throws on non-existent node', async () => {
    await expect(updateNode(graphDir, 'hyp-999', { confidence: '0.5' })).rejects.toThrow(/hyp-999/);
  });

  it('transitionPolicy=warn collects warnings instead of throwing', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.1,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    // PROPOSED → REFUTED has no direct auto rule
    const res = await updateNode(graphDir, 'hyp-001', { status: 'REFUTED' }, { transitionPolicy: 'warn' });
    expect(res.warnings && res.warnings.length).toBeGreaterThan(0);
  });
});

describe('markDone', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('flips `- [ ]` to `- [done]` on a matching item', async () => {
    writeNode(graphDir, 'episodes', 'epi-001-x.md', {
      id: 'epi-001', type: 'episode', title: 'X', status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    }, '## What\'s Next\n- [ ] ship it\n- [ ] write docs\n');
    const res = await markDone(graphDir, 'epi-001', 'ship it');
    expect(res.marker).toBe('done');
    const raw = readFileSync(join(graphDir, 'episodes', 'epi-001-x.md'), 'utf-8');
    expect(raw).toContain('- [done] ship it');
    expect(raw).toContain('- [ ] write docs');
  });

  it('throws when item is already marked', async () => {
    writeNode(graphDir, 'episodes', 'epi-001-x.md', {
      id: 'epi-001', type: 'episode', title: 'X', status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    }, '- [done] ship it\n');
    await expect(markDone(graphDir, 'epi-001', 'ship it')).rejects.toThrow(/already/);
  });

  it('throws on unknown item', async () => {
    writeNode(graphDir, 'episodes', 'epi-001-x.md', {
      id: 'epi-001', type: 'episode', title: 'X', status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    }, '- [ ] ship it\n');
    await expect(markDone(graphDir, 'epi-001', 'nonexistent')).rejects.toThrow();
  });

  it('rejects invalid marker values', async () => {
    writeNode(graphDir, 'episodes', 'epi-001-x.md', {
      id: 'epi-001', type: 'episode', title: 'X', status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    }, '- [ ] ship it\n');
    // @ts-expect-error testing runtime validation
    await expect(markDone(graphDir, 'epi-001', 'ship it', 'bogus')).rejects.toThrow();
  });
});

describe('writeIndex', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('writes _index.md with node count', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    const res = await writeIndex(graphDir);
    expect(res.nodeCount).toBe(1);
    expect(existsSync(join(graphDir, '_index.md'))).toBe(true);
  });
});

describe('markConsolidated', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('records a specified date', async () => {
    const res = await markConsolidated(graphDir, '2026-04-20');
    expect(res.date).toBe('2026-04-20');
  });

  it('defaults to today when no date is passed', async () => {
    const res = await markConsolidated(graphDir);
    expect(res.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

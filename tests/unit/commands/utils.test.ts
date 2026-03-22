import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';

import { graphCommand } from '../../../src/cli/graph.js';
import { generateIndex, getBacklog } from '../../../src/graph/operations.js';
import { loadGraph } from '../../../src/graph/loader.js';
import { writeFileSync as fsWriteFileSync } from 'node:fs';

function setupProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'emdd-utils-'));
  const graph = join(dir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graph, sub), { recursive: true });
  }
  return dir;
}

function writeNode(dir: string, subdir: string, filename: string, frontmatter: Record<string, any>, body: string = '') {
  const content = matter.stringify(body, frontmatter);
  writeFileSync(join(dir, 'graph', subdir, filename), content);
}

describe('indexCommand', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates _index.md file', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const graph = await loadGraph(join(tmpDir, 'graph'));
    const indexContent = generateIndex(graph);
    fsWriteFileSync(join(tmpDir, 'graph', '_index.md'), indexContent);

    expect(existsSync(join(tmpDir, 'graph', '_index.md'))).toBe(true);
  });

  it('generated _index.md contains node information', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Surface Detection',
      status: 'TESTING', confidence: 0.6,
      created: '2026-01-01', updated: '2026-02-01',
      tags: [], links: [],
    });

    const graph = await loadGraph(join(tmpDir, 'graph'));
    const indexContent = generateIndex(graph);
    fsWriteFileSync(join(tmpDir, 'graph', '_index.md'), indexContent);

    const content = readFileSync(join(tmpDir, 'graph', '_index.md'), 'utf-8');
    expect(content).toContain('hyp-001');
    expect(content).toContain('Surface Detection');
  });

  it('returns result summary', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const graph = await loadGraph(join(tmpDir, 'graph'));
    expect(graph.nodes.size).toBe(1);
  });
});

describe('graphCommand', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates _graph.mmd file', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await graphCommand(join(tmpDir, 'graph'));

    expect(existsSync(join(tmpDir, 'graph', '_graph.mmd'))).toBe(true);
  });

  it('generated file starts with graph TD', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await graphCommand(join(tmpDir, 'graph'));

    const content = readFileSync(join(tmpDir, 'graph', '_graph.mmd'), 'utf-8');
    expect(content).toMatch(/^graph TD/);
  });

  it('includes edges', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Hyp',
      status: 'TESTING', confidence: 0.6,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'Exp',
      status: 'COMPLETED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [],
      links: [{ target: 'hyp-001', relation: 'supports' }],
    });

    await graphCommand(join(tmpDir, 'graph'));

    const content = readFileSync(join(tmpDir, 'graph', '_graph.mmd'), 'utf-8');
    expect(content).toContain('supports');
  });

  it('returns result summary', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await graphCommand(join(tmpDir, 'graph'));
    expect(result.nodeCount).toBe(1);
    expect(typeof result.edgeCount).toBe('number');
  });
});

describe('getBacklog', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('collects incomplete items from episodes', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'IN_PROGRESS',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] task one\n- [x] task two\n- [ ] task three\n');

    const result = await getBacklog(join(tmpDir, 'graph'));
    expect(result.items.length).toBe(2);
    expect(result.items.some(i => i.text === 'task one')).toBe(true);
    expect(result.items.some(i => i.text === 'task three')).toBe(true);
  });

  it('excludes completed items', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test',
      status: 'COMPLETED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [x] all done\n');

    const result = await getBacklog(join(tmpDir, 'graph'));
    expect(result.items.length).toBe(0);
  });

  it('returns empty array when no episodes exist', async () => {
    const result = await getBacklog(join(tmpDir, 'graph'));
    expect(result.items).toEqual([]);
  });

  it('each item includes its parent episode ID', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test',
      status: 'IN_PROGRESS',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] my task\n');

    const result = await getBacklog(join(tmpDir, 'graph'));
    expect(result.items[0].episodeId).toBe('epi-001');
  });

  describe('statusFilter with all marker types', () => {
    beforeEach(() => {
      writeNode(tmpDir, 'episodes', 'epi-001-markers.md', {
        id: 'epi-001', type: 'episode', title: 'All Markers',
        status: 'IN_PROGRESS',
        created: '2026-01-01', updated: '2026-01-01',
        tags: [], links: [],
      }, '## Goals\n- [ ] pending task\n- [x] done via x\n- [X] done via X\n- [done] done via text\n- [deferred] deferred task\n- [superseded] superseded task\n');
    });

    it('statusFilter=all returns all 6 items', async () => {
      const result = await getBacklog(join(tmpDir, 'graph'), 'all');
      expect(result.items.length).toBe(6);
    });

    it('statusFilter=done returns 3 items (x, X, done)', async () => {
      const result = await getBacklog(join(tmpDir, 'graph'), 'done');
      expect(result.items.length).toBe(3);
      expect(result.items.every(i => i.marker === 'done')).toBe(true);
    });

    it('statusFilter=deferred returns 1 item', async () => {
      const result = await getBacklog(join(tmpDir, 'graph'), 'deferred');
      expect(result.items.length).toBe(1);
      expect(result.items[0].marker).toBe('deferred');
      expect(result.items[0].text).toBe('deferred task');
    });

    it('statusFilter=superseded returns 1 item', async () => {
      const result = await getBacklog(join(tmpDir, 'graph'), 'superseded');
      expect(result.items.length).toBe(1);
      expect(result.items[0].marker).toBe('superseded');
      expect(result.items[0].text).toBe('superseded task');
    });

    it('default (no filter) returns only pending items', async () => {
      const result = await getBacklog(join(tmpDir, 'graph'));
      expect(result.items.length).toBe(1);
      expect(result.items[0].marker).toBe('pending');
      expect(result.items[0].text).toBe('pending task');
    });

    it('each item has correct marker field value', async () => {
      const result = await getBacklog(join(tmpDir, 'graph'), 'all');
      const byText = new Map(result.items.map(i => [i.text, i.marker]));
      expect(byText.get('pending task')).toBe('pending');
      expect(byText.get('done via x')).toBe('done');
      expect(byText.get('done via X')).toBe('done');
      expect(byText.get('done via text')).toBe('done');
      expect(byText.get('deferred task')).toBe('deferred');
      expect(byText.get('superseded task')).toBe('superseded');
    });
  });
});

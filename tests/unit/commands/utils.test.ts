import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';

import { indexCommand } from '../../../src/commands/index.js';
import { graphCommand } from '../../../src/commands/graph.js';
import { backlogCommand } from '../../../src/commands/backlog.js';

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

  it('_index.md 파일을 생성한다', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await indexCommand(join(tmpDir, 'graph'));

    expect(existsSync(join(tmpDir, 'graph', '_index.md'))).toBe(true);
  });

  it('생성된 _index.md에 노드 정보가 포함된다', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Surface Detection',
      status: 'TESTING', confidence: 0.6,
      created: '2026-01-01', updated: '2026-02-01',
      tags: [], links: [],
    });

    await indexCommand(join(tmpDir, 'graph'));

    const content = readFileSync(join(tmpDir, 'graph', '_index.md'), 'utf-8');
    expect(content).toContain('hyp-001');
    expect(content).toContain('Surface Detection');
  });

  it('결과 요약을 반환한다', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await indexCommand(join(tmpDir, 'graph'));
    expect(result.nodeCount).toBe(1);
  });
});

describe('graphCommand', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('_graph.mmd 파일을 생성한다', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await graphCommand(join(tmpDir, 'graph'));

    expect(existsSync(join(tmpDir, 'graph', '_graph.mmd'))).toBe(true);
  });

  it('생성된 파일이 graph TD로 시작한다', async () => {
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

  it('엣지가 포함된다', async () => {
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

  it('결과 요약을 반환한다', async () => {
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

describe('backlogCommand', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('에피소드에서 미완료 항목을 수집한다', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'IN_PROGRESS',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] task one\n- [x] task two\n- [ ] task three\n');

    const result = await backlogCommand(join(tmpDir, 'graph'));
    expect(result.items.length).toBe(2);
    expect(result.items.some(i => i.text === 'task one')).toBe(true);
    expect(result.items.some(i => i.text === 'task three')).toBe(true);
  });

  it('완료된 항목은 제외한다', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test',
      status: 'COMPLETED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [x] all done\n');

    const result = await backlogCommand(join(tmpDir, 'graph'));
    expect(result.items.length).toBe(0);
  });

  it('에피소드가 없으면 빈 배열을 반환한다', async () => {
    const result = await backlogCommand(join(tmpDir, 'graph'));
    expect(result.items).toEqual([]);
  });

  it('각 항목에 소속 에피소드 ID가 포함된다', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test',
      status: 'IN_PROGRESS',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] my task\n');

    const result = await backlogCommand(join(tmpDir, 'graph'));
    expect(result.items[0].episodeId).toBe('epi-001');
  });
});

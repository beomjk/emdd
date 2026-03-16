import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { graphCommand } from '../../../src/commands/graph.js';

function setupProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'emdd-graph-'));
  const graph = join(dir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graph, sub), { recursive: true });
  }
  return dir;
}

function writeNode(dir: string, subdir: string, filename: string, frontmatter: Record<string, any>, body = '') {
  writeFileSync(join(dir, 'graph', subdir, filename), matter.stringify(body, frontmatter));
}

describe('graphCommand', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns correct node and edge counts', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [{ target: 'exp-001', relation: 'spawns' }],
    });
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'E1',
      status: 'PLANNED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const result = await graphCommand(join(tmpDir, 'graph'));
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
  });

  it('writes _graph.mmd file to graphDir', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await graphCommand(join(tmpDir, 'graph'));
    expect(existsSync(join(tmpDir, 'graph', '_graph.mmd'))).toBe(true);
    const content = readFileSync(join(tmpDir, 'graph', '_graph.mmd'), 'utf-8');
    expect(content).toContain('hyp-001');
  });

  it('handles empty graph (0 nodes, 0 edges)', async () => {
    const result = await graphCommand(join(tmpDir, 'graph'));
    expect(result.nodeCount).toBe(0);
    expect(result.edgeCount).toBe(0);
  });
});

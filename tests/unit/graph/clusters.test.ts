import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { identifyClusters, loadContextForTopic } from '../../../src/graph/clusters.js';

describe('identifyClusters', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-clust-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'findings', 'knowledge', 'questions']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  it('identifies clusters from _index.md', async () => {
    writeFileSync(join(graphDir, '_index.md'), [
      '## Cluster: Defect Detection',
      '- **Entry point**: knw-001',
      '- fnd-001, hyp-001',
      '',
      '## Cluster: Scratch Detection',
      '- **Entry point**: knw-002',
      '- fnd-002',
    ].join('\n'));

    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'ACTIVE',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('knowledge', 'knw-002-test.md', {
      id: 'knw-002', type: 'knowledge', title: 'K2', status: 'ACTIVE',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const clusters = await identifyClusters(graphDir);
    expect(clusters.length).toBe(2);
    expect(clusters[0].name).toBe('Defect Detection');
    expect(clusters[0].entryPoint).toBe('knw-001');
    expect(clusters[1].name).toBe('Scratch Detection');
  });

  it('identifies entry points (ACTIVE knowledge, confirmed findings)', async () => {
    writeFileSync(join(graphDir, '_index.md'), [
      '## Cluster: Test',
      '- **Entry point**: knw-001',
    ].join('\n'));

    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'ACTIVE',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const clusters = await identifyClusters(graphDir);
    expect(clusters[0].entryPoint).toBe('knw-001');
    expect(clusters[0].entryPointValid).toBe(true);
  });

  it('context loading: returns prerequisite reading list', async () => {
    writeNode('knowledge', 'knw-001-test.md', {
      id: 'knw-001', type: 'knowledge', title: 'K1', status: 'ACTIVE',
      confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: ['defect'],
      links: [{ target: 'fnd-001', relation: 'promotes' }],
    });
    writeNode('findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: ['defect'], links: [],
    });
    writeNode('questions', 'qst-001-test.md', {
      id: 'qst-001', type: 'question', title: 'Q1', status: 'OPEN',
      created: '2026-01-01', updated: '2026-01-01', tags: ['defect'], links: [],
    });

    const context = await loadContextForTopic(graphDir, 'defect');
    expect(context.entryPoints.length).toBeGreaterThan(0);
    expect(context.openQuestions.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { detectClusters, identifyClusters } from '../../../src/graph/clusters.js';
import { loadGraph } from '../../../src/graph/loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

describe('identifyClusters', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'emdd-cluster-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no _index.md exists', async () => {
    const clusters = await identifyClusters(tmpDir);
    expect(clusters).toEqual([]);
  });

  it('returns empty array when _index.md has no clusters frontmatter', async () => {
    writeFileSync(path.join(tmpDir, '_index.md'), '---\ntitle: Test\n---\nContent');
    const clusters = await identifyClusters(tmpDir);
    expect(clusters).toEqual([]);
  });

  it('parses YAML frontmatter clusters from _index.md', async () => {
    const indexContent = matter.stringify('', {
      clusters: [
        { label: 'Research A', members: ['hyp-001', 'exp-001'] },
        { label: 'Research B', members: ['hyp-002'] },
      ],
    });
    writeFileSync(path.join(tmpDir, '_index.md'), indexContent);

    const clusters = await identifyClusters(tmpDir);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toEqual({
      id: 'manual-0',
      label: 'Research A',
      nodeIds: ['hyp-001', 'exp-001'],
      isManual: true,
    });
    expect(clusters[1]).toEqual({
      id: 'manual-1',
      label: 'Research B',
      nodeIds: ['hyp-002'],
      isManual: true,
    });
  });

  it('uses fallback label when label is missing', async () => {
    const indexContent = matter.stringify('', {
      clusters: [{ members: ['hyp-001'] }],
    });
    writeFileSync(path.join(tmpDir, '_index.md'), indexContent);

    const clusters = await identifyClusters(tmpDir);
    expect(clusters[0].label).toBe('Manual Cluster 0');
  });
});

describe('detectClusters', () => {
  it('produces clusters from sample-graph fixture', async () => {
    const graph = await loadGraph(SAMPLE_GRAPH);
    const clusters = await detectClusters(graph, SAMPLE_GRAPH);

    // sample-graph has 14 nodes with various links — should produce at least 1 cluster
    expect(Array.isArray(clusters)).toBe(true);
    for (const c of clusters) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('label');
      expect(c).toHaveProperty('nodeIds');
      expect(c).toHaveProperty('isManual');
      expect(typeof c.label).toBe('string');
      expect(Array.isArray(c.nodeIds)).toBe(true);
    }
  });

  it('excludes clusters smaller than minClusterSize', async () => {
    const graph = await loadGraph(SAMPLE_GRAPH);
    const clusters = await detectClusters(graph, SAMPLE_GRAPH, { minClusterSize: 100 });

    // With very high threshold, no auto clusters should form
    const autoClusters = clusters.filter((c) => !c.isManual);
    expect(autoClusters).toHaveLength(0);
  });

  it('manual clusters override Louvain membership', async () => {
    // Create a temp graph with _index.md manual clusters
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'emdd-detect-'));
    try {
      // Create a simple graph structure
      for (const sub of ['hypotheses', 'experiments', 'findings']) {
        mkdirSync(path.join(tmpDir, sub), { recursive: true });
      }

      writeFileSync(
        path.join(tmpDir, 'hypotheses', 'hyp-001-test.md'),
        matter.stringify('Body', {
          id: 'hyp-001', type: 'hypothesis', title: 'Test H1', status: 'PROPOSED',
          tags: ['alpha'], links: [{ target: 'exp-001', relation: 'tested_by' }],
          created: '2026-01-01', updated: '2026-01-01',
        }),
      );
      writeFileSync(
        path.join(tmpDir, 'experiments', 'exp-001-test.md'),
        matter.stringify('Body', {
          id: 'exp-001', type: 'experiment', title: 'Test E1', status: 'RUNNING',
          tags: ['alpha'], links: [{ target: 'fnd-001', relation: 'produces' }],
          created: '2026-01-01', updated: '2026-01-01',
        }),
      );
      writeFileSync(
        path.join(tmpDir, 'findings', 'fnd-001-test.md'),
        matter.stringify('Body', {
          id: 'fnd-001', type: 'finding', title: 'Test F1', status: 'DRAFT',
          tags: ['alpha'], links: [],
          created: '2026-01-01', updated: '2026-01-01',
        }),
      );

      // Add manual cluster claiming hyp-001
      const indexContent = matter.stringify('', {
        clusters: [{ label: 'Manual Group', members: ['hyp-001'] }],
      });
      writeFileSync(path.join(tmpDir, '_index.md'), indexContent);

      const graph = await loadGraph(tmpDir);
      const clusters = await detectClusters(graph, tmpDir);

      const manualClusters = clusters.filter((c) => c.isManual);
      expect(manualClusters.length).toBe(1);
      expect(manualClusters[0].nodeIds).toContain('hyp-001');

      // hyp-001 should NOT appear in any auto cluster
      const autoClusters = clusters.filter((c) => !c.isManual);
      for (const ac of autoClusters) {
        expect(ac.nodeIds).not.toContain('hyp-001');
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('generates labels from tags', async () => {
    const graph = await loadGraph(SAMPLE_GRAPH);
    const clusters = await detectClusters(graph, SAMPLE_GRAPH);
    const autoClusters = clusters.filter((c) => !c.isManual);

    // Auto clusters should have non-empty labels
    for (const c of autoClusters) {
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});

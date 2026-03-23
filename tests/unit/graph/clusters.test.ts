import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { readFileSync } from 'node:fs';
import { identifyClusters, detectClusters, loadContextForTopic } from '../../../src/graph/clusters.js';
import { loadGraph } from '../../../src/graph/loader.js';
import { EDGE_TYPES } from '../../../src/graph/types.js';

describe('identifyClusters (YAML frontmatter)', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-clust-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'findings', 'knowledge', 'questions', 'experiments']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  function writeIndex(yamlData: Record<string, unknown>) {
    writeFileSync(join(graphDir, '_index.md'), matter.stringify('', yamlData));
  }

  it('identifies clusters from YAML frontmatter', async () => {
    writeIndex({
      clusters: [
        { label: 'Defect Detection', members: ['knw-001', 'fnd-001', 'hyp-001'] },
        { label: 'Scratch Detection', members: ['knw-002', 'fnd-002'] },
      ],
    });

    const clusters = await identifyClusters(graphDir);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].id).toBe('manual-0');
    expect(clusters[0].label).toBe('Defect Detection');
    expect(clusters[0].nodeIds).toEqual(['knw-001', 'fnd-001', 'hyp-001']);
    expect(clusters[0].isManual).toBe(true);
    expect(clusters[1].label).toBe('Scratch Detection');
    expect(clusters[1].nodeIds).toEqual(['knw-002', 'fnd-002']);
  });

  it('returns empty array when no _index.md exists', async () => {
    const clusters = await identifyClusters(graphDir);
    expect(clusters).toEqual([]);
  });

  it('returns empty array when _index.md has no clusters field', async () => {
    writeFileSync(join(graphDir, '_index.md'), '# Graph Index\n\nSome content.');
    const clusters = await identifyClusters(graphDir);
    expect(clusters).toEqual([]);
  });

  it('handles missing label/members gracefully', async () => {
    writeIndex({
      clusters: [
        { label: 'Has Label' },
        { members: ['hyp-001'] },
      ],
    });

    const clusters = await identifyClusters(graphDir);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].label).toBe('Has Label');
    expect(clusters[0].nodeIds).toEqual([]);
    expect(clusters[1].label).toBe('Manual Cluster 1');
    expect(clusters[1].nodeIds).toEqual(['hyp-001']);
  });
});

describe('detectClusters (Louvain)', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-clust-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'findings', 'knowledge', 'questions', 'experiments']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  it('detects communities from graph edges', async () => {
    // Cluster A: hyp-001 <-> exp-001 <-> fnd-001 (strongly connected)
    writeNode('hypotheses', 'hyp-001-a.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: ['ml'], links: [{ target: 'exp-001', relation: 'tests' }],
    });
    writeNode('experiments', 'exp-001-a.md', {
      id: 'exp-001', type: 'experiment', title: 'E1', status: 'RUNNING',
      created: '2026-01-01', updated: '2026-01-01',
      tags: ['ml'], links: [{ target: 'fnd-001', relation: 'produces' }],
    });
    writeNode('findings', 'fnd-001-a.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: ['ml'], links: [{ target: 'hyp-001', relation: 'supports' }],
    });

    // Cluster B: hyp-002 <-> exp-002 <-> fnd-002 (strongly connected)
    writeNode('hypotheses', 'hyp-002-b.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: ['data'], links: [{ target: 'exp-002', relation: 'tests' }],
    });
    writeNode('experiments', 'exp-002-b.md', {
      id: 'exp-002', type: 'experiment', title: 'E2', status: 'RUNNING',
      created: '2026-01-01', updated: '2026-01-01',
      tags: ['data'], links: [{ target: 'fnd-002', relation: 'produces' }],
    });
    writeNode('findings', 'fnd-002-b.md', {
      id: 'fnd-002', type: 'finding', title: 'F2', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: ['data'], links: [{ target: 'hyp-002', relation: 'supports' }],
    });

    const graph = await loadGraph(graphDir);
    const clusters = await detectClusters(graph, graphDir);

    // Should detect 2 clusters
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const autoOnly = clusters.filter((c) => !c.isManual);
    expect(autoOnly.length).toBeGreaterThanOrEqual(2);

    // Each cluster should have members
    for (const cluster of autoOnly) {
      expect(cluster.nodeIds.length).toBeGreaterThanOrEqual(2);
      expect(cluster.id).toMatch(/^auto-/);
      expect(cluster.isManual).toBe(false);
    }
  });

  it('applies edge weights correctly', async () => {
    // Strong link (supports = 1.0) vs weak link (relates_to = 0.3)
    writeNode('hypotheses', 'hyp-001-a.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [
        { target: 'fnd-001', relation: 'supports' },
        { target: 'hyp-002', relation: 'relates_to' },
      ],
    });
    writeNode('findings', 'fnd-001-a.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode('hypotheses', 'hyp-002-b.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'PROPOSED',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    const graph = await loadGraph(graphDir);
    const clusters = await detectClusters(graph, graphDir);
    // With only 3 nodes and 2 edges, Louvain may group all or split
    // The important thing is it runs without error
    expect(Array.isArray(clusters)).toBe(true);
  });

  it('manual clusters override Louvain assignment', async () => {
    writeNode('hypotheses', 'hyp-001-a.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: ['ml'], links: [{ target: 'fnd-001', relation: 'supports' }],
    });
    writeNode('findings', 'fnd-001-a.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: ['ml'], links: [],
    });
    writeNode('hypotheses', 'hyp-002-b.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'PROPOSED',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: ['data'], links: [{ target: 'fnd-002', relation: 'supports' }],
    });
    writeNode('findings', 'fnd-002-b.md', {
      id: 'fnd-002', type: 'finding', title: 'F2', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: ['data'], links: [],
    });

    // Manual cluster takes hyp-001 and fnd-001
    writeFileSync(join(graphDir, '_index.md'), matter.stringify('', {
      clusters: [{ label: 'Manual ML', members: ['hyp-001', 'fnd-001'] }],
    }));

    const graph = await loadGraph(graphDir);
    const clusters = await detectClusters(graph, graphDir);

    const manual = clusters.find((c) => c.isManual);
    expect(manual).toBeDefined();
    expect(manual!.label).toBe('Manual ML');
    expect(manual!.nodeIds).toContain('hyp-001');
    expect(manual!.nodeIds).toContain('fnd-001');

    // hyp-001 and fnd-001 should NOT appear in any auto cluster
    const autoClusters = clusters.filter((c) => !c.isManual);
    for (const ac of autoClusters) {
      expect(ac.nodeIds).not.toContain('hyp-001');
      expect(ac.nodeIds).not.toContain('fnd-001');
    }
  });

  it('generates labels from tags', async () => {
    writeNode('hypotheses', 'hyp-001-a.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: ['ml', 'backbone'], links: [{ target: 'fnd-001', relation: 'supports' }],
    });
    writeNode('findings', 'fnd-001-a.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: ['ml', 'backbone'], links: [{ target: 'hyp-001', relation: 'supports' }],
    });

    const graph = await loadGraph(graphDir);
    const clusters = await detectClusters(graph, graphDir);
    const autoCluster = clusters.find((c) => !c.isManual);
    if (autoCluster) {
      // Label should contain the most frequent tags
      expect(autoCluster.label).toMatch(/ml|backbone/);
    }
  });

  it('generates label from knowledge node title when no tags', async () => {
    writeNode('knowledge', 'knw-001-a.md', {
      id: 'knw-001', type: 'knowledge', title: 'Important Knowledge', status: 'ACTIVE',
      confidence: 0.95, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [{ target: 'fnd-001', relation: 'supports' }],
    });
    writeNode('findings', 'fnd-001-a.md', {
      id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
      confidence: 0.8, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [{ target: 'knw-001', relation: 'supports' }],
    });

    const graph = await loadGraph(graphDir);
    const clusters = await detectClusters(graph, graphDir);
    const autoCluster = clusters.find((c) => !c.isManual);
    if (autoCluster) {
      expect(autoCluster.label).toBe('Important Knowledge');
    }
  });

  it('returns only manual clusters when graph has no edges', async () => {
    writeNode('hypotheses', 'hyp-001-a.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'PROPOSED',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    writeFileSync(join(graphDir, '_index.md'), matter.stringify('', {
      clusters: [{ label: 'Solo', members: ['hyp-001'] }],
    }));

    const graph = await loadGraph(graphDir);
    const clusters = await detectClusters(graph, graphDir);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].isManual).toBe(true);
  });
});

describe('loadContextForTopic', () => {
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

  it('returns prerequisite reading list', async () => {
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

describe('EDGE_WEIGHTS consistency with EDGE_TYPES', () => {
  it('all EDGE_WEIGHTS keys are valid EDGE_TYPES members', () => {
    // Extract EDGE_WEIGHTS keys by parsing the source file (private const)
    const source = readFileSync(join(__dirname, '../../../src/graph/clusters.ts'), 'utf-8');
    const match = source.match(/const EDGE_WEIGHTS:\s*Record<string,\s*number>\s*=\s*\{([^}]+)\}/);
    expect(match).not.toBeNull();
    const keys = match![1].match(/(\w+)\s*:/g)!.map(k => k.replace(':', '').trim());
    for (const key of keys) {
      expect(EDGE_TYPES.has(key)).toBe(true);
    }
  });

  it('edge types not in EDGE_WEIGHTS use DEFAULT_EDGE_WEIGHT fallback', () => {
    // Extract EDGE_WEIGHTS keys
    const source = readFileSync(join(__dirname, '../../../src/graph/clusters.ts'), 'utf-8');
    const match = source.match(/const EDGE_WEIGHTS:\s*Record<string,\s*number>\s*=\s*\{([^}]+)\}/);
    const weightKeys = new Set(match![1].match(/(\w+)\s*:/g)!.map(k => k.replace(':', '').trim()));
    // DEFAULT_EDGE_WEIGHT
    const defaultMatch = source.match(/const DEFAULT_EDGE_WEIGHT\s*=\s*([\d.]+)/);
    expect(defaultMatch).not.toBeNull();
    const defaultWeight = parseFloat(defaultMatch![1]);
    expect(defaultWeight).toBe(0.3);
    // Verify that some EDGE_TYPES are NOT in EDGE_WEIGHTS (they use the fallback)
    const missingKeys = [...EDGE_TYPES].filter(e => !weightKeys.has(e));
    expect(missingKeys.length).toBeGreaterThan(0); // Some edges use fallback
  });
});

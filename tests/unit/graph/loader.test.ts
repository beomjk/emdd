import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { loadNode, loadGraph, resolveGraphDir } from '../../../src/graph/loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../fixtures');

describe('loadNode', () => {
  it('parses valid .md file into Node with correct fields', async () => {
    const filePath = path.join(FIXTURES, 'sample-graph/hypotheses/hyp-001-surface-defect-detection.md');
    const node = await loadNode(filePath);
    expect(node).not.toBeNull();
    expect(node!.id).toBe('hyp-001');
    expect(node!.type).toBe('hypothesis');
    expect(node!.title).toBe('Surface Defect Detection via CNN');
    expect(node!.status).toBe('TESTING');
    expect(node!.confidence).toBe(0.6);
    expect(node!.tags).toEqual(['cnn', 'defect-detection']);
    expect(node!.links).toHaveLength(1);
    expect(node!.links[0].target).toBe('exp-001');
    expect(node!.path).toBe(filePath);
  });

  it('normalizes reverse labels', async () => {
    const filePath = path.join(FIXTURES, 'sample-graph/findings/fnd-001-cnn-accuracy-92.md');
    const node = await loadNode(filePath);
    expect(node).not.toBeNull();
    // fnd-001 has produced_by and confirmed_by which should be normalized
    const relations = node!.links.map(l => l.relation);
    expect(relations).toContain('produces');
    expect(relations).toContain('confirms');
    expect(relations).not.toContain('produced_by');
    expect(relations).not.toContain('confirmed_by');
  });

  it('returns null for file with no frontmatter', async () => {
    const filePath = path.join(FIXTURES, 'invalid-nodes/no-frontmatter.md');
    const node = await loadNode(filePath);
    expect(node).toBeNull();
  });

  it('returns null for file that does not exist', async () => {
    const filePath = path.join(FIXTURES, 'nonexistent-file.md');
    const node = await loadNode(filePath);
    expect(node).toBeNull();
  });
});

describe('loadGraph', () => {
  it('loads all nodes from sample-graph fixture', async () => {
    const graphDir = path.join(FIXTURES, 'sample-graph');
    const graph = await loadGraph(graphDir);
    expect(graph.nodes.size).toBe(14);
    expect(graph.nodes.has('hyp-001')).toBe(true);
    expect(graph.nodes.has('exp-001')).toBe(true);
    expect(graph.nodes.has('fnd-001')).toBe(true);
    expect(graph.nodes.has('knw-001')).toBe(true);
    expect(graph.nodes.has('qst-001')).toBe(true);
    expect(graph.nodes.has('dec-001')).toBe(true);
    expect(graph.nodes.has('epi-001')).toBe(true);
  });

  it('excludes files starting with _', async () => {
    const graphDir = path.join(FIXTURES, 'sample-graph');
    const graph = await loadGraph(graphDir);
    // No node should have id starting with _ or be from an _index.md file
    for (const [id] of graph.nodes) {
      expect(id).not.toMatch(/^_/);
    }
  });

  it('returns empty Graph for empty-graph fixture', async () => {
    const graphDir = path.join(FIXTURES, 'empty-graph');
    const graph = await loadGraph(graphDir);
    expect(graph.nodes.size).toBe(0);
  });
});

describe('parseLinks with edge attributes', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-loader-'));
    graphDir = join(tmpDir, 'graph');
    mkdirSync(join(graphDir, 'findings'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFixture(filename: string, frontmatter: Record<string, unknown>) {
    const content = matter.stringify('', frontmatter);
    writeFileSync(join(graphDir, 'findings', filename), content);
  }

  it('parses strength from supports link', async () => {
    writeFixture('fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test', status: 'DRAFT',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });
    const node = await loadNode(join(graphDir, 'findings/fnd-001-test.md'));
    expect(node!.links[0].strength).toBe(0.8);
  });

  it('parses severity from contradicts link', async () => {
    writeFixture('fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test', status: 'DRAFT',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'contradicts', severity: 'FATAL' }],
    });
    const node = await loadNode(join(graphDir, 'findings/fnd-001-test.md'));
    expect(node!.links[0].severity).toBe('FATAL');
  });

  it('parses completeness from answers link', async () => {
    writeFixture('fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test', status: 'DRAFT',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'qst-001', relation: 'answers', completeness: 0.7 }],
    });
    const node = await loadNode(join(graphDir, 'findings/fnd-001-test.md'));
    expect(node!.links[0].completeness).toBe(0.7);
  });

  it('parses dependencyType from depends_on link', async () => {
    writeFixture('fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test', status: 'DRAFT',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'fnd-002', relation: 'depends_on', dependencyType: 'LOGICAL' }],
    });
    const node = await loadNode(join(graphDir, 'findings/fnd-001-test.md'));
    expect(node!.links[0].dependencyType).toBe('LOGICAL');
  });

  it('parses impact from informs link', async () => {
    writeFixture('fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test', status: 'DRAFT',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'informs', impact: 'DECISIVE' }],
    });
    const node = await loadNode(join(graphDir, 'findings/fnd-001-test.md'));
    expect(node!.links[0].impact).toBe('DECISIVE');
  });

  it('defaults missing attributes to undefined', async () => {
    writeFixture('fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test', status: 'DRAFT',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports' }],
    });
    const node = await loadNode(join(graphDir, 'findings/fnd-001-test.md'));
    expect(node!.links[0].strength).toBeUndefined();
    expect(node!.links[0].severity).toBeUndefined();
    expect(node!.links[0].completeness).toBeUndefined();
    expect(node!.links[0].dependencyType).toBeUndefined();
    expect(node!.links[0].impact).toBeUndefined();
  });

  it('ignores unknown link attributes', async () => {
    writeFixture('fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test', status: 'DRAFT',
      confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', unknownField: 42 }],
    });
    const node = await loadNode(join(graphDir, 'findings/fnd-001-test.md'));
    expect(node!.links[0]).not.toHaveProperty('unknownField');
  });
});

describe('loadGraph permissive mode', () => {
  const invalidFixture = path.join(FIXTURES, 'graph-with-invalid');

  it('non-permissive skips invalid nodes (default behavior)', async () => {
    const graph = await loadGraph(invalidFixture);
    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.has('hyp-001')).toBe(true);
    expect(graph.nodes.has('hyp-002')).toBe(false);
    expect(graph.nodes.has('fnd-001')).toBe(false);
    expect(graph.errors).toHaveLength(0);
  });

  it('permissive=true includes invalid nodes with _invalid meta', async () => {
    const graph = await loadGraph(invalidFixture, { permissive: true });
    expect(graph.nodes.size).toBe(3);
    expect(graph.nodes.has('hyp-001')).toBe(true);
    expect(graph.nodes.has('hyp-002')).toBe(true);
    expect(graph.nodes.has('fnd-001')).toBe(true);
  });

  it('invalid nodes have _invalid and _parseError in meta', async () => {
    const graph = await loadGraph(invalidFixture, { permissive: true });
    const hyp002 = graph.nodes.get('hyp-002')!;
    expect(hyp002.meta._invalid).toBe(true);
    expect(hyp002.meta._parseError).toBeDefined();
    expect(hyp002.type).toBe('hypothesis');
    expect(hyp002.tags).toEqual([]);
    expect(hyp002.links).toEqual([]);

    const fnd001 = graph.nodes.get('fnd-001')!;
    expect(fnd001.meta._invalid).toBe(true);
    expect(fnd001.type).toBe('finding');
  });

  it('populates graph.errors for invalid files', async () => {
    const graph = await loadGraph(invalidFixture, { permissive: true });
    expect(graph.errors.length).toBeGreaterThanOrEqual(2);
    expect(graph.errors.some(e => e.includes('hyp-002'))).toBe(true);
    expect(graph.errors.some(e => e.includes('fnd-001'))).toBe(true);
  });

  it('existing loadGraph call sites are unaffected (no options)', async () => {
    const graphDir = path.join(FIXTURES, 'sample-graph');
    const graph = await loadGraph(graphDir);
    expect(graph.nodes.size).toBe(14);
  });
});

describe('resolveGraphDir', () => {
  it('finds graph/ in sample-project fixture', () => {
    const projectDir = path.join(FIXTURES, 'sample-project');
    const graphDir = resolveGraphDir(projectDir);
    expect(graphDir).toContain('graph');
  });

  it('throws when no graph/ exists', () => {
    // Use /tmp which should not have a graph/ directory
    expect(() => resolveGraphDir('/tmp/nonexistent-emdd-test')).toThrow();
  });
});

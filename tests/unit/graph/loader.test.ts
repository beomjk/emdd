import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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

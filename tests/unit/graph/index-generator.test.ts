import { describe, it, expect } from 'vitest';
import { generateIndex } from '../../../src/graph/index-generator.js';
import type { Graph, Node } from '../../../src/graph/types.js';

function makeNode(overrides: Partial<Node> & { id: string; type: Node['type'] }): Node {
  return {
    title: 'Test Node',
    status: 'PROPOSED',
    links: [],
    tags: [],
    path: '',
    meta: { created: '2026-01-01', updated: '2026-01-01' },
    ...overrides,
  };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

describe('generateIndex', () => {
  it('returns a markdown string', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Test Hypothesis' }),
    ]);
    const output = generateIndex(graph);
    expect(output).toContain('# ');
  });

  it('includes sections for each type', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'H1' }),
      makeNode({ id: 'exp-001', type: 'experiment', title: 'E1' }),
      makeNode({ id: 'fnd-001', type: 'finding', title: 'F1' }),
    ]);
    const output = generateIndex(graph);
    expect(output).toMatch(/hypothes/i);
    expect(output).toMatch(/experiment/i);
    expect(output).toMatch(/finding/i);
  });

  it('includes each node ID and title', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Surface Defect Detection' }),
      makeNode({ id: 'exp-001', type: 'experiment', title: 'CNN Baseline' }),
    ]);
    const output = generateIndex(graph);
    expect(output).toContain('hyp-001');
    expect(output).toContain('Surface Defect Detection');
    expect(output).toContain('exp-001');
    expect(output).toContain('CNN Baseline');
  });

  it('includes node status', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING' }),
    ]);
    const output = generateIndex(graph);
    expect(output).toContain('TESTING');
  });

  it('includes statistics (total node count)', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'H1' }),
      makeNode({ id: 'exp-001', type: 'experiment', title: 'E1' }),
      makeNode({ id: 'fnd-001', type: 'finding', title: 'F1' }),
    ]);
    const output = generateIndex(graph);
    expect(output).toContain('3');
  });

  it('returns valid markdown for empty graph', () => {
    const graph: Graph = { nodes: new Map(), errors: [], warnings: [] };
    const output = generateIndex(graph);
    expect(output).toContain('# ');
    expect(output).not.toContain('hyp-');
  });
});

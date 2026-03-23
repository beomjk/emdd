import { describe, it, expect } from 'vitest';
import { generateMermaid } from '../../../src/graph/mermaid.js';
import type { Graph, Node } from '../../../src/graph/types.js';

function makeNode(overrides: Partial<Node> & { id: string; type: Node['type'] }): Node {
  return {
    title: 'Test Node',
    status: 'PROPOSED',
    links: [],
    tags: [],
    path: '',
    meta: {},
    ...overrides,
  };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

describe('generateMermaid', () => {
  it('starts with graph TD header', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Test' }),
    ]);
    expect(generateMermaid(graph)).toMatch(/^graph TD/);
  });

  it('includes all nodes', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Hypothesis A' }),
      makeNode({ id: 'exp-001', type: 'experiment', title: 'Experiment A' }),
      makeNode({ id: 'fnd-001', type: 'finding', title: 'Finding A' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toContain('hyp-001');
    expect(output).toContain('exp-001');
    expect(output).toContain('fnd-001');
  });

  it('node label includes id and title', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Surface Defect Detection' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toContain('hyp-001');
    expect(output).toContain('Surface Defect Detection');
  });

  it('edges display relation name', () => {
    const graph = makeGraph([
      makeNode({
        id: 'exp-001', type: 'experiment', title: 'Exp',
        links: [{ target: 'hyp-001', relation: 'supports' }],
      }),
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Hyp' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toContain('exp-001');
    expect(output).toContain('hyp-001');
    expect(output).toContain('supports');
  });

  it('truncates long titles (40 char limit)', () => {
    const longTitle = 'A'.repeat(60);
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: longTitle }),
    ]);
    const output = generateMermaid(graph);
    expect(output).not.toContain(longTitle);
    expect(output).toContain('A'.repeat(40));
  });

  it('returns valid Mermaid for empty graph', () => {
    const graph: Graph = { nodes: new Map(), errors: [], warnings: [] };
    const output = generateMermaid(graph);
    expect(output.trim()).toBe('graph TD');
  });

  it('applies style to SUPPORTED status nodes', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Supported', status: 'SUPPORTED' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toMatch(/style.*hyp-001/);
  });

  it('applies style to REFUTED status nodes', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Refuted', status: 'REFUTED' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toMatch(/style.*hyp-001/);
  });
});

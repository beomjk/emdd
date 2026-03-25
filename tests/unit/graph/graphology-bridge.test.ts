import { describe, it, expect } from 'vitest';
import type { Graph, Node } from '../../../src/graph/types.js';
import { toGraphologyGraph } from '../../../src/graph/graphology-bridge.js';

function makeNode(id: string, overrides?: Partial<Node>): Node {
  return {
    id, type: 'finding', title: id, path: `/fake/${id}.md`,
    status: 'DRAFT', confidence: 0.5, tags: [], links: [], meta: {},
    ...overrides,
  };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

describe('toGraphologyGraph', () => {
  it('handles multiple edges between the same node pair', () => {
    const graph = makeGraph([
      makeNode('fnd-001', {
        links: [
          { target: 'knw-001', relation: 'supports' },
          { target: 'knw-001', relation: 'informs' },
        ],
      }),
      makeNode('knw-001', { type: 'knowledge' }),
    ]);

    const g = toGraphologyGraph(graph);

    expect(g.order).toBe(2);
    expect(g.size).toBe(2);
    expect(g.edges('fnd-001', 'knw-001')).toHaveLength(2);
  });

  it('skips edges targeting non-existent nodes', () => {
    const graph = makeGraph([
      makeNode('fnd-001', {
        links: [{ target: 'knw-999', relation: 'supports' }],
      }),
    ]);

    const g = toGraphologyGraph(graph);

    expect(g.order).toBe(1);
    expect(g.size).toBe(0);
  });

  it('preserves edge relation attributes', () => {
    const graph = makeGraph([
      makeNode('fnd-001', {
        links: [{ target: 'hyp-001', relation: 'supports' }],
      }),
      makeNode('hyp-001', { type: 'hypothesis' }),
    ]);

    const g = toGraphologyGraph(graph);

    const edgeKey = g.edges('fnd-001', 'hyp-001')[0];
    expect(g.getEdgeAttribute(edgeKey, 'relation')).toBe('supports');
  });
});

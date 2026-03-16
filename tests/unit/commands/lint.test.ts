import { describe, it, expect } from 'vitest';
import { lintGraph } from '../../../src/graph/validator.js';
import type { Graph, Node } from '../../../src/graph/types.js';

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'hyp-001', type: 'hypothesis', title: 'Test', path: '/test',
    status: 'PROPOSED', confidence: 0.5, tags: [], links: [],
    meta: {},
    ...overrides,
  };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

describe('lintGraph', () => {
  it('returns empty for valid graph', () => {
    const graph = makeGraph([makeNode()]);
    expect(lintGraph(graph)).toEqual([]);
  });

  it('returns error for invalid status', () => {
    const graph = makeGraph([makeNode({ status: 'INVALID_STATUS' })]);
    const errors = lintGraph(graph);
    expect(errors.some(e => e.field === 'status' && e.severity === 'error')).toBe(true);
  });

  it('returns error for broken link target', () => {
    const graph = makeGraph([
      makeNode({ links: [{ target: 'nonexistent-999', relation: 'supports' }] }),
    ]);
    const errors = lintGraph(graph);
    expect(errors.some(e => e.field === 'links' && e.severity === 'error')).toBe(true);
  });

  it('returns warning for missing confidence on hypothesis', () => {
    const graph = makeGraph([makeNode({ confidence: undefined })]);
    const errors = lintGraph(graph);
    expect(errors.some(e => e.field === 'confidence' && e.severity === 'warning')).toBe(true);
  });
});

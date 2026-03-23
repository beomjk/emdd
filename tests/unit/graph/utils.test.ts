import { describe, it, expect } from 'vitest';
import type { Graph, Node } from '../../../src/graph/types.js';
import { buildReverseEdgeIndex, collectDeferredIds } from '../../../src/graph/utils.js';

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

function makeNode(id: string, overrides?: Partial<Node>): Node {
  return {
    id, type: 'finding', title: id, path: `/fake/${id}.md`,
    status: 'DRAFT', confidence: 0.5, tags: [], links: [], meta: {},
    ...overrides,
  };
}

describe('buildReverseEdgeIndex', () => {
  it('builds map from targetId to incoming edges with source info', () => {
    const graph = makeGraph([
      makeNode('fnd-001', {
        confidence: 0.8,
        links: [{ target: 'hyp-001', relation: 'supports', strength: 0.9 }],
      }),
      makeNode('hyp-001', { type: 'hypothesis' }),
    ]);

    const index = buildReverseEdgeIndex(graph);
    const incoming = index.get('hyp-001');
    expect(incoming).toHaveLength(1);
    expect(incoming![0].sourceId).toBe('fnd-001');
    expect(incoming![0].sourceConfidence).toBe(0.8);
    expect(incoming![0].relation).toBe('supports');
    expect(incoming![0].strength).toBe(0.9);
  });

  it('includes edge attributes (strength, severity)', () => {
    const graph = makeGraph([
      makeNode('fnd-001', {
        confidence: 0.7,
        links: [{ target: 'hyp-001', relation: 'contradicts', severity: 'FATAL' }],
      }),
      makeNode('hyp-001', { type: 'hypothesis' }),
    ]);

    const index = buildReverseEdgeIndex(graph);
    const incoming = index.get('hyp-001');
    expect(incoming![0].severity).toBe('FATAL');
  });

  it('empty graph returns empty map', () => {
    const graph = makeGraph([]);
    const index = buildReverseEdgeIndex(graph);
    expect(index.size).toBe(0);
  });
});

describe('collectDeferredIds', () => {
  it('returns IDs of nodes with DEFERRED status only', () => {
    const graph = makeGraph([
      makeNode('hyp-001', { type: 'hypothesis', status: 'DEFERRED' }),
      makeNode('hyp-002', { type: 'hypothesis', status: 'ACTIVE' }),
      makeNode('fnd-001', { status: 'DEFERRED' }),
    ]);

    const result = collectDeferredIds(graph);
    expect(result).toHaveLength(2);
    expect(result).toContain('hyp-001');
    expect(result).toContain('fnd-001');
    expect(result).not.toContain('hyp-002');
  });
});

import type { SerializedNode, SerializedGraph, SerializedEdge } from '../../src/web/types.js';

export function makeNode(overrides: Partial<SerializedNode> = {}): SerializedNode {
  return {
    id: 'hyp-001',
    title: 'Test Hypothesis',
    type: 'hypothesis',
    status: 'PROPOSED',
    tags: [],
    links: [],
    ...overrides,
  };
}

export function makeEdge(overrides: Partial<SerializedEdge> = {}): SerializedEdge {
  return {
    source: 'hyp-001',
    target: 'exp-001',
    relation: 'tested_by',
    ...overrides,
  };
}

export function makeGraph(
  nodes: SerializedNode[] = [makeNode()],
  edges: SerializedEdge[] = [],
): SerializedGraph {
  return {
    nodes,
    edges,
    loadedAt: '2026-04-09T00:00:00Z',
  };
}

export function makeNodeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hyp-001',
    title: 'Test Hypothesis',
    type: 'hypothesis',
    status: 'PROPOSED',
    confidence: 0.75,
    tags: ['ml', 'vision'],
    links: [{ target: 'exp-001', relation: 'tested_by' }],
    body: '# Summary\nThis is the body.',
    ...overrides,
  };
}

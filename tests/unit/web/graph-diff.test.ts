import { describe, it, expect } from 'vitest';
import { diffGraph } from '../../../src/web/frontend/lib/graph-diff.js';
import type { SerializedGraph, SerializedNode, SerializedEdge } from '../../../src/web/types.js';
import type { NodeElementData, EdgeElementData } from '../../../src/web/frontend/lib/graph-diff.js';

function makeNode(id: string, overrides: Partial<SerializedNode> = {}): SerializedNode {
  return {
    id,
    title: `Title ${id}`,
    type: 'hypothesis',
    status: 'PROPOSED',
    tags: [],
    links: [],
    ...overrides,
  };
}

function makeEdge(source: string, target: string, relation = 'tests'): SerializedEdge {
  return { source, target, relation };
}

function makeGraph(nodes: SerializedNode[], edges: SerializedEdge[] = []): SerializedGraph {
  return { nodes, edges, loadedAt: new Date().toISOString() };
}

const buildNodeData = (n: SerializedNode): NodeElementData => ({
  id: n.id,
  label: n.title,
  type: n.type,
  status: n.status,
});

const buildEdgeData = (e: SerializedEdge, validIds: Set<string>): EdgeElementData | null => {
  if (!validIds.has(e.source) || !validIds.has(e.target)) return null;
  return { id: `${e.source}-${e.relation}-${e.target}`, source: e.source, target: e.target, relation: e.relation };
};

describe('diffGraph', () => {
  it('treats null oldGraph as full addition', () => {
    const graph = makeGraph([makeNode('a'), makeNode('b')], [makeEdge('a', 'b')]);
    const delta = diffGraph(null, graph, buildNodeData, buildEdgeData);

    expect(delta.addedNodes).toHaveLength(2);
    expect(delta.addedEdges).toHaveLength(1);
    expect(delta.removedNodeIds).toHaveLength(0);
    expect(delta.removedEdgeIds).toHaveLength(0);
    expect(delta.updatedNodes).toHaveLength(0);
    expect(delta.topologyChanged).toBe(true);
  });

  it('returns empty delta for identical graphs', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const delta = diffGraph(makeGraph(nodes, edges), makeGraph(nodes, edges), buildNodeData, buildEdgeData);

    expect(delta.addedNodes).toHaveLength(0);
    expect(delta.removedNodeIds).toHaveLength(0);
    expect(delta.updatedNodes).toHaveLength(0);
    expect(delta.addedEdges).toHaveLength(0);
    expect(delta.removedEdgeIds).toHaveLength(0);
    expect(delta.topologyChanged).toBe(false);
  });

  it('detects added node', () => {
    const old = makeGraph([makeNode('a')]);
    const next = makeGraph([makeNode('a'), makeNode('b')]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.addedNodes).toHaveLength(1);
    expect(delta.addedNodes[0].id).toBe('b');
    expect(delta.topologyChanged).toBe(true);
  });

  it('detects removed node', () => {
    const old = makeGraph([makeNode('a'), makeNode('b')]);
    const next = makeGraph([makeNode('a')]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.removedNodeIds).toEqual(['b']);
    expect(delta.topologyChanged).toBe(true);
  });

  it('detects updated node data (title change)', () => {
    const old = makeGraph([makeNode('a', { title: 'Old Title' })]);
    const next = makeGraph([makeNode('a', { title: 'New Title' })]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.updatedNodes).toHaveLength(1);
    expect(delta.updatedNodes[0].id).toBe('a');
    expect(delta.updatedNodes[0].data.label).toBe('New Title');
    expect(delta.topologyChanged).toBe(false);
  });

  it('detects updated node data (status change)', () => {
    const old = makeGraph([makeNode('a', { status: 'PROPOSED' })]);
    const next = makeGraph([makeNode('a', { status: 'TESTING' })]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.updatedNodes).toHaveLength(1);
    expect(delta.topologyChanged).toBe(false);
  });

  it('detects added edge', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const old = makeGraph(nodes);
    const next = makeGraph(nodes, [makeEdge('a', 'b')]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.addedEdges).toHaveLength(1);
    expect(delta.topologyChanged).toBe(true);
  });

  it('detects removed edge', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const old = makeGraph(nodes, [makeEdge('a', 'b')]);
    const next = makeGraph(nodes);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.removedEdgeIds).toEqual(['a-tests-b']);
    expect(delta.topologyChanged).toBe(true);
  });

  it('detects updated node data (tags change)', () => {
    const old = makeGraph([makeNode('a', { tags: ['alpha'] })]);
    const next = makeGraph([makeNode('a', { tags: ['alpha', 'beta'] })]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.updatedNodes).toHaveLength(1);
    expect(delta.updatedNodes[0].id).toBe('a');
    expect(delta.topologyChanged).toBe(false);
  });

  it('does not flag unchanged tags as updated', () => {
    const old = makeGraph([makeNode('a', { tags: ['x', 'y'] })]);
    const next = makeGraph([makeNode('a', { tags: ['x', 'y'] })]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.updatedNodes).toHaveLength(0);
  });

  it('filters edges with invalid node references', () => {
    const graph = makeGraph([makeNode('a')], [makeEdge('a', 'missing')]);
    const delta = diffGraph(null, graph, buildNodeData, buildEdgeData);

    expect(delta.addedEdges).toHaveLength(0);
  });

  // ── Node field change coverage ──────────────────────────────────────
  // nodeChanged compares 7 fields: title, status, type, confidence, invalid,
  // bodyPreview, tags. Regression protection against silent field additions.

  it('detects updated node data (type change)', () => {
    const old = makeGraph([makeNode('a', { type: 'hypothesis' })]);
    const next = makeGraph([makeNode('a', { type: 'experiment' })]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.updatedNodes).toHaveLength(1);
    expect(delta.updatedNodes[0].id).toBe('a');
    expect(delta.topologyChanged).toBe(false);
  });

  it('detects updated node data (confidence change)', () => {
    const old = makeGraph([makeNode('a', { confidence: 0.5 })]);
    const next = makeGraph([makeNode('a', { confidence: 0.9 })]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.updatedNodes).toHaveLength(1);
    expect(delta.updatedNodes[0].id).toBe('a');
    expect(delta.topologyChanged).toBe(false);
  });

  it('detects updated node data (invalid flag flipped)', () => {
    const old = makeGraph([makeNode('a', { invalid: false })]);
    const next = makeGraph([makeNode('a', { invalid: true })]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.updatedNodes).toHaveLength(1);
    expect(delta.updatedNodes[0].id).toBe('a');
    expect(delta.topologyChanged).toBe(false);
  });

  it('detects updated node data (bodyPreview change)', () => {
    const old = makeGraph([makeNode('a', { bodyPreview: 'old summary' })]);
    const next = makeGraph([makeNode('a', { bodyPreview: 'new summary' })]);
    const delta = diffGraph(old, next, buildNodeData, buildEdgeData);

    expect(delta.updatedNodes).toHaveLength(1);
    expect(delta.updatedNodes[0].id).toBe('a');
    expect(delta.topologyChanged).toBe(false);
  });
});

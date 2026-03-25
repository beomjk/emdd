import { describe, it, expect } from 'vitest';
import type { Node, Graph } from '../../../src/graph/types.js';
import { hasLinked, minLinkedCount, allLinkedWith } from '../../../src/graph/graph-presets.js';

function makeNode(overrides: Partial<Node> & { id: string; type: Node['type'] }): Node {
  return {
    title: 'Test',
    path: '/test.md',
    status: 'PROPOSED',
    tags: [],
    links: [],
    meta: {},
    ...overrides,
  };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

// Note: PresetFn<Graph> signature is (entity: Entity, context: Graph, args)
// Node satisfies Entity (has id, type, status, meta), so we can pass Node directly.

describe('graph-presets (state-engine PresetFn<Graph>)', () => {
  describe('hasLinked', () => {
    it('returns met=true when outgoing link matches', () => {
      const hyp = makeNode({
        id: 'hyp-001', type: 'hypothesis',
        links: [{ target: 'exp-001', relation: 'tests' }],
      });
      const exp = makeNode({ id: 'exp-001', type: 'experiment' });
      const graph = makeGraph([hyp, exp]);

      const result = hasLinked(hyp, graph, { type: 'experiment', relation: 'tests' });
      expect(result.met).toBe(true);
      expect(result.matchedIds).toEqual(['exp-001']);
    });

    it('returns met=false when no links match', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', links: [] });
      const graph = makeGraph([hyp]);

      const result = hasLinked(hyp, graph, { type: 'experiment' });
      expect(result.met).toBe(false);
    });

    it('filters by min_strength', () => {
      const hyp = makeNode({
        id: 'hyp-001', type: 'hypothesis',
        links: [
          { target: 'fnd-001', relation: 'supports', strength: 0.3 },
          { target: 'fnd-002', relation: 'supports', strength: 0.8 },
        ],
      });
      const fnd1 = makeNode({ id: 'fnd-001', type: 'finding' });
      const fnd2 = makeNode({ id: 'fnd-002', type: 'finding' });
      const graph = makeGraph([hyp, fnd1, fnd2]);

      const result = hasLinked(hyp, graph, { relation: 'supports', min_strength: 0.5 });
      expect(result.met).toBe(true);
      expect(result.matchedIds).toEqual(['fnd-002']);
    });

    it('direction=incoming only checks incoming edges', () => {
      const hyp = makeNode({
        id: 'hyp-001', type: 'hypothesis',
        links: [{ target: 'exp-001', relation: 'tests' }],
      });
      const exp = makeNode({ id: 'exp-001', type: 'experiment', links: [] });
      const graph = makeGraph([hyp, exp]);

      const resultIncoming = hasLinked(hyp, graph, { direction: 'incoming' });
      expect(resultIncoming.met).toBe(false);

      const resultOutgoing = hasLinked(hyp, graph, { direction: 'outgoing' });
      expect(resultOutgoing.met).toBe(true);
    });

    it('direction=incoming finds nodes that link to this node', () => {
      const fnd = makeNode({ id: 'fnd-001', type: 'finding', links: [] });
      const exp = makeNode({
        id: 'exp-001', type: 'experiment',
        links: [{ target: 'fnd-001', relation: 'produces' }],
      });
      const graph = makeGraph([fnd, exp]);

      const result = hasLinked(fnd, graph, { direction: 'incoming', relation: 'produces' });
      expect(result.met).toBe(true);
      expect(result.matchedIds).toEqual(['exp-001']);
    });
  });

  describe('minLinkedCount', () => {
    it('returns met=true when outgoing count meets threshold', () => {
      const exp = makeNode({
        id: 'exp-001', type: 'experiment',
        links: [
          { target: 'fnd-001', relation: 'produces' },
          { target: 'fnd-002', relation: 'produces' },
        ],
      });
      const fnd1 = makeNode({ id: 'fnd-001', type: 'finding' });
      const fnd2 = makeNode({ id: 'fnd-002', type: 'finding' });
      const graph = makeGraph([exp, fnd1, fnd2]);

      const result = minLinkedCount(exp, graph, { type: 'finding', count: 2 });
      expect(result.met).toBe(true);
      expect(result.matchedIds.length).toBe(2);
    });

    it('returns met=false when count below threshold', () => {
      const exp = makeNode({
        id: 'exp-001', type: 'experiment',
        links: [{ target: 'fnd-001', relation: 'produces' }],
      });
      const fnd1 = makeNode({ id: 'fnd-001', type: 'finding' });
      const graph = makeGraph([exp, fnd1]);

      const result = minLinkedCount(exp, graph, { type: 'finding', count: 3 });
      expect(result.met).toBe(false);
    });

    it('includes incoming edges in count', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', links: [] });
      const fnd1 = makeNode({
        id: 'fnd-001', type: 'finding',
        links: [{ target: 'hyp-001', relation: 'supports' }],
      });
      const fnd2 = makeNode({
        id: 'fnd-002', type: 'finding',
        links: [{ target: 'hyp-001', relation: 'supports' }],
      });
      const graph = makeGraph([hyp, fnd1, fnd2]);

      const result = minLinkedCount(hyp, graph, { type: 'finding', count: 2 });
      expect(result.met).toBe(true);
      expect(result.matchedIds).toContain('fnd-001');
      expect(result.matchedIds).toContain('fnd-002');
    });

    it('throws when required args missing', () => {
      const node = makeNode({ id: 'hyp-001', type: 'hypothesis' });
      const graph = makeGraph([node]);

      expect(() => minLinkedCount(node, graph, { type: 'finding' })).toThrow();
      expect(() => minLinkedCount(node, graph, { count: 2 })).toThrow();
    });
  });

  describe('allLinkedWith', () => {
    it('returns met=true when all incoming with relation have status', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', links: [] });
      const fnd1 = makeNode({
        id: 'fnd-001', type: 'finding', status: 'VALIDATED',
        links: [{ target: 'hyp-001', relation: 'supports' }],
      });
      const fnd2 = makeNode({
        id: 'fnd-002', type: 'finding', status: 'VALIDATED',
        links: [{ target: 'hyp-001', relation: 'supports' }],
      });
      const graph = makeGraph([hyp, fnd1, fnd2]);

      const result = allLinkedWith(hyp, graph, { relation: 'supports', status: 'VALIDATED' });
      expect(result.met).toBe(true);
      expect(result.matchedIds.length).toBe(2);
    });

    it('returns met=false when any incoming node has wrong status', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', links: [] });
      const fnd1 = makeNode({
        id: 'fnd-001', type: 'finding', status: 'VALIDATED',
        links: [{ target: 'hyp-001', relation: 'supports' }],
      });
      const fnd2 = makeNode({
        id: 'fnd-002', type: 'finding', status: 'DRAFT',
        links: [{ target: 'hyp-001', relation: 'supports' }],
      });
      const graph = makeGraph([hyp, fnd1, fnd2]);

      const result = allLinkedWith(hyp, graph, { relation: 'supports', status: 'VALIDATED' });
      expect(result.met).toBe(false);
    });

    it('returns met=false when no matching edges (vacuous truth prevention)', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', links: [] });
      const graph = makeGraph([hyp]);

      const result = allLinkedWith(hyp, graph, { relation: 'supports', status: 'VALIDATED' });
      expect(result.met).toBe(false);
      expect(result.matchedIds).toEqual([]);
    });

    it('throws when required args missing', () => {
      const node = makeNode({ id: 'hyp-001', type: 'hypothesis' });
      const graph = makeGraph([node]);

      expect(() => allLinkedWith(node, graph, { relation: 'supports' })).toThrow();
      expect(() => allLinkedWith(node, graph, { status: 'VALIDATED' })).toThrow();
    });
  });
});

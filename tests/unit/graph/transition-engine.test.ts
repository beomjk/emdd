import { describe, it, expect } from 'vitest';
import type { Node, Graph, NodeWithStatus } from '../../../src/graph/types.js';
import type { TransitionRule, ManualTransition } from '@beomjk/state-engine/engine';
import { engine } from '../../../src/graph/engine-setup.js';

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

/** Narrow Node to NodeWithStatus for engine calls. All test nodes have status. */
function withStatus(node: Node): NodeWithStatus {
  return node as NodeWithStatus;
}

describe('transition-engine', () => {
  describe('evaluateTransition', () => {
    it('valid transition succeeds and returns evidenceIds', () => {
      const hyp = makeNode({
        id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED',
        links: [{ target: 'exp-001', relation: 'tests' }],
      });
      const exp = makeNode({
        id: 'exp-001', type: 'experiment', status: 'RUNNING',
      });
      const graph = makeGraph([hyp, exp]);
      const rule: TransitionRule = {
        from: 'PROPOSED', to: 'TESTING',
        conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'RUNNING', direction: 'any' } }],
      };

      const result = engine.evaluate(withStatus(hyp), graph, rule);
      expect(result.met).toBe(true);
      expect(result.matchedIds).toContain('exp-001');
    });

    it('invalid transition is rejected', () => {
      const hyp = makeNode({
        id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED',
        links: [],
      });
      const graph = makeGraph([hyp]);
      const rule: TransitionRule = {
        from: 'PROPOSED', to: 'TESTING',
        conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'RUNNING', direction: 'any' } }],
      };

      const result = engine.evaluate(withStatus(hyp), graph, rule);
      expect(result.met).toBe(false);
      expect(result.matchedIds).toEqual([]);
    });
  });

  describe('condition preset evaluation', () => {
    it('has_linked with matchedIds', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', status: 'TESTING' });
      const fnd = makeNode({
        id: 'fnd-001', type: 'finding', status: 'VALIDATED',
        links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
      });
      const graph = makeGraph([hyp, fnd]);
      const rule: TransitionRule = {
        from: 'TESTING', to: 'SUPPORTED',
        conditions: [{ fn: 'has_linked', args: { relation: 'supports', min_strength: 0.7, direction: 'incoming' } }],
      };

      const result = engine.evaluate(withStatus(hyp), graph, rule);
      expect(result.met).toBe(true);
      expect(result.matchedIds).toContain('fnd-001');
    });

    it('field_present evaluates correctly', () => {
      const node = makeNode({
        id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED',
        meta: { methodology: 'double-blind' },
      });
      const graph = makeGraph([node]);
      const rule: TransitionRule = {
        from: 'PROPOSED', to: 'TESTING',
        conditions: [{ fn: 'field_present', args: { name: 'methodology' } }],
      };

      const result = engine.evaluate(withStatus(node), graph, rule);
      expect(result.met).toBe(true);
    });

    it('field_present returns false for missing field', () => {
      const node = makeNode({
        id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED',
        meta: {},
      });
      const graph = makeGraph([node]);
      const rule: TransitionRule = {
        from: 'PROPOSED', to: 'TESTING',
        conditions: [{ fn: 'field_present', args: { name: 'methodology' } }],
      };

      const result = engine.evaluate(withStatus(node), graph, rule);
      expect(result.met).toBe(false);
    });

    it('min_linked_count evaluates correctly', () => {
      const hyp = makeNode({
        id: 'hyp-001', type: 'hypothesis', status: 'TESTING',
        links: [
          { target: 'fnd-001', relation: 'produces' },
          { target: 'fnd-002', relation: 'produces' },
        ],
      });
      const fnd1 = makeNode({ id: 'fnd-001', type: 'finding', status: 'DRAFT' });
      const fnd2 = makeNode({ id: 'fnd-002', type: 'finding', status: 'DRAFT' });
      const graph = makeGraph([hyp, fnd1, fnd2]);
      const rule: TransitionRule = {
        from: 'TESTING', to: 'SUPPORTED',
        conditions: [{ fn: 'min_linked_count', args: { type: 'finding', count: 2 } }],
      };

      const result = engine.evaluate(withStatus(hyp), graph, rule);
      expect(result.met).toBe(true);
      expect(result.matchedIds).toHaveLength(2);
    });

    it('all_linked_with with matchedIds', () => {
      const knw = makeNode({ id: 'knw-001', type: 'knowledge', status: 'DISPUTED' });
      const fnd1 = makeNode({
        id: 'fnd-001', type: 'finding', status: 'RETRACTED',
        links: [{ target: 'knw-001', relation: 'contradicts' }],
      });
      const fnd2 = makeNode({
        id: 'fnd-002', type: 'finding', status: 'RETRACTED',
        links: [{ target: 'knw-001', relation: 'contradicts' }],
      });
      const graph = makeGraph([knw, fnd1, fnd2]);
      const rule: TransitionRule = {
        from: 'DISPUTED', to: 'ACTIVE',
        conditions: [{ fn: 'all_linked_with', args: { relation: 'contradicts', status: 'RETRACTED' } }],
      };

      const result = engine.evaluate(withStatus(knw), graph, rule);
      expect(result.met).toBe(true);
      expect(result.matchedIds).toContain('fnd-001');
      expect(result.matchedIds).toContain('fnd-002');
    });

    it('all_linked_with returns false with 0 matches (no vacuous truth)', () => {
      const knw = makeNode({ id: 'knw-001', type: 'knowledge', status: 'DISPUTED' });
      const graph = makeGraph([knw]);
      const rule: TransitionRule = {
        from: 'DISPUTED', to: 'ACTIVE',
        conditions: [{ fn: 'all_linked_with', args: { relation: 'contradicts', status: 'RETRACTED' } }],
      };

      const result = engine.evaluate(withStatus(knw), graph, rule);
      expect(result.met).toBe(false);
    });
  });

  describe('multiple conditions AND logic', () => {
    it('all conditions must be met', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', status: 'CONTESTED' });
      const dec = makeNode({
        id: 'dec-001', type: 'decision', status: 'ACCEPTED',
        links: [{ target: 'hyp-001', relation: 'confirms' }],
      });
      const fnd = makeNode({
        id: 'fnd-001', type: 'finding', status: 'VALIDATED',
        links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
      });
      const graph = makeGraph([hyp, dec, fnd]);
      const rule: TransitionRule = {
        from: 'CONTESTED', to: 'SUPPORTED',
        conditions: [
          { fn: 'has_linked', args: { type: 'decision', status: 'ACCEPTED', direction: 'incoming' } },
          { fn: 'has_linked', args: { relation: 'supports', min_strength: 0.7, direction: 'incoming' } },
        ],
      };

      const result = engine.evaluate(withStatus(hyp), graph, rule);
      expect(result.met).toBe(true);
      expect(result.matchedIds).toContain('dec-001');
      expect(result.matchedIds).toContain('fnd-001');
    });

    it('fails when one condition is not met', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', status: 'CONTESTED' });
      // Has accepted decision but no supports edge
      const dec = makeNode({
        id: 'dec-001', type: 'decision', status: 'ACCEPTED',
        links: [{ target: 'hyp-001', relation: 'confirms' }],
      });
      const graph = makeGraph([hyp, dec]);
      const rule: TransitionRule = {
        from: 'CONTESTED', to: 'SUPPORTED',
        conditions: [
          { fn: 'has_linked', args: { type: 'decision', status: 'ACCEPTED', direction: 'incoming' } },
          { fn: 'has_linked', args: { relation: 'supports', min_strength: 0.7, direction: 'incoming' } },
        ],
      };

      const result = engine.evaluate(withStatus(hyp), graph, rule);
      expect(result.met).toBe(false);
    });
  });

  describe('missing condition args error', () => {
    it('field_present throws when name arg is missing', () => {
      const node = makeNode({ id: 'hyp-001', type: 'hypothesis' });
      const graph = makeGraph([node]);
      const rule: TransitionRule = {
        from: 'PROPOSED', to: 'TESTING',
        conditions: [{ fn: 'field_present', args: {} }],
      };

      expect(() => engine.evaluate(withStatus(node), graph, rule)).toThrow('name');
    });

    it('min_linked_count throws when args are missing', () => {
      const node = makeNode({ id: 'hyp-001', type: 'hypothesis' });
      const graph = makeGraph([node]);
      const rule: TransitionRule = {
        from: 'PROPOSED', to: 'TESTING',
        conditions: [{ fn: 'min_linked_count', args: {} }],
      };

      expect(() => engine.evaluate(withStatus(node), graph, rule)).toThrow();
    });

    it('all_linked_with throws when args are missing', () => {
      const node = makeNode({ id: 'hyp-001', type: 'hypothesis' });
      const graph = makeGraph([node]);
      const rule: TransitionRule = {
        from: 'PROPOSED', to: 'TESTING',
        conditions: [{ fn: 'all_linked_with', args: {} }],
      };

      expect(() => engine.evaluate(withStatus(node), graph, rule)).toThrow();
    });
  });

  describe('validateTransition', () => {
    it('returns matchedIds for valid transition', () => {
      const hyp = makeNode({
        id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED',
        links: [{ target: 'exp-001', relation: 'tests' }],
      });
      const exp = makeNode({ id: 'exp-001', type: 'experiment', status: 'RUNNING' });
      const graph = makeGraph([hyp, exp]);
      const rules: TransitionRule[] = [
        { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'RUNNING', direction: 'any' } }] },
      ];

      const result = engine.validate(withStatus(hyp), graph, rules, 'TESTING');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.matchedIds).toContain('exp-001');
      }
    });

    it('rejects invalid transition with reason', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED' });
      const graph = makeGraph([hyp]);
      const rules: TransitionRule[] = [
        { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'RUNNING', direction: 'any' } }] },
      ];

      const result = engine.validate(withStatus(hyp), graph, rules, 'TESTING');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBeTruthy();
      }
    });

    it('accepts manual transition (from=ANY)', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', status: 'TESTING' });
      const graph = makeGraph([hyp]);
      const rules: TransitionRule[] = [];
      const manual: ManualTransition[] = [{ from: 'ANY', to: 'DEFERRED' }];

      const result = engine.validate(withStatus(hyp), graph, rules, 'DEFERRED', manual);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.matchedIds).toEqual([]);
      }
    });

    it('accepts manual transition (from=currentStatus)', () => {
      const hyp = makeNode({ id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED' });
      const graph = makeGraph([hyp]);
      const rules: TransitionRule[] = [];
      const manual: ManualTransition[] = [{ from: 'PROPOSED', to: 'DEFERRED' }];

      const result = engine.validate(withStatus(hyp), graph, rules, 'DEFERRED', manual);
      expect(result.valid).toBe(true);
    });
  });

  describe('FR-011: unknown preset fn name', () => {
    it('throws runtime error with preset name', () => {
      const node = makeNode({ id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED' });
      const graph = makeGraph([node]);
      const rule: TransitionRule = {
        from: 'PROPOSED', to: 'TESTING',
        conditions: [{ fn: 'nonexistent_preset', args: {} }],
      };

      expect(() => engine.evaluate(withStatus(node), graph, rule)).toThrow(/nonexistent_preset/);
    });
  });

  describe('getValidTransitions', () => {
    it('returns valid target statuses', () => {
      const hyp = makeNode({
        id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED',
        links: [{ target: 'exp-001', relation: 'tests' }],
      });
      const exp = makeNode({ id: 'exp-001', type: 'experiment', status: 'RUNNING' });
      const graph = makeGraph([hyp, exp]);
      const rules: TransitionRule[] = [
        { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'RUNNING', direction: 'any' } }] },
        { from: 'TESTING', to: 'SUPPORTED', conditions: [{ fn: 'has_linked', args: { relation: 'supports', min_strength: 0.7, direction: 'incoming' } }] },
      ];

      const valid = engine.getValidTransitions(withStatus(hyp), graph, rules);
      expect(valid.map(v => v.status)).toEqual(['TESTING']);
    });
  });

  describe('transition added via YAML without code changes', () => {
    it('new transition rule works through the engine', () => {
      // Simulating a new rule that could be added to YAML: question OPEN→RESOLVED
      const qst = makeNode({
        id: 'qst-001', type: 'question', status: 'OPEN',
        meta: { resolution: 'We found the answer' },
      });
      const graph = makeGraph([qst]);
      const rules: TransitionRule[] = [
        { from: 'OPEN', to: 'RESOLVED', conditions: [{ fn: 'field_present', args: { name: 'resolution' } }] },
      ];

      const result = engine.validate(withStatus(qst), graph, rules, 'RESOLVED');
      expect(result.valid).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';
import type { Graph, Node, Link } from '../../../src/graph/types.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeNode(id: string, type: string, status: string, links: Link[] = []): Node {
  return { id, type: type as Node['type'], title: id, path: '', status, confidence: 0.5, tags: [], links, meta: {} };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

// ═══════════════════════════════════════════════════════════════════════
// T15: all_linked_with vacuous truth guard
//
// Tests that the engine's rule evaluation for DISPUTED→ACTIVE requires
// at least one incoming 'contradicts' edge (vacuous truth = false).
// Uses engine.getValidTransitions() directly for precise control.
// ═══════════════════════════════════════════════════════════════════════

describe('all_linked_with vacuous truth guard (engine direct)', () => {
  it('prevents DISPUTED→ACTIVE when zero contradicts edges exist', async () => {
    const { engine } = await import('../../../src/graph/engine-setup.js');
    const { TRANSITION_TABLE, MANUAL_TRANSITIONS } = await import('../../../src/graph/derive-constants.js');

    // Knowledge node with DISPUTED status, NO incoming contradicts edges
    const graph = makeGraph([
      makeNode('knw-001', 'knowledge', 'DISPUTED'),
      makeNode('hyp-001', 'hypothesis', 'TESTING', [
        { target: 'knw-001', relation: 'supports' }, // supports, not contradicts
      ]),
    ]);

    const entity = { id: 'knw-001', type: 'knowledge', status: 'DISPUTED', meta: {} };
    const rules = TRANSITION_TABLE.knowledge ?? [];
    const manual = MANUAL_TRANSITIONS.knowledge ?? [];

    const transitions = engine.getValidTransitions(entity, graph, rules, manual);

    // DISPUTED→ACTIVE rule requires all_linked_with(contradicts, RETRACTED)
    // With 0 contradicts edges, vacuous truth guard returns false
    const activeTransition = transitions.find(t => t.status === 'ACTIVE');
    expect(activeTransition).toBeUndefined();

    // Manual transition DISPUTED→RETRACTED should still be available
    const retractedTransition = transitions.find(t => t.status === 'RETRACTED');
    expect(retractedTransition).toBeDefined();
    expect(retractedTransition!.rule).toBeNull(); // manual transitions have rule=null
  });

  it('allows DISPUTED→ACTIVE when all contradicts sources are RETRACTED', async () => {
    const { engine } = await import('../../../src/graph/engine-setup.js');
    const { TRANSITION_TABLE, MANUAL_TRANSITIONS } = await import('../../../src/graph/derive-constants.js');

    // All contradicting nodes are RETRACTED
    const graph = makeGraph([
      makeNode('knw-001', 'knowledge', 'DISPUTED'),
      makeNode('fnd-001', 'finding', 'RETRACTED', [
        { target: 'knw-001', relation: 'contradicts' },
      ]),
      makeNode('fnd-002', 'finding', 'RETRACTED', [
        { target: 'knw-001', relation: 'contradicts' },
      ]),
    ]);

    const entity = { id: 'knw-001', type: 'knowledge', status: 'DISPUTED', meta: {} };
    const rules = TRANSITION_TABLE.knowledge ?? [];
    const manual = MANUAL_TRANSITIONS.knowledge ?? [];

    const transitions = engine.getValidTransitions(entity, graph, rules, manual);

    // All contradicts sources are RETRACTED → condition met → ACTIVE transition available
    const activeTransition = transitions.find(t => t.status === 'ACTIVE');
    expect(activeTransition).toBeDefined();
    expect(activeTransition!.matchedIds).toContain('fnd-001');
    expect(activeTransition!.matchedIds).toContain('fnd-002');
  });

  it('blocks DISPUTED→ACTIVE when only some contradicts sources are RETRACTED', async () => {
    const { engine } = await import('../../../src/graph/engine-setup.js');
    const { TRANSITION_TABLE } = await import('../../../src/graph/derive-constants.js');

    // One RETRACTED, one still VALIDATED → partial → condition not met
    const graph = makeGraph([
      makeNode('knw-001', 'knowledge', 'DISPUTED'),
      makeNode('fnd-001', 'finding', 'RETRACTED', [
        { target: 'knw-001', relation: 'contradicts' },
      ]),
      makeNode('fnd-002', 'finding', 'VALIDATED', [
        { target: 'knw-001', relation: 'contradicts' },
      ]),
    ]);

    const entity = { id: 'knw-001', type: 'knowledge', status: 'DISPUTED', meta: {} };
    const rules = TRANSITION_TABLE.knowledge ?? [];

    const transitions = engine.getValidTransitions(entity, graph, rules);

    const activeTransition = transitions.find(t => t.status === 'ACTIVE');
    expect(activeTransition).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// T16: traceImpact what-if cascade + BFS merge
//
// Tests that what-if mode produces correct cascade trace structure
// and merges BFS scores with cascade results.
// ═══════════════════════════════════════════════════════════════════════

describe('traceImpact what-if cascade structure', () => {
  it('produces valid cascade trace with trigger and BFS scores', async () => {
    const { createEmddOrchestrator } = await import('../../../src/graph/orchestrator-setup.js');

    const orchestrator = createEmddOrchestrator();
    const graph = makeGraph([
      makeNode('hyp-001', 'hypothesis', 'TESTING', [
        { target: 'knw-001', relation: 'supports' },
      ]),
      makeNode('knw-001', 'knowledge', 'ACTIVE'),
    ]);

    const entities = new Map([
      ['hyp-001', { id: 'hyp-001', type: 'hypothesis', status: 'TESTING', meta: {} }],
      ['knw-001', { id: 'knw-001', type: 'knowledge', status: 'ACTIVE', meta: {} }],
    ]);
    const relations = [{ name: 'supports', sourceId: 'hyp-001', targetId: 'knw-001' }];

    const result = orchestrator.simulate(entities, relations, graph, {
      entityId: 'hyp-001',
      targetStatus: 'SUPPORTED',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const trace = result.trace;

    // Trigger is correctly set
    expect(trace.trigger.entityId).toBe('hyp-001');
    expect(trace.trigger.from).toBe('TESTING');
    expect(trace.trigger.to).toBe('SUPPORTED');

    // Structure invariants
    expect(trace.converged).toBe(true);
    expect(trace.rounds).toBeGreaterThanOrEqual(0);
    expect(trace.finalStates).toBeDefined();
    expect(trace.finalStates.get('hyp-001')).toBe('SUPPORTED');

    // Steps and unresolved are arrays
    expect(Array.isArray(trace.steps)).toBe(true);
    expect(Array.isArray(trace.unresolved)).toBe(true);
    expect(Array.isArray(trace.availableManualTransitions)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// T17: Unresolved conflict — CONTESTED hypothesis
//
// Tests that engine detects conflict when both SUPPORTED and REFUTED
// conditions are met simultaneously for a CONTESTED hypothesis.
// Uses engine.getValidTransitions() for direct rule evaluation.
// ═══════════════════════════════════════════════════════════════════════

describe('CONTESTED hypothesis conflict detection (engine direct)', () => {
  it('finds both SUPPORTED and REFUTED as valid targets when conditions overlap', async () => {
    const { engine } = await import('../../../src/graph/engine-setup.js');
    const { TRANSITION_TABLE } = await import('../../../src/graph/derive-constants.js');

    // CONTESTED→SUPPORTED requires: supports(strength>=0.7, incoming) AND decision(ACCEPTED, incoming)
    // CONTESTED→REFUTED requires: contradicts(incoming) AND decision(ACCEPTED, incoming)
    const graph = makeGraph([
      makeNode('hyp-001', 'hypothesis', 'CONTESTED'),
      makeNode('fnd-001', 'finding', 'VALIDATED', [
        { target: 'hyp-001', relation: 'supports', strength: 0.85 },
      ]),
      makeNode('fnd-002', 'finding', 'VALIDATED', [
        { target: 'hyp-001', relation: 'contradicts' },
      ]),
      makeNode('dec-001', 'decision', 'ACCEPTED', [
        { target: 'hyp-001', relation: 'supports' },
      ]),
    ]);

    const entity = { id: 'hyp-001', type: 'hypothesis', status: 'CONTESTED', meta: {} };
    const rules = TRANSITION_TABLE.hypothesis ?? [];

    const transitions = engine.getValidTransitions(entity, graph, rules);

    // Both SUPPORTED and REFUTED should be valid targets (conflict)
    const targetStatuses = transitions.map(t => t.status);
    expect(targetStatuses).toContain('SUPPORTED');
    expect(targetStatuses).toContain('REFUTED');

    // This conflict would cause the orchestrator to add to unresolved[]
    // and NOT apply either transition
  });

  it('resolves to single target when only SUPPORTED conditions are met', async () => {
    const { engine } = await import('../../../src/graph/engine-setup.js');
    const { TRANSITION_TABLE } = await import('../../../src/graph/derive-constants.js');

    // Only SUPPORTED conditions met (no contradicts)
    const graph = makeGraph([
      makeNode('hyp-001', 'hypothesis', 'CONTESTED'),
      makeNode('fnd-001', 'finding', 'VALIDATED', [
        { target: 'hyp-001', relation: 'supports', strength: 0.85 },
      ]),
      makeNode('dec-001', 'decision', 'ACCEPTED', [
        { target: 'hyp-001', relation: 'supports' },
      ]),
    ]);

    const entity = { id: 'hyp-001', type: 'hypothesis', status: 'CONTESTED', meta: {} };
    const rules = TRANSITION_TABLE.hypothesis ?? [];

    const transitions = engine.getValidTransitions(entity, graph, rules);

    const targetStatuses = [...new Set(transitions.map(t => t.status))];
    // Only SUPPORTED should be valid (no REFUTED without contradicts)
    expect(targetStatuses).toContain('SUPPORTED');
    expect(targetStatuses).not.toContain('REFUTED');
  });
});

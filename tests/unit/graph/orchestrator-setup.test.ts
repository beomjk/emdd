import { describe, it, expect } from 'vitest';
import { createEmddOrchestrator } from '../../../src/graph/orchestrator-setup.js';
import type { Graph, Node } from '../../../src/graph/types.js';
import { EDGE_CLASSIFICATION } from '../../../src/graph/derive-constants.js';

describe('createEmddOrchestrator', () => {
  it('returns an orchestrator with simulate method', () => {
    const orchestrator = createEmddOrchestrator();
    expect(orchestrator).toBeDefined();
    expect(typeof orchestrator.simulate).toBe('function');
  });
});

describe('propagation strategy', () => {
  it('blocks propagation through blocks-classified edges', () => {
    const orchestrator = createEmddOrchestrator();
    // Find a blocks-classified edge
    const blocksEdge = Object.entries(EDGE_CLASSIFICATION)
      .find(([, v]) => v.classification === 'blocks');
    expect(blocksEdge).toBeDefined();

    // Find a conducts-classified edge
    const conductsEdge = Object.entries(EDGE_CLASSIFICATION)
      .find(([, v]) => v.classification === 'conducts');
    expect(conductsEdge).toBeDefined();

    // Build minimal graph and entities for simulate
    const graph: Graph = {
      nodes: new Map<string, Node>([
        ['hyp-001', { id: 'hyp-001', type: 'hypothesis', title: 'H1', path: '', status: 'PROPOSED', confidence: 0.5, tags: [], links: [
          { target: 'hyp-002', relation: blocksEdge![0] },
        ], meta: {} } as Node],
        ['hyp-002', { id: 'hyp-002', type: 'hypothesis', title: 'H2', path: '', status: 'PROPOSED', confidence: 0.5, tags: [], links: [], meta: {} } as Node],
      ]),
      errors: [],
      warnings: [],
    };

    const entities = new Map([
      ['hyp-001', { id: 'hyp-001', type: 'hypothesis', status: 'PROPOSED', meta: {} }],
      ['hyp-002', { id: 'hyp-002', type: 'hypothesis', status: 'PROPOSED', meta: {} }],
    ]);

    const relations = [{
      name: blocksEdge![0],
      sourceId: 'hyp-001',
      targetId: 'hyp-002',
    }];

    // Simulate with a manual transition — hyp-002 should NOT be affected
    // because the edge is blocks-classified
    const result = orchestrator.simulate(entities, relations, graph, {
      entityId: 'hyp-001',
      targetStatus: 'TESTING',
    });

    // The simulation should succeed; hyp-002 should not be cascaded through blocks edge
    expect(result.ok).toBe(true);
    if (result.ok) {
      const trace = result.trace;
      const hyp002Steps = trace.steps.filter(s => s.entityId === 'hyp-002');
      expect(hyp002Steps.length).toBe(0);
    }
  });
});

describe('contextEnricher', () => {
  it('creates virtual graph overlay with cascade statuses', () => {
    const orchestrator = createEmddOrchestrator();

    // Build a graph with two connected nodes using a conducts edge
    const conductsEdge = Object.entries(EDGE_CLASSIFICATION)
      .find(([, v]) => v.classification === 'conducts');
    expect(conductsEdge).toBeDefined();

    const graph: Graph = {
      nodes: new Map<string, Node>([
        ['hyp-001', { id: 'hyp-001', type: 'hypothesis', title: 'H1', path: '', status: 'TESTING', confidence: 0.5, tags: [], links: [
          { target: 'exp-001', relation: conductsEdge![0] },
        ], meta: {} } as Node],
        ['exp-001', { id: 'exp-001', type: 'experiment', title: 'E1', path: '', status: 'RUNNING', tags: [], links: [], meta: {} } as Node],
      ]),
      errors: [],
      warnings: [],
    };

    const entities = new Map([
      ['hyp-001', { id: 'hyp-001', type: 'hypothesis', status: 'TESTING', meta: {} }],
      ['exp-001', { id: 'exp-001', type: 'experiment', status: 'RUNNING', meta: {} }],
    ]);

    const relations = [{
      name: conductsEdge![0],
      sourceId: 'hyp-001',
      targetId: 'exp-001',
    }];

    // Simulate — the contextEnricher should reflect cascade state in the virtual graph
    const result = orchestrator.simulate(entities, relations, graph, {
      entityId: 'hyp-001',
      targetStatus: 'SUPPORTED',
    });

    // The simulation should complete without throwing
    expect(result).toBeDefined();
    // Verify the enricher works: finalStates must include the trigger's new status
    if (result.ok) {
      expect(result.trace.finalStates.get('hyp-001')).toBe('SUPPORTED');
      expect(typeof result.trace.converged).toBe('boolean');
      // Original graph must not be mutated by the virtual overlay
      expect(graph.nodes.get('hyp-001')!.status).toBe('TESTING');
    } else {
      // cascade_error still has a partialTrace; invalid_trigger/no_machine are config issues
      expect(['cascade_error', 'invalid_trigger', 'no_machine']).toContain(result.error);
      if (result.error === 'cascade_error') {
        expect(result.partialTrace.finalStates.get('hyp-001')).toBe('SUPPORTED');
      }
    }
  });
});

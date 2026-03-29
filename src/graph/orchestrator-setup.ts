/**
 * orchestrator-setup.ts — Creates EMDD Orchestrator for cascade simulation.
 *
 * Uses @beomjk/state-engine Orchestrator with EMDD's transition rules,
 * graph presets, and edge classification for propagation strategy.
 */
import { createOrchestrator } from '@beomjk/state-engine/orchestrator';
import type { Orchestrator, PropagationStrategy, RelationInstance } from '@beomjk/state-engine/orchestrator';
import { engine } from './engine-setup.js';
import { TRANSITION_TABLE, MANUAL_TRANSITIONS, RELATION_DEFINITIONS, EDGE_CLASSIFICATION, NODE_TYPES } from './derive-constants.js';
import type { Graph } from './types.js';

/**
 * Create an EMDD-configured Orchestrator for cascade simulation.
 * Propagation strategy: blocks-classified edges stop propagation.
 * Context enricher: passes the full Graph as context for graph presets.
 */
export function createEmddOrchestrator(): Orchestrator<Graph> {
  const machines: Record<string, { rules: { from: string; to: string; conditions: { fn: string; args: Record<string, unknown> }[] }[]; manualTransitions?: { from: string; to: string }[] }> = {};

  for (const nodeType of NODE_TYPES) {
    const rules = TRANSITION_TABLE[nodeType];
    const manual = MANUAL_TRANSITIONS[nodeType];
    if (rules || manual) {
      machines[nodeType] = {
        rules: rules ?? [],
        ...(manual ? { manualTransitions: manual } : {}),
      };
    }
  }

  // Propagation strategy: block propagation through blocks-classified edges
  const propagation: PropagationStrategy = (_change, relation) => {
    const cls = EDGE_CLASSIFICATION[relation.name];
    if (cls && cls.classification === 'blocks') return false;
    return true;
  };

  return createOrchestrator<Graph>({
    engine,
    machines,
    relations: RELATION_DEFINITIONS,
    propagation,
    maxCascadeDepth: 10,
    contextEnricher: (baseContext, getStatus) => {
      // Create a virtual graph overlay where entity statuses reflect cascade state
      const virtualNodes = new Map(baseContext.nodes);
      for (const [id, node] of virtualNodes) {
        const cascadeStatus = getStatus(id);
        if (cascadeStatus && cascadeStatus !== node.status) {
          virtualNodes.set(id, { ...node, status: cascadeStatus });
        }
      }
      return { ...baseContext, nodes: virtualNodes };
    },
  });
}

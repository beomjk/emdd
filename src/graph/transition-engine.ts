import type { Node, Graph } from './types.js';
import { PRESET_REGISTRY, type PresetResult } from './transition-presets.js';

export interface TransitionRule {
  from: string;
  to: string;
  conditions: { fn: string; args: Record<string, unknown> }[];
}

export interface ManualTransition {
  from: string;
  to: string;
}

export interface EvaluationResult {
  met: boolean;
  matchedNodeIds: string[];
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  evidenceIds: string[];
}

/**
 * Evaluates a transition rule's conditions against a node using AND logic.
 * All conditions must be met for the transition to be valid.
 * Returns aggregated matched node IDs from all conditions.
 */
export function evaluateTransition(
  node: Node,
  graph: Graph,
  rule: TransitionRule,
): EvaluationResult {
  const allMatchedNodeIds: string[] = [];

  for (const condition of rule.conditions) {
    const presetFn = PRESET_REGISTRY[condition.fn];
    if (!presetFn) {
      throw new Error(
        `Unknown preset function "${condition.fn}" in transition ${rule.from}→${rule.to}`
      );
    }
    const result: PresetResult = presetFn(node, graph, condition.args);
    if (!result.met) {
      return { met: false, matchedNodeIds: [] };
    }
    for (const id of result.matchedNodeIds) {
      if (!allMatchedNodeIds.includes(id)) {
        allMatchedNodeIds.push(id);
      }
    }
  }

  return { met: true, matchedNodeIds: allMatchedNodeIds };
}

/**
 * Returns list of valid target statuses for a node given the transition table.
 */
export function getValidTransitions(
  node: Node,
  graph: Graph,
  transitionTable: TransitionRule[],
): string[] {
  const valid: string[] = [];
  for (const rule of transitionTable) {
    if (rule.from !== node.status) continue;
    const result = evaluateTransition(node, graph, rule);
    if (result.met && !valid.includes(rule.to)) {
      valid.push(rule.to);
    }
  }
  return valid;
}

/**
 * Validates whether a specific transition is allowed for a node.
 * Checks both automatic transitions (with conditions) and manual transitions (no conditions).
 */
export function validateTransition(
  node: Node,
  graph: Graph,
  transitionTable: TransitionRule[],
  targetStatus: string,
  manualTransitions?: ManualTransition[],
): ValidationResult {
  // Check automatic transitions
  for (const rule of transitionTable) {
    if (rule.from !== node.status || rule.to !== targetStatus) continue;
    const result = evaluateTransition(node, graph, rule);
    if (result.met) {
      return { valid: true, evidenceIds: result.matchedNodeIds };
    }
  }

  // Check manual transitions
  if (manualTransitions) {
    for (const mt of manualTransitions) {
      if (mt.to !== targetStatus) continue;
      if (mt.from === 'ANY' || mt.from === node.status) {
        return { valid: true, evidenceIds: [] };
      }
    }
  }

  return {
    valid: false,
    reason: `No valid transition from ${node.status} to ${targetStatus}`,
    evidenceIds: [],
  };
}

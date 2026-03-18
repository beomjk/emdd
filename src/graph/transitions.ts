import { loadGraph } from './loader.js';
import { TRANSITION_TABLE, MANUAL_TRANSITIONS } from './types.js';
import { evaluateTransition } from './transition-engine.js';

export interface TransitionRecommendation {
  nodeId: string;
  currentStatus: string;
  recommendedStatus: string;
  reason: string;
  evidenceIds: string[];
}

export async function detectTransitions(graphDir: string): Promise<TransitionRecommendation[]> {
  const graph = await loadGraph(graphDir);
  const recommendations: TransitionRecommendation[] = [];

  for (const [nodeId, node] of graph.nodes) {
    const rules = TRANSITION_TABLE[node.type];
    if (!rules) continue;

    // Track which from-statuses have already matched (first match wins per from-status)
    const matchedFromStatuses = new Set<string>();

    for (const rule of rules) {
      if (rule.from !== node.status) continue;
      if (matchedFromStatuses.has(rule.from)) continue;

      const result = evaluateTransition(node, graph, rule);
      if (result.met) {
        const conditionNames = rule.conditions.map(c => c.fn).join(', ');
        recommendations.push({
          nodeId,
          currentStatus: node.status!,
          recommendedStatus: rule.to,
          reason: `Transition ${rule.from}→${rule.to}: ${conditionNames} condition met`,
          evidenceIds: result.matchedNodeIds,
        });
        matchedFromStatuses.add(rule.from);
      }
    }
  }

  return recommendations;
}

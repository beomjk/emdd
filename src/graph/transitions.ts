import { loadGraph } from './loader.js';
import type { NodeWithStatus } from './types.js';
import { TRANSITION_TABLE } from './types.js';
import { engine } from './engine-setup.js';

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
    if (!rules || !node.status) continue;

    const validTransitions = engine.getValidTransitions(
      node as NodeWithStatus, graph, rules,
    );

    // First passing rule wins (declaration-order priority).
    // getValidTransitions returns all matching rules, but we only take the first.
    if (validTransitions.length > 0) {
      const first = validTransitions[0];
      if (first.rule) {
        const conditionNames = first.rule.conditions.map(c => c.fn).join(', ');
        recommendations.push({
          nodeId,
          currentStatus: node.status,
          recommendedStatus: first.status,
          reason: `Transition ${first.rule.from}→${first.rule.to}: ${conditionNames} condition met`,
          evidenceIds: first.matchedIds,
        });
      }
    }
  }

  return recommendations;
}

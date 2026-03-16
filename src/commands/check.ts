import { loadGraph } from '../graph/loader.js';

export interface CheckTrigger {
  type: string;
  message: string;
  count?: number;
}

export interface CheckResult {
  triggers: CheckTrigger[];
}

/**
 * Check consolidation triggers in the graph.
 *
 * Triggers:
 * 1. 5+ unpromoted findings
 * 2. 3+ episodes accumulated
 * 3. All questions resolved (0 open) when questions exist
 */
export async function checkCommand(graphDir: string): Promise<CheckResult> {
  const graph = await loadGraph(graphDir);
  const triggers: CheckTrigger[] = [];

  // Categorize nodes by type
  const findings: string[] = [];
  const episodes: string[] = [];
  const openQuestions: string[] = [];
  const questionCount = { total: 0 };
  const promotedIds = new Set<string>();

  for (const [id, node] of graph.nodes) {
    switch (node.type) {
      case 'finding':
        findings.push(id);
        break;
      case 'episode':
        episodes.push(id);
        break;
      case 'question':
        questionCount.total++;
        if (node.status === 'OPEN') {
          openQuestions.push(id);
        }
        break;
      case 'knowledge':
        // Track which findings have been promoted
        for (const link of node.links) {
          if (link.relation === 'promotes') {
            promotedIds.add(link.target);
          }
        }
        break;
    }
  }

  // 1. Unpromoted findings threshold (5)
  const unpromoted = findings.filter(id => !promotedIds.has(id));
  if (unpromoted.length >= 5) {
    triggers.push({
      type: 'findings',
      message: `Findings pending consolidation: ${unpromoted.length} (threshold: 5)`,
      count: unpromoted.length,
    });
  }

  // 2. Episode accumulation threshold (3)
  if (episodes.length >= 3) {
    triggers.push({
      type: 'episodes',
      message: `Episodes since last consolidation: ${episodes.length} (threshold: 3)`,
      count: episodes.length,
    });
  }

  // 3. All questions resolved (no open questions when questions exist)
  if (questionCount.total > 0 && openQuestions.length === 0) {
    triggers.push({
      type: 'questions',
      message: `All questions resolved — consider generating new ones`,
      count: 0,
    });
  }

  return { triggers };
}

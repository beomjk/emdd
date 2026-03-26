import { loadGraph } from './loader.js';
import { getHypothesisMeta } from './accessors.js';
import { STATUS, VALID_STATUSES, IN_PROGRESS_STATUSES, INITIAL_STATUSES, THRESHOLDS } from './types.js';
import { nodeDate } from './date-utils.js';

export interface KillCriterionAlert {
  hypothesisId: string;
  killCriterion: string;
  trigger: 'low_confidence' | 'stale';
  message: string;
}

const INACTIVE_STATUSES = new Set(
  VALID_STATUSES.hypothesis.filter(s => !IN_PROGRESS_STATUSES.has(s) && !INITIAL_STATUSES.has(s))
);

export async function checkKillCriteria(graphDir: string): Promise<KillCriterionAlert[]> {
  const graph = await loadGraph(graphDir);
  const alerts: KillCriterionAlert[] = [];
  const now = new Date();

  for (const [, node] of graph.nodes) {
    if (node.type !== 'hypothesis') continue;
    if (INACTIVE_STATUSES.has(node.status ?? '')) continue;

    const meta = getHypothesisMeta(node);
    const killCriterion = meta?.kill_criterion;
    if (!killCriterion) continue;

    // Low confidence trigger
    if ((node.confidence ?? 0) < THRESHOLDS.kill_confidence) {
      alerts.push({
        hypothesisId: node.id,
        killCriterion,
        trigger: 'low_confidence',
        message: `Confidence ${node.confidence} is below ${THRESHOLDS.kill_confidence} — review kill criterion: "${killCriterion}"`,
      });
    }

    // Stale trigger: TESTING N+ days with no recent experiment
    if (node.status === STATUS.TESTING) {
      const updated = nodeDate(node);
      if (updated) {
        const daysElapsed = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
        if (daysElapsed >= THRESHOLDS.kill_stale_days) {
          alerts.push({
            hypothesisId: node.id,
            killCriterion,
            trigger: 'stale',
            message: `Kill criterion untested for ${daysElapsed} days: "${killCriterion}"`,
          });
        }
      }
    }
  }

  return alerts;
}

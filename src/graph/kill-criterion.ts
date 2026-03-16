import { loadGraph } from './loader.js';
import { getHypothesisMeta } from './accessors.js';

export interface KillCriterionAlert {
  hypothesisId: string;
  killCriterion: string;
  trigger: 'low_confidence' | 'stale';
  message: string;
}

const INACTIVE_STATUSES = new Set(['REFUTED', 'DEFERRED', 'SUPPORTED', 'REVISED']);

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
    if ((node.confidence ?? 0) < 0.3) {
      alerts.push({
        hypothesisId: node.id,
        killCriterion,
        trigger: 'low_confidence',
        message: `Confidence ${node.confidence} is below 0.3 — review kill criterion: "${killCriterion}"`,
      });
    }

    // Stale trigger: TESTING 14+ days with no recent experiment
    if (node.status === 'TESTING') {
      const updated = node.meta.updated ? new Date(String(node.meta.updated)) : null;
      if (updated) {
        const daysElapsed = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
        if (daysElapsed >= 14) {
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

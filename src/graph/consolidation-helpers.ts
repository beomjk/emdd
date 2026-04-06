import { EDGE } from './types.js';
import type { Graph } from './types.js';
import type { EmddConfig } from './config.js';

/** Count episodes in the graph created after `sinceDate`. */
export function countEpisodesSince(graph: Graph, sinceDate: Date): number {
  let count = 0;
  for (const node of graph.nodes.values()) {
    if (node.type === 'episode') {
      const created = node.meta.created ? new Date(String(node.meta.created)) : null;
      if (created && created > sinceDate) count++;
    }
  }
  return count;
}

/**
 * Determine the anchor date for "since last consolidation" counting.
 * Priority: (a) last_consolidation_date from .emdd.yml
 *           (d) newest created date among Knowledge nodes with promotes edges
 *           null if no consolidation evidence exists
 */
export function resolveConsolidationAnchor(config: EmddConfig, graph: Graph): Date | null {
  // (a) Explicit config date
  if (config.last_consolidation_date) {
    const d = new Date(config.last_consolidation_date);
    if (!isNaN(d.getTime())) return d;
  }

  // (d) Fallback: newest created date among Knowledge nodes with promotes edge
  let newest: Date | null = null;
  for (const node of graph.nodes.values()) {
    if (node.type === 'knowledge' && node.links.some(l => l.relation === EDGE.promotes)) {
      const created = node.meta.created ? new Date(String(node.meta.created)) : null;
      if (created && (!newest || created > newest)) {
        newest = created;
      }
    }
  }
  return newest;
}

/**
 * operations.ts — Re-export facade.
 *
 * All graph operations are implemented in focused modules.
 * This file re-exports them so that the 29+ files importing from
 * `./operations.js` continue to work without changes.
 */

import { loadGraph } from './loader.js';
import { lintGraph as _lintGraph } from './validator.js';

// ── Sole remaining function (thin wrapper) ─────────────────────────

/**
 * Convenience facade: load graph from directory and lint in one call.
 */
export async function lintGraphFromDir(graphDir: string) {
  const graph = await loadGraph(graphDir);
  return _lintGraph(graph);
}

// ── Re-exports from pre-existing modules ───────────────────────────

export { detectClusters, identifyClusters } from './clusters.js';
export { lintNode, lintGraph } from './validator.js';
export { analyzeRefutation } from './refutation.js';
export { detectTransitions } from './transitions.js';
export { propagateConfidence } from './confidence.js';
export { checkKillCriteria } from './kill-criterion.js';
export { listBranchGroups } from './branch-groups.js';
export { traceImpact } from './impact.js';
export { generateIndex } from './index-generator.js';
export { getBacklog } from './backlog.js';

// ── Re-exports from newly extracted modules ────────────────────────

export { executeOps } from './file-ops.js';

export { listNodes, readNode, readNodes, getNeighbors } from './query.js';
export type { NeighborNode } from './query.js';

export { planCreateNode, createNode, updateNode, markDone, writeIndex, markConsolidated } from './node-crud.js';

export { planCreateEdge, createEdge, deleteEdge } from './edge-crud.js';

export { getHealth } from './health.js';

export { checkConsolidation, getPromotionCandidates } from './consolidation.js';

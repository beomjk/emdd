import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { loadGraph } from './loader.js';
import { nextId, renderTemplate, nodePath, sanitizeSlug } from './templates.js';
import { NODE_TYPES, NODE_TYPE_DIRS, ALL_VALID_RELATIONS, REVERSE_LABELS, THRESHOLDS, VALID_STATUSES, ENUM_FIELD_VALIDATORS, EDGE_ATTRIBUTE_NAMES, EDGE_ATTRIBUTE_RANGES, EDGE_ATTRIBUTE_ENUM_VALUES, TRANSITION_POLICY_DEFAULT, TRANSITION_TABLE, MANUAL_TRANSITIONS, CEREMONY_TRIGGERS, URGENCY, VALUE_PRODUCING_EDGES, EDGE, STATUS } from './types.js';
import { checkEdgeAffinity, getPresentAttrKeys } from './edge-attrs.js';
import { engine } from './engine-setup.js';
import { collectDeferredIds, buildNodeToComponent, getConnectedComponents } from './utils.js';
import { toGraphologyGraph } from './graphology-bridge.js';
import { normalizeDateFields, nodeDate } from './date-utils.js';
import { suggest } from '../utils/suggest.js';
import type {
  Node,
  NodeType,
  NodeFilter,
  NodeDetail,
  NodeWithStatus,
  Graph,
  CreateNodeResult,
  CreateEdgeResult,
  CreateNodePlan,
  CreateEdgePlan,
  EdgeAttributes,
  FileOp,
  HealthReport,
  GapDetail,
  CheckResult,
  CheckTrigger,
  PromoteCandidate,
  UpdateNodeResult,
  DeleteEdgeResult,
  DoneMarker,
  MarkDoneResult,
} from './types.js';
import { loadConfig, saveConfig } from './config.js';
import type { EmddConfig } from './config.js';
export { detectClusters, identifyClusters } from './clusters.js';
export { lintNode, lintGraph } from './validator.js';
import { lintGraph as _lintGraph } from './validator.js';

/**
 * Convenience facade: load graph from directory and lint in one call.
 */
export async function lintGraphFromDir(graphDir: string) {
  const graph = await loadGraph(graphDir);
  return _lintGraph(graph);
}
export { analyzeRefutation } from './refutation.js';
export { detectTransitions } from './transitions.js';
export { propagateConfidence } from './confidence.js';
export { checkKillCriteria } from './kill-criterion.js';
export { listBranchGroups } from './branch-groups.js';
export { traceImpact } from './impact.js';
export { generateIndex } from './index-generator.js';
export { getBacklog } from './backlog.js';
import { generateIndex as _generateIndex } from './index-generator.js';
import { t } from '../i18n/index.js';
import type { Locale } from '../i18n/index.js';

// ── query functions (moved to query.ts) ─────────────────────────────
export { listNodes, readNode, readNodes, getNeighbors } from './query.js';
export type { NeighborNode } from './query.js';

// ── executeOps ──────────────────────────────────────────────────────
// (moved to file-ops.ts)

import { executeOps } from './file-ops.js';
export { executeOps } from './file-ops.js';

// ── node CRUD (moved to node-crud.ts) ──────────────────────────────
export { planCreateNode, createNode, updateNode, markDone, writeIndex, markConsolidated } from './node-crud.js';

// ── edge CRUD (moved to edge-crud.ts) ──────────────────────────────
export { planCreateEdge, createEdge, deleteEdge } from './edge-crud.js';

// ── Shared helpers (moved to consolidation-helpers.ts) ─────────────
import { countEpisodesSince, resolveConsolidationAnchor } from './consolidation-helpers.js';

// ── getHealth (moved to health.ts) ──────────────────────────────────
export { getHealth } from './health.js';

// ── getNeighbors (moved to query.ts, re-exported above) ────────────

// ── consolidation (moved to consolidation.ts) ──────────────────────
export { checkConsolidation, getPromotionCandidates } from './consolidation.js';

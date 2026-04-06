// ── EMDD Public API ──────────────────────────────────────────────────
// Curated exports for library consumers.
// CLI and MCP server have their own entry points (cli.ts, mcp-server/index.ts).

// Core graph operations
export { loadGraph, resolveGraphDir } from './graph/loader.js';
export {
  listNodes,
  readNode,
  readNodes,
  createNode,
  planCreateNode,
  createEdge,
  planCreateEdge,
  executeOps,
  updateNode,
  deleteEdge,
  markDone,
  markConsolidated,
  getHealth,
  getNeighbors,
  checkConsolidation,
  getPromotionCandidates,
  detectTransitions,
  propagateConfidence,
  traceImpact,
  lintGraph,
  lintNode,
  detectClusters,
  getBacklog,
  checkKillCriteria,
  listBranchGroups,
  analyzeRefutation,
} from './graph/operations.js';

// Types
export type {
  Node,
  Graph,
  Link,
  NodeDetail,
  NodeWithStatus,
  NodeFilter,
  NodeType,
  EdgeAttributes,
  CreateNodeResult,
  CreateEdgeResult,
  CreateNodePlan,
  CreateEdgePlan,
  FileOp,
  UpdateNodeResult,
  DeleteEdgeResult,
  DoneMarker,
  MarkDoneResult,
  MarkConsolidatedResult,
  HealthReport,
  GapDetail,
  CheckResult,
  CheckTrigger,
  PromoteCandidate,
  ImpactReport,
} from './graph/types.js';

export type { NeighborNode } from './graph/query.js';

// i18n
export { t, setLocale, getLocale } from './i18n/index.js';
export type { MessageKey } from './i18n/en.js';
export type { Locale } from './i18n/index.js';

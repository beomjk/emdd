// ── Re-export derived constants and types ────────────────────────────
// All constants, type unions, and valid-value arrays are derived
// from schema.config.ts. See derive-constants.ts.

export * from './derive-constants.js';

// ── Data Interfaces ─────────────────────────────────────────────────

import type { NodeType, EdgeAttributes } from './derive-constants.js';

export type { EdgeAttributes };

export interface Link extends EdgeAttributes {
  target: string;
  relation: string;
}

export interface Node {
  id: string;
  type: NodeType;
  title: string;
  path: string;
  status?: string;
  confidence?: number;
  tags: string[];
  links: Link[];
  meta: Record<string, unknown>;
}

export interface Graph {
  nodes: Map<string, Node>;
  errors: string[];
  warnings: string[];
}

/**
 * A Node with guaranteed status. Satisfies @beomjk/state-engine Entity
 * interface (status: string). Use at transition evaluation boundaries
 * where status existence has already been verified.
 */
export type NodeWithStatus = Node & { status: string };

// ── Operations Return Types ────────────────────────────────────────

export interface NodeFilter {
  type?: NodeType;
  status?: string;
  since?: string;
}

export interface NodeDetail extends Node {
  body: string;
}

export interface CreateNodeResult {
  id: string;
  type: NodeType;
  path: string;
}

export interface CreateEdgeResult extends EdgeAttributes {
  source: string;
  target: string;
  relation: string;
  skipped?: boolean;
}

export interface UpdateNodeResult {
  nodeId: string;
  updatedFields: string[];
  updatedDate: string;
  warnings?: string[];
}

export interface DeleteEdgeResult {
  source: string;
  target: string;
  deletedCount: number;
  deletedRelations: string[];
}

export type DoneMarker = 'done' | 'deferred' | 'superseded';

export interface MarkDoneResult {
  episodeId: string;
  item: string;
  marker: DoneMarker;
}

export interface MarkConsolidatedResult {
  date: string;
}

export interface GapDetail {
  type: 'untested_hypothesis' | 'blocking_question' | 'stale_knowledge' | 'orphan_finding' | 'disconnected_cluster';
  nodeIds: string[];
  message: string;
  triggerType?: 'days' | 'episodes' | 'both';
}

export interface HealthReport {
  totalNodes: number;
  totalEdges: number;
  byType: Record<NodeType, number>;
  statusDistribution: Record<NodeType, Record<string, number>>;
  avgConfidence: number | null;
  openQuestions: number;
  linkDensity: number;
  gaps: string[];
  gapDetails: GapDetail[];
  deferredItems: string[];
  affinityViolations: string[];
}

export interface CheckTrigger {
  type: string;
  message: string;
  count?: number;
}

export interface CheckResult {
  triggers: CheckTrigger[];
  promotionCandidates: PromoteCandidate[];
  orphanFindings: string[];
  deferredItems: string[];
}

export interface PromoteCandidate {
  id: string;
  confidence: number;
  supports: number;
  reason: 'confidence' | 'de_facto' | 'both';
}

// ── File Operations (plan+execute pattern) ────────────────────────

export interface WriteFileOp { kind: 'write'; path: string; content: string; }
export interface MkdirOp { kind: 'mkdir'; path: string; }
export type FileOp = WriteFileOp | MkdirOp;

export interface CreateNodePlan { id: string; type: NodeType; path: string; ops: FileOp[]; }
export interface CreateEdgePlan { source: string; target: string; relation: string; ops: FileOp[]; skipped?: boolean; }

// ── Impact Analysis Types ──────────────────────────────────────────

export type { PropagationClass, EdgeClassificationEntry } from './derive-constants.js';

export interface ImpactReport {
  seed: {
    nodeId: string;
    nodeType: NodeType;
    currentStatus: string;
    whatIfStatus?: string;
  };
  impactedNodes: ImpactedNode[];
  cascadeTrace?: {
    trigger: { entityId: string; entityType: string; from: string; to: string };
    steps: Array<{ entityId: string; entityType: string; from: string; to: string; round: number; triggeredBy: string[] }>;
    unresolved: Array<{ entityId: string; entityType: string; candidates: Array<{ to: string }> }>;
    availableManualTransitions: Array<{ entityId: string; entityType: string; from: string; to: string }>;
    affected: string[];
    finalStates: Record<string, string>;
    converged: boolean;
    rounds: number;
  };
  summary: {
    totalAffected: number;
    maxScore: number;
    avgScore: number;
    affectedByType: Record<string, number>;
  };
}

export interface ImpactedNode {
  nodeId: string;
  nodeType: NodeType;
  currentStatus: string;
  aggregateScore: number;
  bestPathScore: number;
  /** BFS hop count from seed. -1 indicates cascade-only impact (orchestrator-affected, not BFS-reachable). */
  depth: number;
  bestPath: string[];
  bestPathEdges: string[];
  pathCount: number;
  autoTransition?: {
    from: string;
    to: string;
    matchedIds: string[];
  };
}

export interface ImpactScoringState {
  complementProduct: number;
  bestPathScore: number;
  bestPath: string[];
  bestPathEdges: string[];
  depth: number;
  pathCount: number;
}

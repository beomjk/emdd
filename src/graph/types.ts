// ── Re-export generated constants and types ─────────────────────────
// All constants, type unions, and valid-value arrays are auto-generated
// from graph-schema.yaml. See types.generated.ts.

export * from './types.generated.js';

// ── Data Interfaces ─────────────────────────────────────────────────

import type { NodeType, EdgeAttributes } from './types.generated.js';

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

// ── Operations Return Types ────────────────────────────────────────

export interface NodeFilter {
  type?: NodeType;
  status?: string;
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
  byType: Record<string, number>;
  statusDistribution: Record<string, Record<string, number>>;
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
export interface CreateEdgePlan { source: string; target: string; relation: string; ops: FileOp[]; }

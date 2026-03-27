// ── Serialized types for REST API responses ──────────────────────────

export interface SerializedGraph {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  loadedAt: string; // ISO 8601
}

export interface SerializedNode {
  id: string;
  title: string;
  type: string;
  status: string;
  confidence?: number;
  tags: string[];
  links: { target: string; relation: string }[];
  created?: string;
  updated?: string;
  invalid?: boolean;
  parseError?: string;
  bodyPreview?: string;
}

export interface SerializedEdge {
  source: string;
  target: string;
  relation: string;
}

// ── Cluster types ────────────────────────────────────────────────────

export interface VisualCluster {
  id: string;
  label: string;
  nodeIds: string[];
  isManual: boolean;
}

// ── Re-export existing types used by web layer ───────────────────────

export type {
  HealthReport,
  GapDetail,
  PromoteCandidate,
  CheckResult,
  CheckTrigger,
} from '../graph/types.js';

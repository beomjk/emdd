import type {
  GraphTheme,
  MotionProfile,
  VisualElementKind,
  VisualStateKind,
  VisualStateToken,
} from './visual-state.js';

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

// ── Layout mode ─────────────────────────────────────────────────────

export type LayoutMode = 'force' | 'hierarchical';

export interface ExportRequest {
  layout?: LayoutMode;
  theme?: GraphTheme;
  types?: string[];
  statuses?: string[];
  edgeTypes?: string[];
}

export interface ExportRenderOptions extends ExportRequest {
  clusters?: VisualCluster[];
}

// ── Cluster types ────────────────────────────────────────────────────

export interface VisualCluster {
  id: string;
  label: string;
  nodeIds: string[];
  isManual: boolean;
}

export type {
  GraphTheme,
  MotionProfile,
  VisualElementKind,
  VisualStateKind,
  VisualStateToken,
} from './visual-state.js';

// ── Re-export existing types used by web layer ───────────────────────

export type {
  HealthReport,
  GapDetail,
  PromoteCandidate,
  CheckResult,
  CheckTrigger,
} from '../graph/types.js';

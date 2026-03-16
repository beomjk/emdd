// ── Node Types ──────────────────────────────────────────────────────

export type NodeType =
  | 'hypothesis'
  | 'experiment'
  | 'finding'
  | 'knowledge'
  | 'question'
  | 'decision'
  | 'episode';

// ── Edge Types ──────────────────────────────────────────────────────

export type EdgeType =
  // evidence
  | 'supports'
  | 'contradicts'
  | 'confirms'
  // generation
  | 'spawns'
  | 'produces'
  | 'answers'
  | 'revises'
  | 'promotes'
  // structure
  | 'depends_on'
  | 'extends'
  | 'relates_to'
  | 'informs'
  // composition
  | 'part_of'
  | 'context_for'
  // aliases
  | 'tests'
  | 'answers_to'
  // reverse labels
  | 'confirmed_by'
  | 'supported_by'
  | 'answered_by'
  | 'spawned_from'
  | 'produced_by'
  | 'tested_by';

export const EDGE_TYPES = new Set<string>([
  // evidence
  'supports', 'contradicts', 'confirms',
  // generation
  'spawns', 'produces', 'answers', 'revises', 'promotes',
  // structure
  'depends_on', 'extends', 'relates_to', 'informs',
  // composition
  'part_of', 'context_for',
  // aliases
  'tests', 'answers_to',
]);

export const REVERSE_LABELS: Record<string, string> = {
  confirmed_by: 'confirms',
  supported_by: 'supports',
  answered_by: 'answers',
  spawned_from: 'spawns',
  produced_by: 'produces',
  tested_by: 'tests',
};

export const ALL_VALID_RELATIONS = new Set<string>([
  ...EDGE_TYPES,
  ...Object.keys(REVERSE_LABELS),
]);

export const NODE_TYPES: NodeType[] = [
  'hypothesis', 'experiment', 'finding', 'knowledge',
  'question', 'decision', 'episode',
];

// ── Node Type → Directory Mapping ───────────────────────────────────

export const NODE_TYPE_DIRS: Record<NodeType, string> = {
  hypothesis: 'hypotheses',
  experiment: 'experiments',
  finding: 'findings',
  knowledge: 'knowledge',
  question: 'questions',
  decision: 'decisions',
  episode: 'episodes',
};

// ── ID Prefixes ─────────────────────────────────────────────────────

export const ID_PREFIXES: Record<NodeType, string> = {
  hypothesis: 'hyp',
  experiment: 'exp',
  finding: 'fnd',
  knowledge: 'knw',
  question: 'qst',
  decision: 'dec',
  episode: 'epi',
};

export const PREFIX_TO_TYPE: Record<string, NodeType> = Object.fromEntries(
  Object.entries(ID_PREFIXES).map(([type, prefix]) => [prefix, type as NodeType])
) as Record<string, NodeType>;

// ── Valid Statuses per Node Type ────────────────────────────────────

export const VALID_STATUSES: Record<NodeType, readonly string[]> = {
  hypothesis: ['PROPOSED', 'TESTING', 'SUPPORTED', 'REFUTED', 'REVISED', 'DEFERRED'],
  experiment: ['PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'ABANDONED'],
  finding: ['DRAFT', 'VALIDATED', 'PROMOTED', 'RETRACTED'],
  knowledge: ['ACTIVE', 'DISPUTED', 'SUPERSEDED', 'RETRACTED'],
  question: ['OPEN', 'RESOLVED', 'ANSWERED', 'DEFERRED'],
  decision: ['PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'REVERTED'],
  episode: ['ACTIVE', 'COMPLETED'],
};

// ── Required Fields per Node Type ───────────────────────────────────

export const REQUIRED_FIELDS: Record<NodeType, readonly string[]> = {
  hypothesis: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'],
  experiment: ['id', 'type', 'title', 'status', 'created', 'updated'],
  finding: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'],
  knowledge: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'],
  question: ['id', 'type', 'title', 'status', 'created', 'updated'],
  decision: ['id', 'type', 'title', 'status', 'created', 'updated'],
  episode: ['id', 'type', 'title', 'status', 'created', 'updated'],
};

// ── Data Interfaces ─────────────────────────────────────────────────

export interface Link {
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

export interface CreateEdgeResult {
  source: string;
  target: string;
  relation: string;
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
}

export interface CheckTrigger {
  type: string;
  message: string;
  count?: number;
}

export interface CheckResult {
  triggers: CheckTrigger[];
}

export interface PromoteCandidate {
  id: string;
  confidence: number;
  supports: number;
}

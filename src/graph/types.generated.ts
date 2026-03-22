// @generated — DO NOT EDIT. Source: graph-schema.yaml

// ── Node Types ───────────────────────────────────────────────────────

export type NodeType =
  | 'decision'
  | 'episode'
  | 'experiment'
  | 'finding'
  | 'hypothesis'
  | 'knowledge'
  | 'question'
;

export const NODE_TYPES: NodeType[] = [
  'decision',
  'episode',
  'experiment',
  'finding',
  'hypothesis',
  'knowledge',
  'question',
];

// ── Node Type → Directory Mapping ────────────────────────────────────

export const NODE_TYPE_DIRS: Record<NodeType, string> = {
  decision: 'decisions',
  episode: 'episodes',
  experiment: 'experiments',
  finding: 'findings',
  hypothesis: 'hypotheses',
  knowledge: 'knowledge',
  question: 'questions',
};

// ── ID Prefixes ──────────────────────────────────────────────────────

export const ID_PREFIXES: Record<NodeType, string> = {
  decision: 'dec',
  episode: 'epi',
  experiment: 'exp',
  finding: 'fnd',
  hypothesis: 'hyp',
  knowledge: 'knw',
  question: 'qst',
};

export const PREFIX_TO_TYPE: Record<string, NodeType> = {
  dec: 'decision',
  epi: 'episode',
  exp: 'experiment',
  fnd: 'finding',
  hyp: 'hypothesis',
  knw: 'knowledge',
  qst: 'question',
};

// ── Valid Statuses per Node Type ─────────────────────────────────────

export const VALID_STATUSES: Record<NodeType, readonly string[]> = {
  decision: ['PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'REVERTED', 'CONTESTED'],
  episode: ['ACTIVE', 'COMPLETED'],
  experiment: ['PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'ABANDONED'],
  finding: ['DRAFT', 'VALIDATED', 'PROMOTED', 'RETRACTED'],
  hypothesis: ['PROPOSED', 'TESTING', 'SUPPORTED', 'REFUTED', 'REVISED', 'DEFERRED', 'CONTESTED'],
  knowledge: ['ACTIVE', 'DISPUTED', 'SUPERSEDED', 'RETRACTED'],
  question: ['OPEN', 'RESOLVED', 'ANSWERED', 'DEFERRED'],
};

// ── Required Fields per Node Type ────────────────────────────────────

export const REQUIRED_FIELDS: Record<NodeType, readonly string[]> = {
  decision: ['id', 'type', 'title', 'status', 'created', 'updated'],
  episode: ['id', 'type', 'title', 'status', 'created', 'updated'],
  experiment: ['id', 'type', 'title', 'status', 'created', 'updated'],
  finding: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'],
  hypothesis: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'],
  knowledge: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'],
  question: ['id', 'type', 'title', 'status', 'created', 'updated'],
};

// ── Edge Types ───────────────────────────────────────────────────────

export type EdgeType =
  | 'answered_by'
  | 'answers'
  | 'confirmed_by'
  | 'confirms'
  | 'context_for'
  | 'contradicts'
  | 'depends_on'
  | 'extends'
  | 'informs'
  | 'part_of'
  | 'produced_by'
  | 'produces'
  | 'promotes'
  | 'relates_to'
  | 'resolved_by'
  | 'resolves'
  | 'revises'
  | 'spawned_from'
  | 'spawns'
  | 'supported_by'
  | 'supports'
  | 'tested_by'
  | 'tests'
;

export const EDGE_TYPES = new Set<string>([
  'answers',
  'confirms',
  'context_for',
  'contradicts',
  'depends_on',
  'extends',
  'informs',
  'part_of',
  'produces',
  'promotes',
  'relates_to',
  'resolves',
  'revises',
  'spawns',
  'supports',
  'tests',
]);

export const REVERSE_LABELS: Record<string, string> = {
  answered_by: 'answers',
  confirmed_by: 'confirms',
  produced_by: 'produces',
  resolved_by: 'resolves',
  spawned_from: 'spawns',
  supported_by: 'supports',
  tested_by: 'tests',
};

export const ALL_VALID_RELATIONS = new Set<string>([
  ...EDGE_TYPES,
  ...Object.keys(REVERSE_LABELS),
]);

// ── Thresholds ───────────────────────────────────────────────────────

export const THRESHOLDS = {
  min_independent_supports: 2,
  promotion_confidence: 0.9,
  support_strength_min: 0.7,
} as const;

// ── Transition Table ─────────────────────────────────────────────────

export const TRANSITION_TABLE: Record<string, { from: string; to: string; conditions: { fn: string; args: Record<string, unknown> }[] }[]> = {
  hypothesis: [
    { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { direction: "any", status: "RUNNING", type: "experiment" } }] },
    { from: 'TESTING', to: 'CONTESTED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", status: "CONTESTED", type: "decision" } }] },
    { from: 'TESTING', to: 'REVISED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", relation: "revises" } }] },
    { from: 'TESTING', to: 'SUPPORTED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", min_strength: 0.7, relation: "supports" } }] },
    { from: 'TESTING', to: 'REFUTED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", relation: "contradicts" } }] },
    { from: 'CONTESTED', to: 'REVISED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", relation: "revises" } }] },
    { from: 'CONTESTED', to: 'SUPPORTED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", min_strength: 0.7, relation: "supports" } }, { fn: 'has_linked', args: { direction: "incoming", status: "ACCEPTED", type: "decision" } }] },
    { from: 'CONTESTED', to: 'REFUTED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", relation: "contradicts" } }, { fn: 'has_linked', args: { direction: "incoming", status: "ACCEPTED", type: "decision" } }] },
  ],
  knowledge: [
    { from: 'ACTIVE', to: 'DISPUTED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", relation: "contradicts" } }] },
    { from: 'ACTIVE', to: 'SUPERSEDED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", relation: "revises", type: "knowledge" } }] },
    { from: 'DISPUTED', to: 'SUPERSEDED', conditions: [{ fn: 'has_linked', args: { direction: "incoming", relation: "revises", type: "knowledge" } }] },
    { from: 'DISPUTED', to: 'ACTIVE', conditions: [{ fn: 'all_linked_with', args: { relation: "contradicts", status: "RETRACTED" } }] },
  ],
};

export const MANUAL_TRANSITIONS: Record<string, { from: string; to: string }[]> = {
  hypothesis: [
    { from: 'ANY', to: 'DEFERRED' },
  ],
};

// ── Valid Values ─────────────────────────────────────────────────────

export const VALID_DEPENDENCY_TYPES = ['LOGICAL', 'PRACTICAL', 'TEMPORAL'] as const;
export const VALID_FINDING_TYPES = ['observation', 'insight', 'negative'] as const;
export const VALID_IMPACTS = ['DECISIVE', 'SIGNIFICANT', 'MINOR'] as const;
export const VALID_REVERSIBILITIES = ['high', 'medium', 'low'] as const;
export const VALID_RISK_LEVELS = ['high', 'medium', 'low'] as const;
export const VALID_SEVERITIES = ['FATAL', 'WEAKENING', 'TENSION'] as const;
export const VALID_URGENCIES = ['BLOCKING', 'HIGH', 'MEDIUM', 'LOW'] as const;

// ── Edge Attributes Interface ────────────────────────────────────────

export interface EdgeAttributes {
  completeness?: number;
  dependencyType?: typeof VALID_DEPENDENCY_TYPES[number];
  impact?: typeof VALID_IMPACTS[number];
  severity?: typeof VALID_SEVERITIES[number];
  strength?: number;
}

export const EDGE_ATTRIBUTE_NAMES = ['completeness', 'dependencyType', 'impact', 'severity', 'strength'] as const;

export const EDGE_ATTRIBUTE_TYPES: Record<string, 'number' | 'enum'> = {
  completeness: 'number',
  dependencyType: 'enum',
  impact: 'enum',
  severity: 'enum',
  strength: 'number',
};

export const EDGE_ATTRIBUTE_RANGES: Record<string, { min?: number; max?: number }> = {
  completeness: { min: 0, max: 1 },
  strength: { min: 0, max: 1 },
};

export const EDGE_ATTRIBUTE_ENUM_VALUES: Record<string, readonly string[]> = {
  dependencyType: VALID_DEPENDENCY_TYPES,
  impact: VALID_IMPACTS,
  severity: VALID_SEVERITIES,
};

// ── Edge Attribute Affinity ──────────────────────────────────────────

export const EDGE_ATTRIBUTE_AFFINITY: Record<string, readonly string[]> = {
  answers: ['completeness'],
  confirms: ['strength'],
  contradicts: ['severity'],
  depends_on: ['dependencyType'],
  informs: ['impact'],
  supports: ['strength'],
};

// ── Transition Policy ────────────────────────────────────────────────

export const TRANSITION_POLICY_DEFAULT = 'strict' as const;

// ── Ceremony Triggers ────────────────────────────────────────────────

export const CEREMONY_TRIGGERS = {
  consolidation: {
    all_questions_resolved: true,
    episodes_threshold: 3,
    experiment_overload_threshold: 5,
    unpromoted_findings_threshold: 5,
  },
} as const satisfies Record<string, Record<string, number | boolean>>;

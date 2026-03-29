/**
 * derive-constants.ts — Derives all constants from schema.config.ts.
 *
 * Derives all runtime constants from schema.config.ts.
 * These are computed at import time — no code generation step needed.
 */
import { extractRules, extractManualTransitions } from '@beomjk/state-engine/schema';
import {
  entityDefinitions,
  nodeMetadata,
  forwardEdges,
  reverseEdges,
  edgeCategories,
  statusCategories,
  thresholds as schemaThresholds,
  validValues,
  transitionPolicy,
  ceremonies,
  edgeAttributes,
  edgeAttributeAffinity,
  nodeDisplayOrder,
  impactClassification,
  attributeModifiers,
  impactThreshold,
  relationDefinitions,
  type NodeTypeName,
} from '../schema/schema.config.js';

// ── Node Types ───────────────────────────────────────────────────────

export type NodeType = NodeTypeName;

export const NODE_TYPES: NodeType[] = (Object.keys(nodeMetadata) as NodeType[]).sort();

export const NODE_DISPLAY_ORDER: NodeType[] = [...nodeDisplayOrder];

// ── Node Type → Directory Mapping ────────────────────────────────────

export const NODE_TYPE_DIRS: Record<NodeType, string> = Object.fromEntries(
  NODE_TYPES.map(t => [t, nodeMetadata[t].directory])
) as Record<NodeType, string>;

// ── ID Prefixes ──────────────────────────────────────────────────────

export const ID_PREFIXES: Record<NodeType, string> = Object.fromEntries(
  NODE_TYPES.map(t => [t, nodeMetadata[t].prefix])
) as Record<NodeType, string>;

export const PREFIX_TO_TYPE: Record<string, NodeType> = Object.fromEntries(
  NODE_TYPES.map(t => [nodeMetadata[t].prefix, t])
) as Record<string, NodeType>;

// ── Valid Statuses per Node Type ─────────────────────────────────────

export const VALID_STATUSES: Record<NodeType, readonly string[]> = Object.fromEntries(
  NODE_TYPES.map(t => [t, entityDefinitions[t].statuses])
) as Record<NodeType, readonly string[]>;

// ── Required Fields per Node Type ────────────────────────────────────

export const REQUIRED_FIELDS: Record<NodeType, readonly string[]> = Object.fromEntries(
  NODE_TYPES.map(t => [t, nodeMetadata[t].requiredFields as readonly string[]])
) as Record<NodeType, readonly string[]>;

// ── Edge Types ───────────────────────────────────────────────────────

const allForward = [...forwardEdges].sort();
const allReverse = Object.keys(reverseEdges).sort();
const allEdgeNames = [...allForward, ...allReverse].sort();

export type EdgeType = (typeof forwardEdges)[number] | keyof typeof reverseEdges;

export const EDGE_TYPES = new Set<string>(allForward);

export const REVERSE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(reverseEdges).sort(([a], [b]) => a.localeCompare(b))
);

export const ALL_VALID_RELATIONS = new Set<string>([
  ...EDGE_TYPES,
  ...Object.keys(REVERSE_LABELS),
]);

// ── Edge Categories ──────────────────────────────────────────────────

export const COMPOSITION_EDGES = new Set<string>([...edgeCategories.composition].sort());
export type CompositionEdgeType = (typeof edgeCategories.composition)[number];

export const EVIDENCE_EDGES = new Set<string>([...edgeCategories.evidence].sort());
export type EvidenceEdgeType = (typeof edgeCategories.evidence)[number];

export const GENERATION_EDGES = new Set<string>([...edgeCategories.generation].sort());
export type GenerationEdgeType = (typeof edgeCategories.generation)[number];

export const STRUCTURE_EDGES = new Set<string>([...edgeCategories.structure].sort());
export type StructureEdgeType = (typeof edgeCategories.structure)[number];

export const VALUE_PRODUCING_EDGES = new Set<string>([...edgeCategories.value_producing].sort());
export type ValueProducingEdgeType = (typeof edgeCategories.value_producing)[number];

// ── Status Categories ────────────────────────────────────────────────

export const IN_PROGRESS_STATUSES = new Set<string>([...statusCategories.in_progress].sort());
export const INITIAL_STATUSES = new Set<string>([...statusCategories.initial].sort());
export const NEGATIVE_STATUSES = new Set<string>([...statusCategories.negative].sort());
export const POSITIVE_STATUSES = new Set<string>([...statusCategories.positive].sort());
export const TERMINAL_STATUSES = new Set<string>([...statusCategories.terminal].sort());

// ── Edge Enum ────────────────────────────────────────────────────────

// Completeness guaranteed by construction: allEdgeNames and EdgeType both
// derive from the same source (forwardEdges + reverseEdges in schema.config).
// Runtime completeness verified in types.test.ts → "EDGE const has entry for every ALL_VALID_RELATIONS member".
export const EDGE = Object.fromEntries(
  allEdgeNames.map(e => [e, e])
) as { readonly [K in EdgeType]: K };

// ── Status Enum ──────────────────────────────────────────────────────

const allStatuses = new Set<string>();
for (const t of NODE_TYPES) {
  for (const s of entityDefinitions[t].statuses) {
    allStatuses.add(s);
  }
}
const sortedStatuses = [...allStatuses].sort();

// Derive status union from statusCategories which covers all statuses with literal types
type AllStatuses = (typeof statusCategories)[keyof typeof statusCategories][number];

export const STATUS = Object.fromEntries(
  sortedStatuses.map(s => [s, s])
) as { readonly [K in AllStatuses]: K };

// ── Thresholds ───────────────────────────────────────────────────────

export const THRESHOLDS = Object.fromEntries(
  Object.entries(schemaThresholds).sort(([a], [b]) => a.localeCompare(b))
) as typeof schemaThresholds;

// ── Transition Table ─────────────────────────────────────────────────

const transitionEntries: [string, { from: string; to: string; conditions: { fn: string; args: Record<string, unknown> }[] }[]][] = [];
for (const t of NODE_TYPES) {
  const rules = extractRules(entityDefinitions[t]);
  if (rules.length > 0) {
    transitionEntries.push([t, rules]);
  }
}

export const TRANSITION_TABLE: Partial<Record<NodeType, { from: string; to: string; conditions: { fn: string; args: Record<string, unknown> }[] }[]>> =
  Object.fromEntries(transitionEntries);

// ── Manual Transitions ───────────────────────────────────────────────

const manualEntries: [string, { from: string; to: string }[]][] = [];
for (const t of NODE_TYPES) {
  const manuals = extractManualTransitions(entityDefinitions[t]);
  if (manuals.length > 0) {
    manualEntries.push([t, manuals]);
  }
}

export const MANUAL_TRANSITIONS: Partial<Record<NodeType, { from: string; to: string }[]>> =
  Object.fromEntries(manualEntries);

// ── Valid Values ─────────────────────────────────────────────────────

export const VALID_DEPENDENCY_TYPES = validValues.dependencyTypes;
export const VALID_FINDING_TYPES = validValues.findingTypes;
export const VALID_IMPACTS = validValues.impacts;
export const VALID_REVERSIBILITIES = validValues.reversibilities;
export const VALID_RISK_LEVELS = validValues.riskLevels;
export const VALID_SEVERITIES = validValues.severities;
export const VALID_URGENCIES = validValues.urgencies;

// ── Valid Value Enums ────────────────────────────────────────────────

export const DEPENDENCY_TYPE = Object.fromEntries(
  validValues.dependencyTypes.map(v => [v, v])
) as { readonly [K in (typeof validValues.dependencyTypes)[number]]: K };

export const FINDING_TYPE = Object.fromEntries(
  validValues.findingTypes.map(v => [v, v])
) as { readonly [K in (typeof validValues.findingTypes)[number]]: K };

export const IMPACT = Object.fromEntries(
  validValues.impacts.map(v => [v, v])
) as { readonly [K in (typeof validValues.impacts)[number]]: K };

export const REVERSIBILITY = Object.fromEntries(
  validValues.reversibilities.map(v => [v, v])
) as { readonly [K in (typeof validValues.reversibilities)[number]]: K };

export const RISK_LEVEL = Object.fromEntries(
  validValues.riskLevels.map(v => [v, v])
) as { readonly [K in (typeof validValues.riskLevels)[number]]: K };

export const SEVERITY = Object.fromEntries(
  validValues.severities.map(v => [v, v])
) as { readonly [K in (typeof validValues.severities)[number]]: K };

export const URGENCY = Object.fromEntries(
  validValues.urgencies.map(v => [v, v])
) as { readonly [K in (typeof validValues.urgencies)[number]]: K };

export type DependencyType = (typeof VALID_DEPENDENCY_TYPES)[number];
export type FindingType = (typeof VALID_FINDING_TYPES)[number];
export type Impact = (typeof VALID_IMPACTS)[number];
export type Reversibility = (typeof VALID_REVERSIBILITIES)[number];
export type RiskLevel = (typeof VALID_RISK_LEVELS)[number];
export type Severity = (typeof VALID_SEVERITIES)[number];
export type Urgency = (typeof VALID_URGENCIES)[number];

// ── Edge Attributes Interface ────────────────────────────────────────

export interface EdgeAttributes {
  completeness?: number;
  dependencyType?: (typeof validValues.dependencyTypes)[number];
  impact?: (typeof validValues.impacts)[number];
  severity?: (typeof validValues.severities)[number];
  strength?: number;
}

export const EDGE_ATTRIBUTE_NAMES = ['completeness', 'dependencyType', 'impact', 'severity', 'strength'] as const;

export const EDGE_ATTRIBUTE_TYPES: Record<string, 'number' | 'enum'> = Object.fromEntries(
  Object.entries(edgeAttributes).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.type])
);

export const EDGE_ATTRIBUTE_RANGES: Record<string, { min?: number; max?: number }> = Object.fromEntries(
  Object.entries(edgeAttributes)
    .filter(([, v]) => v.type === 'number')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, { min: (v as { min: number }).min, max: (v as { max: number }).max }])
);

const valuesRefToArray: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(validValues)
);

export const EDGE_ATTRIBUTE_ENUM_VALUES: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(edgeAttributes)
    .filter(([, v]) => v.type === 'enum')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, valuesRefToArray[(v as { valuesRef: string }).valuesRef]])
);

// ── Edge Attribute Affinity ──────────────────────────────────────────

export const EDGE_ATTRIBUTE_AFFINITY: Partial<Record<EdgeType, readonly string[]>> = Object.fromEntries(
  Object.entries(edgeAttributeAffinity).sort(([a], [b]) => a.localeCompare(b))
) as Partial<Record<EdgeType, readonly string[]>>;

// ── Transition Policy ────────────────────────────────────────────────

export const TRANSITION_POLICY_DEFAULT = transitionPolicy.mode;

// ── Ceremony Triggers ────────────────────────────────────────────────

export const CEREMONY_TRIGGERS = Object.fromEntries(
  Object.entries(ceremonies).map(([key, val]) => [
    key,
    Object.fromEntries(
      Object.entries(val.triggers).sort(([a], [b]) => a.localeCompare(b))
    ),
  ])
) as {
  readonly [K in keyof typeof ceremonies]: {
    readonly [T in keyof (typeof ceremonies)[K]['triggers']]: (typeof ceremonies)[K]['triggers'][T]
  }
} satisfies Record<string, Record<string, number | boolean>>;

// ── Impact Analysis Constants ───────────────────────────────────────

export type PropagationClass = keyof typeof impactClassification;

export interface EdgeClassificationEntry {
  classification: PropagationClass;
  baseFactor: number;
}

export const EDGE_CLASSIFICATION: Record<string, EdgeClassificationEntry> = {};
for (const [cls, def] of Object.entries(impactClassification)) {
  for (const edge of def.edges) {
    EDGE_CLASSIFICATION[edge] = {
      classification: cls as PropagationClass,
      baseFactor: def.baseFactor,
    };
  }
}

export const ATTRIBUTE_MODIFIERS = attributeModifiers;

export const UNKNOWN_STATUS = 'UNKNOWN' as const;

export const IMPACT_THRESHOLD: number = impactThreshold;

export { maxCascadeDepth as MAX_CASCADE_DEPTH } from '../schema/schema.config.js';

export const RELATION_DEFINITIONS = relationDefinitions;

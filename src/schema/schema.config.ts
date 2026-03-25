/**
 * schema.config.ts — Single source of truth for EMDD graph structure.
 *
 * Replaces graph-schema.yaml with a type-safe TypeScript configuration.
 * Uses @beomjk/state-engine/schema for entity definitions and transition rules.
 *
 * IMPORTANT: This file must NOT import from engine-setup.ts or any file
 * under src/graph/ to prevent circular dependencies.
 */
import { createDefiner, type EntityDefinition } from '@beomjk/state-engine/schema';

// ── Definer (preset names defined inline to avoid circular imports) ──

const define = createDefiner([
  'has_linked', 'field_present', 'field_equals', 'min_linked_count', 'all_linked_with',
] as const);

// ── Node Entity Definitions (statuses + transitions) ────────────────

export const hypothesisEntity = define.entity({
  name: 'hypothesis',
  statuses: ['PROPOSED', 'TESTING', 'SUPPORTED', 'REFUTED', 'REVISED', 'DEFERRED', 'CONTESTED'] as const,
  transitions: [
    {
      from: 'PROPOSED', to: 'TESTING',
      conditions: [
        { fn: 'has_linked' as const, args: { type: 'experiment', status: 'RUNNING', direction: 'any' } },
      ],
    },
    {
      from: 'PROPOSED', to: 'SUPPORTED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'supports', min_strength: 0.7, direction: 'incoming' } },
      ],
    },
    {
      from: 'TESTING', to: 'CONTESTED',
      conditions: [
        { fn: 'has_linked' as const, args: { type: 'decision', status: 'CONTESTED', direction: 'incoming' } },
      ],
    },
    {
      from: 'TESTING', to: 'REVISED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'revises', direction: 'incoming' } },
      ],
    },
    {
      from: 'TESTING', to: 'SUPPORTED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'supports', min_strength: 0.7, direction: 'incoming' } },
      ],
    },
    {
      from: 'TESTING', to: 'REFUTED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'contradicts', direction: 'incoming' } },
      ],
    },
    {
      from: 'CONTESTED', to: 'REVISED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'revises', direction: 'incoming' } },
      ],
    },
    {
      from: 'CONTESTED', to: 'SUPPORTED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'supports', min_strength: 0.7, direction: 'incoming' } },
        { fn: 'has_linked' as const, args: { type: 'decision', status: 'ACCEPTED', direction: 'incoming' } },
      ],
    },
    {
      from: 'CONTESTED', to: 'REFUTED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'contradicts', direction: 'incoming' } },
        { fn: 'has_linked' as const, args: { type: 'decision', status: 'ACCEPTED', direction: 'incoming' } },
      ],
    },
  ],
  manualTransitions: [
    { from: 'ANY', to: 'DEFERRED' },
  ],
});

export const knowledgeEntity = define.entity({
  name: 'knowledge',
  statuses: ['ACTIVE', 'DISPUTED', 'SUPERSEDED', 'RETRACTED'] as const,
  transitions: [
    {
      from: 'ACTIVE', to: 'DISPUTED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'contradicts', direction: 'incoming' } },
      ],
    },
    {
      from: 'ACTIVE', to: 'SUPERSEDED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'revises', type: 'knowledge', direction: 'incoming' } },
      ],
    },
    {
      from: 'DISPUTED', to: 'SUPERSEDED',
      conditions: [
        { fn: 'has_linked' as const, args: { relation: 'revises', type: 'knowledge', direction: 'incoming' } },
      ],
    },
    {
      from: 'DISPUTED', to: 'ACTIVE',
      conditions: [
        { fn: 'all_linked_with' as const, args: { relation: 'contradicts', status: 'RETRACTED' } },
      ],
    },
  ],
  manualTransitions: [
    { from: 'DISPUTED', to: 'RETRACTED' },
  ],
});

export const decisionEntity = define.entity({
  name: 'decision',
  statuses: ['PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'REVERTED', 'CONTESTED'] as const,
});

export const episodeEntity = define.entity({
  name: 'episode',
  statuses: ['ACTIVE', 'COMPLETED'] as const,
});

export const experimentEntity = define.entity({
  name: 'experiment',
  statuses: ['PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'ABANDONED'] as const,
});

export const findingEntity = define.entity({
  name: 'finding',
  statuses: ['DRAFT', 'VALIDATED', 'PROMOTED', 'RETRACTED'] as const,
});

export const questionEntity = define.entity({
  name: 'question',
  statuses: ['OPEN', 'RESOLVED', 'ANSWERED', 'DEFERRED'] as const,
});

// ── All entity definitions keyed by node type ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- EntityDefinition generics differ per entity; `any` avoids union complexity
export const entityDefinitions: Record<string, EntityDefinition<readonly string[], readonly string[], any>> = {
  decision: decisionEntity,
  episode: episodeEntity,
  experiment: experimentEntity,
  finding: findingEntity,
  hypothesis: hypothesisEntity,
  knowledge: knowledgeEntity,
  question: questionEntity,
};

// ── Node Metadata (EMDD-specific: prefix, directory, requiredFields) ─

export const nodeMetadata = {
  decision: {
    prefix: 'dec',
    directory: 'decisions',
    requiredFields: ['id', 'type', 'title', 'status', 'created', 'updated'] as const,
  },
  episode: {
    prefix: 'epi',
    directory: 'episodes',
    requiredFields: ['id', 'type', 'title', 'status', 'created', 'updated'] as const,
  },
  experiment: {
    prefix: 'exp',
    directory: 'experiments',
    requiredFields: ['id', 'type', 'title', 'status', 'created', 'updated'] as const,
  },
  finding: {
    prefix: 'fnd',
    directory: 'findings',
    requiredFields: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'] as const,
  },
  hypothesis: {
    prefix: 'hyp',
    directory: 'hypotheses',
    requiredFields: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'] as const,
  },
  knowledge: {
    prefix: 'knw',
    directory: 'knowledge',
    requiredFields: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'] as const,
  },
  question: {
    prefix: 'qst',
    directory: 'questions',
    requiredFields: ['id', 'type', 'title', 'status', 'created', 'updated'] as const,
  },
} as const;

export type NodeTypeName = keyof typeof nodeMetadata;

// ── Edge Types ──────────────────────────────────────────────────────

export const forwardEdges = [
  'supports', 'contradicts', 'confirms',
  'spawns', 'produces', 'answers', 'revises', 'promotes',
  'depends_on', 'extends', 'relates_to', 'informs',
  'part_of', 'context_for', 'resolves', 'tests',
] as const;

export const reverseEdges = {
  answered_by: 'answers',
  confirmed_by: 'confirms',
  produced_by: 'produces',
  resolved_by: 'resolves',
  spawned_from: 'spawns',
  supported_by: 'supports',
  tested_by: 'tests',
} as const;

// ── Edge Categories ─────────────────────────────────────────────────

export const edgeCategories = {
  evidence: ['supports', 'contradicts', 'confirms'] as const,
  generation: ['spawns', 'produces', 'answers', 'revises', 'promotes'] as const,
  structure: ['depends_on', 'extends', 'relates_to', 'informs'] as const,
  composition: ['part_of', 'context_for', 'resolves', 'tests'] as const,
  value_producing: [
    'supports', 'contradicts', 'confirms',
    'spawns', 'produces', 'answers', 'revises', 'promotes',
    'extends', 'informs', 'resolves', 'tests',
  ] as const,
} as const;

// ── Status Categories ───────────────────────────────────────────────

export const statusCategories = {
  positive: ['SUPPORTED', 'VALIDATED', 'ACCEPTED', 'ACTIVE', 'ANSWERED', 'COMPLETED', 'PROMOTED'] as const,
  negative: ['REFUTED', 'RETRACTED', 'REVERTED', 'FAILED', 'ABANDONED'] as const,
  in_progress: ['TESTING', 'RUNNING', 'CONTESTED', 'DISPUTED'] as const,
  terminal: ['DEFERRED', 'SUPERSEDED', 'REVISED', 'RESOLVED'] as const,
  initial: ['PROPOSED', 'DRAFT', 'OPEN', 'PLANNED'] as const,
} as const;

// ── Thresholds ──────────────────────────────────────────────────────

export const thresholds = {
  min_independent_supports: 2,
  promotion_confidence: 0.9,
  support_strength_min: 0.7,
  kill_confidence: 0.3,
  kill_stale_days: 14,
  branch_max_active: 3,
  branch_max_candidates: 4,
  branch_max_open_weeks: 4,
  branch_convergence_gap: 0.3,
  branch_convergence_weeks: 2,
} as const;

// ── Valid Values ────────────────────────────────────────────────────

export const validValues = {
  dependencyTypes: ['LOGICAL', 'PRACTICAL', 'TEMPORAL'] as const,
  findingTypes: ['observation', 'insight', 'negative'] as const,
  impacts: ['DECISIVE', 'SIGNIFICANT', 'MINOR'] as const,
  reversibilities: ['high', 'medium', 'low'] as const,
  riskLevels: ['high', 'medium', 'low'] as const,
  severities: ['FATAL', 'WEAKENING', 'TENSION'] as const,
  urgencies: ['BLOCKING', 'HIGH', 'MEDIUM', 'LOW'] as const,
} as const;

// ── Transition Policy ───────────────────────────────────────────────

export const transitionPolicy = {
  mode: 'strict' as const,
} as const;

// ── Ceremonies ──────────────────────────────────────────────────────

export const ceremonies = {
  consolidation: {
    triggers: {
      unpromoted_findings_threshold: 5,
      episodes_threshold: 3,
      all_questions_resolved: true,
      experiment_overload_threshold: 5,
    },
  },
} as const;

// ── Edge Attributes ─────────────────────────────────────────────────

export const edgeAttributes = {
  strength: { type: 'number' as const, min: 0, max: 1 },
  severity: { type: 'enum' as const, valuesRef: 'severities' as const },
  completeness: { type: 'number' as const, min: 0, max: 1 },
  dependencyType: { type: 'enum' as const, valuesRef: 'dependencyTypes' as const },
  impact: { type: 'enum' as const, valuesRef: 'impacts' as const },
} as const;

// ── Edge Attribute Affinity ─────────────────────────────────────────

export const edgeAttributeAffinity = {
  supports: ['strength'] as const,
  contradicts: ['severity'] as const,
  confirms: ['strength'] as const,
  answers: ['completeness'] as const,
  depends_on: ['dependencyType'] as const,
  informs: ['impact'] as const,
} as const;

// ── Node Display Order ──────────────────────────────────────────────

export const nodeDisplayOrder = [
  'hypothesis', 'experiment', 'finding', 'knowledge',
  'question', 'decision', 'episode',
] as const;

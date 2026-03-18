// ── Schema Validation ───────────────────────────────────────────────
// Zod structural validation for graph-schema.yaml.
// Referential integrity checks are added in Phase 2 (T004).

import { z } from 'zod';

// ── Sub-Schemas ─────────────────────────────────────────────────────

const TransitionConditionZod = z.object({
  fn: z.string(),
  args: z.record(z.string(), z.unknown()),
});

const TransitionRuleZod = z.object({
  from: z.string(),
  to: z.string(),
  conditions: z.array(TransitionConditionZod),
});

const ManualTransitionRuleZod = z.object({
  from: z.string(),
  to: z.string(),
});

const NodeTypeDefinitionZod = z.object({
  name: z.string(),
  prefix: z.string(),
  directory: z.string(),
  statuses: z.array(z.string()).min(1),
  requiredFields: z.array(z.string()).min(1),
  optionalFields: z.array(z.string()).optional(),
});

const EdgeTypeDefinitionsZod = z.object({
  forward: z.array(z.string()).min(1),
  reverse: z.record(z.string(), z.string()),
});

// ── Main Schema ─────────────────────────────────────────────────────

export const GraphSchemaZod = z.object({
  version: z.string(),
  nodeTypes: z.array(NodeTypeDefinitionZod).min(1),
  edgeTypes: EdgeTypeDefinitionsZod,
  thresholds: z.record(z.string(), z.number()),
  transitions: z.record(z.string(), z.array(TransitionRuleZod)),
  validValues: z.record(z.string(), z.array(z.string())),
  manualTransitions: z.record(z.string(), z.array(ManualTransitionRuleZod)).optional(),
});

// ── Exported Types ──────────────────────────────────────────────────

export type GraphSchema = z.infer<typeof GraphSchemaZod>;
export type NodeTypeDefinition = z.infer<typeof NodeTypeDefinitionZod>;
export type TransitionRule = z.infer<typeof TransitionRuleZod>;
export type TransitionCondition = z.infer<typeof TransitionConditionZod>;
export type ManualTransitionRule = z.infer<typeof ManualTransitionRuleZod>;
export type EdgeTypeDefinitions = z.infer<typeof EdgeTypeDefinitionsZod>;

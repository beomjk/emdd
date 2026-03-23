// ── Schema Validation ───────────────────────────────────────────────
// Zod structural validation + referential integrity checks for graph-schema.yaml.

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

const TransitionPolicyZod = z.object({
  mode: z.enum(['strict', 'warn', 'off']),
});

const CeremonyZod = z.object({
  triggers: z.record(z.string(), z.union([z.number(), z.boolean()])),
});

const EdgeAttributeDefZod = z.object({
  type: z.enum(['number', 'enum']),
  min: z.number().optional(),
  max: z.number().optional(),
  valuesRef: z.string().optional(),
}).refine(
  (d) => !(d.type === 'enum' && (d.min !== undefined || d.max !== undefined)),
  { message: 'enum attributes must not have min/max' },
).refine(
  (d) => !(d.type === 'number' && d.valuesRef !== undefined),
  { message: 'number attributes must not have valuesRef' },
).refine(
  (d) => !(d.type === 'number' && d.min !== undefined && d.max !== undefined && d.min >= d.max),
  { message: 'number attribute min must be less than max' },
);

// ── Main Schema ─────────────────────────────────────────────────────

export const GraphSchemaZod = z.object({
  version: z.string(),
  nodeTypes: z.array(NodeTypeDefinitionZod).min(1),
  edgeTypes: EdgeTypeDefinitionsZod,
  thresholds: z.record(z.string(), z.number()),
  transitions: z.record(z.string(), z.array(TransitionRuleZod)),
  validValues: z.record(z.string(), z.array(z.string())),
  manualTransitions: z.record(z.string(), z.array(ManualTransitionRuleZod)).optional(),
  edgeAttributes: z.record(z.string(), EdgeAttributeDefZod).optional(),
  edgeCategories: z.record(z.string(), z.array(z.string())).optional(),
  statusCategories: z.record(z.string(), z.array(z.string())).optional(),
  edgeAttributeAffinity: z.record(z.string(), z.array(z.string())).optional(),
  transitionPolicy: TransitionPolicyZod.optional(),
  ceremonies: z.record(z.string(), CeremonyZod).optional(),
});

// ── Exported Types ──────────────────────────────────────────────────

export type GraphSchema = z.infer<typeof GraphSchemaZod>;
export type NodeTypeDefinition = z.infer<typeof NodeTypeDefinitionZod>;
export type TransitionRule = z.infer<typeof TransitionRuleZod>;
export type TransitionCondition = z.infer<typeof TransitionConditionZod>;
export type ManualTransitionRule = z.infer<typeof ManualTransitionRuleZod>;
export type EdgeTypeDefinitions = z.infer<typeof EdgeTypeDefinitionsZod>;

// ── Referential Integrity ───────────────────────────────────────────

export interface ValidationError {
  path: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export const VALID_PRESET_FNS = [
  'has_linked',
  'field_present',
  'min_linked_count',
  'all_linked_with',
] as const;

const presetFnSet = new Set<string>(VALID_PRESET_FNS);

export function validateReferentialIntegrity(schema: GraphSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build lookup maps
  const typeNames = new Set(schema.nodeTypes.map(n => n.name));
  const statusesByType = new Map(schema.nodeTypes.map(n => [n.name, new Set(n.statuses)]));
  const allRelations = new Set([
    ...schema.edgeTypes.forward,
    ...Object.keys(schema.edgeTypes.reverse),
  ]);

  // ── Duplicate prefix check ──
  const seenPrefixes = new Map<string, string>();
  for (let i = 0; i < schema.nodeTypes.length; i++) {
    const nt = schema.nodeTypes[i];
    const existing = seenPrefixes.get(nt.prefix);
    if (existing) {
      errors.push({
        path: `nodeTypes[${i}].prefix`,
        message: `duplicate prefix "${nt.prefix}" (already used by "${existing}")`,
        severity: 'ERROR',
      });
    } else {
      seenPrefixes.set(nt.prefix, nt.name);
    }
  }

  // ── Transition rules check ──
  for (const [typeName, rules] of Object.entries(schema.transitions)) {
    if (!typeNames.has(typeName)) {
      errors.push({
        path: `transitions.${typeName}`,
        message: `references non-existent nodeType "${typeName}"`,
        severity: 'ERROR',
      });
      continue;
    }

    const validStatuses = statusesByType.get(typeName)!;
    const seenFromTo = new Set<string>();

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const rulePath = `transitions.${typeName}[${i}]`;

      // Check from/to statuses
      if (!validStatuses.has(rule.from)) {
        errors.push({
          path: rulePath,
          message: `"from" status "${rule.from}" not in ${typeName} statuses`,
          severity: 'ERROR',
        });
      }
      if (!validStatuses.has(rule.to)) {
        errors.push({
          path: rulePath,
          message: `"to" status "${rule.to}" not in ${typeName} statuses`,
          severity: 'ERROR',
        });
      }

      // Check duplicate from→to
      const fromToKey = `${rule.from}→${rule.to}`;
      if (seenFromTo.has(fromToKey)) {
        errors.push({
          path: rulePath,
          message: `duplicate transition ${fromToKey} in ${typeName}`,
          severity: 'ERROR',
        });
      }
      seenFromTo.add(fromToKey);

      // Check conditions
      for (let j = 0; j < rule.conditions.length; j++) {
        const cond = rule.conditions[j];
        const condPath = `${rulePath}.conditions[${j}]`;

        // Check preset fn
        if (!presetFnSet.has(cond.fn)) {
          errors.push({
            path: condPath,
            message: `unknown preset function "${cond.fn}"`,
            severity: 'ERROR',
          });
        }

        // Check type arg references valid nodeType
        const condType = cond.args.type as string | undefined;
        if (condType && !typeNames.has(condType)) {
          errors.push({
            path: condPath,
            message: `condition references non-existent nodeType "${condType}"`,
            severity: 'ERROR',
          });
        }

        // Check relation arg references valid edge type
        const condRelation = cond.args.relation as string | undefined;
        if (condRelation && !allRelations.has(condRelation)) {
          errors.push({
            path: condPath,
            message: `condition references non-existent relation "${condRelation}"`,
            severity: 'ERROR',
          });
        }

        // Check status arg is valid for the referenced type
        const condStatus = cond.args.status as string | undefined;
        if (condStatus && condType) {
          const refStatuses = statusesByType.get(condType);
          if (refStatuses && !refStatuses.has(condStatus)) {
            errors.push({
              path: condPath,
              message: `condition references status "${condStatus}" not in ${condType} statuses`,
              severity: 'ERROR',
            });
          }
        }
      }
    }
  }

  // ── Edge categories check ──
  if (schema.edgeCategories) {
    const forwardEdges = new Set(schema.edgeTypes.forward);
    for (const [category, edges] of Object.entries(schema.edgeCategories)) {
      for (let i = 0; i < edges.length; i++) {
        if (!forwardEdges.has(edges[i])) {
          errors.push({
            path: `edgeCategories.${category}[${i}]`,
            message: `edge "${edges[i]}" is not in edgeTypes.forward`,
            severity: 'ERROR',
          });
        }
      }
    }
  }

  // ── Status categories check ──
  if (schema.statusCategories) {
    // Collect all statuses across all node types
    const allStatuses = new Set<string>();
    for (const nt of schema.nodeTypes) {
      for (const s of nt.statuses) {
        allStatuses.add(s);
      }
    }

    // Check mutual exclusivity: each status in exactly one category
    const statusToCategory = new Map<string, string>();
    for (const [category, statuses] of Object.entries(schema.statusCategories)) {
      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];

        // Check status exists in some node type
        if (!allStatuses.has(status)) {
          errors.push({
            path: `statusCategories.${category}[${i}]`,
            message: `status "${status}" is not defined in any nodeType's statuses`,
            severity: 'ERROR',
          });
        }

        // Check mutual exclusivity
        const existing = statusToCategory.get(status);
        if (existing) {
          errors.push({
            path: `statusCategories.${category}[${i}]`,
            message: `status "${status}" is already in category "${existing}" (mutual exclusivity violation)`,
            severity: 'ERROR',
          });
        } else {
          statusToCategory.set(status, category);
        }
      }
    }

    // Check full coverage: every status must be in some category
    for (const status of allStatuses) {
      if (!statusToCategory.has(status)) {
        errors.push({
          path: 'statusCategories',
          message: `status "${status}" is not assigned to any category (full coverage required)`,
          severity: 'WARNING',
        });
      }
    }
  }

  // ── Edge attribute definitions check ──
  if (schema.edgeAttributes) {
    for (const [attrName, attrDef] of Object.entries(schema.edgeAttributes)) {
      if (attrDef.type === 'enum' && !attrDef.valuesRef) {
        errors.push({
          path: `edgeAttributes.${attrName}`,
          message: `enum attribute "${attrName}" must have a valuesRef`,
          severity: 'ERROR',
        });
      }
      if (attrDef.type === 'enum' && attrDef.valuesRef) {
        if (!schema.validValues[attrDef.valuesRef]) {
          errors.push({
            path: `edgeAttributes.${attrName}.valuesRef`,
            message: `references non-existent validValues key "${attrDef.valuesRef}"`,
            severity: 'ERROR',
          });
        }
      }
    }
  }

  // ── Edge attribute affinity check ──
  if (schema.edgeAttributeAffinity) {
    const forwardEdges = new Set(schema.edgeTypes.forward);
    const knownAttrs = schema.edgeAttributes ? new Set(Object.keys(schema.edgeAttributes)) : new Set<string>();
    for (const [edgeType, attrs] of Object.entries(schema.edgeAttributeAffinity)) {
      if (!forwardEdges.has(edgeType)) {
        errors.push({
          path: `edgeAttributeAffinity.${edgeType}`,
          message: `references non-existent forward edge type "${edgeType}"`,
          severity: 'ERROR',
        });
      }
      for (const attr of attrs) {
        if (knownAttrs.size > 0 && !knownAttrs.has(attr)) {
          errors.push({
            path: `edgeAttributeAffinity.${edgeType}`,
            message: `attribute "${attr}" is not defined in edgeAttributes (known: ${[...knownAttrs].join(', ')})`,
            severity: 'WARNING',
          });
        }
      }
    }
  }

  // ── Manual transitions check ──
  if (schema.manualTransitions) {
    for (const [typeName, rules] of Object.entries(schema.manualTransitions)) {
      if (!typeNames.has(typeName)) {
        errors.push({
          path: `manualTransitions.${typeName}`,
          message: `references non-existent nodeType "${typeName}"`,
          severity: 'ERROR',
        });
        continue;
      }

      const validStatuses = statusesByType.get(typeName)!;

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const rulePath = `manualTransitions.${typeName}[${i}]`;

        // "ANY" is a special value meaning "from any status"
        if (rule.from !== 'ANY' && !validStatuses.has(rule.from)) {
          errors.push({
            path: rulePath,
            message: `"from" status "${rule.from}" not in ${typeName} statuses`,
            severity: 'ERROR',
          });
        }

        if (!validStatuses.has(rule.to)) {
          errors.push({
            path: rulePath,
            message: `"to" status "${rule.to}" not in ${typeName} statuses`,
            severity: 'ERROR',
          });
        }
      }
    }
  }

  return errors;
}

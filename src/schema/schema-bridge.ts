// ── Schema Bridge ───────────────────────────────────────────────────
// Converts EMDD's GraphSchema (from graph-schema.yaml) into a
// state-engine SchemaDefinition for use with generateDocs() etc.

import type { SchemaDefinition } from '@beomjk/state-engine/schema';
import type { GraphSchema } from './validator.js';

const PRESET_NAMES = [
  'has_linked',
  'field_present',
  'field_equals',
  'min_linked_count',
  'all_linked_with',
] as const;

type PresetName = (typeof PRESET_NAMES)[number];

/**
 * Convert a validated GraphSchema into a state-engine SchemaDefinition.
 * The YAML-parsed `fn: string` fields are cast to preset name literals
 * since defineSchema() is an identity function at runtime.
 */
export function toSchemaDefinition(schema: GraphSchema): SchemaDefinition<typeof PRESET_NAMES> {
  return {
    presetNames: PRESET_NAMES,
    entities: Object.fromEntries(
      schema.nodeTypes.map(nt => [nt.name, {
        name: nt.name,
        statuses: nt.statuses as readonly string[],
        transitions: (schema.transitions[nt.name] ?? []).map(t => ({
          from: t.from,
          to: t.to,
          conditions: t.conditions.map(c => ({
            fn: c.fn as PresetName,
            args: c.args,
          })),
        })),
        manualTransitions: (schema.manualTransitions?.[nt.name] ?? []).map(mt => ({
          from: mt.from,
          to: mt.to,
        })),
      }]),
    ),
    policy: schema.transitionPolicy
      ? { mode: schema.transitionPolicy.mode }
      : undefined,
  };
}

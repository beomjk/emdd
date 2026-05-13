// ── Schema Validation Types ────────────────────────────────────────
// Validation types and preset function list for EMDD schema.
// Structural validation is now handled by TypeScript (schema.config.ts).

import { ceremonies as defaultCeremonies } from './schema.config.js';

export interface ValidationError {
  path: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

/**
 * Valid preset function names — EMDD graph presets + state-engine builtins.
 * Adding a new preset to graph-presets.ts or state-engine builtins makes it valid here.
 */
export { ALL_PRESET_FNS as VALID_PRESET_FNS } from './preset-names.js';

// ── Ceremony cross-field validation ────────────────────────────────
//
// data-model.md §E-1 L101–L102:
//   (a) every CONDITIONAL ceremony MUST have a non-empty `triggers` map.
//   (b) PER_SESSION ceremonies MUST NOT use `trigger_role: 'prompt_guard'`.

export interface CeremonyShape {
  rhythm: string;
  execution_point: string;
  triggers: Record<string, unknown>;
  trigger_role: string;
}

export function validateCeremonies(
  cers: Record<string, CeremonyShape> = defaultCeremonies as unknown as Record<string, CeremonyShape>
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [name, def] of Object.entries(cers)) {
    if (def.rhythm === 'CONDITIONAL' && Object.keys(def.triggers).length === 0) {
      errors.push({
        path: `ceremonies.${name}`,
        message: `CONDITIONAL ceremony "${name}" must define at least one trigger`,
        severity: 'ERROR',
      });
    }
    if (def.rhythm === 'PER_SESSION' && def.trigger_role === 'prompt_guard') {
      errors.push({
        path: `ceremonies.${name}`,
        message: `PER_SESSION ceremony "${name}" must not use trigger_role: 'prompt_guard'`,
        severity: 'ERROR',
      });
    }
  }
  return errors;
}

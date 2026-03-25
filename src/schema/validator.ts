// ── Schema Validation Types ────────────────────────────────────────
// Validation types and preset function list for EMDD schema.
// Structural validation is now handled by TypeScript (schema.config.ts).

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

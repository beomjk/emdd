/**
 * Canonical preset name list — importable by any module without circular deps.
 * This file must NOT import from src/graph/ (to prevent cycles via types.ts).
 */

/** EMDD graph presets (implemented in graph-presets.ts). */
export const EMDD_PRESET_NAMES = ['has_linked', 'min_linked_count', 'all_linked_with'] as const;

/** state-engine builtin presets. Must match Object.keys(builtinPresets). */
export const BUILTIN_PRESET_NAMES = ['field_present', 'field_equals'] as const;

/** All preset function names available in the engine. */
export const ALL_PRESET_FNS = [...EMDD_PRESET_NAMES, ...BUILTIN_PRESET_NAMES] as const;

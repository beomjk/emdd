/**
 * EMDD transition engine instance.
 *
 * Creates a singleton engine from @beomjk/state-engine with EMDD's
 * graph presets registered alongside builtin presets (field_present,
 * field_equals). Import `engine` from this module wherever transition
 * evaluation is needed.
 */
import { createEngine } from '@beomjk/state-engine/engine';
import { builtinPresets } from '@beomjk/state-engine/presets';
import type { Graph } from './types.js';
import { emddPresets } from './graph-presets.js';
export { ALL_PRESET_FNS } from '../schema/preset-names.js';

export const engine = createEngine<Graph>({
  presets: { ...builtinPresets, ...emddPresets },
});

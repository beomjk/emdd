/**
 * EMDD transition engine instance.
 *
 * Creates a singleton engine from @beomjk/state-engine with EMDD's
 * graph presets registered. Import `engine` from this module wherever
 * transition evaluation is needed.
 */
import { createEngine } from '@beomjk/state-engine/engine';
import type { Graph } from './types.js';
import { emddPresets } from './graph-presets.js';

export const engine = createEngine<Graph>({
  presets: emddPresets,
});

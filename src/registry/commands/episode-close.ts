import { z } from 'zod';
import { closeEpisode, type EpisodeCloseResult } from '../../graph/episode-close.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  episodeId: z.string().min(1).describe('Episode node ID'),
});

export const episodeCloseDef: CommandDef<typeof schema, EpisodeCloseResult> = {
  name: 'episode-close',
  description: 'Transition an IN_PROGRESS episode to COMPLETED',
  category: 'write',
  schema,
  cli: { positional: ['episodeId'] },

  async execute(input) {
    return closeEpisode(input.graphDir, input.episodeId);
  },

  format(result) {
    return `✓ ${result.episodeId} closed (${result.fromStatus} → ${result.toStatus})`;
  },
};

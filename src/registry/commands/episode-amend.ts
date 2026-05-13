import { z } from 'zod';
import { amendEpisode } from '../../graph/operations.js';
import type { AmendResult } from '../../graph/episode-amend.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  episodeId: z.string().min(1).describe('Episode node ID'),
  reason: z.string().min(5).max(200).describe('Why this amendment was needed (5-200 chars)'),
});

export const episodeAmendDef: CommandDef<typeof schema, AmendResult> = {
  name: 'episode-amend',
  description: 'Record a justified append-only violation on an episode',
  category: 'write',
  schema,
  cli: { positional: ['episodeId'] },

  async execute(input) {
    return amendEpisode(input.graphDir, input.episodeId, input.reason);
  },

  format(result) {
    return `✓ Amendment recorded for ${result.episodeId} (#${result.violationIndex}, ${result.severity})`;
  },
};

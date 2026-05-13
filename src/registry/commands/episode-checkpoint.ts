import { z } from 'zod';
import { checkpointEpisode, type CheckpointResult } from '../../graph/episode-checkpoint.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  episodeId: z.string().min(1).describe('Episode node ID (e.g., epi-014)'),
  note: z.string().min(1).max(500).describe('Progress note text (max 500 chars)'),
});

export const episodeCheckpointDef: CommandDef<typeof schema, CheckpointResult> = {
  name: 'episode-checkpoint',
  description: 'Append a progress note to an IN_PROGRESS episode',
  category: 'write',
  schema,
  cli: { positional: ['episodeId', 'note'] },

  async execute(input) {
    return checkpointEpisode(input.graphDir, input.episodeId, input.note);
  },

  format(result) {
    const lines = [
      `✓ Checkpoint added to ${result.episodeId}`,
      `  ${result.checkpointTimestamp}`,
    ];
    for (const w of result.warnings) {
      lines.push(`  ⚠ ${w}`);
    }
    return lines.join('\n');
  },
};

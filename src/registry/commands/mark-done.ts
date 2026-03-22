import { z } from 'zod';
import { markDone } from '../../graph/operations.js';
import type { MarkDoneResult } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  episodeId: z.string().describe('Episode node ID'),
  item: z.string().describe('Checklist item text'),
  marker: z.enum(['done', 'deferred', 'superseded']).optional().describe('Done marker type (default: done)'),
});

export const markDoneDef: CommandDef<typeof schema, MarkDoneResult> = {
  name: 'mark-done',
  description: 'Mark a checklist item as done in an episode',
  category: 'write',
  schema,
  cli: { commandName: 'done', positional: ['episodeId', 'item'] },

  async execute(input) {
    return markDone(input.graphDir, input.episodeId, input.item, input.marker ?? 'done');
  },

  format(result) {
    return t('format.item_marked', { item: result.item, marker: result.marker, episodeId: result.episodeId });
  },
};

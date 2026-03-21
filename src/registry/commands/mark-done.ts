import { z } from 'zod';
import { markDone } from '../../graph/operations.js';
import type { MarkDoneResult } from '../../graph/types.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  episodeId: z.string().describe('Episode node ID'),
  item: z.string().describe('Checklist item text'),
  marker: z.enum(['done', 'deferred', 'superseded']).optional().describe('Done marker type (default: done)'),
});

export const markDoneDef: CommandDef<typeof schema, MarkDoneResult> = {
  name: 'mark-done',
  description: { en: 'Mark a checklist item as done in an episode', ko: '에피소드 체크리스트 항목 완료 처리' },
  category: 'write',
  schema,
  cli: { commandName: 'done' },

  async execute(input) {
    return markDone(input.graphDir, input.episodeId, input.item, input.marker ?? 'done');
  },

  format(result, _locale) {
    return `Marked "${result.item}" as ${result.marker} in ${result.episodeId}`;
  },
};

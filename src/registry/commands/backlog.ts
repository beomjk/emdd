import { z } from 'zod';
import { backlogCommand } from '../../graph/operations.js';
import type { BacklogResult } from '../../graph/backlog.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const backlogDef: CommandDef<typeof schema, BacklogResult> = {
  name: 'backlog',
  description: { en: 'Show project backlog (open items, deferred, checklists)', ko: '프로젝트 백로그 표시 (열린 항목, 보류, 체크리스트)' },
  category: 'analysis',
  schema,

  async execute(input) {
    return backlogCommand(input.graphDir);
  },

  format(result, _locale) {
    if (result.items.length === 0) return 'No backlog items.';
    return result.items.map(item =>
      `[${item.marker}] ${item.text} (${item.episodeId})`
    ).join('\n');
  },
};

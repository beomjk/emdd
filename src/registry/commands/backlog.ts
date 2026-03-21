import { z } from 'zod';
import { backlogCommand } from '../../graph/operations.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const backlogDef: CommandDef<typeof schema, unknown> = {
  name: 'backlog',
  description: { en: 'Show project backlog (open items, deferred, checklists)', ko: '프로젝트 백로그 표시 (열린 항목, 보류, 체크리스트)' },
  category: 'analysis',
  schema,

  async execute(input) {
    return backlogCommand(input.graphDir);
  },

  format(result, _locale) {
    // backlogCommand returns a formatted object
    return JSON.stringify(result, null, 2);
  },
};

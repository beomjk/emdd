import { z } from 'zod';
import { checkKillCriteria } from '../../graph/operations.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const killCheckDef: CommandDef<typeof schema, unknown[]> = {
  name: 'kill-check',
  description: { en: 'Check kill criteria alerts', ko: '킬 크라이테리아 경고 확인' },
  category: 'analysis',
  schema,

  async execute(input) {
    return checkKillCriteria(input.graphDir);
  },

  format(results, _locale) {
    const arr = results as Array<{ nodeId: string; criterion: string; message: string }>;
    if (arr.length === 0) return 'No kill criteria alerts.';
    return arr.map(r => `[${r.nodeId}] ${r.criterion}: ${r.message}`).join('\n');
  },
};

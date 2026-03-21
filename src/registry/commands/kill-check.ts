import { z } from 'zod';
import { checkKillCriteria } from '../../graph/operations.js';
import type { KillCriterionAlert } from '../../graph/kill-criterion.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const killCheckDef: CommandDef<typeof schema, KillCriterionAlert[]> = {
  name: 'kill-check',
  description: { en: 'Check kill criteria alerts', ko: '킬 크라이테리아 경고 확인' },
  category: 'analysis',
  schema,

  async execute(input) {
    return checkKillCriteria(input.graphDir);
  },

  format(results, _locale) {
    if (results.length === 0) return 'No kill criteria alerts.';
    return results.map(r => `[${r.hypothesisId}] ${r.killCriterion}: ${r.message}`).join('\n');
  },
};

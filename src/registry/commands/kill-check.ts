import { z } from 'zod';
import { checkKillCriteria } from '../../graph/operations.js';
import type { KillCriterionAlert } from '../../graph/kill-criterion.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const killCheckDef: CommandDef<typeof schema, KillCriterionAlert[]> = {
  name: 'kill-check',
  description: 'Check kill criteria alerts',
  category: 'analysis',
  schema,

  async execute(input) {
    return checkKillCriteria(input.graphDir);
  },

  format(results) {
    if (results.length === 0) return t('format.no_kill');
    return results.map(r => `[${r.hypothesisId}] ${r.killCriterion}: ${r.message}`).join('\n');
  },
};

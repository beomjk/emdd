import { z } from 'zod';
import { getPromotionCandidates } from '../../graph/operations.js';
import type { PromoteCandidate } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const promoteDef: CommandDef<typeof schema, PromoteCandidate[]> = {
  name: 'promote',
  description: 'Show promotion candidates',
  category: 'analysis',
  schema,

  async execute(input) {
    return getPromotionCandidates(input.graphDir);
  },

  format(candidates) {
    if (candidates.length === 0) return t('format.no_promote');
    return candidates.map(c =>
      `${c.id}: confidence=${c.confidence}, supports=${c.supports} (${c.reason})`
    ).join('\n');
  },
};

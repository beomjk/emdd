import { z } from 'zod';
import { getPromotionCandidates } from '../../graph/operations.js';
import type { PromoteCandidate } from '../../graph/types.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const promoteDef: CommandDef<typeof schema, PromoteCandidate[]> = {
  name: 'promote',
  description: { en: 'Show promotion candidates', ko: '승격 후보 표시' },
  category: 'analysis',
  schema,

  async execute(input) {
    return getPromotionCandidates(input.graphDir);
  },

  format(candidates, _locale) {
    if (candidates.length === 0) return 'No promotion candidates.';
    return candidates.map(c =>
      `${c.id}: confidence=${c.confidence}, supports=${c.supports} (${c.reason})`
    ).join('\n');
  },
};

import { z } from 'zod';
import { markConsolidated } from '../../graph/operations.js';
import type { MarkConsolidatedResult } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  date: z.string().optional().describe('Consolidation date (YYYY-MM-DD, default: today)'),
});

export const markConsolidatedDef: CommandDef<typeof schema, MarkConsolidatedResult> = {
  name: 'mark-consolidated',
  description: 'Record a consolidation date to reset episode counting',
  category: 'write',
  schema,

  async execute(input) {
    return markConsolidated(input.graphDir, input.date);
  },

  format(result) {
    return t('format.consolidated_marked', { date: result.date });
  },
};

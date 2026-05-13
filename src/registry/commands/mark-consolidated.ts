import { z } from 'zod';
import { markConsolidated, regenerateBacklog } from '../../graph/operations.js';
import type { MarkConsolidatedResult } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  date: z.string().optional().describe('Consolidation date (YYYY-MM-DD, default: today)'),
});

interface MarkConsolidatedExt extends MarkConsolidatedResult {
  backlog?: { totalItems: number; written: boolean };
  backlogError?: string;
}

export const markConsolidatedDef: CommandDef<typeof schema, MarkConsolidatedExt> = {
  name: 'mark-consolidated',
  description: 'Record a consolidation date and regenerate _backlog.md',
  category: 'analysis',
  schema,

  async execute(input) {
    const result = await markConsolidated(input.graphDir, input.date);
    try {
      const backlog = await regenerateBacklog(input.graphDir);
      return { ...result, backlog: { totalItems: backlog.totalItems, written: backlog.written } };
    } catch (err) {
      return { ...result, backlogError: err instanceof Error ? err.message : String(err) };
    }
  },

  format(result) {
    const base = t('format.consolidated_marked', { date: result.date });
    if (result.backlogError) {
      return `${base}\n  ⚠ _backlog.md regeneration failed: ${result.backlogError}`;
    }
    if (result.backlog) {
      return `${base}\n✓ _backlog.md regenerated (${result.backlog.totalItems} pending items)`;
    }
    return base;
  },
};

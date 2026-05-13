import { z } from 'zod';
import { getBacklog } from '../../graph/operations.js';
import { pinBacklogItem, detectGitUser, type BacklogResult } from '../../graph/backlog.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  status: z.enum(['pending', 'done', 'deferred', 'superseded', 'all']).optional()
    .describe('Filter by item status (default: pending)'),
  pin: z.string().optional()
    .describe('Item slug to pin priority for (use with --priority)'),
  priority: z.enum(['P0', 'P1', 'P2']).optional()
    .describe('Priority to assign (required when --pin is used)'),
});

interface BacklogCommandResult {
  mode: 'read' | 'pin';
  items?: BacklogResult['items'];
  pinnedItem?: string;
  priority?: 'P0' | 'P1' | 'P2';
  totalPinned?: number;
  warning?: string;
}

export const backlogDef: CommandDef<typeof schema, BacklogCommandResult> = {
  name: 'backlog',
  description: 'Show project backlog or pin an item priority',
  category: 'analysis',
  schema,

  async execute(input) {
    if (input.pin !== undefined) {
      if (input.priority === undefined) {
        throw new Error('--priority is required with --pin');
      }
      const result = await pinBacklogItem(input.graphDir, input.pin, input.priority, detectGitUser());
      return { mode: 'pin', ...result };
    }
    if (input.priority !== undefined && input.pin === undefined) {
      throw new Error('--priority is only valid with --pin');
    }
    const result = await getBacklog(input.graphDir, input.status);
    return { mode: 'read', items: result.items };
  },

  format(result) {
    if (result.mode === 'pin') {
      const lines = [`✓ Pinned [${result.pinnedItem}] → ${result.priority} in _backlog.meta.yml`, '✓ _backlog.md regenerated'];
      if (result.warning) lines.push(`  ⚠ ${result.warning}`);
      return lines.join('\n');
    }
    const items = result.items ?? [];
    if (items.length === 0) return t('format.no_backlog');
    return items.map(item =>
      `[${item.marker}] ${item.text} (${item.episodeId})`
    ).join('\n');
  },
};

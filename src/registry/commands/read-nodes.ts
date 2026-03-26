import { z } from 'zod';
import { readNodes } from '../../graph/operations.js';
import type { NodeDetail } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  nodeIds: z.array(z.string()).describe('Array of node IDs to read (missing IDs are silently skipped)'),
});

export const readNodesDef: CommandDef<typeof schema, NodeDetail[]> = {
  name: 'read-nodes',
  description: 'Read multiple nodes in a single operation (batch)',
  category: 'read',
  schema,
  cli: false,

  async execute(input) {
    return readNodes(input.graphDir, input.nodeIds);
  },

  format(details) {
    if (details.length === 0) return t('format.no_nodes');
    return details.map(detail => {
      const lines: string[] = [];
      lines.push(`[${detail.id}] ${detail.title}`);
      lines.push(`  ${t('format.type')}: ${detail.type}  ${t('format.status')}: ${detail.status ?? '-'}`);
      if (detail.confidence != null) lines.push(`  ${t('format.confidence')}: ${detail.confidence}`);
      if (detail.tags.length > 0) lines.push(`  ${t('format.tags')}: ${detail.tags.join(', ')}`);
      if (detail.links.length > 0) {
        lines.push(`  ${t('format.links')}:`);
        for (const l of detail.links) lines.push(`    → ${l.target} [${l.relation}]`);
      }
      for (const [key, val] of Object.entries(detail.meta)) {
        lines.push(`  ${key}: ${String(val)}`);
      }
      if (detail.body) lines.push('', detail.body);
      return lines.join('\n');
    }).join('\n---\n');
  },
};

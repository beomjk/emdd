import { z } from 'zod';
import { readNode } from '../../graph/operations.js';
import type { NodeDetail } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  nodeId: z.string().describe('Node ID to read (e.g., hyp-001)'),
});

export const readNodeDef: CommandDef<typeof schema, NodeDetail> = {
  name: 'read-node',
  description: 'Read a node detail',
  category: 'read',
  schema,
  cli: { commandName: 'read' },

  async execute(input) {
    const detail = await readNode(input.graphDir, input.nodeId);
    if (!detail) throw new Error(t('error.node_not_found', { id: input.nodeId }));
    return detail;
  },

  format(detail) {
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
  },
};

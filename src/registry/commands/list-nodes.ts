import { z } from 'zod';
import { listNodes } from '../../graph/operations.js';
import type { Node, NodeFilter, NodeType } from '../../graph/types.js';
import { NODE_TYPES } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  type: z.enum(NODE_TYPES as unknown as [string, ...string[]]).optional().describe('Filter by node type'),
  status: z.string().optional().describe('Filter by status'),
  since: z.string().optional().describe('Filter nodes updated since date (YYYY-MM-DD)'),
});

export const listNodesDef: CommandDef<typeof schema, Node[]> = {
  name: 'list-nodes',
  description: 'List nodes, optionally filtered by type and/or status',
  category: 'read',
  schema,
  cli: { commandName: 'list' },

  async execute(input) {
    const filter: NodeFilter = {};
    if (input.type) filter.type = input.type as NodeType;
    if (input.status) filter.status = input.status.toUpperCase();
    if (input.since) filter.since = input.since;
    return listNodes(input.graphDir, filter);
  },

  format(nodes) {
    if (nodes.length === 0) return t('format.no_nodes');
    return nodes.map(n => {
      const status = n.status ?? '-';
      const conf = n.confidence != null ? ` (${n.confidence.toFixed(2)})` : '';
      return `[${n.id}] ${n.title}  ${n.type}  ${status}${conf}`;
    }).join('\n');
  },
};

import { z } from 'zod';
import { listNodes } from '../../graph/operations.js';
import type { Node, NodeFilter, NodeType } from '../../graph/types.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  type: z.string().optional().describe('Filter by node type'),
  status: z.string().optional().describe('Filter by status'),
});

export const listNodesDef: CommandDef<typeof schema, Node[]> = {
  name: 'list-nodes',
  description: { en: 'List nodes, optionally filtered by type and/or status', ko: '노드 목록 조회 (타입/상태 필터 가능)' },
  category: 'read',
  schema,
  cli: false, // CLI uses legacy positional args (list [path]); registry serves MCP only until Phase 6

  async execute(input) {
    const filter: NodeFilter = {};
    if (input.type) filter.type = input.type as NodeType;
    if (input.status) filter.status = input.status.toUpperCase();
    return listNodes(input.graphDir, filter);
  },

  format(nodes, _locale) {
    if (nodes.length === 0) return 'No nodes found.';
    return nodes.map(n => {
      const status = n.status ?? '-';
      const conf = n.confidence != null ? ` (${n.confidence.toFixed(2)})` : '';
      return `[${n.id}] ${n.title}  ${n.type}  ${status}${conf}`;
    }).join('\n');
  },
};

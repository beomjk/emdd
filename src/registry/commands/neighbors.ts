import { z } from 'zod';
import { getNeighbors } from '../../graph/operations.js';
import type { NeighborNode } from '../../graph/operations.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  nodeId: z.string().describe('Center node ID'),
  depth: z.number().optional().default(1).describe('BFS depth (default: 1)'),
});

export const neighborsDef: CommandDef<typeof schema, NeighborNode[]> = {
  name: 'neighbors',
  description: 'List neighbor nodes within BFS depth',
  category: 'read',
  schema,
  cli: { positional: ['nodeId'] },
  mcp: { toolName: 'graph-neighbors' },

  async execute(input) {
    return getNeighbors(input.graphDir, input.nodeId, input.depth);
  },

  format(neighbors) {
    if (neighbors.length === 0) return t('format.no_neighbors');
    return neighbors.map(n => {
      const dir = n.direction === 'outgoing' ? '→' : '←';
      return `${dir} [${n.id}] ${n.title}  ${n.type}  ${n.relation}`;
    }).join('\n');
  },
};

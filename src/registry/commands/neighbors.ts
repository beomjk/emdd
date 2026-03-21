import { z } from 'zod';
import { getNeighbors } from '../../graph/operations.js';
import type { NeighborNode } from '../../graph/operations.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  nodeId: z.string().describe('Center node ID'),
  depth: z.number().optional().default(1).describe('BFS depth (default: 1)'),
});

export const neighborsDef: CommandDef<typeof schema, NeighborNode[]> = {
  name: 'neighbors',
  description: { en: 'List neighbor nodes within BFS depth', ko: '이웃 노드 조회 (BFS 깊이)' },
  category: 'read',
  schema,
  mcp: { toolName: 'graph_neighbors' },

  async execute(input) {
    return getNeighbors(input.graphDir, input.nodeId, input.depth);
  },

  format(neighbors, _locale) {
    if (neighbors.length === 0) return 'No neighbors found.';
    return neighbors.map(n => {
      const dir = n.direction === 'outgoing' ? '→' : '←';
      return `${dir} [${n.id}] ${n.title}  ${n.type}  ${n.relation}`;
    }).join('\n');
  },
};

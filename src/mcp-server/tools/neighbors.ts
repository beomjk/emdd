import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getNeighbors } from '../../graph/operations.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerNeighbors(server: McpServer): void {
  server.tool(
    'graph_neighbors',
    'Get neighbors of a node up to a given depth (BFS traversal)',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      nodeId: z.string().describe('Node ID (e.g., hyp-001)'),
      depth: z.number().optional().default(1).describe('Traversal depth (default: 1)'),
    },
    async ({ graphDir, nodeId, depth }) => {
      return withErrorHandling(async () => {
        const neighbors = await getNeighbors(graphDir, nodeId, depth);
        return jsonResult(neighbors);
      });
    },
  );
}

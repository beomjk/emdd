import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { deleteEdge } from '../../graph/operations.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerDeleteEdge(server: McpServer): void {
  server.tool(
    'delete-edge',
    'Remove a link from source to target. If relation is omitted, removes all links between the two nodes.',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      source: z.string().describe('Source node ID'),
      target: z.string().describe('Target node ID'),
      relation: z.string().optional().describe('Relation to remove (if omitted, removes all links to target)'),
    },
    async ({ graphDir, source, target, relation }) =>
      withErrorHandling(async () => {
        const result = await deleteEdge(graphDir, source, target, relation);
        return jsonResult(result);
      }),
  );
}

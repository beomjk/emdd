import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createEdge } from '../../graph/operations.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerCreateEdge(server: McpServer): void {
  server.tool(
    'create-edge',
    'Add an edge (link) from source to target with the given relation',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      source: z.string().describe('Source node ID'),
      target: z.string().describe('Target node ID'),
      relation: z.string().describe('Relation type (supports, contradicts, spawns, etc.)'),
    },
    async ({ graphDir, source, target, relation }) =>
      withErrorHandling(async () => {
        const result = await createEdge(graphDir, source, target, relation);
        return jsonResult(result);
      }),
  );
}

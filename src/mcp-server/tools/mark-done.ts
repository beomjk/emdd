import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { markDone } from '../../graph/operations.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerMarkDone(server: McpServer): void {
  server.tool(
    'mark-done',
    'Mark a checklist item in an episode node with a status marker (done/deferred/superseded)',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      episodeId: z.string().describe('Episode node ID (e.g., epi-001)'),
      item: z.string().describe('Checklist item text to match'),
      marker: z.enum(['done', 'deferred', 'superseded']).default('done').describe('Marker type'),
    },
    async ({ graphDir, episodeId, item, marker }) =>
      withErrorHandling(async () => {
        const result = await markDone(graphDir, episodeId, item, marker);
        return jsonResult(result);
      }),
  );
}

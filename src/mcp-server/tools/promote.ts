import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPromotionCandidates } from '../../graph/operations.js';
import { jsonResult } from './util.js';

export function registerPromote(server: McpServer): void {
  server.tool(
    'promote',
    'Identify findings eligible for promotion to knowledge',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) => {
      const candidates = await getPromotionCandidates(graphDir);
      return jsonResult(candidates);
    },
  );
}

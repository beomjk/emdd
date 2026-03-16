import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkConsolidation } from '../../graph/operations.js';
import { jsonResult } from './util.js';

export function registerCheck(server: McpServer): void {
  server.tool(
    'check',
    'Check consolidation triggers in the EMDD graph',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) => {
      const result = await checkConsolidation(graphDir);
      return jsonResult(result);
    },
  );
}

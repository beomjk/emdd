import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth } from '../../graph/operations.js';
import { jsonResult } from './util.js';

export function registerHealth(server: McpServer): void {
  server.tool(
    'health',
    'Compute a health report for the EMDD graph',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) => {
      const report = await getHealth(graphDir);
      return jsonResult(report);
    },
  );
}

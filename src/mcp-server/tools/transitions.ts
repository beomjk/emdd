import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { detectTransitions } from '../../graph/transitions.js';
import { jsonResult } from './util.js';

export function registerTransitions(server: McpServer): void {
  server.tool(
    'status-transitions',
    'Detect recommended status transitions in the EMDD graph',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) => {
      const results = await detectTransitions(graphDir);
      return jsonResult(results);
    },
  );
}

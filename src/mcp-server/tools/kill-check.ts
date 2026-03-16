import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkKillCriteria } from '../../graph/kill-criterion.js';
import { jsonResult } from './util.js';

export function registerKillCheck(server: McpServer): void {
  server.tool(
    'kill-check',
    'Check kill criteria status for hypotheses in the EMDD graph',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) => {
      const alerts = await checkKillCriteria(graphDir);
      return jsonResult(alerts);
    },
  );
}

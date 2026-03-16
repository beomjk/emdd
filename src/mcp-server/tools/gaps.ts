import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth } from '../../graph/operations.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerGaps(server: McpServer): void {
  server.tool(
    'graph_gaps',
    'Detect structural gaps in the knowledge graph',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) => {
      return withErrorHandling(async () => {
        const report = await getHealth(graphDir);
        return jsonResult({
          gaps: report.gaps,
          gapDetails: report.gapDetails,
        });
      });
    },
  );
}

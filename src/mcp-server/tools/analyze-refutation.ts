import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeRefutation } from '../../graph/refutation.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerAnalyzeRefutation(server: McpServer): void {
  server.tool(
    'analyze-refutation',
    'Analyze refutation impact on hypotheses from disputed/retracted knowledge nodes',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) =>
      withErrorHandling(async () => {
        const analysis = await analyzeRefutation(graphDir);
        return jsonResult(analysis);
      }),
  );
}

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { propagateConfidence } from '../../graph/confidence.js';
import { jsonResult } from './util.js';

export function registerConfidence(server: McpServer): void {
  server.tool(
    'confidence-propagate',
    'Propagate confidence across the EMDD graph using Bayesian-inspired formula',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) => {
      const results = await propagateConfidence(graphDir);
      return jsonResult(results);
    },
  );
}

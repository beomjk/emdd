import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createNode } from '../../graph/operations.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerCreateNode(server: McpServer): void {
  server.tool(
    'create-node',
    'Create a new node of the given type with the given slug',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      type: z.string().describe('Node type (hypothesis, experiment, finding, knowledge, question, decision, episode)'),
      slug: z.string().describe('URL-friendly slug for the node'),
      lang: z.string().optional().describe('Language locale (default: en)'),
    },
    async ({ graphDir, type, slug, lang }) =>
      withErrorHandling(async () => {
        const result = await createNode(graphDir, type, slug, lang);
        return jsonResult(result);
      }),
  );
}

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { updateNode } from '../../graph/operations.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerUpdateNode(server: McpServer): void {
  server.tool(
    'update-node',
    'Update frontmatter fields on a node (auto-sets updated date). Values are strings; confidence is parsed as a number.',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      nodeId: z.string().describe('Node ID to update (e.g., hyp-001)'),
      updates: z.record(z.string(), z.string()).describe('Key-value pairs to set on frontmatter. Use dot-notation for nested fields (e.g., {"config.learning_rate": "0.01", "status": "TESTING"})'),
      transitionPolicy: z.enum(['strict', 'warn', 'off']).optional().describe('Transition policy mode (default: strict from schema)'),
    },
    async ({ graphDir, nodeId, updates, transitionPolicy }) =>
      withErrorHandling(async () => {
        const options = transitionPolicy ? { transitionPolicy } : undefined;
        const result = await updateNode(graphDir, nodeId, updates as Record<string, string>, options);
        return jsonResult(result);
      }),
  );
}

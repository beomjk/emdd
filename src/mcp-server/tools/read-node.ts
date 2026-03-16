import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readNode } from '../../graph/operations.js';
import { jsonResult, errorResult } from './util.js';

export function registerReadNode(server: McpServer): void {
  server.tool(
    'read-node',
    'Read a single node by ID, returning full detail including body text',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      nodeId: z.string().describe('Node ID (e.g., hyp-001)'),
    },
    async ({ graphDir, nodeId }) => {
      const detail = await readNode(graphDir, nodeId);
      if (!detail) {
        return errorResult(`Node not found: ${nodeId}`);
      }
      return jsonResult(detail);
    },
  );
}

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listNodes } from '../../graph/operations.js';
import type { NodeFilter } from '../../graph/types.js';
import { jsonResult } from './util.js';

export function registerListNodes(server: McpServer): void {
  server.tool(
    'list-nodes',
    'List all nodes in the EMDD graph, optionally filtered by type and/or status',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      type: z.string().optional().describe('Filter by node type (hypothesis, experiment, finding, etc.)'),
      status: z.string().optional().describe('Filter by status'),
    },
    async ({ graphDir, type, status }) => {
      const filter: NodeFilter = {};
      if (type) filter.type = type as NodeFilter['type'];
      if (status) filter.status = status;
      const nodes = await listNodes(graphDir, filter);
      return jsonResult(nodes);
    },
  );
}

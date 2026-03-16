import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listBranchGroups } from '../../graph/branch-groups.js';
import { jsonResult } from './util.js';

export function registerBranchGroups(server: McpServer): void {
  server.tool(
    'branch-groups',
    'List and analyze branch groups in the EMDD graph',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
    },
    async ({ graphDir }) => {
      const groups = await listBranchGroups(graphDir);
      return jsonResult(groups);
    },
  );
}

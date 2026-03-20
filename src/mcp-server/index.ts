import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerListNodes } from './tools/list-nodes.js';
import { registerReadNode } from './tools/read-node.js';
import { registerCreateNode } from './tools/create-node.js';
import { registerCreateEdge } from './tools/create-edge.js';
import { registerHealth } from './tools/health.js';
import { registerCheck } from './tools/check.js';
import { registerPromote } from './tools/promote.js';
import { registerConfidence } from './tools/confidence.js';
import { registerTransitions } from './tools/transitions.js';
import { registerKillCheck } from './tools/kill-check.js';
import { registerBranchGroups } from './tools/branch-groups.js';
import { registerNeighbors } from './tools/neighbors.js';
import { registerGaps } from './tools/gaps.js';
import { registerUpdateNode } from './tools/update-node.js';
import { registerDeleteEdge } from './tools/delete-edge.js';
import { registerMarkDone } from './tools/mark-done.js';
import { registerContextLoading } from './prompts/context-loading.js';
import { registerEpisodeCreation } from './prompts/episode-creation.js';
import { registerConsolidation } from './prompts/consolidation.js';
import { registerHealthReview } from './prompts/health-review.js';
import { VERSION } from '../version.js';

export function createEmddMcpServer(): McpServer {
  const server = new McpServer({ name: 'emdd', version: VERSION });

  // Tools
  registerListNodes(server);
  registerReadNode(server);
  registerCreateNode(server);
  registerCreateEdge(server);
  registerHealth(server);
  registerCheck(server);
  registerPromote(server);
  registerConfidence(server);
  registerTransitions(server);
  registerKillCheck(server);
  registerBranchGroups(server);
  registerNeighbors(server);
  registerGaps(server);
  registerUpdateNode(server);
  registerDeleteEdge(server);
  registerMarkDone(server);

  // Prompts
  registerContextLoading(server);
  registerEpisodeCreation(server);
  registerConsolidation(server);
  registerHealthReview(server);

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createEmddMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

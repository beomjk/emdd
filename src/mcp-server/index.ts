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
import { registerAnalyzeRefutation } from './tools/analyze-refutation.js';
import { registerContextLoading } from './prompts/context-loading.js';
import { registerEpisodeCreation } from './prompts/episode-creation.js';
import { registerConsolidation } from './prompts/consolidation.js';
import { registerHealthReview } from './prompts/health-review.js';
import { VERSION } from '../version.js';
import { CommandRegistry } from '../registry/registry.js';
import { McpAdapter } from '../registry/mcp-adapter.js';
import { listNodesDef } from '../registry/commands/list-nodes.js';
import { createNodeDef } from '../registry/commands/create-node.js';
import { healthDef } from '../registry/commands/health.js';

/** Names registered by the registry (used to skip legacy duplicates) */
const registryNames = new Set([listNodesDef.name, createNodeDef.name, healthDef.name]);

export function createEmddMcpServer(): McpServer {
  const server = new McpServer({ name: 'emdd', version: VERSION });

  // Registry-based tools (take precedence)
  const registry = new CommandRegistry();
  registry.register(listNodesDef);
  registry.register(createNodeDef);
  registry.register(healthDef);
  new McpAdapter(registry).registerTools(server);

  // Legacy tools (skip those already registered by registry)
  // list-nodes, create-node, health are now served by registry
  registerReadNode(server);
  registerCreateEdge(server);
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
  registerAnalyzeRefutation(server);

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

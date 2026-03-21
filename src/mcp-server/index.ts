import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
import { readNodeDef } from '../registry/commands/read-node.js';
import { neighborsDef } from '../registry/commands/neighbors.js';
import { gapsDef } from '../registry/commands/gaps.js';
import { createEdgeDef } from '../registry/commands/create-edge.js';
import { deleteEdgeDef } from '../registry/commands/delete-edge.js';
import { updateNodeDef } from '../registry/commands/update-node.js';
import { markDoneDef } from '../registry/commands/mark-done.js';
import { checkDef } from '../registry/commands/check.js';
import { promoteDef } from '../registry/commands/promote.js';
import { confidencePropagateDef } from '../registry/commands/confidence-propagate.js';
import { transitionsDef } from '../registry/commands/transitions.js';
import { killCheckDef } from '../registry/commands/kill-check.js';
import { branchGroupsDef } from '../registry/commands/branch-groups.js';
import { lintDef } from '../registry/commands/lint.js';
import { backlogDef } from '../registry/commands/backlog.js';
import { indexGraphDef } from '../registry/commands/index-graph.js';
import { analyzeRefutationDef } from '../registry/commands/analyze-refutation.js';

export function createEmddMcpServer(): McpServer {
  const server = new McpServer({ name: 'emdd', version: VERSION });

  // All tools served from registry
  const registry = new CommandRegistry();

  // Read
  registry.register(listNodesDef);
  registry.register(readNodeDef);
  registry.register(neighborsDef);
  registry.register(gapsDef);

  // Write
  registry.register(createNodeDef);
  registry.register(createEdgeDef);
  registry.register(deleteEdgeDef);
  registry.register(updateNodeDef);
  registry.register(markDoneDef);

  // Analysis
  registry.register(healthDef);
  registry.register(checkDef);
  registry.register(promoteDef);
  registry.register(confidencePropagateDef);
  registry.register(transitionsDef);
  registry.register(killCheckDef);
  registry.register(branchGroupsDef);
  registry.register(lintDef);
  registry.register(backlogDef);
  registry.register(indexGraphDef);
  registry.register(analyzeRefutationDef);

  new McpAdapter(registry).registerTools(server);

  // Prompts (not part of registry)
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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerContextLoading } from './prompts/context-loading.js';
import { registerEpisodeCreation } from './prompts/episode-creation.js';
import { registerConsolidation } from './prompts/consolidation.js';
import { registerHealthReview } from './prompts/health-review.js';
import { VERSION } from '../version.js';
import { McpAdapter } from '../registry/mcp-adapter.js';
import { createDefaultRegistry } from '../registry/all-commands.js';

export function createEmddMcpServer(): McpServer {
  const server = new McpServer({ name: 'emdd', version: VERSION });

  // All tools served from registry
  const registry = createDefaultRegistry();

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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEmddMcpServer } from '../../../src/mcp-server/index.js';
import { VERSION } from '../../../src/version.js';

describe('MCP Server — server metadata', () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createEmddMcpServer();
    await server.connect(serverTransport);
    client = new Client({ name: 'test', version: '1.0' });
    await client.connect(clientTransport);
    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    await cleanup();
  });

  it('reports server name and version', () => {
    const info = client.getServerVersion();
    expect(info?.name).toBe('emdd');
    expect(info?.version).toBe(VERSION);
  });

  it('lists 20 tools', async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(20);
    const names = result.tools.map(t => t.name).sort();
    expect(names).toEqual([
      'analyze-refutation',
      'backlog',
      'branch-groups',
      'check',
      'confidence-propagate',
      'create-edge',
      'create-node',
      'delete-edge',
      'graph_gaps',
      'graph_neighbors',
      'health',
      'index-graph',
      'kill-check',
      'lint',
      'list-nodes',
      'mark-done',
      'promote',
      'read-node',
      'status-transitions',
      'update-node',
    ]);
  });

  it('lists 4 prompts', async () => {
    const result = await client.listPrompts();
    expect(result.prompts).toHaveLength(4);
    const names = result.prompts.map(p => p.name).sort();
    expect(names).toEqual([
      'consolidation',
      'context-loading',
      'episode-creation',
      'health-review',
    ]);
  });
});

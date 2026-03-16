import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEmddMcpServer } from '../../../src/mcp-server/index.js';

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
    expect(info?.version).toBe('0.1.0');
  });

  it('lists 7 tools', async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(7);
    const names = result.tools.map(t => t.name).sort();
    expect(names).toEqual([
      'check',
      'create-edge',
      'create-node',
      'health',
      'list-nodes',
      'promote',
      'read-node',
    ]);
  });

  it.todo('prompts (Wave 4 scope)');
});

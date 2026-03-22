import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CommandRegistry } from '../../../src/registry/registry.js';
import { McpAdapter } from '../../../src/registry/mcp-adapter.js';
import type { CommandDef } from '../../../src/registry/types.js';

vi.mock('../../../src/graph/loader.js', () => ({
  resolveGraphDir: (p?: string) => p ?? '/mock/graph',
}));

function makeCommand(overrides: Partial<CommandDef> & { name: string }): CommandDef {
  return {
    description: 'Test command',
    category: 'read',
    schema: z.object({}),
    execute: async () => ({ result: 'ok' }),
    format: () => '',
    ...overrides,
  };
}

async function setupMcp(registry: CommandRegistry) {
  const server = new McpServer({ name: 'test', version: '1.0' });
  const adapter = new McpAdapter(registry);
  adapter.registerTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0' });
  await client.connect(clientTransport);

  return {
    client,
    cleanup: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe('McpAdapter', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('tool registration', () => {
    it('registers command as MCP tool', async () => {
      registry.register(makeCommand({ name: 'test-tool' }));
      const { client, cleanup } = await setupMcp(registry);

      const tools = await client.listTools();
      expect(tools.tools.some(t => t.name === 'test-tool')).toBe(true);

      await cleanup();
    });

    it('skips commands with mcp: false', async () => {
      registry.register(makeCommand({ name: 'cli-only', mcp: false }));
      registry.register(makeCommand({ name: 'visible-tool' }));
      const { client, cleanup } = await setupMcp(registry);

      const tools = await client.listTools();
      expect(tools.tools.some(t => t.name === 'cli-only')).toBe(false);
      expect(tools.tools.some(t => t.name === 'visible-tool')).toBe(true);

      await cleanup();
    });

    it('uses toolName override from McpOptions', async () => {
      registry.register(makeCommand({
        name: 'list-nodes',
        mcp: { toolName: 'custom-list' },
      }));
      const { client, cleanup } = await setupMcp(registry);

      const tools = await client.listTools();
      expect(tools.tools.some(t => t.name === 'custom-list')).toBe(true);
      expect(tools.tools.some(t => t.name === 'list-nodes')).toBe(false);

      await cleanup();
    });

    it('adds optional graphDir parameter to tool schema', async () => {
      registry.register(makeCommand({ name: 'test-tool' }));
      const { client, cleanup } = await setupMcp(registry);

      const tools = await client.listTools();
      const tool = tools.tools.find(t => t.name === 'test-tool');
      expect(tool).toBeDefined();
      // graphDir should be in the input schema
      const schema = tool!.inputSchema as { properties?: Record<string, unknown> };
      expect(schema.properties).toHaveProperty('graphDir');

      await cleanup();
    });

    it('does not overwrite schema-defined lang field', async () => {
      registry.register(makeCommand({
        name: 'with-lang',
        schema: z.object({ lang: z.string().optional().describe('Custom lang field') }),
      }));
      const { client, cleanup } = await setupMcp(registry);

      const tools = await client.listTools();
      const tool = tools.tools.find(t => t.name === 'with-lang');
      expect(tool).toBeDefined();
      const schema = tool!.inputSchema as { properties?: Record<string, { description?: string }> };
      expect(schema.properties?.lang?.description).toBe('Custom lang field');

      await cleanup();
    });
  });

  describe('execution and JSON response', () => {
    it('returns JSON result on success', async () => {
      registry.register(makeCommand({
        name: 'test-tool',
        execute: async () => ({ count: 42 }),
      }));
      const { client, cleanup } = await setupMcp(registry);

      const result = await client.callTool({ name: 'test-tool', arguments: { graphDir: '/tmp' } });
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe('text');
      expect(JSON.parse(content[0].text)).toEqual({ count: 42 });

      await cleanup();
    });
  });

  describe('error handling', () => {
    it('wraps errors in MCP error format', async () => {
      registry.register(makeCommand({
        name: 'fail-tool',
        execute: async () => { throw new Error('something broke'); },
      }));
      const { client, cleanup } = await setupMcp(registry);

      const result = await client.callTool({ name: 'fail-tool', arguments: { graphDir: '/tmp' } });
      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain('something broke');

      await cleanup();
    });
  });
});

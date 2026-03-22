import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Command } from 'commander';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CommandRegistry } from '../../../src/registry/registry.js';
import { CliAdapter } from '../../../src/registry/cli-adapter.js';
import { McpAdapter } from '../../../src/registry/mcp-adapter.js';
import { createDefaultRegistry } from '../../../src/registry/all-commands.js';
import type { CommandDef } from '../../../src/registry/types.js';

function makeCommand(overrides: Partial<CommandDef> & { name: string }): CommandDef {
  return {
    description: 'Test command',
    category: 'read',
    schema: z.object({}),
    execute: async () => ({}),
    format: () => '',
    ...overrides,
  };
}

describe('FR-018: CLI/MCP Parity', () => {
  it('registry command count == CLI exposed count == MCP exposed count (synthetic)', async () => {
    const registry = new CommandRegistry();

    // Register commands with various visibility settings
    registry.register(makeCommand({ name: 'both-exposed' }));
    registry.register(makeCommand({ name: 'cli-only', mcp: false }));
    registry.register(makeCommand({ name: 'mcp-only', cli: false }));
    registry.register(makeCommand({ name: 'also-both' }));

    // Expected: "both" commands appear in both, exclusions respected
    const expectedCliCount = 3; // both-exposed, cli-only, also-both
    const expectedMcpCount = 3; // both-exposed, mcp-only, also-both

    // CLI: count commands
    const program = new Command().name('emdd').exitOverride();
    const cliAdapter = new CliAdapter(registry);
    cliAdapter.attachTo(program);
    const cliCommandCount = program.commands.length;

    // MCP: count tools
    const server = new McpServer({ name: 'test', version: '1.0' });
    const mcpAdapter = new McpAdapter(registry);
    mcpAdapter.registerTools(server);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '1.0' });
    await client.connect(clientTransport);
    const tools = await client.listTools();
    const mcpToolCount = tools.tools.length;
    await client.close();
    await server.close();

    // Verify counts
    expect(cliCommandCount).toBe(expectedCliCount);
    expect(mcpToolCount).toBe(expectedMcpCount);

    // The "parity" check: commands visible to both CLI and MCP should match
    const allCommands = registry.getAll();
    const cliVisible = allCommands.filter(c => c.cli !== false);
    const mcpVisible = allCommands.filter(c => c.mcp !== false);
    const bothVisible = allCommands.filter(c => c.cli !== false && c.mcp !== false);

    expect(cliCommandCount).toBe(cliVisible.length);
    expect(mcpToolCount).toBe(mcpVisible.length);

    // Core parity assertion: commands that are meant for both should appear in both
    expect(bothVisible.length).toBe(2); // both-exposed, also-both
  });

  it('real registry: all 21 commands exposed to both CLI and MCP', async () => {
    const registry = createDefaultRegistry();
    const allCommands = registry.getAll();

    // All commands should be visible to both CLI and MCP (no exclusions currently)
    expect(allCommands.length).toBe(21);
    expect(allCommands.every(c => c.cli !== false)).toBe(true);
    expect(allCommands.every(c => c.mcp !== false)).toBe(true);

    // Verify CLI adapter registers all commands
    const program = new Command().name('emdd').exitOverride();
    new CliAdapter(registry).attachTo(program);
    expect(program.commands.length).toBe(21);

    // Verify MCP adapter registers all commands
    const server = new McpServer({ name: 'test', version: '1.0' });
    new McpAdapter(registry).registerTools(server);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '1.0' });
    await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(21);
    await client.close();
    await server.close();
  });
});

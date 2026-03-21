import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEmddMcpServer } from '../../src/mcp-server/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');
const SAMPLE_GRAPH = path.join(FIXTURES, 'sample-graph');

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const result = await client.callTool({ name, arguments: args });
  const textContent = result.content as Array<{ type: string; text: string }>;
  expect(textContent).toHaveLength(1);
  expect(textContent[0].type).toBe('text');
  return JSON.parse(textContent[0].text);
}

async function callToolError(client: Client, name: string, args: Record<string, unknown> = {}): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
  const textContent = result.content as Array<{ type: string; text: string }>;
  return textContent[0].text;
}

describe('Registry pilot — MCP integration', () => {
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

  describe('registry tools are listed', () => {
    it('list-nodes tool is available', async () => {
      const tools = await client.listTools();
      expect(tools.tools.some(t => t.name === 'list-nodes')).toBe(true);
    });

    it('create-node tool is available', async () => {
      const tools = await client.listTools();
      expect(tools.tools.some(t => t.name === 'create-node')).toBe(true);
    });

    it('health tool is available', async () => {
      const tools = await client.listTools();
      expect(tools.tools.some(t => t.name === 'health')).toBe(true);
    });
  });

  describe('list-nodes via registry', () => {
    it('returns all nodes from sample graph', async () => {
      const nodes = await callTool(client, 'list-nodes', { graphDir: SAMPLE_GRAPH }) as unknown[];
      expect(nodes).toHaveLength(14);
    });

    it('filters by type', async () => {
      const nodes = await callTool(client, 'list-nodes', { graphDir: SAMPLE_GRAPH, type: 'hypothesis' }) as unknown[];
      expect(nodes.length).toBeGreaterThan(0);
      for (const n of nodes as Array<{ type: string }>) {
        expect(n.type).toBe('hypothesis');
      }
    });
  });

  describe('create-node via registry', () => {
    it('creates a node', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-reg-'));
      // Initialize graph dir with required subdirectories
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.mkdirSync(path.join(graphDir, 'experiments'), { recursive: true });
      fs.mkdirSync(path.join(graphDir, 'findings'), { recursive: true });
      fs.mkdirSync(path.join(graphDir, 'questions'), { recursive: true });
      fs.mkdirSync(path.join(graphDir, 'decisions'), { recursive: true });
      fs.mkdirSync(path.join(graphDir, 'episodes'), { recursive: true });
      fs.mkdirSync(path.join(graphDir, 'knowledge'), { recursive: true });

      const result = await callTool(client, 'create-node', {
        graphDir,
        type: 'hypothesis',
        slug: 'test-hyp',
      }) as { id: string; type: string; path: string };

      expect(result.id).toMatch(/^hyp-\d+/);
      expect(result.type).toBe('hypothesis');
      expect(fs.existsSync(result.path)).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('rejects invalid node type', async () => {
      const errMsg = await callToolError(client, 'create-node', {
        graphDir: SAMPLE_GRAPH,
        type: 'invalid_type',
        slug: 'test',
      });
      expect(errMsg).toContain('invalid_type');
    });
  });

  describe('health via registry', () => {
    it('returns health report', async () => {
      const report = await callTool(client, 'health', { graphDir: SAMPLE_GRAPH }) as { totalNodes: number };
      expect(report.totalNodes).toBe(14);
    });
  });

  describe('MCP tool registration completeness', () => {
    it('all expected tools are registered', async () => {
      const tools = await client.listTools();
      const names = tools.tools.map(t => t.name);

      expect(names).toContain('list-nodes');
      expect(names).toContain('create-node');
      expect(names).toContain('health');
      expect(names).toContain('read-node');
      expect(names).toContain('create-edge');
      expect(names).toContain('check');
    });

    it('no duplicate tool names', async () => {
      const tools = await client.listTools();
      const names = tools.tools.map(t => t.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });
  });
});

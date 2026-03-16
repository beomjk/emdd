import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEmddMcpServer } from '../../../src/mcp-server/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../fixtures');
const SAMPLE_GRAPH = path.join(FIXTURES, 'sample-graph');
const EMPTY_GRAPH = path.join(FIXTURES, 'empty-graph');

/** Helper: call a tool and parse JSON text content */
async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const result = await client.callTool({ name, arguments: args });
  const textContent = result.content as Array<{ type: string; text: string }>;
  expect(textContent).toHaveLength(1);
  expect(textContent[0].type).toBe('text');
  return JSON.parse(textContent[0].text);
}

/** Helper: call a tool expecting isError */
async function callToolError(client: Client, name: string, args: Record<string, unknown> = {}): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
  const textContent = result.content as Array<{ type: string; text: string }>;
  return textContent[0].text;
}

describe('MCP Server — tools', () => {
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

  // ── list-nodes ──────────────────────────────────────────────────────

  describe('list-nodes', () => {
    it('returns all nodes from sample graph', async () => {
      const nodes = await callTool(client, 'list-nodes', { graphDir: SAMPLE_GRAPH }) as unknown[];
      expect(nodes).toHaveLength(14);
    });

    it('filters by type', async () => {
      const nodes = await callTool(client, 'list-nodes', {
        graphDir: SAMPLE_GRAPH,
        type: 'finding',
      }) as Array<{ type: string }>;
      expect(nodes.length).toBeGreaterThan(0);
      for (const n of nodes) {
        expect(n.type).toBe('finding');
      }
    });

    it('filters by status', async () => {
      const nodes = await callTool(client, 'list-nodes', {
        graphDir: SAMPLE_GRAPH,
        status: 'OPEN',
      }) as Array<{ status: string }>;
      expect(nodes.length).toBeGreaterThan(0);
      for (const n of nodes) {
        expect(n.status).toBe('OPEN');
      }
    });

    it('returns empty array for empty graph', async () => {
      const nodes = await callTool(client, 'list-nodes', { graphDir: EMPTY_GRAPH }) as unknown[];
      expect(nodes).toEqual([]);
    });
  });

  // ── read-node ───────────────────────────────────────────────────────

  describe('read-node', () => {
    it('returns detail by ID', async () => {
      const detail = await callTool(client, 'read-node', {
        graphDir: SAMPLE_GRAPH,
        nodeId: 'hyp-001',
      }) as { id: string; body: string; title: string };
      expect(detail.id).toBe('hyp-001');
      expect(detail.title).toBeTruthy();
      expect(detail.body).toBeTruthy();
    });

    it('returns error for invalid ID', async () => {
      const errText = await callToolError(client, 'read-node', {
        graphDir: SAMPLE_GRAPH,
        nodeId: 'nonexistent-999',
      });
      expect(errText).toMatch(/not found/i);
    });
  });

  // ── create-node ─────────────────────────────────────────────────────

  describe('create-node', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-mcp-'));
      // Copy sample graph structure
      for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
        fs.mkdirSync(path.join(tmpDir, sub), { recursive: true });
      }
    });

    it('creates a hypothesis node', async () => {
      const result = await callTool(client, 'create-node', {
        graphDir: tmpDir,
        type: 'hypothesis',
        slug: 'test-hyp',
      }) as { id: string; type: string; path: string };
      expect(result.id).toMatch(/^hyp-/);
      expect(result.type).toBe('hypothesis');
      expect(fs.existsSync(result.path)).toBe(true);
    });

    it('rejects invalid type', async () => {
      const errText = await callToolError(client, 'create-node', {
        graphDir: tmpDir,
        type: 'bogus',
        slug: 'bad',
      });
      expect(errText).toMatch(/invalid/i);
    });
  });

  // ── create-edge ─────────────────────────────────────────────────────

  describe('create-edge', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-mcp-edge-'));
      // Copy sample-graph into tmp
      fs.cpSync(SAMPLE_GRAPH, tmpDir, { recursive: true });
    });

    it('adds a SUPPORTS link', async () => {
      const result = await callTool(client, 'create-edge', {
        graphDir: tmpDir,
        source: 'fnd-001',
        target: 'hyp-001',
        relation: 'supports',
      }) as { source: string; target: string; relation: string };
      expect(result.source).toBe('fnd-001');
      expect(result.target).toBe('hyp-001');
      expect(result.relation).toBe('supports');
    });

    it('fails for missing source', async () => {
      const errText = await callToolError(client, 'create-edge', {
        graphDir: tmpDir,
        source: 'nonexistent-999',
        target: 'hyp-001',
        relation: 'supports',
      });
      expect(errText).toMatch(/not found/i);
    });
  });

  // ── health ──────────────────────────────────────────────────────────

  describe('health', () => {
    it('returns structured report', async () => {
      const report = await callTool(client, 'health', { graphDir: SAMPLE_GRAPH }) as {
        totalNodes: number;
        totalEdges: number;
        byType: Record<string, number>;
        gaps: string[];
      };
      expect(report.totalNodes).toBe(14);
      expect(report.byType).toBeDefined();
      expect(typeof report.totalEdges).toBe('number');
      expect(Array.isArray(report.gaps)).toBe(true);
    });
  });

  // ── check ───────────────────────────────────────────────────────────

  describe('check', () => {
    it('returns consolidation trigger status', async () => {
      const result = await callTool(client, 'check', { graphDir: SAMPLE_GRAPH }) as {
        triggers: Array<{ type: string; message: string }>;
      };
      expect(result.triggers).toBeDefined();
      expect(Array.isArray(result.triggers)).toBe(true);
    });
  });

  // ── promote ─────────────────────────────────────────────────────────

  describe('promote', () => {
    it('returns candidate list', async () => {
      const candidates = await callTool(client, 'promote', { graphDir: SAMPLE_GRAPH }) as Array<{
        id: string;
        confidence: number;
        supports: number;
      }>;
      expect(Array.isArray(candidates)).toBe(true);
      // Each candidate should have the expected shape
      for (const c of candidates) {
        expect(c.id).toBeTruthy();
        expect(typeof c.confidence).toBe('number');
        expect(typeof c.supports).toBe('number');
      }
    });
  });
});

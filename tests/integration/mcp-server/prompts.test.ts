import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEmddMcpServer } from '../../../src/mcp-server/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../fixtures');
const SAMPLE_GRAPH = path.join(FIXTURES, 'sample-graph');

describe('MCP Prompts via SDK Client', () => {
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

  // --- context-loading ---

  describe('context-loading', () => {
    it('returns graph summary prompt', async () => {
      const result = await client.getPrompt({
        name: 'context-loading',
        arguments: { path: SAMPLE_GRAPH },
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      const content = result.messages[0].content as { type: string; text: string };
      expect(content.type).toBe('text');
      expect(content.text).toContain('EMDD');
    });

    it('includes node count and types', async () => {
      const result = await client.getPrompt({
        name: 'context-loading',
        arguments: { path: SAMPLE_GRAPH },
      });
      const text = (result.messages[0].content as { type: string; text: string }).text;
      expect(text).toContain('14');
      expect(text).toMatch(/hypothesis/i);
      expect(text).toMatch(/experiment/i);
      expect(text).toMatch(/finding/i);
      expect(text).toMatch(/knowledge/i);
    });

    it('accepts custom path', async () => {
      const result = await client.getPrompt({
        name: 'context-loading',
        arguments: { path: SAMPLE_GRAPH },
      });
      const text = (result.messages[0].content as { type: string; text: string }).text;
      // Should reflect the sample graph data, not fail
      expect(text.length).toBeGreaterThan(100);
    });
  });

  // --- episode-creation ---

  describe('episode-creation', () => {
    it('returns episode template prompt', async () => {
      const result = await client.getPrompt({
        name: 'episode-creation',
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      const content = result.messages[0].content as { type: string; text: string };
      expect(content.type).toBe('text');
      expect(content.text).toMatch(/episode/i);
    });

    it('includes checklist items', async () => {
      const result = await client.getPrompt({
        name: 'episode-creation',
      });
      const text = (result.messages[0].content as { type: string; text: string }).text;
      expect(text).toMatch(/what.*(tried|i tried)/i);
      expect(text).toMatch(/what.*next/i);
      expect(text).toMatch(/frontmatter/i);
    });
  });

  // --- consolidation ---

  describe('consolidation', () => {
    it('returns trigger analysis', async () => {
      const result = await client.getPrompt({
        name: 'consolidation',
        arguments: { path: SAMPLE_GRAPH },
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      const content = result.messages[0].content as { type: string; text: string };
      expect(content.type).toBe('text');
      expect(content.text).toMatch(/consolidation/i);
    });

    it('includes step-by-step guide', async () => {
      const result = await client.getPrompt({
        name: 'consolidation',
        arguments: { path: SAMPLE_GRAPH },
      });
      const text = (result.messages[0].content as { type: string; text: string }).text;
      expect(text).toMatch(/promot/i);
      expect(text).toMatch(/question/i);
      expect(text).toMatch(/hypothesis/i);
    });
  });

  // --- health-review ---

  describe('health-review', () => {
    it('returns health analysis prompt', async () => {
      const result = await client.getPrompt({
        name: 'health-review',
        arguments: { path: SAMPLE_GRAPH },
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      const content = result.messages[0].content as { type: string; text: string };
      expect(content.type).toBe('text');
      expect(content.text).toMatch(/health/i);
    });

    it('includes recommendations', async () => {
      const result = await client.getPrompt({
        name: 'health-review',
        arguments: { path: SAMPLE_GRAPH },
      });
      const text = (result.messages[0].content as { type: string; text: string }).text;
      expect(text).toMatch(/recommend/i);
      expect(text).toMatch(/gap|issue|action/i);
    });
  });
});

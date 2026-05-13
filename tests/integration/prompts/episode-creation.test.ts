// Integration test for the `episode-creation` MCP prompt.
// Verifies contracts/mcp-prompts.md §P-3 (IN_PROGRESS guidance).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEmddMcpServer } from '../../../src/mcp-server/index.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const GRAPH_TYPES = [
  'hypotheses', 'experiments', 'findings', 'knowledge',
  'questions', 'decisions', 'episodes',
];

function makeEmptyGraph(prefix: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `emdd-${prefix}-`));
  const graphDir = path.join(tmp, 'graph');
  fs.mkdirSync(graphDir, { recursive: true });
  for (const t of GRAPH_TYPES) {
    fs.mkdirSync(path.join(graphDir, t), { recursive: true });
  }
  return graphDir;
}

describe('episode-creation prompt — IN_PROGRESS guidance (§P-3)', () => {
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

  it('mentions IN_PROGRESS in frontmatter template', async () => {
    const graphDir = makeEmptyGraph('ec-tmpl');
    const result = await client.getPrompt({ name: 'episode-creation', arguments: { graphDir } });
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('IN_PROGRESS');
  });

  it('contains "When to use IN_PROGRESS" section with --status flag and lifecycle commands', async () => {
    const graphDir = makeEmptyGraph('ec-when');
    const result = await client.getPrompt({ name: 'episode-creation', arguments: { graphDir } });
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('When to use IN_PROGRESS');
    expect(text).toContain('--status IN_PROGRESS');
    expect(text).toContain('episode-checkpoint');
    expect(text).toContain('episode-close');
  });

  it('explicitly notes default creation is COMPLETED', async () => {
    const graphDir = makeEmptyGraph('ec-default');
    const result = await client.getPrompt({ name: 'episode-creation', arguments: { graphDir } });
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toMatch(/COMPLETED episode|status: COMPLETED/);
  });
});

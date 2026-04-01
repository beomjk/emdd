import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from 'vitest';

// Mock operations and templates before importing the module that uses them
vi.mock('../../../src/graph/operations.js', () => ({
  listNodes: vi.fn(),
}));

vi.mock('../../../src/graph/templates.js', () => ({
  nextId: vi.fn(),
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { listNodes } from '../../../src/graph/operations.js';
import { nextId } from '../../../src/graph/templates.js';
import { registerEpisodeCreation } from '../../../src/mcp-server/prompts/episode-creation.js';
import type { Node } from '../../../src/graph/types.js';

function makeNode(overrides: Partial<Node> & Pick<Node, 'id' | 'type' | 'title'>): Node {
  return {
    path: `/graph/${overrides.type}s/${overrides.id}.md`,
    tags: [],
    links: [],
    meta: {
      created: '2026-03-20',
      updated: '2026-03-20',
      ...overrides.meta,
    },
    ...overrides,
  };
}

describe('episode-creation prompt (unit)', () => {
  let client: Client;
  let cleanupFn: () => Promise<void>;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test-episode', version: '1.0.0' });
    registerEpisodeCreation(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: 'test', version: '1.0' });
    await client.connect(clientTransport);

    cleanupFn = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    await cleanupFn();
  });

  function getPromptText(result: Awaited<ReturnType<typeof client.getPrompt>>): string {
    return (result.messages[0].content as { type: string; text: string }).text;
  }

  it('returns next episode ID in output', async () => {
    (nextId as unknown as Mock).mockReturnValue('epi-004');
    (listNodes as Mock).mockResolvedValue([
      makeNode({ id: 'epi-003', type: 'episode', title: 'Previous', status: 'COMPLETED', meta: { created: '2026-03-15', updated: '2026-03-15' } }),
    ]);

    const result = await client.getPrompt({
      name: 'episode-creation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('epi-004');
    expect(text).toContain('Next Episode ID');
  });

  it('lists recently changed nodes since last episode', async () => {
    (nextId as unknown as Mock).mockReturnValue('epi-003');
    (listNodes as Mock).mockResolvedValue([
      makeNode({ id: 'epi-002', type: 'episode', title: 'Last Episode', status: 'COMPLETED', meta: { created: '2026-03-10', updated: '2026-03-10' } }),
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'New Hypothesis', status: 'PROPOSED', meta: { created: '2026-03-12', updated: '2026-03-12' } }),
      makeNode({ id: 'fnd-001', type: 'finding', title: 'Updated Finding', status: 'ACTIVE', meta: { created: '2026-03-01', updated: '2026-03-11' } }),
      makeNode({ id: 'knw-001', type: 'knowledge', title: 'Old Knowledge', status: 'ACTIVE', meta: { created: '2026-02-01', updated: '2026-02-01' } }),
    ]);

    const result = await client.getPrompt({
      name: 'episode-creation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    // Nodes since last episode (2026-03-10) should appear
    expect(text).toContain('hyp-001');
    expect(text).toContain('fnd-001');
    // Old node should not appear
    expect(text).not.toContain('knw-001');
  });

  it('pre-fills frontmatter with calculated ID and today\'s date', async () => {
    (nextId as unknown as Mock).mockReturnValue('epi-002');
    (listNodes as Mock).mockResolvedValue([
      makeNode({ id: 'epi-001', type: 'episode', title: 'First', status: 'COMPLETED', meta: { created: '2026-03-01', updated: '2026-03-01' } }),
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'New Hyp', status: 'PROPOSED', meta: { created: '2026-03-05', updated: '2026-03-05' } }),
    ]);

    const result = await client.getPrompt({
      name: 'episode-creation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('id: epi-002');
    expect(text).toContain('type: episode');
    expect(text).toContain('status: COMPLETED');
    // Should contain today's date
    const today = new Date().toISOString().slice(0, 10);
    expect(text).toContain(`created: ${today}`);
    expect(text).toContain(`updated: ${today}`);
    // Should have produces link for the new node
    expect(text).toContain('target: hyp-001');
    expect(text).toContain('relation: produces');
  });

  it('first episode scenario — shows epi-001, lists all non-episode nodes', async () => {
    (nextId as unknown as Mock).mockReturnValue('epi-001');
    (listNodes as Mock).mockResolvedValue([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Hyp A', status: 'PROPOSED', meta: { created: '2026-03-01', updated: '2026-03-01' } }),
      makeNode({ id: 'que-001', type: 'question', title: 'Question A', status: 'OPEN', meta: { created: '2026-03-02', updated: '2026-03-02' } }),
    ]);

    const result = await client.getPrompt({
      name: 'episode-creation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('epi-001');
    expect(text).toContain('First episode');
    expect(text).toContain('hyp-001');
    expect(text).toContain('que-001');
  });

  it('no changed nodes since last episode — still works', async () => {
    (nextId as unknown as Mock).mockReturnValue('epi-004');
    (listNodes as Mock).mockResolvedValue([
      makeNode({ id: 'epi-003', type: 'episode', title: 'Last', status: 'COMPLETED', meta: { created: '2026-03-28', updated: '2026-03-28' } }),
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Old Hyp', status: 'PROPOSED', meta: { created: '2026-02-01', updated: '2026-02-01' } }),
    ]);

    const result = await client.getPrompt({
      name: 'episode-creation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('epi-004');
    expect(text).toContain('no nodes changed since last episode');
  });

  it('excludes episode-type nodes from recently changed list', async () => {
    (nextId as unknown as Mock).mockReturnValue('epi-004');
    (listNodes as Mock).mockResolvedValue([
      makeNode({ id: 'epi-001', type: 'episode', title: 'Ep 1', status: 'COMPLETED', meta: { created: '2026-03-01', updated: '2026-03-01' } }),
      makeNode({ id: 'epi-002', type: 'episode', title: 'Ep 2', status: 'COMPLETED', meta: { created: '2026-03-10', updated: '2026-03-10' } }),
      makeNode({ id: 'epi-003', type: 'episode', title: 'Ep 3', status: 'ACTIVE', meta: { created: '2026-03-20', updated: '2026-03-20' } }),
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Recent Hyp', status: 'PROPOSED', meta: { created: '2026-03-25', updated: '2026-03-25' } }),
    ]);

    const result = await client.getPrompt({
      name: 'episode-creation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    // The recently changed list should contain hyp-001 but NOT episode nodes
    // Episodes are used for the "last episode" logic, not listed as recent changes
    expect(text).toContain('hyp-001');
    // epi-003 is referenced as the last episode in the "Since last episode" line
    expect(text).toContain('epi-003');
    // But episode nodes should not appear in the recently changed section with [new]/[updated] tags
    expect(text).not.toMatch(/\[(new|updated)\].*epi-001/);
    expect(text).not.toMatch(/\[(new|updated)\].*epi-002/);
    expect(text).not.toMatch(/\[(new|updated)\].*epi-003/);
  });

  it('still contains static guide content', async () => {
    (nextId as unknown as Mock).mockReturnValue('epi-001');
    (listNodes as Mock).mockResolvedValue([]);

    const result = await client.getPrompt({
      name: 'episode-creation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    // Static guide content
    expect(text).toContain('Episode Creation Reference Guide');
    expect(text).toContain('Step-by-Step Checklist');
    expect(text).toContain('Frontmatter');
    expect(text).toContain('Linking Instructions');
    expect(text).toMatch(/what.*tried/i);
    expect(text).toMatch(/what.*next/i);
    expect(text).toContain('produces');
    expect(text).toContain('relates_to');
    expect(text).toContain('context_for');
  });
});

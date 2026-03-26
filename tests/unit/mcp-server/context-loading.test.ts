import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from 'vitest';

// Mock operations before importing the module that uses them
vi.mock('../../../src/graph/operations.js', () => ({
  getHealth: vi.fn(),
  listNodes: vi.fn(),
  checkConsolidation: vi.fn(),
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getHealth, listNodes, checkConsolidation } from '../../../src/graph/operations.js';
import { registerContextLoading } from '../../../src/mcp-server/prompts/context-loading.js';
import type { HealthReport } from '../../../src/graph/types.js';

function makeHealth(overrides: Partial<HealthReport> = {}): HealthReport {
  return {
    totalNodes: 10,
    totalEdges: 15,
    linkDensity: 1.5,
    avgConfidence: 0.7,
    openQuestions: 2,
    byType: {
      hypothesis: 3,
      experiment: 2,
      finding: 3,
      knowledge: 1,
      question: 1,
      episode: 1,
      decision: 0,
    },
    statusDistribution: { hypothesis: { PROPOSED: 3 } },
    gaps: [],
    gapDetails: [],
    deferredItems: [],
    affinityViolations: [],
    ...overrides,
  };
}

function makeEmptyHealth(): HealthReport {
  return makeHealth({
    totalNodes: 0,
    totalEdges: 0,
    linkDensity: 0,
    avgConfidence: null,
    openQuestions: 0,
    byType: {
      hypothesis: 0,
      experiment: 0,
      finding: 0,
      knowledge: 0,
      question: 0,
      episode: 0,
      decision: 0,
    },
    statusDistribution: {},
    gaps: [],
    gapDetails: [],
    deferredItems: [],
    affinityViolations: [],
  });
}

describe('context-loading prompt (unit)', () => {
  let client: Client;
  let cleanupFn: () => Promise<void>;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test-context', version: '1.0.0' });
    registerContextLoading(server);

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

  it('returns session context for non-empty graph', async () => {
    (getHealth as Mock).mockResolvedValue(makeHealth());
    (listNodes as Mock).mockResolvedValue([
      { id: 'hyp-001', title: 'Test Hyp', type: 'hypothesis', status: 'PROPOSED' },
    ]);
    (checkConsolidation as Mock).mockResolvedValue({ triggers: [] });

    const result = await client.getPrompt({
      name: 'context-loading',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('EMDD Graph Context');
    expect(text).toContain('Total nodes: 10');
    expect(text).toContain('Session Start Instructions');
  });

  it('returns first session guide for empty graph', async () => {
    (getHealth as Mock).mockResolvedValue(makeEmptyHealth());

    const result = await client.getPrompt({
      name: 'context-loading',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('First Session Guide');
    expect(text).toContain('knowledge graph is empty');
    expect(text).toContain('create-node');
    expect(text).toContain('Question');
    expect(text).toContain('Hypothesis');
    expect(text).toContain('episode-creation');
  });

  it('does not call listNodes or checkConsolidation for empty graph', async () => {
    (getHealth as Mock).mockResolvedValue(makeEmptyHealth());
    (listNodes as Mock).mockClear();
    (checkConsolidation as Mock).mockClear();

    await client.getPrompt({
      name: 'context-loading',
      arguments: { graphDir: '/any' },
    });

    expect(listNodes).not.toHaveBeenCalled();
    expect(checkConsolidation).not.toHaveBeenCalled();
  });

  it('calls listNodes and checkConsolidation for non-empty graph', async () => {
    (getHealth as Mock).mockResolvedValue(makeHealth());
    (listNodes as Mock).mockResolvedValue([]);
    (checkConsolidation as Mock).mockResolvedValue({ triggers: [] });
    (listNodes as Mock).mockClear();
    (checkConsolidation as Mock).mockClear();

    await client.getPrompt({
      name: 'context-loading',
      arguments: { graphDir: '/any' },
    });

    expect(listNodes).toHaveBeenCalledOnce();
    expect(checkConsolidation).toHaveBeenCalledOnce();
  });
});

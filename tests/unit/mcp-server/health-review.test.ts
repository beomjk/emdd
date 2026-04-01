import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from 'vitest';

// Mock getHealth before importing the module that uses it
vi.mock('../../../src/graph/operations.js', () => ({
  getHealth: vi.fn(),
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getHealth } from '../../../src/graph/operations.js';
import { registerHealthReview } from '../../../src/mcp-server/prompts/health-review.js';
import { CEREMONY_TRIGGERS } from '../../../src/graph/types.js';
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

describe('health-review prompt (unit)', () => {
  let client: Client;
  let cleanupFn: () => Promise<void>;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test-health', version: '1.0.0' });
    registerHealthReview(server);

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

  it('healthy graph — no ACTION items, contains "looks good"', async () => {
    (getHealth as Mock).mockResolvedValue(makeHealth());

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('Graph health looks good');
    // Extract the Recommendations section (between ## Recommendations and ## Next Steps)
    const recsSection = text.split('## Recommendations')[1]?.split('## Next Steps')[0] ?? '';
    expect(recsSection).not.toContain('[ACTION]');
  });

  it('gaps.length > 0 — contains "[ACTION] Address structural gap"', async () => {
    (getHealth as Mock).mockResolvedValue(
      makeHealth({ gaps: ['Hypothesis hyp-001 has no linked experiments'] }),
    );

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('[ACTION] Address structural gap');
  });

  it('linkDensity < 1.0 with totalNodes > 0 — contains "Low link density"', async () => {
    (getHealth as Mock).mockResolvedValue(
      makeHealth({ linkDensity: 0.5 }),
    );

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('Low link density');
  });

  it('openQuestions === 0 with totalNodes > 0 — contains "No open questions"', async () => {
    (getHealth as Mock).mockResolvedValue(
      makeHealth({ openQuestions: 0 }),
    );

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('No open questions');
  });

  it('avgConfidence < 0.5 — contains "Low average confidence"', async () => {
    (getHealth as Mock).mockResolvedValue(
      makeHealth({ avgConfidence: 0.3 }),
    );

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('Low average confidence');
  });

  it('findings >= threshold && knowledge === 0 — contains "Multiple findings but no knowledge"', async () => {
    const threshold = CEREMONY_TRIGGERS.consolidation.unpromoted_findings_threshold;
    (getHealth as Mock).mockResolvedValue(
      makeHealth({
        byType: {
          hypothesis: 3,
          experiment: 2,
          finding: threshold,
          knowledge: 0,
          question: 1,
          episode: 1,
          decision: 0,
        },
      }),
    );

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('Multiple findings but no knowledge');
  });

  it('episodes === 0 with totalNodes > 0 — contains "No episode nodes"', async () => {
    (getHealth as Mock).mockResolvedValue(
      makeHealth({
        byType: {
          hypothesis: 3,
          experiment: 2,
          finding: 3,
          knowledge: 1,
          question: 1,
          episode: 0,
          decision: 0,
        },
      }),
    );

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('No episode nodes');
  });

  it('footer references context-loading when ACTION items exist', async () => {
    (getHealth as Mock).mockResolvedValue(
      makeHealth({ gaps: ['Hypothesis hyp-001 has no linked experiments'] }),
    );

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    const nextStepsSection = text.split('## Next Steps')[1] ?? '';
    expect(nextStepsSection).toContain('context-loading');
  });

  it('footer does not reference context-loading when no ACTION items', async () => {
    (getHealth as Mock).mockResolvedValue(makeHealth());

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    const nextStepsSection = text.split('## Next Steps')[1] ?? '';
    expect(nextStepsSection).not.toContain('context-loading');
  });

  it('footer always references consolidation', async () => {
    (getHealth as Mock).mockResolvedValue(makeHealth());

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    const nextStepsSection = text.split('## Next Steps')[1] ?? '';
    expect(nextStepsSection).toContain('consolidation');
  });

  it('footer always references episode-creation', async () => {
    (getHealth as Mock).mockResolvedValue(makeHealth());

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    const nextStepsSection = text.split('## Next Steps')[1] ?? '';
    expect(nextStepsSection).toContain('episode-creation');
  });

  it('multiple recommendations fire — has multiple [ACTION], no "looks good"', async () => {
    (getHealth as Mock).mockResolvedValue(
      makeHealth({
        linkDensity: 0.3,
        openQuestions: 0,
        avgConfidence: 0.2,
        gaps: ['Gap A', 'Gap B'],
        byType: {
          hypothesis: 3,
          experiment: 2,
          finding: 10,
          knowledge: 0,
          question: 0,
          episode: 0,
          decision: 0,
        },
      }),
    );

    const result = await client.getPrompt({
      name: 'health-review',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    const actionCount = (text.match(/\[ACTION\]/g) || []).length;
    expect(actionCount).toBeGreaterThanOrEqual(2);
    expect(text).not.toContain('looks good');
  });
});

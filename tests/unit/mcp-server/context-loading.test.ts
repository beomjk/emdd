import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from 'vitest';

// Mock operations before importing the module that uses them
vi.mock('../../../src/graph/operations.js', () => ({
  getHealth: vi.fn(),
  listNodes: vi.fn(),
  checkConsolidation: vi.fn(),
  getBacklog: vi.fn(),
  detectTransitions: vi.fn(),
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getHealth, listNodes, checkConsolidation, getBacklog, detectTransitions } from '../../../src/graph/operations.js';
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

function makeEpisodeNode(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Episode ${id}`,
    type: 'episode',
    status: 'COMPLETED',
    created: '2026-03-20',
    updated: '2026-03-20',
    tags: [],
    links: [],
    meta: { trigger: '', outcome: '', duration: '' },
    ...overrides,
  };
}

function makeQuestionNode(id: string, urgency: string, title: string) {
  return {
    id,
    title,
    type: 'question',
    status: 'OPEN',
    created: '2026-03-01',
    updated: '2026-03-01',
    tags: [],
    links: [],
    meta: { urgency },
  };
}

/** Set up default mocks for non-empty graph scenario */
function setupDefaultMocks() {
  (getHealth as Mock).mockResolvedValue(makeHealth());
  (listNodes as Mock).mockResolvedValue([
    { id: 'hyp-001', title: 'Test Hyp', type: 'hypothesis', status: 'PROPOSED', created: '2026-03-01', updated: '2026-03-01', tags: [], links: [], meta: {} },
  ]);
  (checkConsolidation as Mock).mockResolvedValue({ triggers: [], promotionCandidates: [], orphanFindings: [], deferredItems: [] });
  (getBacklog as Mock).mockResolvedValue({ items: [] });
  (detectTransitions as Mock).mockResolvedValue([]);
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
    setupDefaultMocks();

    const result = await client.getPrompt({
      name: 'context-loading',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('EMDD Graph Context');
    expect(text).toContain('Total nodes: 10');
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

  it('calls listNodes, checkConsolidation, getBacklog, and detectTransitions for non-empty graph', async () => {
    setupDefaultMocks();
    (listNodes as Mock).mockClear();
    (checkConsolidation as Mock).mockClear();
    (getBacklog as Mock).mockClear();
    (detectTransitions as Mock).mockClear();

    await client.getPrompt({
      name: 'context-loading',
      arguments: { graphDir: '/any' },
    });

    expect(listNodes).toHaveBeenCalledOnce();
    expect(checkConsolidation).toHaveBeenCalledOnce();
    expect(getBacklog).toHaveBeenCalledOnce();
    expect(detectTransitions).toHaveBeenCalledOnce();
  });

  // ── Episode Arc ─────────────────────────────────────────────────

  describe('Episode Arc', () => {
    it('renders episode arc table when episodes exist', async () => {
      (getHealth as Mock).mockResolvedValue(makeHealth());
      (listNodes as Mock).mockResolvedValue([
        makeEpisodeNode('epi-003', {
          created: '2026-03-20', updated: '2026-03-20',
          meta: { trigger: 'test edge cases', outcome: 'success', duration: '~30m' },
          links: [{ target: 'fnd-001', relation: 'produces' }],
        }),
        makeEpisodeNode('epi-002', {
          created: '2026-03-18', updated: '2026-03-18',
          meta: { trigger: 'initial setup', outcome: 'partial', duration: '~45m' },
          links: [],
        }),
      ]);
      (checkConsolidation as Mock).mockResolvedValue({ triggers: [], promotionCandidates: [], orphanFindings: [], deferredItems: [] });
      (getBacklog as Mock).mockResolvedValue({ items: [] });
      (detectTransitions as Mock).mockResolvedValue([]);

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).toContain('Episode Arc');
      expect(text).toContain('epi-003');
      expect(text).toContain('epi-002');
      expect(text).toContain('success');
      expect(text).toContain('partial');
    });

    it('omits episode arc when no episodes exist', async () => {
      (getHealth as Mock).mockResolvedValue(makeHealth());
      (listNodes as Mock).mockResolvedValue([
        { id: 'hyp-001', title: 'Hyp', type: 'hypothesis', status: 'PROPOSED', created: '2026-03-01', updated: '2026-03-01', tags: [], links: [], meta: {} },
      ]);
      (checkConsolidation as Mock).mockResolvedValue({ triggers: [], promotionCandidates: [], orphanFindings: [], deferredItems: [] });
      (getBacklog as Mock).mockResolvedValue({ items: [] });
      (detectTransitions as Mock).mockResolvedValue([]);

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).not.toContain('Episode Arc');
    });
  });

  // ── Outcome Streak ──────────────────────────────────────────────

  describe('Outcome Streak', () => {
    it('shows warning on consecutive blocked outcomes', async () => {
      (getHealth as Mock).mockResolvedValue(makeHealth());
      (listNodes as Mock).mockResolvedValue([
        makeEpisodeNode('epi-003', { created: '2026-03-20', updated: '2026-03-20', meta: { outcome: 'blocked' } }),
        makeEpisodeNode('epi-002', { created: '2026-03-18', updated: '2026-03-18', meta: { outcome: 'blocked' } }),
        makeEpisodeNode('epi-001', { created: '2026-03-16', updated: '2026-03-16', meta: { outcome: 'success' } }),
      ]);
      (checkConsolidation as Mock).mockResolvedValue({ triggers: [], promotionCandidates: [], orphanFindings: [], deferredItems: [] });
      (getBacklog as Mock).mockResolvedValue({ items: [] });
      (detectTransitions as Mock).mockResolvedValue([]);

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).toMatch(/blocked.*blocked/i);
    });
  });

  // ── Backlog Digest ──────────────────────────────────────────────

  describe('Backlog Digest', () => {
    it('shows pending backlog items', async () => {
      setupDefaultMocks();
      (getBacklog as Mock).mockResolvedValue({
        items: [
          { text: 'Run baseline experiment', episodeId: 'epi-001', marker: 'pending' },
          { text: 'Compare with baseline', episodeId: 'epi-003', marker: 'pending' },
        ],
      });

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).toContain('Backlog');
      expect(text).toContain('Run baseline experiment');
      expect(text).toContain('epi-001');
      expect(text).toContain('Compare with baseline');
    });

    it('omits backlog section when no pending items', async () => {
      setupDefaultMocks();
      (getBacklog as Mock).mockResolvedValue({ items: [] });

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).not.toContain('Backlog');
    });
  });

  // ── Active Frontier ─────────────────────────────────────────────

  describe('Active Frontier', () => {
    it('shows transition recommendations', async () => {
      setupDefaultMocks();
      (detectTransitions as Mock).mockResolvedValue([
        { nodeId: 'hyp-001', currentStatus: 'PROPOSED', recommendedStatus: 'TESTING', reason: 'has_linked met', evidenceIds: ['exp-001'] },
      ]);

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).toContain('Active Frontier');
      expect(text).toContain('hyp-001');
      expect(text).toContain('PROPOSED');
      expect(text).toContain('TESTING');
    });

    it('omits active frontier when no transitions', async () => {
      setupDefaultMocks();
      (detectTransitions as Mock).mockResolvedValue([]);

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).not.toContain('Active Frontier');
    });
  });

  // ── Open Questions ──────────────────────────────────────────────

  describe('Open Questions', () => {
    it('shows open questions sorted by urgency (BLOCKING first)', async () => {
      (getHealth as Mock).mockResolvedValue(makeHealth());
      (listNodes as Mock).mockResolvedValue([
        makeQuestionNode('qst-001', 'MEDIUM', 'How to handle edge cases?'),
        makeQuestionNode('qst-002', 'BLOCKING', 'Can we handle multi-GPU?'),
      ]);
      (checkConsolidation as Mock).mockResolvedValue({ triggers: [], promotionCandidates: [], orphanFindings: [], deferredItems: [] });
      (getBacklog as Mock).mockResolvedValue({ items: [] });
      (detectTransitions as Mock).mockResolvedValue([]);

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).toContain('Open Questions');
      expect(text).toContain('BLOCKING');
      expect(text).toContain('qst-002');
      // BLOCKING should appear before MEDIUM
      const blockingPos = text.indexOf('BLOCKING');
      const mediumPos = text.indexOf('MEDIUM');
      expect(blockingPos).toBeLessThan(mediumPos);
    });

    it('omits open questions when none exist', async () => {
      setupDefaultMocks();
      // Default mock has no question-type nodes

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).not.toContain('Open Questions');
    });
  });

  // ── Episode Directive ───────────────────────────────────────────

  describe('Episode Directive', () => {
    it('references specific episode IDs to read', async () => {
      (getHealth as Mock).mockResolvedValue(makeHealth());
      (listNodes as Mock).mockResolvedValue([
        makeEpisodeNode('epi-003', { created: '2026-03-20', updated: '2026-03-20', meta: { outcome: 'success' } }),
        makeEpisodeNode('epi-002', { created: '2026-03-18', updated: '2026-03-18', meta: { outcome: 'partial' } }),
      ]);
      (checkConsolidation as Mock).mockResolvedValue({ triggers: [], promotionCandidates: [], orphanFindings: [], deferredItems: [] });
      (getBacklog as Mock).mockResolvedValue({ items: [] });
      (detectTransitions as Mock).mockResolvedValue([]);

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).toContain('Episode Directive');
      expect(text).toContain('read-node epi-003');
    });
  });

  // ── Adaptive Instructions ───────────────────────────────────────

  describe('Adaptive Instructions', () => {
    it('mentions consolidation when triggers are active', async () => {
      setupDefaultMocks();
      (checkConsolidation as Mock).mockResolvedValue({
        triggers: [{ type: 'findings', message: '5 findings since last consolidation' }],
        promotionCandidates: [],
        orphanFindings: [],
        deferredItems: [],
      });

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).toMatch(/[Cc]onsolidation/);
    });

    it('mentions blocking questions when present', async () => {
      (getHealth as Mock).mockResolvedValue(makeHealth());
      (listNodes as Mock).mockResolvedValue([
        makeQuestionNode('qst-001', 'BLOCKING', 'Critical question'),
      ]);
      (checkConsolidation as Mock).mockResolvedValue({ triggers: [], promotionCandidates: [], orphanFindings: [], deferredItems: [] });
      (getBacklog as Mock).mockResolvedValue({ items: [] });
      (detectTransitions as Mock).mockResolvedValue([]);

      const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir: '/any' } });
      const text = getPromptText(result);

      expect(text).toMatch(/BLOCKING/);
    });
  });
});

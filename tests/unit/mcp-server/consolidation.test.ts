import { describe, it, expect, beforeAll, beforeEach, afterAll, vi, type Mock } from 'vitest';

// Mock modules before importing anything that uses them
vi.mock('../../../src/graph/operations.js', () => ({
  checkConsolidation: vi.fn(),
  getHealth: vi.fn(),
  listNodes: vi.fn(),
}));

vi.mock('../../../src/graph/config.js', () => ({
  loadConfig: vi.fn(),
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { checkConsolidation, getHealth, listNodes } from '../../../src/graph/operations.js';
import { loadConfig } from '../../../src/graph/config.js';
import { registerConsolidation } from '../../../src/mcp-server/prompts/consolidation.js';
import type { HealthReport, CheckResult, Node } from '../../../src/graph/types.js';

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
    statusDistribution: {},
    gaps: [],
    gapDetails: [],
    deferredItems: [],
    affinityViolations: [],
    ...overrides,
  };
}

function makeCheckResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    triggers: [],
    promotionCandidates: [],
    orphanFindings: [],
    deferredItems: [],
    ...overrides,
  };
}

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'fnd-001',
    type: 'finding',
    title: 'Test Finding',
    path: '/graph/findings/fnd-001.md',
    tags: [],
    links: [],
    meta: {},
    ...overrides,
  };
}

describe('consolidation prompt (unit)', () => {
  let client: Client;
  let cleanupFn: () => Promise<void>;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test-consolidation', version: '1.0.0' });
    registerConsolidation(server);

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getPromptText(result: Awaited<ReturnType<typeof client.getPrompt>>): string {
    return (result.messages[0].content as { type: string; text: string }).text;
  }

  function setupMocks(
    checkResult: CheckResult = makeCheckResult(),
    health: HealthReport = makeHealth(),
    configOverrides: { last_consolidation_date?: string } = {},
    deltaNodes: Node[] = [],
  ) {
    (checkConsolidation as Mock).mockResolvedValue(checkResult);
    (getHealth as Mock).mockResolvedValue(health);
    (loadConfig as Mock).mockReturnValue({
      lang: 'en',
      version: '1.0',
      gaps: {},
      ...configOverrides,
    });
    (listNodes as Mock).mockResolvedValue(deltaNodes);
  }

  // --- Promotion Candidates ---

  it('renders promotion candidates table when present', async () => {
    setupMocks(
      makeCheckResult({
        promotionCandidates: [
          { id: 'fnd-001', confidence: 0.85, supports: 3, reason: 'confidence' },
          { id: 'fnd-002', confidence: 0.90, supports: 5, reason: 'both' },
        ],
      }),
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('### Promotion Candidates');
    expect(text).toContain('| Finding | Confidence | Supports | Reason |');
    expect(text).toContain('| fnd-001 | 0.85 | 3 | confidence |');
    expect(text).toContain('| fnd-002 | 0.90 | 5 | both |');
  });

  it('shows "No findings" message when no promotion candidates', async () => {
    setupMocks(
      makeCheckResult({ promotionCandidates: [] }),
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('### Promotion Candidates');
    expect(text).toContain('No findings currently meet promotion criteria.');
  });

  // --- Orphan Findings ---

  it('renders orphan findings as list when present', async () => {
    setupMocks(
      makeCheckResult({ orphanFindings: ['fnd-004', 'fnd-007'] }),
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('### Orphan Findings (no forward edges)');
    expect(text).toContain('- fnd-004');
    expect(text).toContain('- fnd-007');
  });

  it('omits orphan findings section when empty', async () => {
    setupMocks(
      makeCheckResult({ orphanFindings: [] }),
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).not.toContain('### Orphan Findings');
  });

  // --- Delta View ---

  it('shows delta node count since last consolidation', async () => {
    const deltaNodes = [
      makeNode({ id: 'fnd-010', type: 'finding' }),
      makeNode({ id: 'fnd-011', type: 'finding' }),
      makeNode({ id: 'exp-005', type: 'experiment' }),
      makeNode({ id: 'epi-003', type: 'episode' }),
    ];

    setupMocks(
      makeCheckResult(),
      makeHealth(),
      { last_consolidation_date: '2026-03-15' },
      deltaNodes,
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('## Delta Since Last Consolidation (2026-03-15)');
    expect(text).toContain('4 nodes created/modified');
    expect(text).toContain('2 finding');
    expect(text).toContain('1 experiment');
    expect(text).toContain('1 episode');
  });

  it('handles missing last_consolidation_date', async () => {
    setupMocks(
      makeCheckResult(),
      makeHealth(),
      {}, // no last_consolidation_date
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('## Delta Since Last Consolidation');
    expect(text).toContain('No consolidation anchor found');
    expect(listNodes as Mock).not.toHaveBeenCalled();
  });

  // --- Deferred Items ---

  it('renders deferred items when present', async () => {
    setupMocks(
      makeCheckResult({ deferredItems: ['fnd-002', 'qst-003'] }),
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('### Deferred Items');
    expect(text).toContain('- fnd-002');
    expect(text).toContain('- qst-003');
  });

  it('omits deferred items section when empty', async () => {
    setupMocks(
      makeCheckResult({ deferredItems: [] }),
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).not.toContain('### Deferred Items');
  });

  // --- Existing trigger display preserved ---

  it('preserves existing trigger display', async () => {
    setupMocks(
      makeCheckResult({
        triggers: [
          { type: 'unpromoted_findings', message: '5 unpromoted findings since last consolidation' },
          { type: 'episodes', message: '3 episodes since last consolidation' },
        ],
      }),
    );

    const result = await client.getPrompt({
      name: 'consolidation',
      arguments: { graphDir: '/any' },
    });

    const text = getPromptText(result);
    expect(text).toContain('[TRIGGERED] 5 unpromoted findings since last consolidation');
    expect(text).toContain('[TRIGGERED] 3 episodes since last consolidation');
  });
});

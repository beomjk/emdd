// Integration test for the `consolidation` MCP prompt.
// Verifies contracts/mcp-prompts.md §P-1 (PER_SESSION rhythm, Depth Hint header,
// no "optional" wording, all 6 Steps with "no candidates" fallbacks, Skipped step
// recording protocol).

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

function writeNode(graphDir: string, subdir: string, id: string, frontmatter: Record<string, unknown>, body = ''): void {
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');
  fs.writeFileSync(
    path.join(graphDir, subdir, `${id}.md`),
    `---\n${yaml}\n---\n${body}\n`,
    'utf-8',
  );
}

async function getPrompt(client: Client, graphDir: string): Promise<string> {
  const result = await client.getPrompt({ name: 'consolidation', arguments: { graphDir } });
  expect(result.messages).toHaveLength(1);
  const c = result.messages[0].content as { type: string; text: string };
  expect(c.type).toBe('text');
  return c.text;
}

describe('consolidation prompt — Ceremony Rhythm contract (§P-1)', () => {
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

  it('has no "optional" wording anywhere in the prompt', async () => {
    const graphDir = makeEmptyGraph('cons-empty');
    const text = await getPrompt(client, graphDir);
    expect(text.toLowerCase()).not.toContain('optional');
  });

  it('mentions PER_SESSION rhythm', async () => {
    const graphDir = makeEmptyGraph('cons-rhythm');
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('PER_SESSION');
  });

  it('uses Depth Hint header instead of Current Trigger Status', async () => {
    const graphDir = makeEmptyGraph('cons-depth');
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('Depth Hint');
    expect(text).not.toContain('Current Trigger Status');
  });

  it('on empty graph shows depth: shallow', async () => {
    const graphDir = makeEmptyGraph('cons-shallow');
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('shallow');
  });

  it('shows all 6 Steps with "no candidates" / "no orphans" fallback on empty graph', async () => {
    const graphDir = makeEmptyGraph('cons-steps');
    const text = await getPrompt(client, graphDir);
    for (const heading of [
      '### Step 1:',
      '### Step 2:',
      '### Step 3:',
      '### Step 4:',
      '### Step 5:',
      '### Step 6:',
    ]) {
      expect(text).toContain(heading);
    }
    expect(text.toLowerCase()).toMatch(/no candidates|no orphans/);
  });

  it('fires depth: deep when ≥2 triggers fire (5 unpromoted findings + 3 completed episodes + 0 open questions)', async () => {
    const graphDir = makeEmptyGraph('cons-deep');
    const today = new Date().toISOString().slice(0, 10);
    // 5 unpromoted findings (status DRAFT, no edges)
    for (let i = 1; i <= 5; i++) {
      writeNode(graphDir, 'findings', `fnd-${i}`, {
        id: `fnd-${i}`,
        type: 'finding',
        title: `f${i}`,
        status: 'DRAFT',
        confidence: 0.5,
        created: today,
        updated: today,
      });
    }
    // 3 COMPLETED episodes (post-T029 the count is COMPLETED-only)
    for (let i = 1; i <= 3; i++) {
      writeNode(graphDir, 'episodes', `epi-${i}`, {
        id: `epi-${i}`,
        type: 'episode',
        title: `e${i}`,
        status: 'COMPLETED',
        created: today,
        updated: today,
      });
    }
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('deep');
  });

  it('shows depth: normal when exactly 1 trigger fires', async () => {
    const graphDir = makeEmptyGraph('cons-normal');
    const today = new Date().toISOString().slice(0, 10);
    // Fire all_questions_resolved by creating a RESOLVED question (total > 0, open == 0).
    // Avoid firing other triggers: <5 findings, <3 episodes, no experiments.
    writeNode(graphDir, 'questions', 'qst-1', {
      id: 'qst-1',
      type: 'question',
      title: 'q1',
      status: 'RESOLVED',
      created: today,
      updated: today,
    });
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('normal');
  });

  it('mentions Recording Skipped Steps (FR Edge Case in spec L95)', async () => {
    const graphDir = makeEmptyGraph('cons-skip');
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('Skipped Consolidation Steps');
    expect(text).toContain('Step <N>');
    expect(text).toContain('MUST be recorded');
  });

  it('keeps Delta Since Last Consolidation header as informational reference (FR-024)', async () => {
    const graphDir = makeEmptyGraph('cons-delta');
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('Delta Since Last Consolidation');
  });
});

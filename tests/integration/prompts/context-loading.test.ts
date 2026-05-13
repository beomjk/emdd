// Integration test for the `context-loading` MCP prompt.
// Verifies contracts/mcp-prompts.md §P-2 (Gap Directive section position,
// acknowledgment protocol, IN_PROGRESS resuming, response classification).

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
  const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir } });
  expect(result.messages).toHaveLength(1);
  const c = result.messages[0].content as { type: string; text: string };
  expect(c.type).toBe('text');
  return c.text;
}

function sectionIndex(text: string, heading: string): number {
  const re = new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`, 'm');
  const m = text.match(re);
  return m && typeof m.index === 'number' ? m.index : -1;
}

describe('context-loading prompt — Gap Directive contract (§P-2)', () => {
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

  it('places Gap Directive above Graph Overview', async () => {
    // Build a graph that has at least one orphan finding so gapDetails is non-empty
    const graphDir = makeEmptyGraph('cl-pos');
    const today = new Date().toISOString().slice(0, 10);
    // Single isolated finding → orphan (no outgoing edges)
    writeNode(graphDir, 'findings', 'fnd-orphan', {
      id: 'fnd-orphan',
      type: 'finding',
      title: 'orphan',
      status: 'DRAFT',
      confidence: 0.5,
      created: today,
      updated: today,
    });
    // Add at least one node so the empty-graph first-session guide is skipped
    writeNode(graphDir, 'hypotheses', 'hyp-x', {
      id: 'hyp-x',
      type: 'hypothesis',
      title: 'x',
      status: 'TESTING',
      confidence: 0.5,
      created: today,
      updated: today,
    });
    const text = await getPrompt(client, graphDir);
    const directiveIdx = sectionIndex(text, 'Gap Directive');
    const overviewIdx = sectionIndex(text, 'Graph Overview');
    expect(directiveIdx).toBeGreaterThanOrEqual(0);
    expect(overviewIdx).toBeGreaterThan(directiveIdx);
  });

  it('renders fallback line when no gaps', async () => {
    const graphDir = makeEmptyGraph('cl-nogap');
    const today = new Date().toISOString().slice(0, 10);
    // Single SUPPORTED hypothesis — no orphan findings, no stale knowledge, no
    // multi-cluster check (cluster check requires totalNodes > 1).
    writeNode(graphDir, 'hypotheses', 'hyp-a', {
      id: 'hyp-a',
      type: 'hypothesis',
      title: 'a',
      status: 'SUPPORTED',
      confidence: 0.9,
      created: today,
      updated: today,
    });
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('No structural gaps — divergent exploration recommended');
  });

  it('emits MUST + explicit acknowledgment + Acknowledgment protocol when gaps exist', async () => {
    const graphDir = makeEmptyGraph('cl-gap');
    const today = new Date().toISOString().slice(0, 10);
    writeNode(graphDir, 'findings', 'fnd-orphan', {
      id: 'fnd-orphan',
      type: 'finding',
      title: 'orphan',
      status: 'DRAFT',
      confidence: 0.5,
      created: today,
      updated: today,
    });
    writeNode(graphDir, 'hypotheses', 'hyp-x', {
      id: 'hyp-x',
      type: 'hypothesis',
      title: 'x',
      status: 'TESTING',
      confidence: 0.5,
      created: today,
      updated: today,
    });
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('MUST');
    expect(text).toContain('explicit acknowledgment');
    expect(text).toContain('Acknowledgment protocol');
  });

  it('shows Resuming In-Progress line for IN_PROGRESS episode (FR-017)', async () => {
    const graphDir = makeEmptyGraph('cl-resume');
    const today = new Date().toISOString().slice(0, 10);
    writeNode(graphDir, 'episodes', 'epi-014', {
      id: 'epi-014',
      type: 'episode',
      title: 'Long training run',
      status: 'IN_PROGRESS',
      created: today,
      updated: today,
    });
    // Need at least one non-episode node so we don't hit the empty-graph guide path
    writeNode(graphDir, 'hypotheses', 'hyp-x', {
      id: 'hyp-x',
      type: 'hypothesis',
      title: 'x',
      status: 'TESTING',
      confidence: 0.5,
      created: today,
      updated: today,
    });
    const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir } });
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('## Resuming In-Progress');
    expect(text).toContain('Resuming in-progress episode: epi-014');
    expect(text).toContain('Long training run');
  });

  it('omits Resuming In-Progress section when no IN_PROGRESS episodes', async () => {
    const graphDir = makeEmptyGraph('cl-noresume');
    const today = new Date().toISOString().slice(0, 10);
    writeNode(graphDir, 'hypotheses', 'hyp-x', {
      id: 'hyp-x',
      type: 'hypothesis',
      title: 'x',
      status: 'TESTING',
      confidence: 0.5,
      created: today,
      updated: today,
    });
    const result = await client.getPrompt({ name: 'context-loading', arguments: { graphDir } });
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).not.toContain('## Resuming In-Progress');
  });

  it('includes response-classification table with en/ko sample phrases', async () => {
    const graphDir = makeEmptyGraph('cl-resp');
    const today = new Date().toISOString().slice(0, 10);
    writeNode(graphDir, 'findings', 'fnd-orphan', {
      id: 'fnd-orphan',
      type: 'finding',
      title: 'orphan',
      status: 'DRAFT',
      confidence: 0.5,
      created: today,
      updated: today,
    });
    writeNode(graphDir, 'hypotheses', 'hyp-x', {
      id: 'hyp-x',
      type: 'hypothesis',
      title: 'x',
      status: 'TESTING',
      confidence: 0.5,
      created: today,
      updated: today,
    });
    const text = await getPrompt(client, graphDir);
    expect(text).toContain('Response classification');
    expect(text).toMatch(/proceed|defer|skip/i);
    // Korean
    expect(text).toMatch(/건너뛰|수렴|먼저/);
  });

  it('renders derived backlog priorities from _backlog.meta.yml', async () => {
    const graphDir = makeEmptyGraph('cl-backlog');
    const today = new Date().toISOString().slice(0, 10);
    writeNode(graphDir, 'hypotheses', 'hyp-x', {
      id: 'hyp-x',
      type: 'hypothesis',
      title: 'x',
      status: 'SUPPORTED',
      confidence: 0.9,
      created: today,
      updated: today,
    });
    writeNode(graphDir, 'episodes', 'epi-001', {
      id: 'epi-001',
      type: 'episode',
      title: 'old',
      status: 'COMPLETED',
      created: '2026-05-10',
      updated: '2026-05-10',
    }, '## What\'s Next\n- [ ] [OLD] Older task\n');
    writeNode(graphDir, 'episodes', 'epi-002', {
      id: 'epi-002',
      type: 'episode',
      title: 'late',
      status: 'COMPLETED',
      created: '2026-05-12',
      updated: '2026-05-12',
    }, '## What\'s Next\n- [ ] [LATE] Pinned late task\n');
    fs.writeFileSync(path.join(graphDir, '_backlog.meta.yml'), 'version: 1\nitems:\n  LATE:\n    priority: P0\n    pinned_at: 2026-05-13\n', 'utf-8');

    const text = await getPrompt(client, graphDir);
    expect(text).toContain('[P0] [LATE] Pinned late task');
    expect(text.indexOf('[P0] [LATE]')).toBeLessThan(text.indexOf('[P1] [OLD]'));
  });
});

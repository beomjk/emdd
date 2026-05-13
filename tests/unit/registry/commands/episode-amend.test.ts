import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import matter from 'gray-matter';
import { episodeAmendDef } from '../../../../src/registry/commands/episode-amend.js';

const GRAPH_TYPES = [
  'hypotheses', 'experiments', 'findings', 'knowledge',
  'questions', 'decisions', 'episodes',
];

function makeGraph(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-am-'));
  const graphDir = path.join(tmp, 'graph');
  fs.mkdirSync(graphDir, { recursive: true });
  for (const t of GRAPH_TYPES) {
    fs.mkdirSync(path.join(graphDir, t), { recursive: true });
  }
  return graphDir;
}

function writeEpisode(graphDir: string, id: string, status: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm = { id, type: 'episode', title: id, status, created: today, updated: today };
  const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  const file = path.join(graphDir, 'episodes', `${id}.md`);
  fs.writeFileSync(file, `---\n${yamlLines}\n---\nbody\n`, 'utf-8');
  return file;
}

describe('episode-amend command', () => {
  let graphDir: string;

  beforeEach(() => {
    graphDir = makeGraph();
  });

  it('happy path: appends justified violation with reason + detected_by', async () => {
    const file = writeEpisode(graphDir, 'epi-001', 'IN_PROGRESS');
    const result = await episodeAmendDef.execute({
      graphDir,
      episodeId: 'epi-001',
      reason: 'Typo correction in checkpoint 1',
    });
    expect(result).toMatchObject({ episodeId: 'epi-001', violationIndex: 0, severity: 'justified' });
    const parsed = matter(fs.readFileSync(file, 'utf-8'));
    const violations = parsed.data.append_only_violations as Array<{ severity: string; reason: string; detected_by: string }>;
    expect(violations.length).toBe(1);
    expect(violations[0].severity).toBe('justified');
    expect(violations[0].reason).toBe('Typo correction in checkpoint 1');
    expect(violations[0].detected_by).toBe('manual_amend');
  });

  it('rejects reason shorter than 5 chars via zod schema', () => {
    const result = episodeAmendDef.schema.safeParse({ episodeId: 'epi-1', reason: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects reason longer than 200 chars via zod schema', () => {
    const result = episodeAmendDef.schema.safeParse({ episodeId: 'epi-1', reason: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('preserves YYYY-MM-DD date format in frontmatter (no ISO timestamp drift)', async () => {
    const file = writeEpisode(graphDir, 'epi-date', 'IN_PROGRESS');
    await episodeAmendDef.execute({ graphDir, episodeId: 'epi-date', reason: 'just because reason' });
    const raw = fs.readFileSync(file, 'utf-8');
    expect(raw).toMatch(/^created: '?\d{4}-\d{2}-\d{2}'?$/m);
    expect(raw).toMatch(/^updated: '?\d{4}-\d{2}-\d{2}'?$/m);
    expect(raw).not.toMatch(/created:.*T\d{2}:\d{2}:\d{2}/);
  });
});

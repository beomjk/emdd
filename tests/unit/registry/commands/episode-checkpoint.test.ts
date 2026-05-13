import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import matter from 'gray-matter';
import { episodeCheckpointDef } from '../../../../src/registry/commands/episode-checkpoint.js';

const GRAPH_TYPES = [
  'hypotheses', 'experiments', 'findings', 'knowledge',
  'questions', 'decisions', 'episodes',
];

function makeGraph(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-cp-'));
  const graphDir = path.join(tmp, 'graph');
  fs.mkdirSync(graphDir, { recursive: true });
  for (const t of GRAPH_TYPES) {
    fs.mkdirSync(path.join(graphDir, t), { recursive: true });
  }
  return graphDir;
}

function writeEpisode(graphDir: string, id: string, status: string, body = '', extra: Record<string, unknown> = {}): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm: Record<string, unknown> = {
    id,
    type: 'episode',
    title: id,
    status,
    created: today,
    updated: today,
    ...extra,
  };
  const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
  const file = path.join(graphDir, 'episodes', `${id}.md`);
  fs.writeFileSync(file, `---\n${yamlLines}\n---\n${body}\n`, 'utf-8');
  return file;
}

async function call(graphDir: string, args: { episodeId: string; note: string }): Promise<unknown> {
  return episodeCheckpointDef.execute({ graphDir, ...args });
}

describe('episode-checkpoint command', () => {
  let graphDir: string;

  beforeEach(() => {
    graphDir = makeGraph();
  });

  it('happy path: appends checkpoint to IN_PROGRESS episode', async () => {
    const file = writeEpisode(graphDir, 'epi-001', 'IN_PROGRESS');
    const result = await call(graphDir, { episodeId: 'epi-001', note: 'Initial setup' });
    expect(result).toMatchObject({ episodeId: 'epi-001', status: 'IN_PROGRESS' });
    const raw = fs.readFileSync(file, 'utf-8');
    expect(raw).toContain('## Checkpoints');
    expect(raw).toContain('Initial setup');
    const parsed = matter(raw);
    expect(Array.isArray(parsed.data.checkpoints)).toBe(true);
    expect((parsed.data.checkpoints as unknown[]).length).toBe(1);
  });

  it('errors on episode not found', async () => {
    await expect(call(graphDir, { episodeId: 'epi-999', note: 'x' })).rejects.toThrow(/epi-999/);
  });

  it('errors when status is COMPLETED', async () => {
    writeEpisode(graphDir, 'epi-c', 'COMPLETED');
    await expect(call(graphDir, { episodeId: 'epi-c', note: 'x' })).rejects.toThrow(/COMPLETED/);
  });

  it('errors when status is ACTIVE (legacy)', async () => {
    writeEpisode(graphDir, 'epi-a', 'ACTIVE');
    await expect(call(graphDir, { episodeId: 'epi-a', note: 'x' })).rejects.toThrow(/IN_PROGRESS/);
  });

  it('rejects notes exceeding 500 chars via zod schema', () => {
    const long = 'x'.repeat(501);
    const result = episodeCheckpointDef.schema.safeParse({ episodeId: 'epi-001', note: long });
    expect(result.success).toBe(false);
  });

  it('detects append-only drift on second checkpoint when body was altered', async () => {
    const file = writeEpisode(graphDir, 'epi-d', 'IN_PROGRESS');
    await call(graphDir, { episodeId: 'epi-d', note: 'first' });
    // Simulate manual edit: replace the only checkpoint line with mangled text
    const altered = fs.readFileSync(file, 'utf-8')
      .replace(/- \d{4}-\d{2}-\d{2}T[^\n]+/, '- 1999-01-01T00:00:00.000Z — tampered');
    fs.writeFileSync(file, altered, 'utf-8');
    const result = await call(graphDir, { episodeId: 'epi-d', note: 'second' }) as { warnings: string[] };
    expect(result.warnings.length).toBeGreaterThan(0);
    const parsed = matter(fs.readFileSync(file, 'utf-8'));
    const violations = parsed.data.append_only_violations as Array<{ severity: string; detected_by: string }>;
    expect(violations.some(v => v.severity === 'soft' && v.detected_by === 'checkpoint_diff')).toBe(true);
  });

  it('does not report drift for two legitimate consecutive checkpoints', async () => {
    const file = writeEpisode(graphDir, 'epi-clean', 'IN_PROGRESS');
    await call(graphDir, { episodeId: 'epi-clean', note: 'first' });
    const result = await call(graphDir, { episodeId: 'epi-clean', note: 'second' }) as { warnings: string[] };
    expect(result.warnings).toEqual([]);
    const parsed = matter(fs.readFileSync(file, 'utf-8'));
    expect(parsed.data.append_only_violations).toBeUndefined();
  });

  it('preserves existing checkpoint section formatting while appending', async () => {
    const body = '## Checkpoints\n- 2026-05-01T00:00:00.000Z — first\n\n## Notes\nkeep me\n';
    const file = writeEpisode(graphDir, 'epi-format', 'IN_PROGRESS', body, {
      checkpoints: [{ timestamp: '2026-05-01T00:00:00.000Z', note: 'first' }],
    });
    await call(graphDir, { episodeId: 'epi-format', note: 'second' });
    const raw = fs.readFileSync(file, 'utf-8');
    expect(raw).toMatch(/first\n\n- \d{4}-\d{2}-\d{2}T[^\n]+ — second\n## Notes/);
    expect(raw).toContain('keep me');
  });

  it('records ISO8601 timestamp shape', async () => {
    writeEpisode(graphDir, 'epi-t', 'IN_PROGRESS');
    const result = await call(graphDir, { episodeId: 'epi-t', note: 'x' }) as { checkpointTimestamp: string };
    expect(result.checkpointTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('preserves YYYY-MM-DD date format in frontmatter (no ISO timestamp drift)', async () => {
    const file = writeEpisode(graphDir, 'epi-date', 'IN_PROGRESS');
    await call(graphDir, { episodeId: 'epi-date', note: 'x' });
    const raw = fs.readFileSync(file, 'utf-8');
    expect(raw).toMatch(/^created: '?\d{4}-\d{2}-\d{2}'?$/m);
    expect(raw).toMatch(/^updated: '?\d{4}-\d{2}-\d{2}'?$/m);
    expect(raw).not.toMatch(/created:.*T\d{2}:\d{2}:\d{2}/);
  });

  it('detects drift when a fabricated checkpoint line is appended after the last legit entry', async () => {
    const file = writeEpisode(graphDir, 'epi-append', 'IN_PROGRESS');
    await call(graphDir, { episodeId: 'epi-append', note: 'real' });
    // Tamper: append an extra line AFTER the legitimate checkpoint
    const raw = fs.readFileSync(file, 'utf-8');
    const withExtra = raw.replace(/(- \d{4}-\d{2}-\d{2}T[^\n]+\n)/, '$1- 1999-01-01T00:00:00.000Z — fabricated\n');
    fs.writeFileSync(file, withExtra, 'utf-8');
    const result = await call(graphDir, { episodeId: 'epi-append', note: 'next' }) as { warnings: string[] };
    expect(result.warnings.length).toBeGreaterThan(0);
    const parsed = matter(fs.readFileSync(file, 'utf-8'));
    const violations = parsed.data.append_only_violations as Array<{ severity: string; detected_by: string }>;
    expect(violations.some(v => v.severity === 'soft' && v.detected_by === 'checkpoint_diff')).toBe(true);
  });
});

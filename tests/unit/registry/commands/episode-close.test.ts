import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import matter from 'gray-matter';
import { episodeCloseDef } from '../../../../src/registry/commands/episode-close.js';

const GRAPH_TYPES = [
  'hypotheses', 'experiments', 'findings', 'knowledge',
  'questions', 'decisions', 'episodes',
];

function makeGraph(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-cl-'));
  const graphDir = path.join(tmp, 'graph');
  fs.mkdirSync(graphDir, { recursive: true });
  for (const t of GRAPH_TYPES) {
    fs.mkdirSync(path.join(graphDir, t), { recursive: true });
  }
  return graphDir;
}

function writeEpisode(graphDir: string, id: string, status: string, body = ''): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm = { id, type: 'episode', title: id, status, created: today, updated: today };
  const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  const file = path.join(graphDir, 'episodes', `${id}.md`);
  fs.writeFileSync(file, `---\n${yamlLines}\n---\n${body}\n`, 'utf-8');
  return file;
}

describe('episode-close command', () => {
  let graphDir: string;

  beforeEach(() => {
    graphDir = makeGraph();
  });

  it('happy path: IN_PROGRESS → COMPLETED', async () => {
    const file = writeEpisode(graphDir, 'epi-001', 'IN_PROGRESS', '## Checkpoints\n- 2026-05-13T09:00:00Z — start\n');
    const result = await episodeCloseDef.execute({ graphDir, episodeId: 'epi-001' });
    expect(result).toMatchObject({ episodeId: 'epi-001', fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED' });
    const parsed = matter(fs.readFileSync(file, 'utf-8'));
    expect(parsed.data.status).toBe('COMPLETED');
    // body checkpoints preserved
    expect(parsed.content).toContain('## Checkpoints');
    expect(parsed.content).toContain('start');
  });

  it('errors when already COMPLETED', async () => {
    writeEpisode(graphDir, 'epi-c', 'COMPLETED');
    await expect(episodeCloseDef.execute({ graphDir, episodeId: 'epi-c' })).rejects.toThrow(/already COMPLETED/);
  });

  it('errors on episode not found', async () => {
    await expect(episodeCloseDef.execute({ graphDir, episodeId: 'epi-zzz' })).rejects.toThrow(/epi-zzz/);
  });
});

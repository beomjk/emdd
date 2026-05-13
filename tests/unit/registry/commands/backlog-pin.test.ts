import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import { backlogDef } from '../../../../src/registry/commands/backlog.js';

const GRAPH_TYPES = [
  'hypotheses', 'experiments', 'findings', 'knowledge',
  'questions', 'decisions', 'episodes',
];

function makeGraph(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-bp-'));
  const graphDir = path.join(tmp, 'graph');
  fs.mkdirSync(graphDir, { recursive: true });
  for (const t of GRAPH_TYPES) {
    fs.mkdirSync(path.join(graphDir, t), { recursive: true });
  }
  return graphDir;
}

function writeEpisode(graphDir: string, id: string, date: string, body: string): void {
  const fm = `---\nid: ${id}\ntype: episode\ntitle: ${id}\nstatus: COMPLETED\ncreated: ${date}\nupdated: ${date}\n---\n`;
  fs.writeFileSync(path.join(graphDir, 'episodes', `${id}.md`), fm + body, 'utf-8');
}

describe('backlog --pin command', () => {
  let graphDir: string;
  beforeEach(() => { graphDir = makeGraph(); });

  it('happy path: --pin <slug> --priority P0 updates _backlog.meta.yml and regenerates _backlog.md', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [API_RETRY] Add retry logic\n');
    const result = await backlogDef.execute({ graphDir, pin: 'API_RETRY', priority: 'P0' });
    expect(result.mode).toBe('pin');
    expect(result.pinnedItem).toBe('API_RETRY');
    expect(result.priority).toBe('P0');

    const metaPath = path.join(graphDir, '_backlog.meta.yml');
    expect(fs.existsSync(metaPath)).toBe(true);
    const meta = yaml.load(fs.readFileSync(metaPath, 'utf-8')) as { items: Record<string, { priority: string; pinned_by: string; pinned_at: string }> };
    expect(meta.items.API_RETRY.priority).toBe('P0');
    expect(meta.items.API_RETRY.pinned_by).toMatch(/^human:/);
    expect(meta.items.API_RETRY.pinned_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const md = fs.readFileSync(path.join(graphDir, '_backlog.md'), 'utf-8');
    expect(md).toContain('## P0');
    expect(md).toContain('API_RETRY');
  });

  it('errors when --pin without --priority', async () => {
    await expect(backlogDef.execute({ graphDir, pin: 'X' })).rejects.toThrow(/--priority is required/);
  });

  it('warns when pinning a slug not present in current backlog (pre-pin)', async () => {
    const result = await backlogDef.execute({ graphDir, pin: 'FUTURE_ITEM', priority: 'P0' });
    expect(result.mode).toBe('pin');
    expect(result.warning).toContain('not in current backlog');
    // Meta entry still persisted
    const metaPath = path.join(graphDir, '_backlog.meta.yml');
    const meta = yaml.load(fs.readFileSync(metaPath, 'utf-8')) as { items: Record<string, unknown> };
    expect(meta.items.FUTURE_ITEM).toBeDefined();
  });
});

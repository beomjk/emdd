import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { backlogRegenerateDef } from '../../../../src/registry/commands/backlog-regenerate.js';

const GRAPH_TYPES = [
  'hypotheses', 'experiments', 'findings', 'knowledge',
  'questions', 'decisions', 'episodes',
];

function makeGraph(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-bkr-'));
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

describe('backlog-regenerate command', () => {
  let graphDir: string;
  beforeEach(() => { graphDir = makeGraph(); });

  it('happy path: writes _backlog.md and reports counts', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [API_RETRY] Add retry logic\n');
    const result = await backlogRegenerateDef.execute({ graphDir });
    expect(result).toMatchObject({ totalItems: 1, written: true });
    expect(result.byPriority).toMatchObject({ P0: 0, P1: 1, P2: 0 });
    expect(fs.existsSync(path.join(graphDir, '_backlog.md'))).toBe(true);
  });

  it('idempotency: two consecutive calls produce byte-identical output', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [A] first\n- [ ] [B] second\n');
    writeEpisode(graphDir, 'epi-2', '2026-05-11', '## Next\n- [ ] [C] third\n');
    await backlogRegenerateDef.execute({ graphDir });
    const a = fs.readFileSync(path.join(graphDir, '_backlog.md'), 'utf-8');
    await backlogRegenerateDef.execute({ graphDir });
    const b = fs.readFileSync(path.join(graphDir, '_backlog.md'), 'utf-8');
    expect(createHash('sha256').update(a).digest('hex')).toBe(createHash('sha256').update(b).digest('hex'));
  });

  it('writes "No pending items." on empty graph', async () => {
    const result = await backlogRegenerateDef.execute({ graphDir });
    expect(result.totalItems).toBe(0);
    expect(fs.readFileSync(path.join(graphDir, '_backlog.md'), 'utf-8')).toContain('No pending items.');
  });
});

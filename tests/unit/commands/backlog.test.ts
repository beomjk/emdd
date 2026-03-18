import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { backlogCommand } from '../../../src/commands/backlog.js';

describe('backlogCommand', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-backlog-'));
    graphDir = join(tmpDir, 'graph');
    mkdirSync(join(graphDir, 'episodes'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeEpisode(filename: string, fm: Record<string, unknown>, body: string) {
    writeFileSync(join(graphDir, 'episodes', filename), matter.stringify(body, fm));
  }

  it('returns all unchecked items without filter', async () => {
    writeEpisode('epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'E1', status: 'ACTIVE',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [ ] Task A\n- [x] Task B\n- [ ] Task C\n');

    const result = await backlogCommand(graphDir);
    expect(result.items.length).toBe(2);
    expect(result.items.every(i => i.marker === 'pending')).toBe(true);
  });

  it('--status pending: returns only unchecked items', async () => {
    writeEpisode('epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'E1', status: 'ACTIVE',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [ ] Task A\n- [x] Task B\n');

    const result = await backlogCommand(graphDir, 'pending');
    expect(result.items.length).toBe(1);
    expect(result.items[0].text).toBe('Task A');
  });

  it('--status all: returns both checked and unchecked items', async () => {
    writeEpisode('epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'E1', status: 'ACTIVE',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [ ] Task A\n- [x] Task B\n');

    const result = await backlogCommand(graphDir, 'all');
    expect(result.items.length).toBe(2);
  });

  it('parses [done], [deferred], [superseded] markers', async () => {
    writeEpisode('epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'E1', status: 'ACTIVE',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [ ] Pending\n- [done] Done\n- [deferred] Deferred\n- [superseded] Superseded\n');

    const result = await backlogCommand(graphDir, 'all');
    expect(result.items.length).toBe(4);
    expect(result.items[0]).toEqual({ text: 'Pending', episodeId: 'epi-001', marker: 'pending' });
    expect(result.items[1]).toEqual({ text: 'Done', episodeId: 'epi-001', marker: 'done' });
    expect(result.items[2]).toEqual({ text: 'Deferred', episodeId: 'epi-001', marker: 'deferred' });
    expect(result.items[3]).toEqual({ text: 'Superseded', episodeId: 'epi-001', marker: 'superseded' });
  });

  it('treats [x] as [done] for backward compatibility', async () => {
    writeEpisode('epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'E1', status: 'ACTIVE',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [x] Legacy done\n- [X] Legacy Done Upper\n');

    const result = await backlogCommand(graphDir, 'all');
    expect(result.items.length).toBe(2);
    expect(result.items.every(i => i.marker === 'done')).toBe(true);
  });

  it('--status done: returns only done items', async () => {
    writeEpisode('epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'E1', status: 'ACTIVE',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [ ] Pending\n- [done] Done\n- [deferred] Deferred\n');

    const result = await backlogCommand(graphDir, 'done');
    expect(result.items.length).toBe(1);
    expect(result.items[0].text).toBe('Done');
  });

  it('--status superseded: returns only superseded items', async () => {
    writeEpisode('epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'E1', status: 'ACTIVE',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [ ] Pending\n- [superseded] Old task\n');

    const result = await backlogCommand(graphDir, 'superseded');
    expect(result.items.length).toBe(1);
    expect(result.items[0].text).toBe('Old task');
  });

  it('--status deferred: returns [deferred] marker items from any episode', async () => {
    writeEpisode('epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'E1', status: 'ACTIVE',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [ ] Active Task\n- [deferred] Deferred in Active\n');
    writeEpisode('epi-002-test.md', {
      id: 'epi-002', type: 'episode', title: 'E2', status: 'DEFERRED',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    }, '## Goals\n\n- [ ] Pending in Deferred\n- [deferred] Deferred in Deferred\n');

    const result = await backlogCommand(graphDir, 'deferred');
    expect(result.items.length).toBe(2);
    expect(result.items.every(i => i.marker === 'deferred')).toBe(true);
    expect(result.items[0].text).toBe('Deferred in Active');
    expect(result.items[1].text).toBe('Deferred in Deferred');
  });
});

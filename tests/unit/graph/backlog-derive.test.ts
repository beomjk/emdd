import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import {
  deriveBacklog,
  mergeWithMeta,
  renderBacklogMarkdown,
  regenerateBacklog,
  getBacklog,
  loadBacklogMeta,
  saveBacklogMeta,
  type BacklogMeta,
} from '../../../src/graph/backlog.js';

const GRAPH_TYPES = [
  'hypotheses', 'experiments', 'findings', 'knowledge',
  'questions', 'decisions', 'episodes',
];

function makeGraph(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-bk-'));
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

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

describe('deriveBacklog — extracts pending items from episode bodies', () => {
  let graphDir: string;
  beforeEach(() => { graphDir = makeGraph(); });

  it('1. empty graph → empty backlog (header only when rendered)', async () => {
    const items = await deriveBacklog(graphDir);
    expect(items).toEqual([]);
  });

  it('2. 3 episodes × 1 pending each with explicit slugs (priority ordering verified later)', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [API_RETRY] Add retry logic\n');
    writeEpisode(graphDir, 'epi-2', '2026-05-11', '## Next\n- [ ] [INSTRUMENT] Add request instrumentation\n');
    writeEpisode(graphDir, 'epi-3', '2026-05-12', '## Next\n- [ ] [BENCH] Establish baseline benchmark\n');

    const items = await deriveBacklog(graphDir);
    expect(items.map(i => i.slug).sort()).toEqual(['API_RETRY', 'BENCH', 'INSTRUMENT']);
    const apiRetry = items.find(i => i.slug === 'API_RETRY')!;
    expect(apiRetry.first_seen_id).toBe('epi-1');
    expect(apiRetry.last_seen_id).toBe('epi-1');
    expect(apiRetry.text).toBe('Add retry logic');
  });

  it('3. auto-slugify when slug missing', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] Add retry logic to API calls\n');
    const items = await deriveBacklog(graphDir);
    expect(items).toHaveLength(1);
    expect(items[0].slug).toBe('add-retry-logic-to-api-calls');
  });

  it('3b. collision suffix when same auto slug in two episodes', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] add retry\n');
    writeEpisode(graphDir, 'epi-2', '2026-05-11', '## Next\n- [ ] add retry\n');
    const items = await deriveBacklog(graphDir);
    // Same slug + same text → aggregated into one item (last_seen updated)
    expect(items).toHaveLength(1);
    expect(items[0].slug).toBe('add-retry');
    expect(items[0].first_seen_id).toBe('epi-1');
    expect(items[0].last_seen_id).toBe('epi-2');
  });

  it('3c. collision when same slug but different text → suffix', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [SHARED] First version\n');
    writeEpisode(graphDir, 'epi-2', '2026-05-11', '## Next\n- [ ] [SHARED] Second version\n');
    const items = await deriveBacklog(graphDir);
    expect(items.map(i => i.slug).sort()).toEqual(['SHARED', 'SHARED-2']);
  });

  it('3d. repeated collided item reuses suffixed key so completion clears it', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [SHARED] First version\n');
    writeEpisode(graphDir, 'epi-2', '2026-05-11', '## Next\n- [ ] [SHARED] Second version\n');
    writeEpisode(graphDir, 'epi-3', '2026-05-12', '## Next\n- [done] [SHARED] Second version\n');
    const items = await deriveBacklog(graphDir);
    expect(items.map(i => i.slug)).toEqual(['SHARED']);
  });

  it('3e. legacy backlog reader strips explicit slug from item text', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [API_RETRY] Add retry logic\n');
    const result = await getBacklog(graphDir, 'pending');
    expect(result.items).toEqual([
      { text: 'Add retry logic', episodeId: 'epi-1', marker: 'pending' },
    ]);
  });

  it('4. meta override: pin P0 moves item to top', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [API_RETRY] Add retry logic\n- [ ] [BENCH] Establish benchmark\n');
    const meta: BacklogMeta = { version: 1, items: { API_RETRY: { priority: 'P0', pinned_by: 'human:test', pinned_at: '2026-05-13' } } };
    saveBacklogMeta(graphDir, meta);
    await regenerateBacklog(graphDir);
    const md = fs.readFileSync(path.join(graphDir, '_backlog.md'), 'utf-8');
    // API_RETRY must appear in P0 section, BENCH must appear in P1 section (default)
    expect(md.indexOf('## P0')).toBeGreaterThanOrEqual(0);
    expect(md.indexOf('## P1')).toBeGreaterThanOrEqual(0);
    expect(md.indexOf('API_RETRY')).toBeLessThan(md.indexOf('BENCH'));
  });

  it('5. ghost cleanup: meta entry without pinned_at is removed when slug disappears', async () => {
    // Pre-existing meta with a slug that has no derived item, no pinned_at
    const meta: BacklogMeta = { version: 1, items: { GHOST: { priority: 'P0' } } };
    saveBacklogMeta(graphDir, meta);
    const result = await regenerateBacklog(graphDir);
    expect(result.totalItems).toBe(0);
    const reloaded = loadBacklogMeta(graphDir);
    expect(reloaded.items.GHOST).toBeUndefined();
  });

  it('5b. ghost cleanup preserves entries with pinned_at (future appearance)', async () => {
    const meta: BacklogMeta = { version: 1, items: { FUTURE: { priority: 'P0', pinned_by: 'human:test', pinned_at: '2026-05-13' } } };
    saveBacklogMeta(graphDir, meta);
    await regenerateBacklog(graphDir);
    const reloaded = loadBacklogMeta(graphDir);
    expect(reloaded.items.FUTURE).toBeDefined();
    expect(reloaded.items.FUTURE.priority).toBe('P0');
  });

  it('5c. invalid meta priority falls back to P1 without crashing render', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [API_RETRY] Add retry logic\n');
    fs.writeFileSync(path.join(graphDir, '_backlog.meta.yml'), 'version: 1\nitems:\n  API_RETRY:\n    priority: P9\n', 'utf-8');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await regenerateBacklog(graphDir);
    } finally {
      warn.mockRestore();
    }
    const md = fs.readFileSync(path.join(graphDir, '_backlog.md'), 'utf-8');
    expect(md).toContain('## P1');
    expect(md).toContain('API_RETRY');
  });

  it('5d. malformed episode frontmatter is skipped with a warning', async () => {
    fs.writeFileSync(
      path.join(graphDir, 'episodes', 'epi-bad.md'),
      '---\nid: epi-bad\ntype: episode\nbad: [\n---\n## Next\n- [ ] [BAD] hidden\n',
      'utf-8',
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const items = await deriveBacklog(graphDir);
      expect(items).toEqual([]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipped'));
    } finally {
      warn.mockRestore();
    }
  });

  it('6. determinism: two consecutive regens produce byte-identical output', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [API_RETRY] Add retry logic\n  - Prerequisite reading: hyp-001\n- [ ] [BENCH] Establish benchmark\n');
    await regenerateBacklog(graphDir);
    const a = fs.readFileSync(path.join(graphDir, '_backlog.md'), 'utf-8');
    await regenerateBacklog(graphDir);
    const b = fs.readFileSync(path.join(graphDir, '_backlog.md'), 'utf-8');
    expect(sha256(a)).toBe(sha256(b));
  });

  it('7. completed (- [x]) item disappears next regen', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [ ] [API_RETRY] Add retry logic\n- [x] [DONE] something\n');
    const items = await deriveBacklog(graphDir);
    expect(items.map(i => i.slug)).toEqual(['API_RETRY']);
  });

  it('8. deferred item stays + deferred_count increments', async () => {
    writeEpisode(graphDir, 'epi-1', '2026-05-10', '## Next\n- [deferred] [API_RETRY] Add retry logic\n');
    const items = await deriveBacklog(graphDir);
    expect(items).toHaveLength(1);
    expect(items[0].slug).toBe('API_RETRY');
    expect(items[0].deferred_count).toBe(1);
  });
});

describe('mergeWithMeta', () => {
  it('applies meta priority to derived items', () => {
    const derived = [{
      slug: 'X',
      text: 't',
      source_episode_id: 'epi-1',
      first_seen: '2026-05-01',
      first_seen_id: 'epi-1',
      last_seen: '2026-05-01',
      last_seen_id: 'epi-1',
      deferred_count: 0,
      prerequisite_reading: [],
    }];
    const meta: BacklogMeta = { version: 1, items: { X: { priority: 'P0' } } };
    const { items, cleanedMeta } = mergeWithMeta(derived, meta);
    expect(items[0].priority).toBe('P0');
    expect(cleanedMeta.items.X).toBeDefined();
  });

  it('defaults priority to P1', () => {
    const derived = [{
      slug: 'X',
      text: 't',
      source_episode_id: 'epi-1',
      first_seen: '2026-05-01',
      first_seen_id: 'epi-1',
      last_seen: '2026-05-01',
      last_seen_id: 'epi-1',
      deferred_count: 0,
      prerequisite_reading: [],
    }];
    const { items } = mergeWithMeta(derived, { version: 1, items: {} });
    expect(items[0].priority).toBe('P1');
  });
});

describe('renderBacklogMarkdown', () => {
  it('renders empty backlog with "No pending items."', () => {
    const md = renderBacklogMarkdown([], '2026-05-13');
    expect(md).toContain('No pending items.');
  });

  it('emits P0/P1/P2 sections in order, omitting empty ones', () => {
    const items = [
      {
        slug: 'A', text: 'a', source_episode_id: 'epi-1',
        first_seen: '2026-05-01', first_seen_id: 'epi-1',
        last_seen: '2026-05-01', last_seen_id: 'epi-1',
        deferred_count: 0, prerequisite_reading: [], priority: 'P0' as const,
      },
      {
        slug: 'B', text: 'b', source_episode_id: 'epi-2',
        first_seen: '2026-05-02', first_seen_id: 'epi-2',
        last_seen: '2026-05-02', last_seen_id: 'epi-2',
        deferred_count: 0, prerequisite_reading: [], priority: 'P2' as const,
      },
    ];
    const md = renderBacklogMarkdown(items, '2026-05-13');
    expect(md).toMatch(/## P0[\s\S]*## P2/);
    expect(md).not.toContain('## P1');
  });

  it('includes Prerequisite reading line when non-empty', () => {
    const items = [{
      slug: 'A', text: 'a', source_episode_id: 'epi-1',
      first_seen: '2026-05-01', first_seen_id: 'epi-1',
      last_seen: '2026-05-01', last_seen_id: 'epi-1',
      deferred_count: 0, prerequisite_reading: ['hyp-001', 'fnd-005'], priority: 'P1' as const,
    }];
    const md = renderBacklogMarkdown(items, '2026-05-13');
    expect(md).toContain('Prerequisite reading: hyp-001, fnd-005');
  });
});

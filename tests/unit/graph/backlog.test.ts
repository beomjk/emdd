import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBacklog } from '../../../src/graph/backlog.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const sampleGraphDir = join(__dirname, '../../fixtures/sample-graph');

// Fixture episodes:
//   epi-001: [done] Survey..., [x] Set up..., [ ] run baseline..., [deferred] Analyze...
//   epi-002: [done] Tune..., [x] Test..., [superseded] Document...
//   epi-003: [x] Review..., [ ] Implement..., [ ] Compare...

describe('getBacklog', () => {
  it('returns only pending items by default', async () => {
    const result = await getBacklog(sampleGraphDir);
    expect(result.items.every(i => i.marker === 'pending')).toBe(true);
    expect(result.items.length).toBe(3);
  });

  it('returns all items with status filter "all"', async () => {
    const result = await getBacklog(sampleGraphDir, 'all');
    expect(result.items.length).toBe(10);
  });

  it('returns done items with status filter "done"', async () => {
    const result = await getBacklog(sampleGraphDir, 'done');
    expect(result.items.every(i => i.marker === 'done')).toBe(true);
    expect(result.items.length).toBe(5);
  });

  it('returns deferred items with status filter "deferred"', async () => {
    const result = await getBacklog(sampleGraphDir, 'deferred');
    expect(result.items.every(i => i.marker === 'deferred')).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0].text).toBe('Analyze failure cases');
    expect(result.items[0].episodeId).toBe('epi-001');
  });

  it('returns superseded items with status filter "superseded"', async () => {
    const result = await getBacklog(sampleGraphDir, 'superseded');
    expect(result.items.every(i => i.marker === 'superseded')).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0].text).toBe('Document results');
    expect(result.items[0].episodeId).toBe('epi-002');
  });

  it('attaches correct episodeId to each item', async () => {
    const result = await getBacklog(sampleGraphDir, 'all');
    const epi001Items = result.items.filter(i => i.episodeId === 'epi-001');
    const epi002Items = result.items.filter(i => i.episodeId === 'epi-002');
    const epi003Items = result.items.filter(i => i.episodeId === 'epi-003');
    expect(epi001Items.length).toBe(4);
    expect(epi002Items.length).toBe(3);
    expect(epi003Items.length).toBe(3);
  });

  it('treats [x] and [done] both as done marker', async () => {
    const result = await getBacklog(sampleGraphDir, 'done');
    const texts = result.items.map(i => i.text);
    expect(texts).toContain('Survey existing defect detection literature');
    expect(texts).toContain('Set up baseline experiment');
  });

  it('returns empty items for non-existent graph dir', async () => {
    const result = await getBacklog(join(sampleGraphDir, 'nonexistent'));
    expect(result.items).toEqual([]);
  });
});

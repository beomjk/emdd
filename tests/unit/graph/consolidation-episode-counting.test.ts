// Verifies FR-018a: `episodes_threshold` counts COMPLETED episodes only;
// IN_PROGRESS episodes are excluded until closed.

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkConsolidation } from '../../../src/graph/consolidation.js';
import { closeEpisode } from '../../../src/graph/episode-close.js';

const GRAPH_TYPES = [
  'hypotheses', 'experiments', 'findings', 'knowledge',
  'questions', 'decisions', 'episodes',
];

function makeGraph(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-cnt-'));
  const graphDir = path.join(tmp, 'graph');
  fs.mkdirSync(graphDir, { recursive: true });
  for (const t of GRAPH_TYPES) {
    fs.mkdirSync(path.join(graphDir, t), { recursive: true });
  }
  return graphDir;
}

function writeEpisode(graphDir: string, id: string, status: string, daysAgo: number): void {
  const date = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  const fm = { id, type: 'episode', title: id, status, created: date, updated: date };
  const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  fs.writeFileSync(
    path.join(graphDir, 'episodes', `${id}.md`),
    `---\n${yamlLines}\n---\nbody\n`,
    'utf-8',
  );
}

describe('consolidation episode counting — FR-018a', () => {
  let graphDir: string;

  beforeEach(() => {
    graphDir = makeGraph();
  });

  it('does NOT fire episodes_threshold with 2 COMPLETED + 1 IN_PROGRESS (total=3 raw, completed=2)', async () => {
    writeEpisode(graphDir, 'epi-1', 'COMPLETED', 3);
    writeEpisode(graphDir, 'epi-2', 'COMPLETED', 2);
    writeEpisode(graphDir, 'epi-3', 'IN_PROGRESS', 1);
    const result = await checkConsolidation(graphDir);
    const fired = result.triggers.find(t => t.type === 'episodes');
    expect(fired).toBeUndefined();
  });

  it('fires episodes_threshold after closing the IN_PROGRESS episode (3 COMPLETED total)', async () => {
    writeEpisode(graphDir, 'epi-1', 'COMPLETED', 3);
    writeEpisode(graphDir, 'epi-2', 'COMPLETED', 2);
    writeEpisode(graphDir, 'epi-3', 'IN_PROGRESS', 1);
    await closeEpisode(graphDir, 'epi-3');
    const result = await checkConsolidation(graphDir);
    const fired = result.triggers.find(t => t.type === 'episodes');
    expect(fired).toBeDefined();
    expect(fired!.count).toBeGreaterThanOrEqual(3);
  });
});

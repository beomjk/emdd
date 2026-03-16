import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { branchesCommand } from '../../../src/commands/branches.js';
import { confidenceCommand } from '../../../src/commands/confidence.js';
import { killCheckCommand } from '../../../src/commands/kill-check.js';
import { transitionsCommand } from '../../../src/commands/transitions.js';

function setupProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'emdd-wrap-'));
  const graph = join(dir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graph, sub), { recursive: true });
  }
  return dir;
}

function writeNode(dir: string, subdir: string, filename: string, frontmatter: Record<string, any>, body = '') {
  writeFileSync(join(dir, 'graph', subdir, filename), matter.stringify(body, frontmatter));
}

describe('thin wrapper commands', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = setupProject();
    // Create a minimal hypothesis for commands to process
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hypothesis',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
  });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('branchesCommand returns array', async () => {
    const result = await branchesCommand(join(tmpDir, 'graph'));
    expect(Array.isArray(result)).toBe(true);
  });

  it('confidenceCommand returns array', async () => {
    const result = await confidenceCommand(join(tmpDir, 'graph'));
    expect(Array.isArray(result)).toBe(true);
  });

  it('killCheckCommand returns array', async () => {
    const result = await killCheckCommand(join(tmpDir, 'graph'));
    expect(Array.isArray(result)).toBe(true);
  });

  it('transitionsCommand returns array', async () => {
    const result = await transitionsCommand(join(tmpDir, 'graph'));
    expect(Array.isArray(result)).toBe(true);
  });
});

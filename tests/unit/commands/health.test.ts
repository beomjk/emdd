import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { healthCommand } from '../../../src/commands/health.js';

describe('healthCommand', () => {
  let tmpDir: string;
  let graphDir: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-health-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  it('default output does not include gap details', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'PROPOSED',
      confidence: 0.5, created: '2025-01-01', updated: '2025-01-01', tags: [], links: [],
    });

    await healthCommand(graphDir);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).not.toContain('Gap Details');
  });

  it('--all includes gap details when gaps exist', async () => {
    // Create an old PROPOSED hypothesis to trigger untested gap
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'PROPOSED',
      confidence: 0.5, created: '2025-01-01', updated: '2025-01-01', tags: [], links: [],
    });

    await healthCommand(graphDir, { all: true });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Gap Details');
    expect(output).toContain('untested_hypothesis');
  });
});

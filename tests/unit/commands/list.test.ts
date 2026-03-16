import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { writeFileSync } from 'node:fs';
import { listCommand } from '../../../src/commands/list.js';

function setupProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'emdd-list-'));
  const graph = join(dir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graph, sub), { recursive: true });
  }
  return dir;
}

function writeNode(dir: string, subdir: string, filename: string, frontmatter: Record<string, unknown>) {
  const content = matter.stringify('', frontmatter);
  writeFileSync(join(dir, 'graph', subdir, filename), content);
}

describe('listCommand', () => {
  let tmpDir: string;
  let output: string[];

  beforeEach(() => {
    tmpDir = setupProject();
    output = [];
    // Capture console.log output
    const origLog = console.log;
    console.log = (...args: unknown[]) => { output.push(args.join(' ')); };
    // Restore after each test in afterEach
    return () => { console.log = origLog; };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists all nodes', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test Finding',
      status: 'DRAFT', confidence: 0.6,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await listCommand(tmpDir, {});
    expect(output.length).toBe(2);
    expect(output.some(l => l.includes('hyp-001'))).toBe(true);
    expect(output.some(l => l.includes('fnd-001'))).toBe(true);
  });

  it('filters by type', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Test Finding',
      status: 'DRAFT', confidence: 0.6,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await listCommand(tmpDir, { type: 'hypothesis' });
    expect(output.length).toBe(1);
    expect(output[0]).toContain('hyp-001');
  });

  it('filters by status', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Proposed',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'Testing',
      status: 'TESTING', confidence: 0.6,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await listCommand(tmpDir, { status: 'TESTING' });
    expect(output.length).toBe(1);
    expect(output[0]).toContain('hyp-002');
  });

  it('prints "No nodes found." for empty graph', async () => {
    await listCommand(tmpDir, {});
    expect(output.length).toBe(1);
    expect(output[0]).toBe('No nodes found.');
  });
});

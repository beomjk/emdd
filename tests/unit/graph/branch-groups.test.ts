import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { listBranchGroups } from '../../../src/graph/branch-groups.js';

describe('listBranchGroups', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-bg-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'questions']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  it('listBranchGroups returns groups with candidates', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, branch_group: 'bg-001', branch_role: 'candidate',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    });
    writeNode('hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
      confidence: 0.6, branch_group: 'bg-001', branch_role: 'candidate',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    });

    const groups = await listBranchGroups(graphDir);
    expect(groups.length).toBe(1);
    expect(groups[0].groupId).toBe('bg-001');
    expect(groups[0].candidates.length).toBe(2);
  });

  it('detects convergence: confidence gap >= 0.3', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.8, branch_group: 'bg-001', branch_role: 'candidate',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    });
    writeNode('hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
      confidence: 0.4, branch_group: 'bg-001', branch_role: 'candidate',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    });

    const groups = await listBranchGroups(graphDir);
    expect(groups[0].convergenceReady).toBe(true);
    expect(groups[0].convergenceReason).toContain('confidence gap');
  });

  it('detects convergence: all-but-one REFUTED', async () => {
    // Use close confidence values so gap check doesn't fire first
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, branch_group: 'bg-001', branch_role: 'candidate',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    });
    writeNode('hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'REFUTED',
      confidence: 0.4, branch_group: 'bg-001', branch_role: 'candidate',
      created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
    });

    const groups = await listBranchGroups(graphDir);
    expect(groups[0].convergenceReady).toBe(true);
    expect(groups[0].convergenceReason).toContain('REFUTED');
  });

  it('enforces max 3 active groups constraint', async () => {
    for (let i = 1; i <= 4; i++) {
      const bg = `bg-00${i}`;
      writeNode('hypotheses', `hyp-${String(i*2-1).padStart(3,'0')}-a.md`, {
        id: `hyp-${String(i*2-1).padStart(3,'0')}`, type: 'hypothesis', title: `A${i}`, status: 'TESTING',
        confidence: 0.5, branch_group: bg, branch_role: 'candidate',
        created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
      });
      writeNode('hypotheses', `hyp-${String(i*2).padStart(3,'0')}-b.md`, {
        id: `hyp-${String(i*2).padStart(3,'0')}`, type: 'hypothesis', title: `B${i}`, status: 'TESTING',
        confidence: 0.5, branch_group: bg, branch_role: 'candidate',
        created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
      });
    }

    const groups = await listBranchGroups(graphDir);
    expect(groups.some(g => g.warnings.some(w => w.includes('3 active')))).toBe(true);
  });

  it('enforces max 4 candidates per group', async () => {
    for (let i = 1; i <= 5; i++) {
      writeNode('hypotheses', `hyp-${String(i).padStart(3,'0')}-test.md`, {
        id: `hyp-${String(i).padStart(3,'0')}`, type: 'hypothesis', title: `H${i}`, status: 'TESTING',
        confidence: 0.5, branch_group: 'bg-001', branch_role: 'candidate',
        created: '2026-03-01', updated: '2026-03-01', tags: [], links: [],
      });
    }

    const groups = await listBranchGroups(graphDir);
    expect(groups[0].warnings.some(w => w.includes('4 candidates'))).toBe(true);
  });

  it('warns on group OPEN > 4 weeks', async () => {
    const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, branch_group: 'bg-001', branch_role: 'candidate',
      created: oldDate, updated: oldDate, tags: [], links: [],
    });
    writeNode('hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
      confidence: 0.5, branch_group: 'bg-001', branch_role: 'candidate',
      created: oldDate, updated: oldDate, tags: [], links: [],
    });

    const groups = await listBranchGroups(graphDir);
    expect(groups[0].warnings.some(w => w.includes('4 weeks'))).toBe(true);
  });
});

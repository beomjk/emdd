import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';

// Import the command functions directly
import { checkCommand } from '../../../src/commands/check.js';
import { promoteCommand } from '../../../src/commands/promote.js';
import { updateCommand } from '../../../src/commands/update.js';
import { linkCommand } from '../../../src/commands/link.js';
import { doneCommand } from '../../../src/commands/done.js';

// Helper to create a minimal EMDD project with nodes
function setupProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'emdd-ops-'));
  const graph = join(dir, 'graph');

  // Create directories
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graph, sub), { recursive: true });
  }

  return dir;
}

function writeNode(dir: string, subdir: string, filename: string, frontmatter: Record<string, any>, body: string = '') {
  const content = matter.stringify(body, frontmatter);
  writeFileSync(join(dir, 'graph', subdir, filename), content);
}

describe('checkCommand', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('reports consolidation trigger when 5+ findings exist', async () => {
    // Create 5 findings
    for (let i = 1; i <= 5; i++) {
      writeNode(tmpDir, 'findings', `fnd-00${i}-test.md`, {
        id: `fnd-00${i}`, type: 'finding', title: `Finding ${i}`,
        status: 'VALIDATED', confidence: 0.7,
        created: '2026-01-01', updated: '2026-01-01',
        tags: [], links: [],
      });
    }
    const result = await checkCommand(join(tmpDir, 'graph'));
    expect(result.triggers.length).toBeGreaterThan(0);
    expect(result.triggers.some(t => t.type === 'findings')).toBe(true);
  });

  it('returns empty triggers when no conditions are met', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    const result = await checkCommand(join(tmpDir, 'graph'));
    expect(result.triggers).toEqual([]);
  });
});

describe('promoteCommand', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('identifies finding with confidence >= 0.9 and 2+ supports as candidate', async () => {
    // Create hypothesis
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test Hyp',
      status: 'TESTING', confidence: 0.6,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    // Create experiment
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'Test Exp',
      status: 'COMPLETED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    // Create finding with high confidence (>= 0.9 per spec) and 2 support links
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Promotable Finding',
      status: 'VALIDATED', confidence: 0.95,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [],
      links: [
        { target: 'hyp-001', relation: 'supports' },
        { target: 'exp-001', relation: 'supports' },
      ],
    });
    const result = await promoteCommand(join(tmpDir, 'graph'));
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].id).toBe('fnd-001');
  });

  it('returns empty candidates when none qualify', async () => {
    writeNode(tmpDir, 'findings', 'fnd-001-test.md', {
      id: 'fnd-001', type: 'finding', title: 'Low Confidence',
      status: 'VALIDATED', confidence: 0.3,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    const result = await promoteCommand(join(tmpDir, 'graph'));
    expect(result.candidates).toEqual([]);
  });
});

describe('updateCommand', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('updates frontmatter fields', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Hypothesis\n\nTest content');

    await updateCommand(join(tmpDir, 'graph'), 'hyp-001', { confidence: '0.8' });

    const content = readFileSync(join(tmpDir, 'graph', 'hypotheses', 'hyp-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.confidence).toBe(0.8);
  });

  it('auto-updates the updated date', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await updateCommand(join(tmpDir, 'graph'), 'hyp-001', { confidence: '0.8' });

    const content = readFileSync(join(tmpDir, 'graph', 'hypotheses', 'hyp-001-test.md'), 'utf-8');
    const parsed = matter(content);
    const today = new Date().toISOString().slice(0, 10);
    expect(parsed.data.updated).toBe(today);
  });

  it('throws on nonexistent node', async () => {
    await expect(
      updateCommand(join(tmpDir, 'graph'), 'nonexistent-999', { status: 'TESTING' })
    ).rejects.toThrow();
  });
});

describe('linkCommand', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('adds a link to the source node', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });
    writeNode(tmpDir, 'experiments', 'exp-001-test.md', {
      id: 'exp-001', type: 'experiment', title: 'Test Exp',
      status: 'COMPLETED',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await linkCommand(join(tmpDir, 'graph'), 'exp-001', 'hyp-001', 'supports');

    const content = readFileSync(join(tmpDir, 'graph', 'experiments', 'exp-001-test.md'), 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.links).toContainEqual(
      expect.objectContaining({ target: 'hyp-001', relation: 'supports' })
    );
  });

  it('throws on invalid relation type', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await expect(
      linkCommand(join(tmpDir, 'graph'), 'hyp-001', 'exp-001', 'invalid_relation')
    ).rejects.toThrow();
  });
});

describe('updateCommand edge cases', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('rejects confidence > 1.0', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    });

    await expect(
      updateCommand(join(tmpDir, 'graph'), 'hyp-001', { confidence: '1.5' })
    ).rejects.toThrow();
  });

  it('preserves body content after update', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      status: 'PROPOSED', confidence: 0.5,
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Analysis\n\nImportant findings here.');

    await updateCommand(join(tmpDir, 'graph'), 'hyp-001', { confidence: '0.8' });

    const content = readFileSync(join(tmpDir, 'graph', 'hypotheses', 'hyp-001-test.md'), 'utf-8');
    expect(content).toContain('Important findings here.');
  });
});

describe('doneCommand edge cases', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('throws on multiple matches', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] run experiment\n- [ ] run experiment\n');

    await expect(
      doneCommand(join(tmpDir, 'graph'), 'epi-001', 'run experiment')
    ).rejects.toThrow();
  });
});

describe('doneCommand', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = setupProject(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('marks a checklist item as done with [done] marker', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] run baseline experiment\n- [ ] analyze results\n\n## Notes\n');

    await doneCommand(join(tmpDir, 'graph'), 'epi-001', 'run baseline experiment');

    const content = readFileSync(join(tmpDir, 'graph', 'episodes', 'epi-001-test.md'), 'utf-8');
    expect(content).toContain('- [done] run baseline experiment');
    expect(content).toContain('- [ ] analyze results'); // unchanged
  });

  it('marks item with --marker deferred', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] run experiment\n');

    await doneCommand(join(tmpDir, 'graph'), 'epi-001', 'run experiment', 'deferred');

    const content = readFileSync(join(tmpDir, 'graph', 'episodes', 'epi-001-test.md'), 'utf-8');
    expect(content).toContain('- [deferred] run experiment');
  });

  it('marks item with --marker superseded', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] run experiment\n');

    await doneCommand(join(tmpDir, 'graph'), 'epi-001', 'run experiment', 'superseded');

    const content = readFileSync(join(tmpDir, 'graph', 'episodes', 'epi-001-test.md'), 'utf-8');
    expect(content).toContain('- [superseded] run experiment');
  });

  it('throws on already marked item', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [done] run experiment\n');

    await expect(
      doneCommand(join(tmpDir, 'graph'), 'epi-001', 'run experiment')
    ).rejects.toThrow();
  });

  it('throws on invalid marker value', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] run experiment\n');

    await expect(
      doneCommand(join(tmpDir, 'graph'), 'epi-001', 'run experiment', 'invalid' as any)
    ).rejects.toThrow();
  });

  it('throws when item not found', async () => {
    writeNode(tmpDir, 'episodes', 'epi-001-test.md', {
      id: 'epi-001', type: 'episode', title: 'Test Episode',
      status: 'ACTIVE',
      created: '2026-01-01', updated: '2026-01-01',
      tags: [], links: [],
    }, '## Goals\n\n- [ ] run baseline experiment\n');

    await expect(
      doneCommand(join(tmpDir, 'graph'), 'epi-001', 'nonexistent item')
    ).rejects.toThrow();
  });
});

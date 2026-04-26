import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { getHealth } from '../../../src/graph/health.js';

function setupTmpGraph(): { tmpDir: string; graphDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'emdd-health-'));
  const graphDir = join(tmpDir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graphDir, sub), { recursive: true });
  }
  return { tmpDir, graphDir };
}

function writeNode(graphDir: string, subdir: string, filename: string, fm: Record<string, unknown>) {
  writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

describe('getHealth — aggregate counts', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns empty counts on empty graph', async () => {
    const r = await getHealth(graphDir);
    expect(r.totalNodes).toBe(0);
    expect(r.totalEdges).toBe(0);
    expect(r.avgConfidence).toBeNull();
    expect(r.gapDetails).toEqual([]);
  });

  it('counts nodes by type and computes averages', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.4,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'hypotheses', 'hyp-002-y.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'Y', status: 'TESTING', confidence: 0.8,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    const r = await getHealth(graphDir);
    expect(r.totalNodes).toBe(2);
    expect(r.byType.hypothesis).toBe(2);
    expect(r.avgConfidence).toBeCloseTo(0.6);
  });

  it('counts total edges across all nodes', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });
    const r = await getHealth(graphDir);
    expect(r.totalEdges).toBe(1);
    expect(r.linkDensity).toBe(0.5);
  });
});

describe('getHealth — §6.8 structural gap detection', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('flags untested hypotheses (PROPOSED + old updated date)', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: dateDaysAgo(30), updated: dateDaysAgo(30), tags: [], links: [],
    });
    const r = await getHealth(graphDir);
    expect(r.gapDetails.some(g => g.type === 'untested_hypothesis')).toBe(true);
  });

  it('flags blocking questions (OPEN + urgency=BLOCKING + stale)', async () => {
    writeNode(graphDir, 'questions', 'qst-001-x.md', {
      id: 'qst-001', type: 'question', title: 'Q', status: 'OPEN',
      urgency: 'BLOCKING',
      created: dateDaysAgo(30), updated: dateDaysAgo(30), tags: [], links: [],
    });
    const r = await getHealth(graphDir);
    expect(r.gapDetails.some(g => g.type === 'blocking_question')).toBe(true);
  });

  it('flags orphan findings (no outgoing value-producing edges)', async () => {
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    const r = await getHealth(graphDir);
    expect(r.gapDetails.some(g => g.type === 'orphan_finding')).toBe(true);
  });

  it('does not flag finding that has value-producing edge', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
    });
    const r = await getHealth(graphDir);
    const orphan = r.gapDetails.find(g => g.type === 'orphan_finding');
    expect(orphan?.nodeIds.includes('find-001')).toBeFalsy();
  });

  it('flags stale knowledge when newer knowledge exists in same cluster', async () => {
    writeNode(graphDir, 'knowledge', 'know-001-old.md', {
      id: 'know-001', type: 'knowledge', title: 'Old', status: 'ACTIVE', confidence: 0.9,
      created: dateDaysAgo(200), updated: dateDaysAgo(200), tags: [],
      links: [{ target: 'know-002', relation: 'relates_to' }],
    });
    writeNode(graphDir, 'knowledge', 'know-002-new.md', {
      id: 'know-002', type: 'knowledge', title: 'New', status: 'ACTIVE', confidence: 0.9,
      created: dateDaysAgo(10), updated: dateDaysAgo(10), tags: [], links: [],
    });
    const r = await getHealth(graphDir);
    const stale = r.gapDetails.find(g => g.type === 'stale_knowledge');
    expect(stale).toBeDefined();
    expect(stale!.nodeIds).toContain('know-001');
  });

  it('flags disconnected clusters', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'hypotheses', 'hyp-002-y.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'Y', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    // Two unconnected hypotheses → two clusters
    const r = await getHealth(graphDir);
    expect(r.gapDetails.some(g => g.type === 'disconnected_cluster')).toBe(true);
  });

  it('reports affinity violations when link carries disallowed attribute', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'PROPOSED', confidence: 0.5,
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    writeNode(graphDir, 'findings', 'find-001-f.md', {
      id: 'find-001', type: 'finding', title: 'F', status: 'DRAFT', confidence: 0.7,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      // `spawns` does not accept strength, but we manually inject it
      links: [{ target: 'hyp-001', relation: 'spawns', strength: 0.5 }],
    });
    const r = await getHealth(graphDir);
    expect(r.affinityViolations.length).toBeGreaterThan(0);
  });
});

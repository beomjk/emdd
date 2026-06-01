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

  it('surfaces stale IN_PROGRESS episodes to both gaps and gapDetails', async () => {
    writeNode(graphDir, 'episodes', 'epi-001-stale.md', {
      id: 'epi-001', type: 'episode', title: 'Stale', status: 'IN_PROGRESS',
      created: dateDaysAgo(30), updated: dateDaysAgo(30), tags: [], links: [],
    });
    const r = await getHealth(graphDir);
    expect(r.gaps.some(g => g.includes('stale in-progress episode: epi-001'))).toBe(true);
    const stale = r.gapDetails.find(g => g.type === 'stale_in_progress');
    expect(stale).toBeDefined();
    expect(stale!.nodeIds).toContain('epi-001');
  });

  it('does NOT flag a fresh IN_PROGRESS episode (≤ 7 days)', async () => {
    writeNode(graphDir, 'episodes', 'epi-002-fresh.md', {
      id: 'epi-002', type: 'episode', title: 'Fresh', status: 'IN_PROGRESS',
      created: dateDaysAgo(3), updated: dateDaysAgo(3), tags: [], links: [],
    });
    const r = await getHealth(graphDir);
    expect(r.gapDetails.some(g => g.type === 'stale_in_progress')).toBe(false);
  });

  it('surfaces ≥3 soft append-only violations to both gaps and gapDetails', async () => {
    writeNode(graphDir, 'episodes', 'epi-003-violations.md', {
      id: 'epi-003', type: 'episode', title: 'Violations', status: 'IN_PROGRESS',
      created: dateDaysAgo(1), updated: dateDaysAgo(1), tags: [], links: [],
      append_only_violations: [
        { severity: 'soft', timestamp: 't1', detected_by: 'checkpoint_diff' },
        { severity: 'soft', timestamp: 't2', detected_by: 'checkpoint_diff' },
        { severity: 'soft', timestamp: 't3', detected_by: 'checkpoint_diff' },
      ],
    });
    const r = await getHealth(graphDir);
    expect(r.gaps.some(g => g.includes('3 soft append-only violations'))).toBe(true);
    const soft = r.gapDetails.find(g => g.type === 'soft_violations');
    expect(soft).toBeDefined();
    expect(soft!.nodeIds).toContain('epi-003');
  });

  it('does NOT flag fewer than 3 soft violations', async () => {
    writeNode(graphDir, 'episodes', 'epi-004-under.md', {
      id: 'epi-004', type: 'episode', title: 'Under', status: 'IN_PROGRESS',
      created: dateDaysAgo(1), updated: dateDaysAgo(1), tags: [], links: [],
      append_only_violations: [
        { severity: 'soft', timestamp: 't1', detected_by: 'checkpoint_diff' },
        { severity: 'soft', timestamp: 't2', detected_by: 'checkpoint_diff' },
      ],
    });
    const r = await getHealth(graphDir);
    expect(r.gapDetails.some(g => g.type === 'soft_violations')).toBe(false);
  });
});

// @spec §6.8.1
describe('getHealth — structural_gap integration (011)', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  const TODAY = dateDaysAgo(0);

  /** Write a dense clique (K_n) of nodes into a type subdir, with optional extra cross-links. */
  function writeClique(
    subdir: string,
    nodeIds: string[],
    type: string,
    status: string,
    extraLinks: Record<string, string[]> = {},
  ): void {
    for (const id of nodeIds) {
      const links = nodeIds
        .filter(x => x !== id)
        .map(target => ({ target, relation: 'relates_to' }));
      for (const target of extraLinks[id] ?? []) {
        links.push({ target, relation: 'relates_to' });
      }
      writeNode(graphDir, subdir, `${id}-x.md`, {
        id, type, title: id, status, created: TODAY, updated: TODAY, tags: [], links,
      });
    }
  }

  it('SC-001: flags exactly one structural_gap, clusterA=hyp / clusterB=know, no disconnected_cluster', async () => {
    // two dense K4 clusters joined by one bridge (know-001 — hyp-001)
    writeClique('hypotheses', ['hyp-001', 'hyp-002', 'hyp-003', 'hyp-004'], 'hypothesis', 'TESTING');
    writeClique('knowledge', ['know-001', 'know-002', 'know-003', 'know-004'], 'knowledge', 'ACTIVE', {
      'know-001': ['hyp-001'],
    });
    const r = await getHealth(graphDir);
    const sgs = r.gapDetails.filter(g => g.type === 'structural_gap');
    expect(sgs).toHaveLength(1);
    expect(sgs[0].structuralGap!.clusterA).toEqual(['hyp-001', 'hyp-002', 'hyp-003', 'hyp-004']);
    expect(sgs[0].structuralGap!.clusterB).toEqual(['know-001', 'know-002', 'know-003', 'know-004']);
    expect(sgs[0].structuralGap!.candidates.length).toBeGreaterThanOrEqual(1);
    // mutual exclusion: one bridge ⇒ single connected component ⇒ no disconnected_cluster
    expect(r.gapDetails.some(g => g.type === 'disconnected_cluster')).toBe(false);
    expect(r.structuralGapTruncated).toBeUndefined();
  });

  it('SC-002: two nodes / single cluster → no structural_gap', async () => {
    writeNode(graphDir, 'hypotheses', 'hyp-001-x.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'X', status: 'TESTING',
      created: TODAY, updated: TODAY, tags: [], links: [],
    });
    writeNode(graphDir, 'knowledge', 'know-001-y.md', {
      id: 'know-001', type: 'knowledge', title: 'Y', status: 'ACTIVE',
      created: TODAY, updated: TODAY, tags: [], links: [],
    });
    const r = await getHealth(graphDir);
    expect(r.gapDetails.some(g => g.type === 'structural_gap')).toBe(false);
  });

  it('FR-006: fully separated clusters (0 bridges) → disconnected_cluster only, no structural_gap', async () => {
    writeClique('hypotheses', ['hyp-001', 'hyp-002', 'hyp-003', 'hyp-004'], 'hypothesis', 'TESTING');
    writeClique('knowledge', ['know-001', 'know-002', 'know-003', 'know-004'], 'knowledge', 'ACTIVE');
    const r = await getHealth(graphDir);
    expect(r.gapDetails.some(g => g.type === 'structural_gap')).toBe(false);
    expect(r.gapDetails.some(g => g.type === 'disconnected_cluster')).toBe(true);
  });

  it('FR-009: 6 candidate pairs with max_gaps=5 → 5 reported + structuralGapTruncated===1', async () => {
    // 4 dense K4 clusters, each pair joined by exactly one bridge → C(4,2)=6 pairs.
    const a = ['aaa-001', 'aaa-002', 'aaa-003', 'aaa-004'];
    const b = ['bbb-001', 'bbb-002', 'bbb-003', 'bbb-004'];
    const c = ['ccc-001', 'ccc-002', 'ccc-003', 'ccc-004'];
    const d = ['ddd-001', 'ddd-002', 'ddd-003', 'ddd-004'];
    writeClique('knowledge', a, 'knowledge', 'ACTIVE', { 'aaa-001': ['bbb-001'], 'aaa-002': ['ccc-001'], 'aaa-003': ['ddd-001'] });
    writeClique('knowledge', b, 'knowledge', 'ACTIVE', { 'bbb-002': ['ccc-002'], 'bbb-003': ['ddd-002'] });
    writeClique('knowledge', c, 'knowledge', 'ACTIVE', { 'ccc-003': ['ddd-003'] });
    writeClique('knowledge', d, 'knowledge', 'ACTIVE');
    const r = await getHealth(graphDir);
    const sgs = r.gapDetails.filter(g => g.type === 'structural_gap');
    expect(sgs).toHaveLength(5);
    expect(r.structuralGapTruncated).toBe(1);
  });
});

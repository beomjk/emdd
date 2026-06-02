import { describe, it, expect } from 'vitest';
import {
  detectStructuralGaps,
  buildUndirectedGraph,
  computeBetweenness,
  degreeCentrality,
} from '../../../src/graph/structural-gap.js';
import { DEFAULT_CONFIG, type GapThresholds } from '../../../src/graph/config.js';
import type { Graph, Node } from '../../../src/graph/types.js';

// ── Test graph builders ─────────────────────────────────────────────

/** Build an EMDD Graph from an adjacency spec (id → outgoing link targets). */
function makeGraph(spec: Record<string, string[]>): Graph {
  const nodes = new Map<string, Node>();
  for (const [id, links] of Object.entries(spec)) {
    const node: Node = {
      id,
      type: id.startsWith('hyp') ? 'hypothesis' : 'knowledge',
      title: id,
      path: `graph/${id}.md`,
      tags: [],
      links: links.map((target) => ({ target, relation: 'relates_to' })),
      meta: {},
    };
    nodes.set(id, node);
  }
  return { nodes, errors: [], warnings: [] };
}

/** Complete-graph (K_n) links: every id linked to every other id. */
function cliqueLinks(ids: string[]): Record<string, string[]> {
  const spec: Record<string, string[]> = {};
  for (const id of ids) spec[id] = ids.filter((x) => x !== id);
  return spec;
}

function ids(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`);
}

function thresholds(overrides: Partial<GapThresholds> = {}): GapThresholds {
  return { ...DEFAULT_CONFIG.gaps, ...overrides };
}

/** quickstart "weak bridge between two clusters" fixture:
 *  two dense K4 clusters (hyp-001..004, know-001..004) joined by one bridge. */
function khFixture(): Graph {
  const hyp = ids('hyp', 4);
  const know = ids('know', 4);
  const spec = { ...cliqueLinks(hyp), ...cliqueLinks(know) };
  // single bridge know-001 — hyp-001 (undirected; listed once)
  spec['know-001'] = [...spec['know-001'], 'hyp-001'];
  return makeGraph(spec);
}

// ── betweenness (Brandes) ───────────────────────────────────────────

describe('computeBetweenness — Brandes correctness', () => {
  it('path graph a-b-c-d-e → {a:0, b:3, c:4, d:3, e:0} (center max, endpoints 0)', () => {
    const { g } = buildUndirectedGraph(makeGraph({ a: ['b'], b: ['c'], c: ['d'], d: ['e'], e: [] }));
    const bc = computeBetweenness(g);
    // b=d=3 is a tie — assert only the partial order c>b ∧ c>d, plus exact values.
    expect(bc.get('c')!).toBeGreaterThan(bc.get('b')!);
    expect(bc.get('c')!).toBeGreaterThan(bc.get('d')!);
    expect(bc.get('a')!).toBeCloseTo(0);
    expect(bc.get('b')!).toBeCloseTo(3);
    expect(bc.get('c')!).toBeCloseTo(4);
    expect(bc.get('d')!).toBeCloseTo(3);
    expect(bc.get('e')!).toBeCloseTo(0);
  });

  it('σ>1 fixture (diamond + tail) verifies shortest-path-count accumulation', () => {
    // edges: a-b, a-c, b-d, c-d, d-e. Pairs (a,d),(a,e),(b,c) have 2 shortest paths.
    // Correct betweenness: {a:0.5, b:1, c:1, d:3.5, e:0}.
    // A buggy impl that omits σ[w] += σ[v] would inflate b/c (full credit, not 0.5).
    const { g } = buildUndirectedGraph(makeGraph({ a: ['b', 'c'], b: ['d'], c: ['d'], d: ['e'], e: [] }));
    const bc = computeBetweenness(g);
    expect(bc.get('a')!).toBeCloseTo(0.5);
    expect(bc.get('b')!).toBeCloseTo(1);
    expect(bc.get('c')!).toBeCloseTo(1);
    expect(bc.get('d')!).toBeCloseTo(3.5);
    expect(bc.get('e')!).toBeCloseTo(0);
  });

  it('star K_{1,4} → center = C(4,2) = 6, leaves = 0 (canonical max-centrality case)', () => {
    // Every one of the 6 leaf-pair shortest paths routes through the center.
    const { g } = buildUndirectedGraph(makeGraph({ a: ['b', 'c', 'd', 'e'], b: [], c: [], d: [], e: [] }));
    const bc = computeBetweenness(g);
    expect(bc.get('a')!).toBeCloseTo(6);
    for (const leaf of ['b', 'c', 'd', 'e']) expect(bc.get(leaf)!).toBeCloseTo(0);
  });
});

// ── degree centrality (large-graph ranking fallback) ────────────────

describe('degreeCentrality — large-graph ranking fallback', () => {
  it('returns neighbor counts and ranks the star center above its leaves', () => {
    const { adj } = buildUndirectedGraph(makeGraph({ a: ['b', 'c', 'd', 'e'], b: [], c: [], d: [], e: [] }));
    const deg = degreeCentrality(adj);
    expect(deg.get('a')).toBe(4);
    for (const leaf of ['b', 'c', 'd', 'e']) expect(deg.get(leaf)).toBe(1);
  });

  it('agrees with betweenness on which star node ranks first (degrades precision, not order here)', () => {
    const { g, adj } = buildUndirectedGraph(makeGraph({ a: ['b', 'c', 'd', 'e'], b: [], c: [], d: [], e: [] }));
    const deg = degreeCentrality(adj);
    const bc = computeBetweenness(g);
    // both rank the center strictly above any leaf
    expect(deg.get('a')!).toBeGreaterThan(deg.get('b')!);
    expect(bc.get('a')!).toBeGreaterThan(bc.get('b')!);
  });
});

// ── detection: quickstart K/H fixture ───────────────────────────────

// @spec §6.8.1
describe('detectStructuralGaps — K/H quickstart fixture', () => {
  it('flags exactly one structural_gap with bridgeCount 1', () => {
    const { gaps, truncated } = detectStructuralGaps(khFixture(), thresholds());
    expect(gaps).toHaveLength(1);
    expect(truncated).toBe(0);
    expect(gaps[0].type).toBe('structural_gap');
    expect(gaps[0].structuralGap!.bridgeCount).toBe(1);
  });

  it('assigns clusterA/clusterB by smallest members[0] (hyp < know)', () => {
    const { gaps } = detectStructuralGaps(khFixture(), thresholds());
    const sg = gaps[0].structuralGap!;
    expect(sg.clusterA).toEqual(['hyp-001', 'hyp-002', 'hyp-003', 'hyp-004']);
    expect(sg.clusterB).toEqual(['know-001', 'know-002', 'know-003', 'know-004']);
  });

  it('candidates: 1..3 pairs, from∈A / to∈B, excludes the existing bridge pair', () => {
    const { gaps } = detectStructuralGaps(khFixture(), thresholds());
    const sg = gaps[0].structuralGap!;
    expect(sg.candidates.length).toBeGreaterThanOrEqual(1);
    expect(sg.candidates.length).toBeLessThanOrEqual(3);
    for (const c of sg.candidates) {
      expect(c.from.startsWith('hyp')).toBe(true);
      expect(c.to.startsWith('know')).toBe(true);
      // The existing bridge (hyp-001, know-001) must NOT be proposed.
      expect(c.from === 'hyp-001' && c.to === 'know-001').toBe(false);
    }
  });

  it('ranks bridge-adjacent endpoints first by betweenness, then id', () => {
    const { gaps } = detectStructuralGaps(khFixture(), thresholds());
    expect(gaps[0].structuralGap!.candidates[0]).toEqual({
      from: 'hyp-001',
      to: 'know-002',
    });
  });

  it('nodeIds = sorted unique union of candidate endpoints', () => {
    const { gaps } = detectStructuralGaps(khFixture(), thresholds());
    const sg = gaps[0].structuralGap!;
    const expected = [...new Set(sg.candidates.flatMap((c) => [c.from, c.to]))].sort();
    expect(gaps[0].nodeIds).toEqual(expected);
  });

  it('message references representative titles (candidates[0].from/.to)', () => {
    const { gaps } = detectStructuralGaps(khFixture(), thresholds());
    const sg = gaps[0].structuralGap!;
    // titles == ids in this fixture, so the labels are the rep node ids.
    expect(gaps[0].message).toContain(sg.candidates[0].from);
    expect(gaps[0].message).toContain(sg.candidates[0].to);
    expect(gaps[0].message.toLowerCase()).toContain('structural gap');
  });
});

// ── determinism ─────────────────────────────────────────────────────

describe('detectStructuralGaps — determinism (FR-008)', () => {
  it('produces deeply equal results across two runs (order, candidates, A/B direction)', () => {
    const a = detectStructuralGaps(khFixture(), thresholds());
    const b = detectStructuralGaps(khFixture(), thresholds());
    expect(a).toEqual(b);
  });

  it('multi-gap fixture is deterministic across runs', () => {
    const g = () =>
      detectStructuralGaps(multiClusterFixture(), thresholds({ structural_max_gaps: 999 }));
    expect(g()).toEqual(g());
  });

  it('output is independent of node insertion order (id-sort normalization)', () => {
    // Same logical graph, node Map built in reverse insertion order. The internal
    // id-sort in buildUndirectedGraph/computeBetweenness must erase the difference —
    // this catches accidental reliance on Map iteration order that two same-process
    // runs of an identical Map would not.
    const base = multiClusterFixture();
    const reversed = { ...base, nodes: new Map([...base.nodes].reverse()) };
    const normal = detectStructuralGaps(base, thresholds({ structural_max_gaps: 999 }));
    const shuffled = detectStructuralGaps(reversed, thresholds({ structural_max_gaps: 999 }));
    expect(shuffled).toEqual(normal);
  });
});

// ── threshold guard at the function boundary (M4) ───────────────────

describe('detectStructuralGaps — threshold guard at the function boundary', () => {
  // detectStructuralGaps is exported and unit-callable, bypassing loadConfig's
  // validation. Its own positiveInteger guard is then the ONLY defense, so it
  // must reject invalid thresholds passed directly and fall back to defaults.
  it('rejects fractional / zero / negative thresholds → identical to default-threshold result', () => {
    const invalid = detectStructuralGaps(
      khFixture(),
      thresholds({
        structural_min_cluster_size: 2.5, // → 3
        structural_max_bridges: 0,         // → 1
        structural_max_gaps: -1,           // → 5
      }),
    );
    expect(invalid).toEqual(detectStructuralGaps(khFixture(), thresholds()));
  });

  it('rejects NaN / Infinity thresholds → identical to default-threshold result', () => {
    const invalid = detectStructuralGaps(
      khFixture(),
      thresholds({
        structural_min_cluster_size: NaN,
        structural_max_bridges: Infinity,
        structural_max_gaps: NaN,
      }),
    );
    expect(invalid).toEqual(detectStructuralGaps(khFixture(), thresholds()));
  });
});

// ── false positives ─────────────────────────────────────────────────

describe('detectStructuralGaps — false positives (SC-002)', () => {
  it('two unconnected nodes → 0 gaps', () => {
    const { gaps } = detectStructuralGaps(makeGraph({ a: [], b: [] }), thresholds());
    expect(gaps).toHaveLength(0);
  });

  it('single dense cluster → 0 gaps (needs ≥2 developed clusters)', () => {
    const { gaps } = detectStructuralGaps(makeGraph(cliqueLinks(ids('know', 4))), thresholds());
    expect(gaps).toHaveLength(0);
  });

  it('single large community (K8 ≥ 2·min_cluster_size) → 0 gaps via the <2-developed path', () => {
    // K8: order 8 ≥ 2*S=6 clears the node-count early-exit, but Louvain yields ONE
    // community of 8 ≥ S → developed.length < 2. Isolates that return (the K4 case
    // above exits earlier on `order < 2*S`, never reaching the <2-developed check).
    const { gaps } = detectStructuralGaps(makeGraph(cliqueLinks(ids('know', 8))), thresholds());
    expect(gaps).toHaveLength(0);
  });

  it('empty graph → 0 gaps, 0 truncated', () => {
    const { gaps, truncated } = detectStructuralGaps(makeGraph({}), thresholds());
    expect(gaps).toHaveLength(0);
    expect(truncated).toBe(0);
  });

  it('raising structural_min_cluster_size suppresses otherwise-developed K4 clusters', () => {
    const { gaps } = detectStructuralGaps(
      khFixture(),
      thresholds({ structural_min_cluster_size: 5 }),
    );
    expect(gaps).toHaveLength(0);
  });
});

// ── sorting ─────────────────────────────────────────────────────────

/** Three dense cliques of sizes 5/4/3, each pair joined by exactly one bridge. */
function multiClusterFixture(): Graph {
  const p = ids('aaa', 5); // members[0] = aaa-001 (smallest)
  const q = ids('bbb', 4);
  const r = ids('ccc', 3);
  const spec = { ...cliqueLinks(p), ...cliqueLinks(q), ...cliqueLinks(r) };
  // one bridge per pair (P-Q, P-R, Q-R)
  spec[p[0]] = [...spec[p[0]], q[0]]; // aaa-001 — bbb-001
  spec[p[1]] = [...spec[p[1]], r[0]]; // aaa-002 — ccc-001
  spec[q[1]] = [...spec[q[1]], r[1]]; // bbb-002 — ccc-002
  return makeGraph(spec);
}

describe('detectStructuralGaps — sorting (R7)', () => {
  it('with default max_bridges=1, sorts by total cluster size desc', () => {
    const { gaps } = detectStructuralGaps(
      multiClusterFixture(),
      thresholds({ structural_max_gaps: 999 }),
    );
    expect(gaps).toHaveLength(3);
    // all bridgeCount === 1 here, so size-desc is the active key.
    const totalSizes = gaps.map(
      (g) => g.structuralGap!.clusterA.length + g.structuralGap!.clusterB.length,
    );
    // P-Q=9, P-R=8, Q-R=7 → descending
    expect(totalSizes).toEqual([...totalSizes].sort((a, b) => b - a));
    expect(totalSizes[0]).toBe(9);
  });

  it('bridgeCount asc is the primary sort key (when max_bridges ≥ 2)', () => {
    // P (K5) double-bridged to Q (K4); single bridge P-R (K4). max_bridges=2.
    const p = ids('aaa', 5);
    const q = ids('bbb', 4);
    const r = ids('ccc', 4);
    const spec = { ...cliqueLinks(p), ...cliqueLinks(q), ...cliqueLinks(r) };
    spec[p[0]] = [...spec[p[0]], q[0]]; // bridge 1: P-Q
    spec[p[1]] = [...spec[p[1]], q[1]]; // bridge 2: P-Q (bridgeCount 2)
    spec[p[2]] = [...spec[p[2]], r[0]]; // single bridge: P-R
    const { gaps } = detectStructuralGaps(
      makeGraph(spec),
      thresholds({ structural_max_bridges: 2, structural_max_gaps: 999 }),
    );
    const counts = gaps.map((g) => g.structuralGap!.bridgeCount);
    // ascending bridgeCount: the bridgeCount-1 pair must come before the bridgeCount-2 pair
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts).toContain(1);
    expect(counts).toContain(2);
  });
});

// ── report cap / truncation ─────────────────────────────────────────

describe('detectStructuralGaps — report cap (FR-009)', () => {
  it('caps reported gaps and surfaces truncated count', () => {
    // 4 dense K4 clusters, each pair joined by one bridge → C(4,2)=6 pairs.
    const a = ids('aaa', 4);
    const b = ids('bbb', 4);
    const c = ids('ccc', 4);
    const d = ids('ddd', 4);
    const spec = {
      ...cliqueLinks(a),
      ...cliqueLinks(b),
      ...cliqueLinks(c),
      ...cliqueLinks(d),
    };
    spec[a[0]] = [...spec[a[0]], b[0]]; // a-b
    spec[a[1]] = [...spec[a[1]], c[0]]; // a-c
    spec[a[2]] = [...spec[a[2]], d[0]]; // a-d
    spec[b[1]] = [...spec[b[1]], c[1]]; // b-c
    spec[b[2]] = [...spec[b[2]], d[1]]; // b-d
    spec[c[2]] = [...spec[c[2]], d[2]]; // c-d
    const { gaps, truncated } = detectStructuralGaps(makeGraph(spec), thresholds({ structural_max_gaps: 5 }));
    expect(gaps).toHaveLength(5);
    expect(truncated).toBe(1);
  });

  it('applies the report cap after priority sorting', () => {
    const { gaps, truncated } = detectStructuralGaps(
      multiClusterFixture(),
      thresholds({ structural_max_gaps: 1 }),
    );
    expect(gaps).toHaveLength(1);
    expect(truncated).toBe(2);
    const sg = gaps[0].structuralGap!;
    expect(sg.clusterA.length + sg.clusterB.length).toBe(9);
  });

  it('exactly at the cap (pairs === structural_max_gaps) → truncated 0, all reported', () => {
    // multiClusterFixture has exactly 3 qualified pairs; cap=3 is the off-by-one
    // boundary for `Math.max(0, pairs.length - G)` — nothing is dropped.
    const { gaps, truncated } = detectStructuralGaps(
      multiClusterFixture(),
      thresholds({ structural_max_gaps: 3 }),
    );
    expect(gaps).toHaveLength(3);
    expect(truncated).toBe(0);
  });
});

// ── config sensitivity (SC-004 / US3) ───────────────────────────────

/** Three dense K5 cliques with 1 / 2 / 3 bridges across the three pairs. */
function varyingBridgeFixture(): Graph {
  const x = ids('xxx', 5);
  const y = ids('yyy', 5);
  const z = ids('zzz', 5);
  const spec = { ...cliqueLinks(x), ...cliqueLinks(y), ...cliqueLinks(z) };
  spec[x[0]] = [...spec[x[0]], y[0]]; // X-Y: 1 bridge
  spec[x[1]] = [...spec[x[1]], z[0]]; // X-Z: 2 bridges
  spec[x[2]] = [...spec[x[2]], z[1]];
  spec[y[1]] = [...spec[y[1]], z[2]]; // Y-Z: 3 bridges
  spec[y[2]] = [...spec[y[2]], z[3]];
  spec[y[3]] = [...spec[y[3]], z[4]];
  return makeGraph(spec);
}

describe('detectStructuralGaps — config sensitivity (SC-004, US3)', () => {
  // Compare pre-truncation total (gaps.length + truncated) with the report cap
  // disabled, so the always-applied cap can't mask the monotonic response (F9).
  const run = (maxBridges: number) =>
    detectStructuralGaps(
      varyingBridgeFixture(),
      thresholds({ structural_max_bridges: maxBridges, structural_max_gaps: 999 }),
    );
  const total = (r: { gaps: unknown[]; truncated: number }) => r.gaps.length + r.truncated;

  it('raising structural_max_bridges increases (never decreases) reporting', () => {
    const lo = total(run(1)); // only bridgeCount-1 pairs qualify
    const hi = total(run(3)); // bridgeCount 1, 2, 3 all qualify
    expect(hi).toBeGreaterThanOrEqual(lo);
    expect(hi).toBeGreaterThan(lo);
  });

  it('lowering structural_max_bridges does not increase reporting', () => {
    expect(total(run(1))).toBeLessThanOrEqual(total(run(3)));
  });

  it('excludes bridge counts above the default structural_max_bridges boundary', () => {
    const defaults = run(1).gaps.map((g) => g.structuralGap!.bridgeCount);
    const expanded = run(3).gaps.map((g) => g.structuralGap!.bridgeCount);
    expect(defaults).not.toContain(3);
    expect(expanded).toContain(3);
  });
});

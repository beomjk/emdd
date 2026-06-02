import GraphologyDefault from 'graphology';
import louvainDefault from 'graphology-communities-louvain';
import type { Graph as EmddGraph, GapDetail } from './types.js';
import { DEFAULT_CONFIG, type GapThresholds } from './config.js';
import { t } from '../i18n/index.js';

// ESM interop — graphology/louvain export shapes vary by bundler
const GraphologyGraph = (GraphologyDefault as any).default ?? GraphologyDefault;
const louvain = (louvainDefault as any).default ?? louvainDefault;

type GraphologyInstance = InstanceType<typeof GraphologyGraph>;

// ── Undirected unweighted builder ───────────────────────────────────

/**
 * Build an unweighted, undirected graphology graph from the EMDD graph,
 * plus a symmetric adjacency set for "already connected" checks.
 *
 * Determinism: nodes are inserted in id-sorted order; multi-edges and
 * self-loops are dropped; edges to absent targets are skipped. No weight
 * attribute is assigned (pure structure — Q1/R1).
 */
export function buildUndirectedGraph(
  graph: EmddGraph,
): { g: GraphologyInstance; adj: Map<string, Set<string>> } {
  const g = new GraphologyGraph({ type: 'undirected' });
  const adj = new Map<string, Set<string>>();

  const sortedIds = [...graph.nodes.keys()].sort();
  for (const id of sortedIds) {
    g.addNode(id);
    adj.set(id, new Set());
  }

  const seen = new Set<string>();
  for (const id of sortedIds) {
    const node = graph.nodes.get(id)!;
    for (const link of node.links) {
      const target = link.target;
      if (target === id) continue; // self-loop
      if (!g.hasNode(target)) continue; // dangling target
      const key = [id, target].sort().join('::');
      if (seen.has(key)) continue; // multi-edge → single undirected edge
      seen.add(key);
      g.addEdge(id, target);
      adj.get(id)!.add(target);
      adj.get(target)!.add(id);
    }
  }

  return { g, adj };
}

// ── Deterministic Brandes betweenness (unweighted, undirected) ──────

/**
 * Betweenness centrality via Brandes' algorithm on an unweighted graph.
 * Used only to *rank* bridge candidates (detection uses the bridge-count
 * rule). The final values are halved because each unordered pair is
 * counted twice in an undirected graph — this matches the standard
 * definition so absolute-value unit tests hold.
 */
export function computeBetweenness(g: GraphologyInstance): Map<string, number> {
  const nodes: string[] = (g.nodes() as string[]).slice().sort();
  const neighbors = new Map<string, string[]>();
  for (const v of nodes) {
    neighbors.set(v, (g.neighbors(v) as string[]).slice().sort());
  }

  const CB = new Map<string, number>();
  for (const v of nodes) CB.set(v, 0);

  for (const s of nodes) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    for (const v of nodes) {
      pred.set(v, []);
      sigma.set(v, 0);
      dist.set(v, -1);
    }
    sigma.set(s, 1);
    dist.set(s, 0);

    // BFS (queue with index cursor → FIFO, no shift cost)
    const queue: string[] = [s];
    let qi = 0;
    while (qi < queue.length) {
      const v = queue[qi++];
      stack.push(v);
      const dv = dist.get(v)!;
      const sv = sigma.get(v)!;
      for (const w of neighbors.get(v)!) {
        if (dist.get(w)! < 0) {
          dist.set(w, dv + 1);
          queue.push(w);
        }
        if (dist.get(w)! === dv + 1) {
          sigma.set(w, sigma.get(w)! + sv);
          pred.get(w)!.push(v);
        }
      }
    }

    // Back-propagation of dependencies
    const delta = new Map<string, number>();
    for (const v of nodes) delta.set(v, 0);
    for (let i = stack.length - 1; i >= 0; i--) {
      const w = stack[i];
      const sw = sigma.get(w)!;
      const coeff = (1 + delta.get(w)!) / sw;
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + sigma.get(v)! * coeff);
      }
      if (w !== s) {
        CB.set(w, CB.get(w)! + delta.get(w)!);
      }
    }
  }

  // Undirected → each pair counted twice
  for (const v of nodes) CB.set(v, CB.get(v)! / 2);
  return CB;
}

// ── Structural gap detection ────────────────────────────────────────

interface DevelopedCluster {
  members: string[]; // id-sorted
}

interface QualifiedPair {
  ci: DevelopedCluster; // clusterA — smaller members[0]
  cj: DevelopedCluster; // clusterB
  bridgeCount: number;
}

interface GapPair extends QualifiedPair {
  candidates: Array<{ from: string; to: string }>;
}

function positiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Detect structural gaps: pairs of well-developed Louvain communities that
 * are only weakly bridged (1 ≤ bridges ≤ max_bridges). For each gap, propose
 * up to 3 high-betweenness, not-yet-connected node pairs as bridge candidates.
 *
 * Deterministic: id-sorted node insertion + `randomWalk: false` + explicit
 * members[0] ordering fix the partition, the A/B assignment, and the output.
 */
export function detectStructuralGaps(
  graph: EmddGraph,
  thresholds: Pick<
    GapThresholds,
    'structural_min_cluster_size' | 'structural_max_bridges' | 'structural_max_gaps'
  >,
): { gaps: GapDetail[]; truncated: number } {
  const S = positiveInteger(thresholds.structural_min_cluster_size, DEFAULT_CONFIG.gaps.structural_min_cluster_size);
  const B = positiveInteger(thresholds.structural_max_bridges, DEFAULT_CONFIG.gaps.structural_max_bridges);
  const G = positiveInteger(thresholds.structural_max_gaps, DEFAULT_CONFIG.gaps.structural_max_gaps);

  const { g, adj } = buildUndirectedGraph(graph);

  // Early exit: too few nodes for two developed clusters, or no edges.
  if (g.order < 2 * S || g.size === 0) return { gaps: [], truncated: 0 };

  // Louvain communities — unweighted (getEdgeWeight: null), deterministic.
  const communities = louvain(g, {
    getEdgeWeight: null,
    randomWalk: false,
    resolution: 1.0,
  }) as Record<string, number>;

  const commGroups = new Map<number, string[]>();
  for (const [nodeId, comm] of Object.entries(communities)) {
    const group = commGroups.get(comm);
    if (group) group.push(nodeId);
    else commGroups.set(comm, [nodeId]);
  }

  // Developed clusters (≥ S members), ordered by smallest member id so the
  // cluster order is a function of graph content, not Louvain's label order.
  const developed: DevelopedCluster[] = [];
  for (const members of commGroups.values()) {
    if (members.length >= S) developed.push({ members: members.slice().sort() });
  }
  if (developed.length < 2) return { gaps: [], truncated: 0 };
  developed.sort((a, b) => (a.members[0] < b.members[0] ? -1 : a.members[0] > b.members[0] ? 1 : 0));

  const qualifiedPairs: QualifiedPair[] = [];
  for (let i = 0; i < developed.length; i++) {
    for (let j = i + 1; j < developed.length; j++) {
      const ci = developed[i]; // smaller members[0] → clusterA
      const cj = developed[j];
      const cjSet = new Set(cj.members);

      // Count bridges from one side only (adj is symmetric — counting both
      // sides would double-count each undirected bridge).
      let bridgeCount = 0;
      for (const a of ci.members) {
        for (const b of adj.get(a) ?? []) {
          if (cjSet.has(b)) bridgeCount++;
        }
      }
      if (bridgeCount < 1 || bridgeCount > B) continue;
      qualifiedPairs.push({ ci, cj, bridgeCount });
    }
  }
  if (qualifiedPairs.length === 0) return { gaps: [], truncated: 0 };

  const bc = computeBetweenness(g);

  // Betweenness-desc, id-asc comparator for candidate ranking.
  const byCentrality = (x: string, y: string): number => {
    const bx = bc.get(x) ?? 0;
    const by = bc.get(y) ?? 0;
    if (bx !== by) return by - bx;
    return x < y ? -1 : x > y ? 1 : 0;
  };

  const pairs: GapPair[] = [];
  for (const { ci, cj, bridgeCount } of qualifiedPairs) {
    // Rank each cluster's nodes by betweenness; collect only the best 3
    // not-yet-connected cross pairs ordered by (rankA + rankB, idA, idB).
    const sortedA = ci.members.slice().sort(byCentrality);
    const sortedB = cj.members.slice().sort(byCentrality);
    const rankA = new Map(sortedA.map((id, idx) => [id, idx] as const));
    const rankB = new Map(sortedB.map((id, idx) => [id, idx] as const));

    const compareCandidate = (p: { from: string; to: string }, q: { from: string; to: string }): number => {
      const rp = rankA.get(p.from)! + rankB.get(p.to)!;
      const rq = rankA.get(q.from)! + rankB.get(q.to)!;
      if (rp !== rq) return rp - rq;
      if (p.from !== q.from) return p.from < q.from ? -1 : 1;
      return p.to < q.to ? -1 : p.to > q.to ? 1 : 0;
    };

    const candidates: Array<{ from: string; to: string }> = [];
    for (const a of sortedA) {
      const aAdj = adj.get(a);
      for (const b of sortedB) {
        if (aAdj?.has(b)) continue; // already directly connected
        candidates.push({ from: a, to: b });
        candidates.sort(compareCandidate);
        if (candidates.length > 3) candidates.pop();
      }
    }

    // Defensive: a separated-but-fully-connected pair has no candidate to
    // propose — drop it rather than emit an empty (and unactionable) gap.
    if (candidates.length === 0) continue;

    pairs.push({ ci, cj, bridgeCount, candidates });
  }

  // Sort gaps: bridgeCount asc, total size desc, then cluster member ids.
  pairs.sort((p, q) => {
    if (p.bridgeCount !== q.bridgeCount) return p.bridgeCount - q.bridgeCount;
    const sizeP = p.ci.members.length + p.cj.members.length;
    const sizeQ = q.ci.members.length + q.cj.members.length;
    if (sizeP !== sizeQ) return sizeQ - sizeP;
    if (p.ci.members[0] !== q.ci.members[0]) return p.ci.members[0] < q.ci.members[0] ? -1 : 1;
    return p.cj.members[0] < q.cj.members[0] ? -1 : p.cj.members[0] > q.cj.members[0] ? 1 : 0;
  });

  const truncated = Math.max(0, pairs.length - G);
  const reported = pairs.slice(0, G);

  const gaps: GapDetail[] = reported.map((p) => {
    const repA = p.candidates[0].from;
    const repB = p.candidates[0].to;
    const labelA = graph.nodes.get(repA)?.title || repA;
    const labelB = graph.nodes.get(repB)?.title || repB;
    const candidatesStr = p.candidates.map((c) => `${c.from} ↔ ${c.to}`).join(', ');
    const nodeIds = [...new Set(p.candidates.flatMap((c) => [c.from, c.to]))].sort();

    return {
      type: 'structural_gap' as const,
      nodeIds,
      message: t('gap.structural_gap', {
        clusterA: labelA,
        clusterB: labelB,
        bridges: String(p.bridgeCount),
        candidates: candidatesStr,
      }),
      structuralGap: {
        clusterA: p.ci.members,
        clusterB: p.cj.members,
        bridgeCount: p.bridgeCount,
        candidates: p.candidates,
      },
    };
  });

  return { gaps, truncated };
}

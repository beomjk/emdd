import { describe, it, expect } from 'vitest';
import { countEpisodesSince, resolveConsolidationAnchor } from '../../../src/graph/consolidation-helpers.js';
import type { Graph } from '../../../src/graph/types.js';
import type { EmddConfig } from '../../../src/graph/config.js';

function makeGraph(nodes: Array<{ id: string; type: string; created?: string; links?: { target: string; relation: string }[] }>): Graph {
  const map = new Map<string, import('../../../src/graph/types.js').Node>();
  for (const n of nodes) {
    map.set(n.id, {
      id: n.id,
      type: n.type as import('../../../src/graph/types.js').NodeType,
      title: n.id,
      status: 'ACTIVE',
      path: `/tmp/${n.id}.md`,
      links: n.links ?? [],
      tags: [],
      meta: { created: n.created ?? '2026-04-01' },
    });
  }
  return { nodes: map };
}

describe('countEpisodesSince', () => {
  it('counts only episodes created after the given date', () => {
    const graph = makeGraph([
      { id: 'epi-001', type: 'episode', created: '2026-03-01' },
      { id: 'epi-002', type: 'episode', created: '2026-04-10' },
      { id: 'epi-003', type: 'episode', created: '2026-04-15' },
      { id: 'find-001', type: 'finding', created: '2026-04-15' },
    ]);
    expect(countEpisodesSince(graph, new Date('2026-04-05'))).toBe(2);
  });

  it('returns 0 when no episodes after the date', () => {
    const graph = makeGraph([{ id: 'epi-001', type: 'episode', created: '2026-01-01' }]);
    expect(countEpisodesSince(graph, new Date('2026-04-05'))).toBe(0);
  });

  it('ignores non-episode node types', () => {
    const graph = makeGraph([{ id: 'find-001', type: 'finding', created: '2026-05-01' }]);
    expect(countEpisodesSince(graph, new Date('2026-04-01'))).toBe(0);
  });
});

describe('resolveConsolidationAnchor', () => {
  const baseConfig: EmddConfig = {
    last_consolidation_date: null,
    last_health_date: null,
    gaps: {
      untested_days: 14,
      untested_episodes: 3,
      blocking_days: 7,
      blocking_episodes: 2,
      stale_days: 180,
      orphan_min_outgoing: 0,
      min_cluster_edges: 1,
    },
  };

  it('uses explicit config date when present', () => {
    const cfg = { ...baseConfig, last_consolidation_date: '2026-04-10' };
    const graph = makeGraph([]);
    const anchor = resolveConsolidationAnchor(cfg, graph);
    expect(anchor?.toISOString().slice(0, 10)).toBe('2026-04-10');
  });

  it('falls back to newest knowledge with promotes edge when config empty', () => {
    const graph = makeGraph([
      { id: 'know-001', type: 'knowledge', created: '2026-01-01', links: [{ target: 'find-001', relation: 'promotes' }] },
      { id: 'know-002', type: 'knowledge', created: '2026-03-01', links: [{ target: 'find-002', relation: 'promotes' }] },
    ]);
    const anchor = resolveConsolidationAnchor(baseConfig, graph);
    expect(anchor?.toISOString().slice(0, 10)).toBe('2026-03-01');
  });

  it('ignores knowledge without promotes edges', () => {
    const graph = makeGraph([
      { id: 'know-001', type: 'knowledge', created: '2026-01-01', links: [] },
    ]);
    const anchor = resolveConsolidationAnchor(baseConfig, graph);
    expect(anchor).toBeNull();
  });

  it('returns null when no consolidation evidence exists', () => {
    const graph = makeGraph([]);
    const anchor = resolveConsolidationAnchor(baseConfig, graph);
    expect(anchor).toBeNull();
  });
});

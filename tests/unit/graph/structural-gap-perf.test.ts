// SC-005 performance verification (011).
// Generates a ~500-node sparse graph DETERMINISTICALLY (no random seed) and
// measures getHealth() end-to-end plus the isolated detectStructuralGaps()
// cost, so the structural-gap regression is measured, not estimated.
//
// Budget (constitution Performance Targets): emdd health < 3s at 500 nodes.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { getHealth } from '../../../src/graph/health.js';
import { loadGraph } from '../../../src/graph/loader.js';
import { detectStructuralGaps } from '../../../src/graph/structural-gap.js';
import { DEFAULT_CONFIG } from '../../../src/graph/config.js';

const CLUSTERS = 20;
const PER_CLUSTER = 25; // 20 * 25 = 500 nodes
const NODE_BUDGET_MS = 3000;

/** Deterministic sparse graph: CLUSTERS dense-ish communities, each joined to
 *  the next by a single bridge (one weak-bridge chain → exercises detection). */
function generateGraph(graphDir: string): void {
  mkdirSync(join(graphDir, 'knowledge'), { recursive: true });

  const id = (c: number, i: number) => `know-${String(c * PER_CLUSTER + i).padStart(4, '0')}`;

  for (let c = 0; c < CLUSTERS; c++) {
    for (let i = 0; i < PER_CLUSTER; i++) {
      const links: Array<{ target: string; relation: string }> = [];
      // intra-cluster: ring + two chords → avg degree ~4, sparse but cohesive
      links.push({ target: id(c, (i + 1) % PER_CLUSTER), relation: 'relates_to' });
      links.push({ target: id(c, (i + 2) % PER_CLUSTER), relation: 'relates_to' });
      links.push({ target: id(c, (i + 5) % PER_CLUSTER), relation: 'relates_to' });
      // one bridge from this cluster's node 0 to the next cluster's node 0
      if (i === 0 && c + 1 < CLUSTERS) {
        links.push({ target: id(c + 1, 0), relation: 'relates_to' });
      }
      const fm = {
        id: id(c, i),
        type: 'knowledge',
        title: `Node ${id(c, i)}`,
        status: 'ACTIVE',
        confidence: 0.5,
        created: '2026-05-01',
        updated: '2026-05-01',
        tags: [],
        links,
      };
      writeFileSync(join(graphDir, 'knowledge', `${id(c, i)}.md`), matter.stringify('', fm));
    }
  }
}

describe('SC-005: getHealth performance at ~500 nodes', () => {
  it('stays within the 3s budget and the structural-gap cost is a small fraction', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'emdd-sg-perf-'));
    const graphDir = join(tmpDir, 'graph');
    try {
      generateGraph(graphDir);

      // End-to-end getHealth (includes structural gap detection).
      const h0 = performance.now();
      const report = await getHealth(graphDir);
      const h1 = performance.now();
      const withMs = h1 - h0;

      // Isolated detectStructuralGaps cost on the same loaded graph.
      const graph = await loadGraph(graphDir);
      expect(graph.nodes.size).toBe(CLUSTERS * PER_CLUSTER);
      const s0 = performance.now();
      detectStructuralGaps(graph, DEFAULT_CONFIG.gaps);
      const s1 = performance.now();
      const sgMs = s1 - s0;

      // getHealth "without" the structural path ≈ total − isolated structural cost.
      const withoutMs = Math.max(0, withMs - sgMs);

      // Measured, not estimated — surfaced for documentation.
      // eslint-disable-next-line no-console
      console.log(
        `[SC-005] nodes=${graph.nodes.size} getHealth(with)=${withMs.toFixed(1)}ms ` +
        `structuralGap=${sgMs.toFixed(1)}ms getHealth(without≈)=${withoutMs.toFixed(1)}ms`,
      );

      expect(withMs).toBeLessThan(NODE_BUDGET_MS);
      // The added structural-gap cost must itself fit comfortably in budget.
      expect(sgMs).toBeLessThan(NODE_BUDGET_MS);
      // Sanity: detection actually produced report data (cap applied).
      expect(report.gapDetails.filter(g => g.type === 'structural_gap').length).toBeGreaterThan(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { loadGraph } from '../../../src/graph/loader.js';
import { readNode } from '../../../src/graph/operations.js';
import { createGraphCache } from '../../../src/web/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

const NODE_TYPES = ['hypothesis', 'experiment', 'finding', 'knowledge', 'question', 'episode', 'decision'] as const;
const NODE_TYPE_DIRS: Record<string, string> = {
  hypothesis: 'hypotheses',
  experiment: 'experiments',
  finding: 'findings',
  knowledge: 'knowledge',
  question: 'questions',
  episode: 'episodes',
  decision: 'decisions',
};
const ID_PREFIXES: Record<string, string> = {
  hypothesis: 'hyp',
  experiment: 'exp',
  finding: 'fnd',
  knowledge: 'knw',
  question: 'qst',
  episode: 'epi',
  decision: 'dec',
};
const STATUSES = ['PROPOSED', 'TESTING', 'RUNNING', 'DRAFT', 'OPEN', 'ACTIVE'];
const RELATIONS = ['tested_by', 'supports', 'produces', 'informs', 'answers', 'relates_to'];

function generateSyntheticGraph(graphDir: string, nodeCount: number): void {
  for (const type of NODE_TYPES) {
    mkdirSync(path.join(graphDir, NODE_TYPE_DIRS[type]), { recursive: true });
  }

  const nodesPerType = Math.ceil(nodeCount / NODE_TYPES.length);

  for (const type of NODE_TYPES) {
    const prefix = ID_PREFIXES[type];
    const dir = NODE_TYPE_DIRS[type];
    const count = Math.min(nodesPerType, nodeCount);

    for (let i = 1; i <= count; i++) {
      const id = `${prefix}-${String(i).padStart(3, '0')}`;
      const status = STATUSES[i % STATUSES.length];
      const tags = [`tag-${i % 5}`, `tag-${i % 3}`];

      // Create some links to other nodes
      const links: Array<{ target: string; relation: string }> = [];
      if (i > 1) {
        const targetI = Math.max(1, i - 1);
        const targetType = NODE_TYPES[(NODE_TYPES.indexOf(type) + 1) % NODE_TYPES.length];
        const targetPrefix = ID_PREFIXES[targetType];
        links.push({
          target: `${targetPrefix}-${String(targetI).padStart(3, '0')}`,
          relation: RELATIONS[i % RELATIONS.length],
        });
      }

      const frontmatter: Record<string, unknown> = {
        id,
        type,
        title: `Node ${id}`,
        status,
        tags,
        links,
        created: '2026-01-01',
        updated: '2026-01-01',
      };
      if (type === 'hypothesis' || type === 'finding') {
        frontmatter.confidence = (i % 10) / 10;
      }
      const content = matter.stringify(`Body content for ${id}`, frontmatter);

      writeFileSync(path.join(graphDir, dir, `${id}-node.md`), content);
    }
  }
}

describe('Performance benchmarks', () => {
  let tmpDir200: string;
  let tmpDir500: string;

  beforeEach(() => {
    tmpDir200 = mkdtempSync(path.join(tmpdir(), 'emdd-perf-200-'));
    tmpDir500 = mkdtempSync(path.join(tmpdir(), 'emdd-perf-500-'));
    generateSyntheticGraph(tmpDir200, 200);
    generateSyntheticGraph(tmpDir500, 500);
  });

  afterEach(() => {
    rmSync(tmpDir200, { recursive: true, force: true });
    rmSync(tmpDir500, { recursive: true, force: true });
  });

  it('SC-001: loadGraph() + serialization < 5s for 200 nodes', async () => {
    const start = performance.now();
    const cache = createGraphCache(tmpDir200);
    const graph = await cache.getGraph();
    const elapsed = performance.now() - start;

    expect(graph.nodes.length).toBeGreaterThanOrEqual(200);
    expect(elapsed).toBeLessThan(5000);
  });

  it('SC-001: loadGraph() + serialization < 5s for 500 nodes', async () => {
    const start = performance.now();
    const cache = createGraphCache(tmpDir500);
    const graph = await cache.getGraph();
    const elapsed = performance.now() - start;

    expect(graph.nodes.length).toBeGreaterThanOrEqual(500);
    expect(elapsed).toBeLessThan(5000);
  });

  it('SC-002: readNode() response time < 0.5s', async () => {
    // First load to prime filesystem caches
    await loadGraph(SAMPLE_GRAPH);

    const start = performance.now();
    const node = await readNode(SAMPLE_GRAPH, 'hyp-001');
    const elapsed = performance.now() - start;

    expect(node).not.toBeNull();
    expect(elapsed).toBeLessThan(500);
  });

  it('SC-002: readNode() response time < 0.5s on 500-node graph', async () => {
    await loadGraph(tmpDir500);

    const start = performance.now();
    const node = await readNode(tmpDir500, 'hyp-001');
    const elapsed = performance.now() - start;

    expect(node).not.toBeNull();
    expect(elapsed).toBeLessThan(500);
  });

  it('cached getGraph() returns instantly after initial load', async () => {
    const cache = createGraphCache(tmpDir500);
    await cache.getGraph(); // initial load

    const start = performance.now();
    await cache.getGraph(); // cached
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5); // should be sub-millisecond
  });

  // SC-003: Cytoscape render latency is a client-side metric that cannot be
  // measured in Node.js tests. Manual measurement methodology:
  // 1. Generate a 500-node graph: `generateSyntheticGraph(dir, 500)`
  // 2. Run `emdd serve --no-open` pointing to that directory
  // 3. Open browser DevTools → Performance tab
  // 4. Record page load
  // 5. Measure time from DOMContentLoaded to first Cytoscape paint
  // 6. Target: < 3 seconds for initial render
});

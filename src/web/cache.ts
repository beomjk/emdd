import fs from 'node:fs';
import matter from 'gray-matter';
import type { Graph, HealthReport, PromoteCandidate, CheckResult } from '../graph/types.js';
import { loadGraph } from '../graph/loader.js';
import { getHealth, detectClusters, getPromotionCandidates, checkConsolidation } from '../graph/operations.js';
import type { SerializedGraph, SerializedNode, SerializedEdge, VisualCluster } from './types.js';

export interface GraphCache {
  load(): Promise<SerializedGraph>;
  invalidate(): void;
  getGraph(): Promise<SerializedGraph>;
  getHealth(): Promise<HealthReport>;
  getPromotionCandidates(): Promise<import('../graph/types.js').PromoteCandidate[]>;
  getConsolidation(): Promise<import('../graph/types.js').CheckResult>;
  getRawGraph(): Promise<Graph>;
  getClusters(): Promise<VisualCluster[]>;
}

function serializeGraph(graph: Graph): SerializedGraph {
  const nodes: SerializedNode[] = [];
  const edges: SerializedEdge[] = [];

  for (const [, node] of graph.nodes) {
    let bodyPreview: string | undefined;
    if (!node.meta._invalid) {
      try {
        const raw = fs.readFileSync(node.path, 'utf-8');
        const body = matter(raw).content.trim();
        if (body) {
          bodyPreview = body.slice(0, 100) + (body.length > 100 ? '...' : '');
        }
      } catch { /* skip if file unreadable */ }
    }
    nodes.push({
      id: node.id,
      title: node.title,
      type: node.type,
      status: node.status ?? '',
      confidence: node.confidence,
      tags: node.tags,
      links: node.links.map((l) => ({ target: l.target, relation: l.relation })),
      created: node.meta.created ? String(node.meta.created) : undefined,
      updated: node.meta.updated ? String(node.meta.updated) : undefined,
      ...(node.meta._invalid ? { invalid: true, parseError: String(node.meta._parseError ?? '') } : {}),
      ...(bodyPreview ? { bodyPreview } : {}),
    });

    for (const link of node.links) {
      edges.push({ source: node.id, target: link.target, relation: link.relation });
    }
  }

  return { nodes, edges, loadedAt: new Date().toISOString() };
}

export function createGraphCache(graphDir: string): GraphCache {
  let cachedGraph: SerializedGraph | null = null;
  let cachedRawGraph: Graph | null = null;
  let cachedHealth: HealthReport | null = null;
  let cachedPromoCandidates: PromoteCandidate[] | null = null;
  let cachedConsolidation: CheckResult | null = null;
  let cachedClusters: VisualCluster[] | null = null;

  return {
    async load(): Promise<SerializedGraph> {
      const graph = await loadGraph(graphDir, { permissive: true });
      cachedRawGraph = graph;
      cachedGraph = serializeGraph(graph);
      cachedHealth = null;
      cachedPromoCandidates = null;
      cachedConsolidation = null;
      cachedClusters = null;
      return cachedGraph;
    },

    invalidate(): void {
      cachedGraph = null;
      cachedRawGraph = null;
      cachedHealth = null;
      cachedPromoCandidates = null;
      cachedConsolidation = null;
      cachedClusters = null;
    },

    async getGraph(): Promise<SerializedGraph> {
      if (!cachedGraph) {
        return this.load();
      }
      return cachedGraph;
    },

    async getHealth(): Promise<HealthReport> {
      if (!cachedHealth) {
        cachedHealth = await getHealth(graphDir);
      }
      return cachedHealth;
    },

    async getPromotionCandidates(): Promise<PromoteCandidate[]> {
      if (!cachedPromoCandidates) {
        cachedPromoCandidates = await getPromotionCandidates(graphDir);
      }
      return cachedPromoCandidates;
    },

    async getConsolidation(): Promise<CheckResult> {
      if (!cachedConsolidation) {
        cachedConsolidation = await checkConsolidation(graphDir);
      }
      return cachedConsolidation;
    },

    async getRawGraph(): Promise<Graph> {
      if (!cachedRawGraph) {
        await this.load();
      }
      return cachedRawGraph!;
    },

    async getClusters(): Promise<VisualCluster[]> {
      if (!cachedClusters) {
        const rawGraph = await this.getRawGraph();
        cachedClusters = await detectClusters(rawGraph, graphDir);
      }
      return cachedClusters;
    },
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { loadGraph } from './loader.js';

export interface TopicCluster {
  name: string;
  entryPoint: string;
  entryPointValid: boolean;
  nodeIds: string[];
}

export interface TopicContext {
  entryPoints: Array<{ id: string; title: string; type: string }>;
  openQuestions: Array<{ id: string; title: string }>;
  relatedNodes: Array<{ id: string; title: string; type: string }>;
}

export async function identifyClusters(graphDir: string): Promise<TopicCluster[]> {
  const indexPath = path.join(graphDir, '_index.md');
  const graph = await loadGraph(graphDir);
  const clusters: TopicCluster[] = [];

  let indexContent: string;
  try {
    indexContent = fs.readFileSync(indexPath, 'utf-8');
  } catch {
    return [];
  }

  // Parse cluster sections from _index.md
  const clusterRegex = /## Cluster:\s*(.+)/g;
  const entryPointRegex = /\*\*Entry point\*\*:\s*(\S+)/;
  const nodeIdRegex = /\b([a-z]{3}-\d{3})\b/g;

  const lines = indexContent.split('\n');
  let currentCluster: { name: string; entryPoint: string; nodeIds: string[] } | null = null;

  for (const line of lines) {
    const clusterMatch = line.match(/^## Cluster:\s*(.+)/);
    if (clusterMatch) {
      if (currentCluster) {
        const node = graph.nodes.get(currentCluster.entryPoint);
        const valid = !!node && (
          (node.type === 'knowledge' && node.status === 'ACTIVE') ||
          (node.type === 'finding' && node.status === 'VALIDATED')
        );
        clusters.push({
          name: currentCluster.name,
          entryPoint: currentCluster.entryPoint,
          entryPointValid: valid,
          nodeIds: currentCluster.nodeIds,
        });
      }
      currentCluster = { name: clusterMatch[1].trim(), entryPoint: '', nodeIds: [] };
      continue;
    }

    if (currentCluster) {
      const epMatch = line.match(entryPointRegex);
      if (epMatch) {
        currentCluster.entryPoint = epMatch[1];
      }
      // Collect all node IDs from the line
      let match;
      while ((match = nodeIdRegex.exec(line)) !== null) {
        if (!currentCluster.nodeIds.includes(match[1])) {
          currentCluster.nodeIds.push(match[1]);
        }
      }
    }
  }

  // Push last cluster
  if (currentCluster) {
    const node = graph.nodes.get(currentCluster.entryPoint);
    const valid = !!node && (
      (node.type === 'knowledge' && node.status === 'ACTIVE') ||
      (node.type === 'finding' && node.status === 'VALIDATED')
    );
    clusters.push({
      name: currentCluster.name,
      entryPoint: currentCluster.entryPoint,
      entryPointValid: valid,
      nodeIds: currentCluster.nodeIds,
    });
  }

  return clusters;
}

export async function loadContextForTopic(graphDir: string, topic: string): Promise<TopicContext> {
  const graph = await loadGraph(graphDir);
  const entryPoints: TopicContext['entryPoints'] = [];
  const openQuestions: TopicContext['openQuestions'] = [];
  const relatedNodes: TopicContext['relatedNodes'] = [];

  for (const [, node] of graph.nodes) {
    const tags = node.tags.map(t => t.toLowerCase());
    const titleLower = node.title.toLowerCase();
    const topicLower = topic.toLowerCase();

    if (!tags.includes(topicLower) && !titleLower.includes(topicLower)) continue;

    // Entry points: ACTIVE knowledge or VALIDATED findings
    if (
      (node.type === 'knowledge' && node.status === 'ACTIVE') ||
      (node.type === 'finding' && node.status === 'VALIDATED')
    ) {
      entryPoints.push({ id: node.id, title: node.title, type: node.type });
    }

    // Open questions
    if (node.type === 'question' && node.status === 'OPEN') {
      openQuestions.push({ id: node.id, title: node.title });
    }

    // All related
    relatedNodes.push({ id: node.id, title: node.title, type: node.type });
  }

  return { entryPoints, openQuestions, relatedNodes };
}

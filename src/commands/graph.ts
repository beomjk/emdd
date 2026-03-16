import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadGraph } from '../graph/loader.js';
import { generateMermaid } from '../graph/mermaid.js';

export interface GraphResult {
  nodeCount: number;
  edgeCount: number;
}

export async function graphCommand(graphDir: string): Promise<GraphResult> {
  const graph = await loadGraph(graphDir);
  const content = generateMermaid(graph);
  writeFileSync(join(graphDir, '_graph.mmd'), content, 'utf-8');

  let edgeCount = 0;
  for (const node of graph.nodes.values()) {
    for (const link of node.links) {
      if (graph.nodes.has(link.target)) {
        edgeCount++;
      }
    }
  }

  return { nodeCount: graph.nodes.size, edgeCount };
}

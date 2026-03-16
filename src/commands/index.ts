import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadGraph } from '../graph/loader.js';
import { generateIndex } from '../graph/index-generator.js';

export interface IndexResult {
  nodeCount: number;
}

export async function indexCommand(graphDir: string): Promise<IndexResult> {
  const graph = await loadGraph(graphDir);
  const content = generateIndex(graph);
  writeFileSync(join(graphDir, '_index.md'), content, 'utf-8');
  return { nodeCount: graph.nodes.size };
}

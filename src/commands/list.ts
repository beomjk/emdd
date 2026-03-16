import { resolveGraphDir } from '../graph/loader.js';
import { listNodes } from '../graph/operations.js';
import type { NodeFilter, NodeType } from '../graph/types.js';

export async function listCommand(
  targetPath: string | undefined,
  options: { type?: string; status?: string },
): Promise<void> {
  const graphDir = resolveGraphDir(targetPath);
  const filter: NodeFilter = {};
  if (options.type) filter.type = options.type as NodeType;
  if (options.status) filter.status = options.status.toUpperCase();

  const nodes = await listNodes(graphDir, filter);

  if (nodes.length === 0) {
    console.log('No nodes found.');
    return;
  }

  for (const node of nodes) {
    const status = node.status ?? '-';
    const conf = node.confidence !== null && node.confidence !== undefined
      ? ` (${node.confidence.toFixed(2)})`
      : '';
    console.log(`[${node.id}] ${node.title}  ${node.type}  ${status}${conf}`);
  }
}

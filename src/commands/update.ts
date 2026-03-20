import { updateNode } from '../graph/operations.js';

/**
 * Update frontmatter fields on a node.
 * Delegates to core updateNode() operation.
 */
export async function updateCommand(
  graphDir: string,
  nodeId: string,
  updates: Record<string, string>,
): Promise<void> {
  await updateNode(graphDir, nodeId, updates);
}

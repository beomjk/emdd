import { createEdge } from '../graph/operations.js';

/**
 * Add a link from source node to target node with the given relation.
 * Delegates to the pure operations.createEdge function.
 */
export async function linkCommand(
  graphDir: string,
  source: string,
  target: string,
  relation: string,
): Promise<void> {
  await createEdge(graphDir, source, target, relation);
}

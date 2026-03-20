import { deleteEdge } from '../graph/operations.js';

/**
 * Remove a link between nodes.
 * If relation is omitted, removes all links from source to target.
 */
export async function unlinkCommand(
  graphDir: string,
  source: string,
  target: string,
  relation?: string,
): Promise<void> {
  await deleteEdge(graphDir, source, target, relation);
}

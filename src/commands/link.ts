import { createEdge } from '../graph/operations.js';
import type { EdgeAttributes } from '../graph/types.js';

/**
 * Add a link from source node to target node with the given relation.
 * Delegates to the pure operations.createEdge function.
 */
export async function linkCommand(
  graphDir: string,
  source: string,
  target: string,
  relation: string,
  attrs?: EdgeAttributes,
): Promise<void> {
  await createEdge(graphDir, source, target, relation, attrs);
}

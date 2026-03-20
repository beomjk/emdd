import { markDone } from '../graph/operations.js';
import type { DoneMarker } from '../graph/types.js';

export type { DoneMarker };

/**
 * Mark a checklist item in an episode node with a marker.
 * Delegates to core markDone() operation.
 */
export async function doneCommand(
  graphDir: string,
  episodeId: string,
  item: string,
  marker: DoneMarker = 'done',
): Promise<void> {
  await markDone(graphDir, episodeId, item, marker);
}

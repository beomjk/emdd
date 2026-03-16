import { checkConsolidation } from '../graph/operations.js';
import type { CheckResult } from '../graph/types.js';

/**
 * Check consolidation triggers in the graph.
 * Delegates to the pure operations.checkConsolidation function.
 */
export async function checkCommand(graphDir: string): Promise<CheckResult> {
  return checkConsolidation(graphDir);
}

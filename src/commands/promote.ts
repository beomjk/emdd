import { getPromotionCandidates } from '../graph/operations.js';
import type { PromoteCandidate } from '../graph/types.js';

export interface PromoteResult {
  candidates: PromoteCandidate[];
}

/**
 * Identify findings eligible for promotion to knowledge.
 * Delegates to the pure operations.getPromotionCandidates function.
 */
export async function promoteCommand(graphDir: string): Promise<PromoteResult> {
  const candidates = await getPromotionCandidates(graphDir);
  return { candidates };
}

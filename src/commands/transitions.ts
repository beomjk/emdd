import { detectTransitions } from '../graph/transitions.js';
import type { TransitionRecommendation } from '../graph/transitions.js';

export async function transitionsCommand(graphDir: string): Promise<TransitionRecommendation[]> {
  return detectTransitions(graphDir);
}

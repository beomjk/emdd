import { propagateConfidence } from '../graph/confidence.js';
import type { ConfidenceResult } from '../graph/confidence.js';

export async function confidenceCommand(graphDir: string): Promise<ConfidenceResult[]> {
  return propagateConfidence(graphDir);
}

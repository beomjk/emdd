import { checkKillCriteria } from '../graph/kill-criterion.js';
import type { KillCriterionAlert } from '../graph/kill-criterion.js';

export async function killCheckCommand(graphDir: string): Promise<KillCriterionAlert[]> {
  return checkKillCriteria(graphDir);
}

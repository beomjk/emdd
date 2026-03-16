import { listBranchGroups } from '../graph/branch-groups.js';
import type { BranchGroup } from '../graph/branch-groups.js';

export async function branchesCommand(graphDir: string): Promise<BranchGroup[]> {
  return listBranchGroups(graphDir);
}

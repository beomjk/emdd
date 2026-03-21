import { z } from 'zod';
import { listBranchGroups } from '../../graph/operations.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const branchGroupsDef: CommandDef<typeof schema, unknown[]> = {
  name: 'branch-groups',
  description: { en: 'List hypothesis branch groups', ko: '가설 브랜치 그룹 목록' },
  category: 'analysis',
  schema,
  cli: { commandName: 'branches' },

  async execute(input) {
    return listBranchGroups(input.graphDir);
  },

  format(results, _locale) {
    const arr = results as Array<{ rootId: string; members: string[] }>;
    if (arr.length === 0) return 'No branch groups found.';
    return arr.map(g =>
      `${g.rootId}: ${g.members.join(', ')}`
    ).join('\n');
  },
};

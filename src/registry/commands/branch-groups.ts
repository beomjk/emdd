import { z } from 'zod';
import { listBranchGroups } from '../../graph/operations.js';
import type { BranchGroup } from '../../graph/branch-groups.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const branchGroupsDef: CommandDef<typeof schema, BranchGroup[]> = {
  name: 'branch-groups',
  description: { en: 'List hypothesis branch groups', ko: '가설 브랜치 그룹 목록' },
  category: 'analysis',
  schema,
  cli: { commandName: 'branches' },

  async execute(input) {
    return listBranchGroups(input.graphDir);
  },

  format(results, _locale) {
    if (results.length === 0) return t('format.no_branches');
    return results.map(g => {
      const memberIds = g.candidates.map(c => c.id).join(', ');
      const lines = [`${g.groupId}: ${memberIds}`];
      if (g.convergenceReady) {
        lines.push(`  ${t('format.convergence', { reason: g.convergenceReason })}`);
      }
      if (g.warnings.length > 0) {
        lines.push(...g.warnings.map(w => `  Warning: ${w}`));
      }
      return lines.join('\n');
    }).join('\n');
  },
};

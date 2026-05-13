import { z } from 'zod';
import { regenerateBacklog, type RegenerateBacklogResult } from '../../graph/backlog.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const backlogRegenerateDef: CommandDef<typeof schema, RegenerateBacklogResult> = {
  name: 'backlog-regenerate',
  description: 'Regenerate graph/_backlog.md from episode bodies + _backlog.meta.yml',
  category: 'write',
  schema,

  async execute(input) {
    return regenerateBacklog(input.graphDir);
  },

  format(result) {
    const lines = [
      `✓ _backlog.md regenerated`,
      `  - P0: ${result.byPriority.P0} items`,
      `  - P1: ${result.byPriority.P1} items`,
      `  - P2: ${result.byPriority.P2} items`,
      `  Total: ${result.totalItems} pending items`,
    ];
    return lines.join('\n');
  },
};

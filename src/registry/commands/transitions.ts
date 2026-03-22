import { z } from 'zod';
import { detectTransitions } from '../../graph/operations.js';
import type { TransitionRecommendation } from '../../graph/transitions.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const transitionsDef: CommandDef<typeof schema, TransitionRecommendation[]> = {
  name: 'transitions',
  description: 'Detect available status transitions',
  category: 'analysis',
  schema,
  mcp: { toolName: 'status-transitions' },

  async execute(input) {
    return detectTransitions(input.graphDir);
  },

  format(results) {
    if (results.length === 0) return t('format.no_transitions');
    return results.map(r =>
      `${r.nodeId} (${r.currentStatus}) → ${r.recommendedStatus}: ${r.reason}`
    ).join('\n');
  },
};

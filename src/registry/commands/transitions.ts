import { z } from 'zod';
import { detectTransitions } from '../../graph/operations.js';
import type { TransitionRecommendation } from '../../graph/transitions.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const transitionsDef: CommandDef<typeof schema, TransitionRecommendation[]> = {
  name: 'transitions',
  description: { en: 'Detect available status transitions', ko: '가능한 상태 전이 감지' },
  category: 'analysis',
  schema,
  mcp: { toolName: 'status-transitions' },

  async execute(input) {
    return detectTransitions(input.graphDir);
  },

  format(results, _locale) {
    if (results.length === 0) return 'No available transitions.';
    return results.map(r =>
      `${r.nodeId} (${r.currentStatus}) → ${r.recommendedStatus}: ${r.reason}`
    ).join('\n');
  },
};

import { z } from 'zod';
import { propagateConfidence } from '../../graph/operations.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

// Use unknown for ConfidenceResult since it's re-exported from confidence.ts
export const confidencePropagateDef: CommandDef<typeof schema, unknown[]> = {
  name: 'confidence-propagate',
  description: { en: 'Propagate confidence scores through the graph', ko: '그래프를 통한 신뢰도 전파' },
  category: 'analysis',
  schema,
  cli: { commandName: 'confidence' },

  async execute(input) {
    return propagateConfidence(input.graphDir);
  },

  format(results, _locale) {
    const arr = results as Array<{ nodeId: string; oldConfidence: number; newConfidence: number }>;
    if (arr.length === 0) return 'No confidence changes.';
    return arr.map(r =>
      `${r.nodeId}: ${r.oldConfidence.toFixed(2)} → ${r.newConfidence.toFixed(2)}`
    ).join('\n');
  },
};

import { z } from 'zod';
import { propagateConfidence } from '../../graph/operations.js';
import type { ConfidenceResult } from '../../graph/confidence.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const confidencePropagateDef: CommandDef<typeof schema, ConfidenceResult[]> = {
  name: 'confidence-propagate',
  description: { en: 'Propagate confidence scores through the graph', ko: '그래프를 통한 신뢰도 전파' },
  category: 'analysis',
  schema,
  cli: { commandName: 'confidence' },

  async execute(input) {
    return propagateConfidence(input.graphDir);
  },

  format(results, _locale) {
    if (results.length === 0) return t('format.no_confidence');
    return results.map(r =>
      `${r.nodeId}: ${r.oldConfidence.toFixed(2)} → ${r.newConfidence.toFixed(2)}`
    ).join('\n');
  },
};

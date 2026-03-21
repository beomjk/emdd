import { z } from 'zod';
import { analyzeRefutation } from '../../graph/operations.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const analyzeRefutationDef: CommandDef<typeof schema, unknown> = {
  name: 'analyze-refutation',
  description: { en: 'Analyze refutation patterns in the graph', ko: '그래프의 반증 패턴 분석' },
  category: 'analysis',
  schema,

  async execute(input) {
    return analyzeRefutation(input.graphDir);
  },

  format(result, _locale) {
    return JSON.stringify(result, null, 2);
  },
};

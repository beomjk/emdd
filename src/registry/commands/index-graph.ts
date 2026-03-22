import { z } from 'zod';
import { writeIndex } from '../../graph/operations.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

interface IndexResult {
  nodeCount: number;
}

export const indexGraphDef: CommandDef<typeof schema, IndexResult> = {
  name: 'index-graph',
  description: 'Generate the _index.md file',
  category: 'write',
  schema,
  cli: { commandName: 'index' },

  async execute(input) {
    return writeIndex(input.graphDir);
  },

  format(result) {
    return t('format.index_generated', { count: String(result.nodeCount) });
  },
};

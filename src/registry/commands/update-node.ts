import { z } from 'zod';
import { updateNode } from '../../graph/operations.js';
import type { UpdateNodeResult } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  nodeId: z.string().describe('Node ID to update (e.g., hyp-001)'),
  set: z.record(z.string(), z.string()).describe('Key-value pairs to set. Use dot-notation for nested fields.'),
  transitionPolicy: z.enum(['strict', 'warn', 'off']).optional().describe('Transition policy mode'),
});

export const updateNodeDef: CommandDef<typeof schema, UpdateNodeResult> = {
  name: 'update-node',
  description: 'Update frontmatter fields on a node',
  category: 'write',
  schema,
  cli: { commandName: 'update' },

  async execute(input) {
    const options = input.transitionPolicy ? { transitionPolicy: input.transitionPolicy } : undefined;
    return updateNode(input.graphDir, input.nodeId, input.set, options);
  },

  format(result) {
    return t('format.node_updated', { nodeId: result.nodeId, fields: result.updatedFields.join(', ') });
  },
};

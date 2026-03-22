import { z } from 'zod';
import { deleteEdge } from '../../graph/operations.js';
import type { DeleteEdgeResult } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  source: z.string().describe('Source node ID'),
  target: z.string().describe('Target node ID'),
  relation: z.string().optional().describe('Relation to delete (omit to delete all links to target)'),
});

export const deleteEdgeDef: CommandDef<typeof schema, DeleteEdgeResult> = {
  name: 'delete-edge',
  description: 'Remove a link between nodes',
  category: 'write',
  schema,
  cli: { commandName: 'unlink' },

  async execute(input) {
    return deleteEdge(input.graphDir, input.source, input.target, input.relation);
  },

  format(result) {
    return t('format.edge_deleted', { count: String(result.deletedCount), source: result.source, target: result.target });
  },
};

import { z } from 'zod';
import { createEdge } from '../../graph/operations.js';
import type { CreateEdgeResult, EdgeAttributes } from '../../graph/types.js';
import { ALL_VALID_RELATIONS, VALID_SEVERITIES, VALID_DEPENDENCY_TYPES, VALID_IMPACTS, EDGE_ATTRIBUTE_NAMES } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  source: z.string().describe('Source node ID'),
  target: z.string().describe('Target node ID'),
  relation: z.enum([...ALL_VALID_RELATIONS] as [string, ...string[]]).describe('Edge relation (supports, contradicts, etc.)'),
  strength: z.number().min(0).max(1).optional().describe('Link strength 0.0-1.0'),
  severity: z.enum(VALID_SEVERITIES).optional().describe('Severity'),
  completeness: z.number().min(0).max(1).optional().describe('Completeness 0.0-1.0'),
  dependencyType: z.enum(VALID_DEPENDENCY_TYPES).optional().describe('Dependency type'),
  impact: z.enum(VALID_IMPACTS).optional().describe('Impact'),
});

export const createEdgeDef: CommandDef<typeof schema, CreateEdgeResult> = {
  name: 'create-edge',
  description: 'Create an edge between two nodes',
  category: 'write',
  schema,
  cli: { commandName: 'link' },

  async execute(input) {
    const attrs: EdgeAttributes = {};
    for (const attr of EDGE_ATTRIBUTE_NAMES) {
      if (input[attr] !== undefined) (attrs as Record<string, unknown>)[attr] = input[attr];
    }
    const hasAttrs = Object.keys(attrs).length > 0;
    return createEdge(input.graphDir, input.source, input.target, input.relation, hasAttrs ? attrs : undefined);
  },

  format(result) {
    return t('format.link_created', { source: result.source, target: result.target, relation: result.relation });
  },
};

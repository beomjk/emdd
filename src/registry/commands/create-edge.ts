import { z } from 'zod';
import { createEdge } from '../../graph/operations.js';
import type { CreateEdgeResult, EdgeAttributes } from '../../graph/types.js';
import { ALL_VALID_RELATIONS, VALID_SEVERITIES, VALID_DEPENDENCY_TYPES, VALID_IMPACTS } from '../../graph/types.js';
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
  description: { en: 'Create an edge between two nodes', ko: '두 노드 사이에 에지 생성' },
  category: 'write',
  schema,
  cli: { commandName: 'link' },

  async execute(input) {
    const attrs: EdgeAttributes = {};
    if (input.strength !== undefined) attrs.strength = input.strength;
    if (input.severity !== undefined) attrs.severity = input.severity;
    if (input.completeness !== undefined) attrs.completeness = input.completeness;
    if (input.dependencyType !== undefined) attrs.dependencyType = input.dependencyType;
    if (input.impact !== undefined) attrs.impact = input.impact;
    const hasAttrs = Object.keys(attrs).length > 0;
    return createEdge(input.graphDir, input.source, input.target, input.relation, hasAttrs ? attrs : undefined);
  },

  format(result, _locale) {
    return t('format.link_created', { source: result.source, target: result.target, relation: result.relation });
  },
};

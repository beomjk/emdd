import { z } from 'zod';
import { createEdge } from '../../graph/operations.js';
import type { CreateEdgeResult, EdgeAttributes } from '../../graph/types.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  source: z.string().describe('Source node ID'),
  target: z.string().describe('Target node ID'),
  relation: z.string().describe('Edge relation (supports, contradicts, etc.)'),
  strength: z.number().min(0).max(1).optional().describe('Link strength 0.0-1.0'),
  severity: z.string().optional().describe('Severity: FATAL|WEAKENING|TENSION'),
  completeness: z.number().min(0).max(1).optional().describe('Completeness 0.0-1.0'),
  dependencyType: z.string().optional().describe('Type: LOGICAL|PRACTICAL|TEMPORAL'),
  impact: z.string().optional().describe('Impact: DECISIVE|SIGNIFICANT|MINOR'),
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
    if (input.severity) attrs.severity = input.severity as EdgeAttributes['severity'];
    if (input.completeness !== undefined) attrs.completeness = input.completeness;
    if (input.dependencyType) attrs.dependencyType = input.dependencyType as EdgeAttributes['dependencyType'];
    if (input.impact) attrs.impact = input.impact as EdgeAttributes['impact'];
    const hasAttrs = Object.keys(attrs).length > 0;
    return createEdge(input.graphDir, input.source, input.target, input.relation, hasAttrs ? attrs : undefined);
  },

  format(result, _locale) {
    return `Linked ${result.source} → ${result.target} [${result.relation}]`;
  },
};

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createEdge } from '../../graph/operations.js';
import type { EdgeAttributes } from '../../graph/types.js';
import { jsonResult, withErrorHandling } from './util.js';

export function registerCreateEdge(server: McpServer): void {
  server.tool(
    'create-edge',
    'Add an edge (link) from source to target with the given relation',
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      source: z.string().describe('Source node ID'),
      target: z.string().describe('Target node ID'),
      relation: z.string().describe('Relation type (supports, contradicts, spawns, etc.)'),
      strength: z.number().min(0).max(1).optional().describe('Link strength 0.0-1.0 (for supports/confirms)'),
      severity: z.enum(['FATAL', 'WEAKENING', 'TENSION']).optional().describe('Severity (for contradicts)'),
      completeness: z.number().min(0).max(1).optional().describe('Completeness 0.0-1.0 (for answers)'),
      dependencyType: z.enum(['LOGICAL', 'PRACTICAL', 'TEMPORAL']).optional().describe('Dependency type (for depends_on)'),
      impact: z.enum(['DECISIVE', 'SIGNIFICANT', 'MINOR']).optional().describe('Impact level (for informs)'),
    },
    async ({ graphDir, source, target, relation, ...rest }) =>
      withErrorHandling(async () => {
        const attrs: EdgeAttributes = {};
        if (rest.strength !== undefined) attrs.strength = rest.strength;
        if (rest.severity !== undefined) attrs.severity = rest.severity;
        if (rest.completeness !== undefined) attrs.completeness = rest.completeness;
        if (rest.dependencyType !== undefined) attrs.dependencyType = rest.dependencyType;
        if (rest.impact !== undefined) attrs.impact = rest.impact;
        const hasAttrs = Object.keys(attrs).length > 0;
        const result = await createEdge(graphDir, source, target, relation, hasAttrs ? attrs : undefined);
        return jsonResult(result);
      }),
  );
}

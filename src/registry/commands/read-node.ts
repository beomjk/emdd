import { z } from 'zod';
import { readNode } from '../../graph/operations.js';
import type { NodeDetail } from '../../graph/types.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  nodeId: z.string().describe('Node ID to read (e.g., hyp-001)'),
});

export const readNodeDef: CommandDef<typeof schema, NodeDetail> = {
  name: 'read-node',
  description: { en: 'Read a node detail', ko: '노드 상세 조회' },
  category: 'read',
  schema,
  cli: { commandName: 'read' },

  async execute(input) {
    const detail = await readNode(input.graphDir, input.nodeId);
    if (!detail) throw new Error(`Node not found: ${input.nodeId}`);
    return detail;
  },

  format(detail, _locale) {
    const lines: string[] = [];
    lines.push(`[${detail.id}] ${detail.title}`);
    lines.push(`  type: ${detail.type}  status: ${detail.status ?? '-'}`);
    if (detail.confidence != null) lines.push(`  confidence: ${detail.confidence}`);
    if (detail.tags.length > 0) lines.push(`  tags: ${detail.tags.join(', ')}`);
    if (detail.links.length > 0) {
      lines.push('  links:');
      for (const l of detail.links) lines.push(`    → ${l.target} [${l.relation}]`);
    }
    if (detail.body) lines.push('', detail.body);
    return lines.join('\n');
  },
};

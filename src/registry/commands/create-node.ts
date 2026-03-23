import { z } from 'zod';
import { createNode } from '../../graph/operations.js';
import { NODE_TYPES } from '../../graph/types.js';
import type { CreateNodeResult } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  type: z.enum(NODE_TYPES as unknown as [string, ...string[]]).describe('Node type (hypothesis, experiment, finding, etc.)'),
  slug: z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'Slug: alphanumeric start, then alphanumeric/dash/underscore').describe('URL-friendly slug for the node'),
  title: z.string().optional().describe('Human-readable title (default: slug)'),
  lang: z.string().optional().describe('Language locale (default: en)'),
});

export const createNodeDef: CommandDef<typeof schema, CreateNodeResult> = {
  name: 'create-node',
  description: 'Create a new node',
  category: 'write',
  schema,
  cli: { commandName: 'new', positional: ['type', 'slug'] },

  async execute(input) {
    return createNode(input.graphDir, input.type, input.slug, input.lang, input.title);
  },

  format(result) {
    return t('new.created', { type: result.type, id: result.id });
  },
};

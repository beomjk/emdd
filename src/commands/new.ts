import { resolveGraphDir } from '../graph/loader.js';
import { createNode } from '../graph/operations.js';
import { NODE_TYPES } from '../graph/types.js';
import type { NodeType } from '../graph/types.js';
import { t } from '../i18n/index.js';

export async function newCommand(
  type: string,
  slug: string,
  options: { path?: string },
): Promise<void> {
  // Validate type early for user-facing error message
  if (!NODE_TYPES.includes(type as NodeType)) {
    console.error(t('new.invalid_type', { type, valid: NODE_TYPES.join(', ') }));
    process.exit(1);
  }

  const graphDir = resolveGraphDir(options.path);
  const result = await createNode(graphDir, type, slug);
  console.log(t('new.created', { type: result.type, id: result.id }));
}

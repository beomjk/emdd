import fs from 'node:fs';
import { NODE_TYPES } from '../graph/types.js';
import type { NodeType } from '../graph/types.js';
import { nextId, renderTemplate, nodePath } from '../graph/templates.js';
import { resolveGraphDir } from '../graph/loader.js';
import { t } from '../i18n/index.js';

export function newCommand(
  type: string,
  slug: string,
  options: { path?: string },
): void {
  // Validate type
  if (!NODE_TYPES.includes(type as NodeType)) {
    console.error(t('new.invalid_type', { type, valid: NODE_TYPES.join(', ') }));
    process.exit(1);
  }

  const nodeType = type as NodeType;
  const graphDir = resolveGraphDir(options.path);
  const id = nextId(graphDir, nodeType);
  const content = renderTemplate(nodeType, slug, { id });
  const filePath = nodePath(graphDir, nodeType, id, slug);

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(t('new.created', { type: nodeType, id }));
}

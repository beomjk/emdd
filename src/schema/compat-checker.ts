// ── Compatibility Checker ────────────────────────────────────────────
// Checks existing graph/ Markdown files against a GraphSchema.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { GraphSchema } from './validator.js';
import type { ValidationError } from './validator.js';

export interface CompatResult {
  compatible: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export async function checkCompatibility(
  schema: GraphSchema,
  graphDir: string,
): Promise<CompatResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Build lookup sets
  const validTypes = new Set(schema.nodeTypes.map(n => n.name));
  const statusesByType = new Map(schema.nodeTypes.map(n => [n.name, new Set(n.statuses)]));
  const allRelations = new Set([
    ...schema.edgeTypes.forward,
    ...Object.keys(schema.edgeTypes.reverse),
  ]);

  // Get all subdirectories in graphDir
  let entries: string[];
  try {
    entries = await readdir(graphDir);
  } catch {
    // graphDir doesn't exist — skip with warning
    return { compatible: true, errors: [], warnings: [] };
  }

  for (const entry of entries) {
    const subdir = path.join(graphDir, entry);
    let files: string[];
    try {
      files = await readdir(subdir);
    } catch {
      continue; // not a directory
    }

    const mdFiles = files.filter(f => f.endsWith('.md'));
    for (const file of mdFiles) {
      const filePath = path.join(subdir, file);
      const relativePath = path.relative(graphDir, filePath);

      let raw: string;
      try {
        raw = await readFile(filePath, 'utf-8');
      } catch {
        continue;
      }

      let frontmatter: Record<string, unknown>;
      try {
        const parsed = matter(raw);
        frontmatter = parsed.data as Record<string, unknown>;
      } catch {
        continue;
      }

      const nodeType = frontmatter.type as string | undefined;
      const nodeStatus = frontmatter.status as string | undefined;

      // Check type
      if (nodeType && !validTypes.has(nodeType)) {
        warnings.push({
          path: relativePath,
          message: `uses type "${nodeType}" which is not in schema nodeTypes`,
          severity: 'WARNING',
        });
      }

      // Check status
      if (nodeType && nodeStatus && validTypes.has(nodeType)) {
        const validStatuses = statusesByType.get(nodeType);
        if (validStatuses && !validStatuses.has(nodeStatus)) {
          warnings.push({
            path: relativePath,
            message: `uses status "${nodeStatus}" which is not in ${nodeType} statuses`,
            severity: 'WARNING',
          });
        }
      }

      // Check link relations
      const links = frontmatter.links as Array<{ relation?: string }> | undefined;
      if (Array.isArray(links)) {
        for (const link of links) {
          if (link.relation && !allRelations.has(link.relation)) {
            warnings.push({
              path: relativePath,
              message: `uses relation "${link.relation}" which is not in schema edgeTypes`,
              severity: 'WARNING',
            });
          }
        }
      }
    }
  }

  return {
    compatible: errors.length === 0,
    errors,
    warnings,
  };
}

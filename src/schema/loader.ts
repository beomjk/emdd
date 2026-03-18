// ── Schema Loader ───────────────────────────────────────────────────
// Reads graph-schema.yaml, validates with Zod, returns typed GraphSchema.

import { accessSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { GraphSchemaZod, validateReferentialIntegrity, type GraphSchema } from './validator.js';

const DEFAULT_SCHEMA_FILENAME = 'graph-schema.yaml';

/**
 * Load and validate graph-schema.yaml.
 * @param schemaPath - Absolute or relative path to the YAML file.
 *                     Defaults to `graph-schema.yaml` resolved by walking up from cwd.
 */
export async function loadSchema(schemaPath?: string): Promise<GraphSchema> {
  const resolvedPath = schemaPath
    ? path.resolve(schemaPath)
    : findSchemaFile(process.cwd());

  const raw = await readFile(resolvedPath, 'utf-8');
  const parsed = yaml.load(raw);

  const result = GraphSchemaZod.safeParse(parsed);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(
      `graph-schema.yaml validation failed:\n${messages.join('\n')}`,
    );
  }

  // Referential integrity checks (Phase 2)
  const riErrors = validateReferentialIntegrity(result.data);
  if (riErrors.length > 0) {
    const messages = riErrors.map((e) => `  - ${e.path}: ${e.message}`);
    throw new Error(
      `graph-schema.yaml referential integrity errors:\n${messages.join('\n')}`,
    );
  }

  return result.data;
}

/**
 * Walk up from startDir looking for graph-schema.yaml.
 */
function findSchemaFile(startDir: string): string {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const candidate = path.join(current, DEFAULT_SCHEMA_FILENAME);
    try {
      accessSync(candidate);
      return candidate;
    } catch {
      current = path.dirname(current);
    }
  }

  throw new Error(
    `Could not find ${DEFAULT_SCHEMA_FILENAME} in any parent directory of ${startDir}`,
  );
}

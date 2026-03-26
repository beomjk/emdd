// ── Zod Introspection Helpers ───────────────────────────────────────
// Shared utilities for extracting type info from Zod schemas.
// Used by cli-adapter.ts and doc-tables.ts.

import type { z } from 'zod';

/** Get the Zod v4 schema type string via public API */
export function zodDefType(schema: z.ZodType): string {
  return schema.type;
}

/** Unwrap optional/default wrappers recursively to get the inner type */
export function unwrapZod(schema: z.ZodType): z.ZodType {
  let current = schema;
  while (current.type === 'optional' || current.type === 'default') {
    current = (current as z.ZodOptional | z.ZodDefault).unwrap() as z.ZodType;
  }
  return current;
}

/** Get enum values from a ZodEnum via public .options */
export function getEnumValues(schema: z.ZodType): string[] {
  return (schema as z.ZodEnum).options.map(String);
}

/** Describe a parameter key with optional marker: `key?` for optional/default, `key` for required. */
export function describeParam(key: string, zodField: z.ZodType): string {
  return zodField.isOptional() ? `${key}?` : key;
}

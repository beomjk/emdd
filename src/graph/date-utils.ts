/**
 * Normalize date fields in a frontmatter data object.
 * gray-matter parses YYYY-MM-DD strings as Date objects, which
 * matter.stringify() then writes as full ISO timestamps (2026-03-25T00:00:00.000Z).
 * This function converts Date instances back to YYYY-MM-DD strings.
 */
export function normalizeDateFields(data: Record<string, unknown>): void {
  for (const key of ['created', 'updated']) {
    const val = data[key];
    if (val instanceof Date) {
      data[key] = val.toISOString().slice(0, 10);
    }
  }
}

/**
 * Extract the effective date from a node: updated (preferred) or created (fallback).
 * Handles both string and Date values (gray-matter may return either).
 * Returns null if neither field is present or parseable.
 */
export function nodeDate(node: { meta: Record<string, unknown> }): Date | null {
  const raw = node.meta.updated ?? node.meta.created;
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

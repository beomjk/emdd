import fs from 'node:fs';
import matter from 'gray-matter';
import { loadGraph } from './loader.js';
import { ALL_VALID_RELATIONS, REVERSE_LABELS, EDGE_ATTRIBUTE_NAMES, EDGE_ATTRIBUTE_RANGES, EDGE_ATTRIBUTE_ENUM_VALUES } from './types.js';
import { checkEdgeAffinity, getPresentAttrKeys } from './edge-attrs.js';
import { normalizeDateFields } from './date-utils.js';
import { suggest } from '../utils/suggest.js';
import { executeOps } from './file-ops.js';
import type {
  EdgeAttributes,
  CreateEdgeResult,
  CreateEdgePlan,
  FileOp,
  DeleteEdgeResult,
} from './types.js';
import { t } from '../i18n/index.js';

// ── Edge validation helpers ────────────────────────────────────────

function validateEdgeAffinity(relation: string, attrs: EdgeAttributes): void {
  const violation = checkEdgeAffinity(relation, getPresentAttrKeys(attrs as unknown as Record<string, unknown>));
  if (!violation) return;

  if (violation.allowedAttrs === null) {
    throw new Error(t('error.edge_affinity_no_attrs', { relation, invalid: violation.invalidAttrs.join(', ') }));
  }
  throw new Error(t('error.edge_affinity_invalid_attr', { relation, allowed: violation.allowedAttrs.join(', '), invalid: violation.invalidAttrs.join(', ') }));
}

function validateEdgeAttributes(attrs: EdgeAttributes): void {
  // Numeric range checks driven by schema-declared EDGE_ATTRIBUTE_RANGES
  for (const [attrName, { min, max }] of Object.entries(EDGE_ATTRIBUTE_RANGES)) {
    const val = (attrs as Record<string, unknown>)[attrName];
    if (val !== undefined) {
      if (typeof val !== 'number' || isNaN(val) || (min !== undefined && val < min) || (max !== undefined && val > max)) {
        throw new Error(t('error.invalid_range', { attr: attrName, value: String(val), min: String(min ?? '-Infinity'), max: String(max ?? 'Infinity') }));
      }
    }
  }
  // Enum attribute checks (driven by schema-declared EDGE_ATTRIBUTE_ENUM_VALUES)
  for (const [attrName, validValues] of Object.entries(EDGE_ATTRIBUTE_ENUM_VALUES)) {
    const val = (attrs as Record<string, unknown>)[attrName];
    if (val !== undefined && !(validValues as readonly string[]).includes(String(val))) {
      throw new Error(t('error.invalid_enum_attr', { attr: attrName, value: String(val), valid: validValues.join(', ') }));
    }
  }
}

// ── planCreateEdge / createEdge ────────────────────────────────────

/**
 * Plan the creation of an edge (pure computation after graph load).
 */
export async function planCreateEdge(
  graphDir: string,
  source: string,
  target: string,
  relation: string,
  attrs?: EdgeAttributes,
  options?: { force?: boolean },
): Promise<CreateEdgePlan> {
  // Validate relation
  if (!ALL_VALID_RELATIONS.has(relation)) {
    const validArr = [...ALL_VALID_RELATIONS].sort();
    let msg = t('error.invalid_relation', { relation, valid: validArr.join(', ') });
    const s = suggest(relation, validArr);
    if (s) msg += t('error.did_you_mean', { suggestion: s });
    throw new Error(msg);
  }

  // Normalize reverse labels
  const canonical = REVERSE_LABELS[relation] ?? relation;

  const graph = await loadGraph(graphDir);
  const sourceNode = graph.nodes.get(source);
  if (!sourceNode) {
    throw new Error(t('error.source_not_found', { id: source }));
  }

  const targetNode = graph.nodes.get(target);
  if (!targetNode) {
    throw new Error(t('error.target_not_found', { id: target }));
  }

  const filePath = sourceNode.path;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);

  // Deep-clone data to avoid mutating gray-matter's internal cache
  const data: Record<string, unknown> = structuredClone(parsed.data);

  // Ensure links array exists
  if (!Array.isArray(data.links)) {
    data.links = [];
  }

  // Check for duplicate edge (same target + relation)
  if (!options?.force) {
    const duplicate = (data.links as { target: string; relation: string }[]).some(
      (l) => l.target === target && (REVERSE_LABELS[l.relation] ?? l.relation) === canonical,
    );
    if (duplicate) {
      return { source, target, relation: canonical, ops: [], skipped: true };
    }
  }

  // Add link with optional attributes
  const link: Record<string, unknown> = { target, relation: canonical };
  if (attrs) {
    validateEdgeAffinity(canonical, attrs);
    validateEdgeAttributes(attrs);
    for (const attr of EDGE_ATTRIBUTE_NAMES) {
      if (attrs[attr] !== undefined) link[attr] = attrs[attr];
    }
  }
  (data.links as unknown[]).push(link);

  // Auto-update the `updated` field
  data.updated = new Date().toISOString().slice(0, 10);

  // Compute new file content
  normalizeDateFields(data);
  const output = matter.stringify(parsed.content, data);
  const ops: FileOp[] = [{ kind: 'write', path: filePath, content: output }];

  return { source, target, relation: canonical, ops };
}

/**
 * Add an edge (link) from source to target with the given relation.
 * Validates relation, source existence, and target existence.
 * Optional attrs: strength, severity, completeness, dependencyType, impact.
 */
export async function createEdge(
  graphDir: string,
  source: string,
  target: string,
  relation: string,
  attrs?: EdgeAttributes,
  options?: { force?: boolean },
): Promise<CreateEdgeResult> {
  const plan = await planCreateEdge(graphDir, source, target, relation, attrs, options);
  await executeOps(plan.ops);
  const result: CreateEdgeResult = { source: plan.source, target: plan.target, relation: plan.relation };
  if (plan.skipped) result.skipped = true;
  if (attrs) {
    for (const attr of EDGE_ATTRIBUTE_NAMES) {
      if (attrs[attr] !== undefined) (result as unknown as Record<string, unknown>)[attr] = attrs[attr];
    }
  }
  return result;
}

// ── deleteEdge ─────────────────────────────────────────────────────

/**
 * Remove link(s) from source to target.
 * If relation is specified, removes only matching links.
 * If relation is omitted, removes all links from source to target.
 */
export async function deleteEdge(
  graphDir: string,
  source: string,
  target: string,
  relation?: string,
): Promise<DeleteEdgeResult> {
  let canonical: string | undefined;
  if (relation) {
    if (!ALL_VALID_RELATIONS.has(relation)) {
      const validArr = [...ALL_VALID_RELATIONS].sort();
      let msg = t('error.invalid_relation', { relation, valid: validArr.join(', ') });
      const s = suggest(relation, validArr);
      if (s) msg += t('error.did_you_mean', { suggestion: s });
      throw new Error(msg);
    }
    canonical = REVERSE_LABELS[relation] ?? relation;
  }

  const graph = await loadGraph(graphDir);
  const sourceNode = graph.nodes.get(source);
  if (!sourceNode) {
    throw new Error(t('error.source_not_found', { id: source }));
  }

  const targetNode = graph.nodes.get(target);
  if (!targetNode) {
    throw new Error(t('error.target_not_found', { id: target }));
  }

  const filePath = sourceNode.path;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const data: Record<string, unknown> = structuredClone(parsed.data);

  const links = Array.isArray(data.links) ? data.links as Record<string, unknown>[] : [];
  const deletedRelations: string[] = [];

  const remaining = links.filter(link => {
    const matches = canonical
      ? String(link.target) === target && String(link.relation) === canonical
      : String(link.target) === target;
    if (matches) {
      deletedRelations.push(String(link.relation));
    }
    return !matches;
  });

  if (deletedRelations.length === 0) {
    const relStr = relation ? ` with relation '${relation}'` : '';
    throw new Error(t('error.no_matching_link', { source, target, relation: relStr }));
  }

  data.links = remaining;
  data.updated = new Date().toISOString().slice(0, 10);

  normalizeDateFields(data);
  const output = matter.stringify(parsed.content, data);
  fs.writeFileSync(filePath, output);

  return { source, target, deletedCount: deletedRelations.length, deletedRelations };
}

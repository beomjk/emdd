import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { loadGraph } from './loader.js';
import { nextId, renderTemplate, nodePath, sanitizeSlug } from './templates.js';
import { NODE_TYPES, VALID_STATUSES, ENUM_FIELD_VALIDATORS, TRANSITION_POLICY_DEFAULT, TRANSITION_TABLE, MANUAL_TRANSITIONS } from './types.js';
import { engine } from './engine-setup.js';
import { normalizeDateFields } from './date-utils.js';
import { suggest } from '../utils/suggest.js';
import { executeOps } from './file-ops.js';
import { generateIndex as _generateIndex } from './index-generator.js';
import { saveConfig } from './config.js';
import type {
  NodeType,
  NodeWithStatus,
  CreateNodeResult,
  CreateNodePlan,
  FileOp,
  UpdateNodeResult,
  DoneMarker,
  MarkDoneResult,
  MarkConsolidatedResult,
} from './types.js';
import { t } from '../i18n/index.js';
import type { Locale } from '../i18n/index.js';

// ── planCreateNode / createNode ────────────────────────────────────

/**
 * Plan the creation of a new node (pure computation, no I/O).
 */
export function planCreateNode(
  graphDir: string,
  type: string,
  slug: string,
  lang?: string,
  title?: string,
  body?: string,
): CreateNodePlan {
  if (!NODE_TYPES.includes(type as NodeType)) {
    let msg = t('error.invalid_node_type', { type, valid: NODE_TYPES.join(', ') });
    const s = suggest(type, NODE_TYPES);
    if (s) msg += t('error.did_you_mean', { suggestion: s });
    throw new Error(msg);
  }

  const nodeType = type as NodeType;
  const id = nextId(graphDir, nodeType);
  const sanitized = sanitizeSlug(slug);
  const content = renderTemplate(nodeType, sanitized, {
    id,
    locale: (lang as Locale) ?? 'en',
    title,
    body,
  });
  const filePath = nodePath(graphDir, nodeType, id, sanitized);
  const dir = path.dirname(filePath);

  const ops: FileOp[] = [
    { kind: 'mkdir', path: dir },
    { kind: 'write', path: filePath, content },
  ];

  return { id, type: nodeType, path: filePath, ops };
}

/**
 * Create a new node of the given type with the given slug.
 * Returns the created node's ID, type, and file path.
 */
export async function createNode(
  graphDir: string,
  type: string,
  slug: string,
  lang?: string,
  title?: string,
  body?: string,
): Promise<CreateNodeResult> {
  const plan = planCreateNode(graphDir, type, slug, lang, title, body);
  await executeOps(plan.ops);
  return { id: plan.id, type: plan.type, path: plan.path };
}

// ── updateNode ─────────────────────────────────────────────────────

/**
 * Update frontmatter fields on a node.
 * Automatically sets `updated` to today's date.
 * Parses numeric strings for `confidence`.
 */
function setByDotPath(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const keys = dotPath.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (current[k] == null || typeof current[k] !== 'object' || Array.isArray(current[k])) {
      current[k] = {};
    }
    current = current[k] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

export async function updateNode(
  graphDir: string,
  nodeId: string,
  updates: Record<string, string>,
  options?: { transitionPolicy?: 'strict' | 'warn' | 'off' },
): Promise<UpdateNodeResult> {
  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(nodeId);

  if (!node) {
    throw new Error(t('error.node_not_found', { id: nodeId }));
  }

  const policy = options?.transitionPolicy ?? TRANSITION_POLICY_DEFAULT;
  const warnings: string[] = [];

  const filePath = node.path;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const data: Record<string, unknown> = structuredClone(parsed.data);

  // Deprecated: artifacts → outputs (will be removed in 0.2.0)
  if (node.type === 'experiment' && data.artifacts !== undefined) {
    if (data.outputs === undefined) {
      data.outputs = data.artifacts;
    }
    delete data.artifacts;
  }

  // NOTE: Transition validation uses the pre-update `node` state.
  // If a future transition rule uses `field_present` on a field being
  // updated in the same call, it would evaluate against stale data.
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'confidence') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 1) {
        throw new Error(t('error.invalid_confidence', { value }));
      }
      data[key] = num;
    } else if (key === 'status') {
      const validStatuses = VALID_STATUSES[node.type];
      if (!validStatuses.includes(value)) {
        let msg = t('error.invalid_status', { value, type: node.type, valid: validStatuses.join(', ') });
        const s = suggest(value, validStatuses as string[]);
        if (s) msg += t('error.did_you_mean', { suggestion: s });
        throw new Error(msg);
      }

      // Transition policy enforcement
      if (value !== node.status && policy !== 'off' && node.status) {
        const transitionRules = TRANSITION_TABLE[node.type];
        if (transitionRules) {
          const manualRules = MANUAL_TRANSITIONS[node.type];
          const result = engine.validate(node as NodeWithStatus, graph, transitionRules, value, manualRules);
          if (!result.valid) {
            // Determine violation type: no rule exists vs conditions unmet
            const hasRule = transitionRules.some(r => r.from === node.status && r.to === value);
            const validPaths = transitionRules
              .filter(r => r.from === node.status)
              .map(r => r.to);
            const manualPaths = (manualRules ?? [])
              .filter(r => r.from === 'ANY' || r.from === node.status)
              .map(r => r.to);
            const allPaths = [...new Set([...validPaths, ...manualPaths])];

            let message: string;
            if (hasRule) {
              const failedRule = transitionRules.find(r => r.from === node.status && r.to === value)!;
              const condDesc = failedRule.conditions.map(c => `${c.fn}(${JSON.stringify(c.args)})`).join(', ');
              message = t('error.transition_conditions_unmet', { from: node.status, to: value, conditions: condDesc });
            } else {
              message = t('error.transition_no_rule', { from: node.status, to: value, validPaths: allPaths.join(', ') || 'none' });
            }

            if (policy === 'strict') {
              throw new Error(message);
            } else {
              // warn mode
              warnings.push(message);
            }
          }
        }
        // Node types without transition rules (decision, episode) → enum-only, no rejection
      }

      data[key] = value;
    } else if (key in ENUM_FIELD_VALIDATORS) {
      const validValues = ENUM_FIELD_VALIDATORS[key];
      if (!(validValues as readonly string[]).includes(value)) {
        let msg = t('error.invalid_enum_value', { field: key, value, valid: validValues.join(', ') });
        const s = suggest(value, validValues);
        if (s) msg += t('error.did_you_mean', { suggestion: s });
        throw new Error(msg);
      }
      data[key] = value;
    } else if ((value.startsWith('[') || value.startsWith('{')) && value.length > 1) {
      try {
        setByDotPath(data, key, JSON.parse(value));
      } catch {
        setByDotPath(data, key, value);
      }
    } else {
      setByDotPath(data, key, value);
    }
  }

  const updatedDate = new Date().toISOString().slice(0, 10);
  data.updated = updatedDate;

  normalizeDateFields(data);
  const output = matter.stringify(parsed.content, data);
  fs.writeFileSync(filePath, output);

  const result: UpdateNodeResult = { nodeId, updatedFields: Object.keys(updates), updatedDate };
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

// ── markDone ───────────────────────────────────────────────────────

const VALID_MARKERS: DoneMarker[] = ['done', 'deferred', 'superseded'];
const COMPLETED_MARKERS = ['x', 'X', 'done', 'deferred', 'superseded'];

/**
 * Mark a checklist item in an episode node with a marker.
 * Finds `- [ ] {item}` in the body and replaces with `- [{marker}] {item}`.
 * Throws if the item is not found or already marked.
 */
export async function markDone(
  graphDir: string,
  episodeId: string,
  item: string,
  marker: DoneMarker = 'done',
): Promise<MarkDoneResult> {
  if (!VALID_MARKERS.includes(marker)) {
    throw new Error(t('error.invalid_marker', { marker, valid: VALID_MARKERS.join(', ') }));
  }

  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(episodeId);

  if (!node) {
    throw new Error(t('error.node_not_found', { id: episodeId }));
  }

  const filePath = node.path;
  const raw = fs.readFileSync(filePath, 'utf-8');

  const lines = raw.split('\n');
  const uncheckedMatches: number[] = [];
  const alreadyMarked: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(item)) {
      if (lines[i].includes('- [ ]')) {
        uncheckedMatches.push(i);
      } else {
        for (const m of COMPLETED_MARKERS) {
          if (lines[i].includes(`- [${m}]`)) {
            alreadyMarked.push(i);
            break;
          }
        }
      }
    }
  }

  if (uncheckedMatches.length === 0) {
    if (alreadyMarked.length > 0) {
      throw new Error(t('error.item_already_marked', { id: episodeId, item }));
    }
    throw new Error(t('error.item_not_found', { id: episodeId, item }));
  }

  if (uncheckedMatches.length > 1) {
    throw new Error(t('error.multiple_matches', { item, id: episodeId }));
  }

  lines[uncheckedMatches[0]] = lines[uncheckedMatches[0]].replace('- [ ]', `- [${marker}]`);

  fs.writeFileSync(filePath, lines.join('\n'));

  return { episodeId, item, marker };
}

// ── writeIndex ─────────────────────────────────────────────────────

/**
 * Generate and write the _index.md file for the graph directory.
 */
export async function writeIndex(graphDir: string): Promise<{ nodeCount: number }> {
  const graph = await loadGraph(graphDir);
  const indexContent = _generateIndex(graph);
  fs.writeFileSync(path.join(graphDir, '_index.md'), indexContent);
  return { nodeCount: graph.nodes.size };
}

// ── markConsolidated ──────────────────────────────────────────────

/**
 * Record a consolidation date to reset episode counting.
 */
export async function markConsolidated(graphDir: string, date?: string): Promise<MarkConsolidatedResult> {
  const d = date ?? new Date().toISOString().slice(0, 10);
  saveConfig(graphDir, { last_consolidation_date: d });
  return { date: d };
}

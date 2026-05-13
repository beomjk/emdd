import fs from 'node:fs';
import path, { join, sep } from 'node:path';
import { execSync } from 'node:child_process';
import { glob } from 'glob';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { NODE_TYPE_DIRS } from './types.js';

export type ItemMarker = 'pending' | 'done' | 'deferred' | 'superseded';

export interface BacklogItem {
  text: string;
  episodeId: string;
  marker: ItemMarker;
}

export interface BacklogResult {
  items: BacklogItem[];
}

const CHECKLIST_RE = /^- \[([ xX]|done|deferred|superseded)\]\s+(.+)/;

function parseMarker(raw: string): ItemMarker {
  if (raw === ' ') return 'pending';
  if (raw === 'x' || raw === 'X' || raw === 'done') return 'done';
  if (raw === 'deferred') return 'deferred';
  if (raw === 'superseded') return 'superseded';
  return 'pending';
}

export async function getBacklog(graphDir: string, statusFilter?: string): Promise<BacklogResult> {
  const episodeDir = join(graphDir, NODE_TYPE_DIRS.episode);
  // Use forward slashes for glob patterns (backslashes are escape chars in glob v10+)
  const pattern = join(episodeDir, '*.md').split(sep).join('/');
  const files = await glob(pattern, { nodir: true });
  const items: BacklogItem[] = [];

  for (const file of files.sort()) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch (err) {
      console.warn(`Warning: Could not read ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(content);
    } catch (err) {
      console.warn(`Warning: Could not parse ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const episodeId = parsed.data?.id ?? '';
    const body = parsed.content;

    for (const line of body.split('\n')) {
      const slugged = line.match(SLUG_PATTERN);
      const match = slugged ?? line.match(CHECKLIST_RE);
      if (match) {
        const marker = parseMarker(match[1]);
        const text = slugged ? slugged[3] : match[2];
        items.push({ text: text.trim(), episodeId, marker });
      }
    }
  }

  // Apply status filter
  if (statusFilter === 'all') {
    return { items };
  } else if (statusFilter === 'done') {
    return { items: items.filter(i => i.marker === 'done') };
  } else if (statusFilter === 'deferred') {
    return { items: items.filter(i => i.marker === 'deferred') };
  } else if (statusFilter === 'superseded') {
    return { items: items.filter(i => i.marker === 'superseded') };
  }

  return { items: items.filter(i => i.marker === 'pending') };
}

// ── Derived backlog view (_backlog.md) ─────────────────────────────
//
// See specs/010-ceremony-rhythm/contracts/backlog-view.md
// and data-model.md §E-4.

export type Priority = 'P0' | 'P1' | 'P2';
const PRIORITIES = ['P0', 'P1', 'P2'] as const;

function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

export interface BacklogMetaItem {
  priority?: Priority;
  pinned_by?: string;
  pinned_at?: string;
}

export interface BacklogMeta {
  version: 1;
  items: Record<string, BacklogMetaItem>;
}

export interface DerivedBacklogItem {
  slug: string;
  text: string;
  source_episode_id: string;
  first_seen: string;        // first-seen episode created date (YYYY-MM-DD), used for sorting
  first_seen_id: string;     // first-seen episode ID (rendered into _backlog.md)
  last_seen: string;
  last_seen_id: string;
  deferred_count: number;
  prerequisite_reading: string[];
}

export interface RenderedBacklogItem extends DerivedBacklogItem {
  priority: Priority;
}

export interface RegenerateBacklogResult {
  totalItems: number;
  byPriority: { P0: number; P1: number; P2: number };
  written: boolean;
}

const BACKLOG_MD = '_backlog.md';
const BACKLOG_META = '_backlog.meta.yml';

const SLUG_PATTERN = /^- \[([ xX]|done|deferred|superseded)\] \[([A-Za-z0-9][A-Za-z0-9_-]{0,31})\] (.+)$/;
const PLAIN_CHECKLIST = /^- \[([ xX]|done|deferred|superseded)\] (.+)$/;
const PREREQ_LINE = /^\s+-\s+Prerequisite reading:\s+(.+)$/i;

function autoSlugify(text: string, episodeId: string, lineNumber: number): string {
  let s = text.trim().toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/-{2,}/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  s = s.slice(0, 32);
  if (s.length === 0) {
    return `item-${episodeId}-${lineNumber}`;
  }
  return s;
}

interface RawCheckItem {
  rawSlug: string | null;
  text: string;
  marker: ItemMarker;
  episodeId: string;
  episodeDate: string;
  lineNumber: number;
  prerequisiteReading: string[];
}

function parseEpisodeChecklist(content: string, episodeId: string, episodeDate: string): RawCheckItem[] {
  const lines = content.split('\n');
  const items: RawCheckItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const slugged = line.match(SLUG_PATTERN);
    const plain = line.match(PLAIN_CHECKLIST);
    if (!slugged && !plain) continue;

    const marker = parseMarker(slugged ? slugged[1] : plain![1]);
    const rawSlug = slugged ? slugged[2] : null;
    const text = slugged ? slugged[3].trim() : plain![2].trim();

    // Look ahead for indented "Prerequisite reading: ..." line
    const prereq: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (next.trim() === '') continue;
      const m = next.match(PREREQ_LINE);
      if (m) {
        prereq.push(...m[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean));
        break;
      }
      // Non-indented line — end of this item
      if (!next.startsWith(' ') && !next.startsWith('\t')) break;
    }

    items.push({
      rawSlug,
      text,
      marker,
      episodeId,
      episodeDate,
      lineNumber: i + 1,
      prerequisiteReading: prereq,
    });
  }
  return items;
}

function toIsoDate(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

async function loadEpisodes(graphDir: string): Promise<Array<{ id: string; date: string; content: string }>> {
  const episodeDir = join(graphDir, NODE_TYPE_DIRS.episode);
  const pattern = join(episodeDir, '*.md').split(sep).join('/');
  const files = await glob(pattern, { nodir: true });
  const result: Array<{ id: string; date: string; content: string }> = [];
  for (const file of files.sort()) {
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf-8');
    } catch (err) {
      console.warn(`Skipped ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch (err) {
      console.warn(`Skipped ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const id = String(parsed.data?.id ?? '');
    const date = toIsoDate(parsed.data?.created ?? parsed.data?.updated);
    if (!id) continue;
    result.push({ id, date, content: parsed.content });
  }
  return result;
}

export async function deriveBacklog(graphDir: string): Promise<DerivedBacklogItem[]> {
  const episodes = await loadEpisodes(graphDir);

  // Sort by date ascending so first-seen tracking is correct
  episodes.sort((a, b) => a.date.localeCompare(b.date));

  // Map slug → aggregated info; collisions resolved later with -N suffix
  interface Aggregate {
    slug: string;
    text: string;
    source_episode_id: string;
    first_seen: string;
    first_seen_id: string;
    last_seen: string;
    last_seen_id: string;
    deferred_count: number;
    prerequisite_reading: string[];
    isPending: boolean;
  }

  // Same slug+text is one logical item across episodes. Same slug with
  // different text gets a deterministic suffix and must reuse it later.
  const keyByIdentity = new Map<string, string>();
  const slugUseCount = new Map<string, number>();
  const aggregates = new Map<string, Aggregate>();

  for (const ep of episodes) {
    const items = parseEpisodeChecklist(ep.content, ep.id, ep.date);
    for (const it of items) {
      const baseSlug = it.rawSlug ?? autoSlugify(it.text, it.episodeId, it.lineNumber);
      const identity = `${baseSlug}\0${it.text}`;
      let key = keyByIdentity.get(identity);
      if (!key) {
        key = baseSlug;
        if (aggregates.has(key)) {
          let n = (slugUseCount.get(baseSlug) ?? 1) + 1;
          while (aggregates.has(`${baseSlug}-${n}`)) n++;
          slugUseCount.set(baseSlug, n);
          key = `${baseSlug}-${n}`;
        } else {
          slugUseCount.set(baseSlug, 1);
        }
        keyByIdentity.set(identity, key);
      }

      const existing = aggregates.get(key);
      if (!existing) {
        aggregates.set(key, {
          slug: key,
          text: it.text,
          source_episode_id: it.episodeId,
          first_seen: it.episodeDate,
          first_seen_id: it.episodeId,
          last_seen: it.episodeDate,
          last_seen_id: it.episodeId,
          deferred_count: it.marker === 'deferred' ? 1 : 0,
          prerequisite_reading: [...it.prerequisiteReading],
          isPending: it.marker === 'pending' || it.marker === 'deferred',
        });
      } else {
        if (it.episodeDate > existing.last_seen) {
          existing.last_seen = it.episodeDate;
          existing.last_seen_id = it.episodeId;
        }
        if (it.episodeDate < existing.first_seen) {
          existing.first_seen = it.episodeDate;
          existing.first_seen_id = it.episodeId;
          existing.source_episode_id = it.episodeId;
        }
        if (it.marker === 'deferred') existing.deferred_count++;
        if (it.marker === 'done' || it.marker === 'superseded') existing.isPending = false;
        if (it.marker === 'pending' || it.marker === 'deferred') existing.isPending = true;
        for (const p of it.prerequisiteReading) {
          if (!existing.prerequisite_reading.includes(p)) existing.prerequisite_reading.push(p);
        }
      }
    }
  }

  // Only keep pending items
  const items: DerivedBacklogItem[] = [];
  for (const agg of aggregates.values()) {
    if (!agg.isPending) continue;
    items.push({
      slug: agg.slug,
      text: agg.text,
      source_episode_id: agg.source_episode_id,
      first_seen: agg.first_seen,
      first_seen_id: agg.first_seen_id,
      last_seen: agg.last_seen,
      last_seen_id: agg.last_seen_id,
      deferred_count: agg.deferred_count,
      prerequisite_reading: agg.prerequisite_reading,
    });
  }
  return items;
}

export function loadBacklogMeta(graphDir: string): BacklogMeta {
  const file = path.join(graphDir, BACKLOG_META);
  if (!fs.existsSync(file)) return { version: 1, items: {} };
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = yaml.load(raw) as BacklogMeta | null;
    if (!parsed || typeof parsed !== 'object') return { version: 1, items: {} };
    const rawItems = parsed.items && typeof parsed.items === 'object' && !Array.isArray(parsed.items)
      ? parsed.items as Record<string, unknown>
      : {};
    const items: Record<string, BacklogMetaItem> = {};
    for (const [slug, value] of Object.entries(rawItems)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        console.warn(`Warning: ignored invalid ${BACKLOG_META} entry for ${slug}`);
        continue;
      }
      const rawItem = value as Record<string, unknown>;
      const item: BacklogMetaItem = {};
      if (rawItem.priority !== undefined) {
        if (isPriority(rawItem.priority)) {
          item.priority = rawItem.priority;
        } else {
          console.warn(`Warning: ignored invalid priority for ${slug}: ${String(rawItem.priority)}`);
        }
      }
      if (typeof rawItem.pinned_by === 'string') item.pinned_by = rawItem.pinned_by;
      if (typeof rawItem.pinned_at === 'string') item.pinned_at = rawItem.pinned_at;
      items[slug] = item;
    }
    return { version: 1, items };
  } catch (err) {
    console.warn(`Warning: failed to parse ${BACKLOG_META}: ${err instanceof Error ? err.message : String(err)}`);
    return { version: 1, items: {} };
  }
}

export function saveBacklogMeta(graphDir: string, meta: BacklogMeta): void {
  const file = path.join(graphDir, BACKLOG_META);
  // Sort keys deterministically for byte-stable output
  const sortedItems: Record<string, BacklogMetaItem> = {};
  for (const key of Object.keys(meta.items).sort()) {
    sortedItems[key] = meta.items[key];
  }
  const out: BacklogMeta = { version: 1, items: sortedItems };
  fs.writeFileSync(file, yaml.dump(out, { lineWidth: -1, sortKeys: false }), 'utf-8');
}

export function mergeWithMeta(
  derived: DerivedBacklogItem[],
  meta: BacklogMeta,
): { items: RenderedBacklogItem[]; cleanedMeta: BacklogMeta } {
  const derivedSlugs = new Set(derived.map(d => d.slug));
  const cleanedItems: Record<string, BacklogMetaItem> = {};
  for (const [slug, val] of Object.entries(meta.items)) {
    if (derivedSlugs.has(slug) || val.pinned_at) {
      // Keep entries that are still present OR explicitly pinned (pre-pin survives ghost cleanup)
      cleanedItems[slug] = val;
    }
  }

  const items: RenderedBacklogItem[] = derived.map(d => {
    const m = cleanedItems[d.slug];
    const priority: Priority = m && isPriority(m.priority) ? m.priority : 'P1';
    return { ...d, priority };
  });

  return { items, cleanedMeta: { version: 1, items: cleanedItems } };
}

export function renderBacklogMarkdown(items: RenderedBacklogItem[], todayIso: string): string {
  const header = `<!-- Generated by EMDD — DO NOT EDIT. Source of truth: episode bodies. -->\n# Active Backlog\n\nUpdated: ${todayIso}\n`;

  if (items.length === 0) {
    return `${header}\nNo pending items.\n`;
  }

  // Group by priority + sort within priority
  const buckets: Record<Priority, RenderedBacklogItem[]> = { P0: [], P1: [], P2: [] };
  for (const item of items) {
    buckets[item.priority].push(item);
  }
  for (const p of ['P0', 'P1', 'P2'] as const) {
    buckets[p].sort((a, b) => {
      if (a.first_seen !== b.first_seen) return a.first_seen.localeCompare(b.first_seen);
      return a.slug.localeCompare(b.slug);
    });
  }

  const sections: string[] = [];
  for (const p of ['P0', 'P1', 'P2'] as const) {
    if (buckets[p].length === 0) continue;
    const lines = [`## ${p}`];
    for (const item of buckets[p]) {
      lines.push(`- \`[${item.slug}]\` ${item.text}`);
      lines.push(`  - first_seen: ${item.first_seen_id} · last_seen: ${item.last_seen_id} · deferred: ${item.deferred_count}`);
      if (item.prerequisite_reading.length > 0) {
        lines.push(`  - Prerequisite reading: ${item.prerequisite_reading.join(', ')}`);
      }
    }
    sections.push(lines.join('\n'));
  }

  return `${header}\n${sections.join('\n\n')}\n`;
}

export async function regenerateBacklog(graphDir: string): Promise<RegenerateBacklogResult> {
  const derived = await deriveBacklog(graphDir);
  const meta = loadBacklogMeta(graphDir);
  const { items, cleanedMeta } = mergeWithMeta(derived, meta);

  const today = new Date().toISOString().slice(0, 10);
  const md = renderBacklogMarkdown(items, today);

  const mdFile = path.join(graphDir, BACKLOG_MD);
  fs.writeFileSync(mdFile, md, 'utf-8');

  // Save cleaned meta only if it differs (avoid writing on every regen if no meta).
  const metaFile = path.join(graphDir, BACKLOG_META);
  const metaChanged = JSON.stringify(meta) !== JSON.stringify(cleanedMeta);
  if (metaChanged || fs.existsSync(metaFile)) {
    saveBacklogMeta(graphDir, cleanedMeta);
  }

  const byPriority = { P0: 0, P1: 0, P2: 0 };
  for (const item of items) byPriority[item.priority]++;

  return {
    totalItems: items.length,
    byPriority,
    written: true,
  };
}

export async function pinBacklogItem(
  graphDir: string,
  itemId: string,
  priority: Priority,
  pinnedBy: string,
): Promise<{ pinnedItem: string; priority: Priority; totalPinned: number; warning?: string }> {
  const meta = loadBacklogMeta(graphDir);
  const today = new Date().toISOString().slice(0, 10);

  meta.items[itemId] = {
    ...(meta.items[itemId] ?? {}),
    priority,
    pinned_by: pinnedBy,
    pinned_at: today,
  };
  saveBacklogMeta(graphDir, meta);

  // Check if the item exists in the current derived backlog
  const derived = await deriveBacklog(graphDir);
  const exists = derived.some(d => d.slug === itemId);
  const warning = exists ? undefined : `item ${itemId} not in current backlog, pin saved for future appearance`;

  // Always trigger a regen so the new pin lands in _backlog.md
  await regenerateBacklog(graphDir);

  const totalPinned = Object.values(meta.items).filter(i => i.pinned_at).length;
  return { pinnedItem: itemId, priority, totalPinned, warning };
}

export function detectGitUser(): string {
  // Best-effort: read git config; fallback to env or 'human:unknown'
  try {
    const name = execSync('git config user.name', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (name) return `human:${name}`;
  } catch {
    // ignore
  }
  return `human:${process.env.USER ?? 'unknown'}`;
}

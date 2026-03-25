import path from 'node:path';
import fs from 'node:fs';
import type { NodeType } from './types.js';
import { NODE_TYPE_DIRS, ID_PREFIXES, VALID_STATUSES, RISK_LEVEL, FINDING_TYPE, URGENCY, REVERSIBILITY } from './types.js';
import type { Locale } from '../i18n/index.js';

// ── sanitizeSlug ──────────────────────────────────────────────────

export function sanitizeSlug(slug: string): string {
  let s = slug.replace(/[\/\\\.]+/g, '-');
  s = s.replace(/[^a-zA-Z0-9_-]/g, '');
  s = s.replace(/-{2,}/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  s = s.slice(0, 80);
  if (s.length === 0) throw new Error('Slug is empty after sanitization');
  return s;
}

// ── Body templates per type and locale ─────────────────────────────

const BODY_TEMPLATES: Record<string, Record<NodeType, string>> = {
  en: {
    hypothesis: '## Hypothesis\n\n\n\n## Rationale\n\n',
    experiment: '## Design\n\n\n\n## Results\n\n',
    finding: '## Summary\n\n\n\n## Evidence\n\n',
    knowledge: '## Content\n\n\n\n## Source\n\n',
    question: '## Question\n\n\n\n## Context\n\n',
    decision: '## Decision\n\n\n\n## Rationale\n\n## Alternatives\n\n',
    episode: '## Goals\n\n- [ ] \n\n## Notes\n\n',
  },
  ko: {
    hypothesis: '## 가설\n\n\n\n## 근거\n\n',
    experiment: '## 설계\n\n\n\n## 결과\n\n',
    finding: '## 요약\n\n\n\n## 근거\n\n',
    knowledge: '## 내용\n\n\n\n## 출처\n\n',
    question: '## 질문\n\n\n\n## 맥락\n\n',
    decision: '## 결정\n\n\n\n## 근거\n\n## 대안\n\n',
    episode: '## 목표\n\n- [ ] \n\n## 메모\n\n',
  },
};

// Types that get a confidence field
const CONFIDENCE_TYPES: Partial<Record<NodeType, number>> = {
  hypothesis: 0.5,
  finding: 0.5,
  knowledge: 0.9,
};

// ── renderTemplate ─────────────────────────────────────────────────

export function renderTemplate(
  type: NodeType,
  slug: string,
  options?: { locale?: Locale; user?: string; id?: string; title?: string; body?: string },
): string {
  const locale = options?.locale ?? 'en';
  const today = new Date().toISOString().slice(0, 10);
  const defaultStatus = VALID_STATUSES[type][0];

  // Build frontmatter data
  const data: Record<string, unknown> = {
    type,
    title: options?.title ?? slug,
    status: defaultStatus,
    created: today,
    updated: today,
    tags: [],
    links: [],
  };

  if (options?.id) {
    data.id = options.id;
  }

  const confidence = CONFIDENCE_TYPES[type];
  if (confidence !== undefined) {
    data.confidence = confidence;
  }

  // Build body
  const body = options?.body ?? (BODY_TEMPLATES[locale]?.[type] ?? BODY_TEMPLATES['en'][type]);

  // Type-specific fields
  const typeFields: Record<string, unknown> = {};
  switch (type) {
    case 'hypothesis':
      typeFields.kill_criterion = '';
      typeFields.risk_level = RISK_LEVEL.high;
      typeFields.priority = 1;
      break;
    case 'finding':
      typeFields.finding_type = FINDING_TYPE.observation;
      typeFields.sources = [];
      break;
    case 'question':
      typeFields.question_type = '';
      typeFields.urgency = URGENCY.MEDIUM;
      typeFields.answer_summary = '';
      break;
    case 'episode':
      typeFields.trigger = '';
      typeFields.duration = '';
      typeFields.outcome = 'success';
      typeFields.spawned = [];
      typeFields.dead_ends = [];
      break;
    case 'decision':
      typeFields.rationale = '';
      typeFields.alternatives_considered = [];
      typeFields.reversibility = REVERSIBILITY.medium;
      break;
    case 'experiment':
      typeFields.config = {};
      typeFields.results = {};
      typeFields.inputs = [];
      typeFields.outputs = [];
      break;
    case 'knowledge':
      typeFields.knowledge_type = '';
      typeFields.source = '';
      break;
  }

  // Manually build YAML frontmatter to keep control over formatting
  const lines: string[] = ['---'];
  if (data.id) lines.push(`id: ${data.id}`);
  lines.push(`type: ${data.type}`);
  lines.push(`title: "${String(data.title).replace(/"/g, '\\"')}"`);
  lines.push(`status: ${data.status}`);
  if (confidence !== undefined) {
    lines.push(`confidence: ${data.confidence}`);
  }
  // Type-specific fields
  for (const [key, value] of Object.entries(typeFields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: []`);
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${key}: {}`);
    } else if (typeof value === 'string') {
      lines.push(`${key}: "${String(value).replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push(`created: ${data.created}`);
  lines.push(`updated: ${data.updated}`);
  lines.push(`tags: []`);
  lines.push(`links: []`);
  lines.push('---');
  lines.push('');
  lines.push(body);

  return lines.join('\n');
}

// ── nextId ─────────────────────────────────────────────────────────

export function nextId(graphDir: string, type: NodeType): string {
  const prefix = ID_PREFIXES[type];
  const typeDir = NODE_TYPE_DIRS[type];
  const dirPath = path.join(graphDir, typeDir);

  let maxNum = 0;

  try {
    const files = fs.readdirSync(dirPath);
    const pattern = new RegExp(`^${prefix}-(\\d+)`);
    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  } catch {
    // Directory doesn't exist or is empty — start at 0
  }

  const next = (maxNum + 1).toString().padStart(3, '0');
  return `${prefix}-${next}`;
}

// ── nodePath ───────────────────────────────────────────────────────

export function nodePath(
  graphDir: string,
  type: NodeType,
  id: string,
  slug: string,
): string {
  const typeDir = NODE_TYPE_DIRS[type];
  return path.join(graphDir, typeDir, `${id}-${sanitizeSlug(slug)}.md`);
}

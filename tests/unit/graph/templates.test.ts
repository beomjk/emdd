import { describe, it, expect } from 'vitest';
import matter from 'gray-matter';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, nextId, nodePath, sanitizeSlug } from '../../../src/graph/templates.js';
import { NODE_TYPES } from '../../../src/graph/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../fixtures');

describe('renderTemplate', () => {
  it.each(NODE_TYPES)('generates English template for %s type', (type) => {
    const output = renderTemplate(type, 'test-slug', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.type).toBe(type);
    expect(parsed.data.status).toBeDefined();
    expect(parsed.data.created).toBeDefined();
    expect(parsed.data.updated).toBeDefined();
    // frontmatter should be parseable
    expect(typeof parsed.content).toBe('string');
  });

  it.each(NODE_TYPES)('generates Korean template for %s type', (type) => {
    const output = renderTemplate(type, 'test-slug', { locale: 'ko' });
    const parsed = matter(output);
    expect(parsed.data.type).toBe(type);
    // body should contain Korean text
    expect(parsed.content).toMatch(/[가-힣]/);
  });

  it('hypothesis template includes confidence field', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.confidence).toBeDefined();
    expect(typeof parsed.data.confidence).toBe('number');
  });

  it('finding template includes confidence field', () => {
    const output = renderTemplate('finding', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.confidence).toBeDefined();
  });

  it('experiment template does not include confidence field', () => {
    const output = renderTemplate('experiment', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.confidence).toBeUndefined();
  });

  it('title includes the slug', () => {
    const output = renderTemplate('hypothesis', 'my-test-slug', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.title).toContain('my-test-slug');
  });

  it('uses custom title when provided', () => {
    const output = renderTemplate('hypothesis', 'my-slug', { locale: 'en', title: '수면이 기억에 미치는 영향' });
    const parsed = matter(output);
    expect(parsed.data.title).toBe('수면이 기억에 미치는 영향');
  });

  it('falls back to slug when title is not provided', () => {
    const output = renderTemplate('hypothesis', 'my-slug', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.title).toBe('my-slug');
  });

  it('handles title with double quotes', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en', title: 'My "quoted" title' });
    const parsed = matter(output);
    expect(parsed.data.title).toBe('My "quoted" title');
  });

  it('initializes links as empty array', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.links).toEqual([]);
  });

  it('initializes tags as empty array', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.tags).toEqual([]);
  });

  it('episode template includes checklist', () => {
    const output = renderTemplate('episode', 'test', { locale: 'en' });
    expect(output).toContain('- [ ]');
  });
});

describe('type-specific template fields', () => {
  it('hypothesis template includes kill_criterion, risk_level, priority', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.kill_criterion).toBeDefined();
    expect(parsed.data.risk_level).toBeDefined();
    expect(parsed.data.priority).toBeDefined();
  });

  it('hypothesis template risk_level defaults to high', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.risk_level).toBe('high');
  });

  it('finding template finding_type defaults to observation', () => {
    const output = renderTemplate('finding', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.finding_type).toBe('observation');
  });

  it('question template urgency defaults to MEDIUM', () => {
    const output = renderTemplate('question', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.urgency).toBe('MEDIUM');
  });

  it('finding template includes finding_type: observation', () => {
    const output = renderTemplate('finding', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.finding_type).toBe('observation');
  });

  it('question template includes urgency: MEDIUM', () => {
    const output = renderTemplate('question', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.urgency).toBe('MEDIUM');
  });

  it('episode template includes trigger, outcome', () => {
    const output = renderTemplate('episode', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data).toHaveProperty('trigger');
    expect(parsed.data).toHaveProperty('outcome');
  });

  it('decision template includes alternatives_considered, reversibility', () => {
    const output = renderTemplate('decision', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.alternatives_considered).toEqual([]);
    expect(parsed.data.reversibility).toBe('medium');
  });

  it('experiment template includes config (empty object or omitted)', () => {
    const output = renderTemplate('experiment', 'test', { locale: 'en' });
    const parsed = matter(output);
    // config can be empty object or absent, but template should have it
    expect(parsed.data).toHaveProperty('config');
  });

  it('knowledge template includes knowledge_type and source', () => {
    const output = renderTemplate('knowledge', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data).toHaveProperty('knowledge_type');
    expect(parsed.data).toHaveProperty('source');
  });

  it('episode template includes spawned and dead_ends', () => {
    const output = renderTemplate('episode', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data).toHaveProperty('spawned');
    expect(parsed.data).toHaveProperty('dead_ends');
    expect(parsed.data.spawned).toEqual([]);
    expect(parsed.data.dead_ends).toEqual([]);
  });

  it('finding template includes sources', () => {
    const output = renderTemplate('finding', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data).toHaveProperty('sources');
    expect(parsed.data.sources).toEqual([]);
  });

  it('decision template includes rationale', () => {
    const output = renderTemplate('decision', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data).toHaveProperty('rationale');
  });

  it('episode template includes duration', () => {
    const output = renderTemplate('episode', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data).toHaveProperty('duration');
  });

  it('question template includes question_type and answer_summary', () => {
    const output = renderTemplate('question', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data).toHaveProperty('question_type');
    expect(parsed.data).toHaveProperty('answer_summary');
  });

  it('experiment template includes results and artifacts', () => {
    const output = renderTemplate('experiment', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data).toHaveProperty('results');
    expect(parsed.data).toHaveProperty('artifacts');
  });
});

describe('nextId', () => {
  it('returns 001 for empty directory', () => {
    const id = nextId(path.join(FIXTURES, 'empty-graph'), 'hypothesis');
    expect(id).toBe('hyp-001');
  });

  it('returns next number when nodes already exist', () => {
    const id = nextId(path.join(FIXTURES, 'sample-graph'), 'hypothesis');
    expect(id).toBe('hyp-003');
  });

  it('uses correct prefix for each type', () => {
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'experiment')).toBe('exp-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'finding')).toBe('fnd-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'knowledge')).toBe('knw-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'question')).toBe('qst-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'decision')).toBe('dec-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'episode')).toBe('epi-001');
  });
});

describe('sanitizeSlug', () => {
  it('removes path traversal characters', () => {
    expect(sanitizeSlug('../../etc/passwd')).toBe('etc-passwd');
  });

  it('removes special characters', () => {
    expect(sanitizeSlug('hello@world!#$%')).toBe('helloworld');
  });

  it('collapses repeated hyphens into single hyphen', () => {
    expect(sanitizeSlug('foo---bar')).toBe('foo-bar');
  });

  it('throws error for empty result', () => {
    expect(() => sanitizeSlug('...')).toThrow('Slug is empty after sanitization');
  });

  it('truncates slugs exceeding 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeSlug(long).length).toBe(80);
  });

  it('returns valid slug as-is', () => {
    expect(sanitizeSlug('my-valid-slug_01')).toBe('my-valid-slug_01');
  });
});

describe('nodePath', () => {
  it('generates correct path', () => {
    const p = nodePath('/project/graph', 'hypothesis', 'hyp-001', 'test-slug');
    expect(p).toBe('/project/graph/hypotheses/hyp-001-test-slug.md');
  });

  it('uses correct directory for each type', () => {
    expect(nodePath('/g', 'experiment', 'exp-001', 's')).toBe('/g/experiments/exp-001-s.md');
    expect(nodePath('/g', 'finding', 'fnd-001', 's')).toBe('/g/findings/fnd-001-s.md');
    expect(nodePath('/g', 'knowledge', 'knw-001', 's')).toBe('/g/knowledge/knw-001-s.md');
    expect(nodePath('/g', 'episode', 'epi-001', 's')).toBe('/g/episodes/epi-001-s.md');
  });
});

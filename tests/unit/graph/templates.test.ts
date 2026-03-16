import { describe, it, expect } from 'vitest';
import matter from 'gray-matter';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, nextId, nodePath, sanitizeSlug } from '../../../src/graph/templates.js';
import { NODE_TYPES } from '../../../src/graph/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../fixtures');

describe('renderTemplate', () => {
  it.each(NODE_TYPES)('%s 타입 영문 템플릿을 생성한다', (type) => {
    const output = renderTemplate(type, 'test-slug', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.type).toBe(type);
    expect(parsed.data.status).toBeDefined();
    expect(parsed.data.created).toBeDefined();
    expect(parsed.data.updated).toBeDefined();
    // frontmatter should be parseable
    expect(typeof parsed.content).toBe('string');
  });

  it.each(NODE_TYPES)('%s 타입 한국어 템플릿을 생성한다', (type) => {
    const output = renderTemplate(type, 'test-slug', { locale: 'ko' });
    const parsed = matter(output);
    expect(parsed.data.type).toBe(type);
    // body should contain Korean text
    expect(parsed.content).toMatch(/[가-힣]/);
  });

  it('hypothesis 템플릿에 confidence 필드가 포함된다', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.confidence).toBeDefined();
    expect(typeof parsed.data.confidence).toBe('number');
  });

  it('finding 템플릿에 confidence 필드가 포함된다', () => {
    const output = renderTemplate('finding', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.confidence).toBeDefined();
  });

  it('experiment 템플릿에 confidence 필드가 없다', () => {
    const output = renderTemplate('experiment', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.confidence).toBeUndefined();
  });

  it('title에 slug가 포함된다', () => {
    const output = renderTemplate('hypothesis', 'my-test-slug', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.title).toContain('my-test-slug');
  });

  it('links가 빈 배열로 초기화된다', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.links).toEqual([]);
  });

  it('tags가 빈 배열로 초기화된다', () => {
    const output = renderTemplate('hypothesis', 'test', { locale: 'en' });
    const parsed = matter(output);
    expect(parsed.data.tags).toEqual([]);
  });

  it('episode 템플릿에 체크리스트가 포함된다', () => {
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
  it('빈 디렉토리에서 001을 반환한다', () => {
    const id = nextId(path.join(FIXTURES, 'empty-graph'), 'hypothesis');
    expect(id).toBe('hyp-001');
  });

  it('기존 노드가 있으면 다음 번호를 반환한다', () => {
    const id = nextId(path.join(FIXTURES, 'sample-graph'), 'hypothesis');
    expect(id).toBe('hyp-003');
  });

  it('각 타입별로 올바른 prefix를 사용한다', () => {
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'experiment')).toBe('exp-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'finding')).toBe('fnd-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'knowledge')).toBe('knw-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'question')).toBe('qst-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'decision')).toBe('dec-001');
    expect(nextId(path.join(FIXTURES, 'empty-graph'), 'episode')).toBe('epi-001');
  });
});

describe('sanitizeSlug', () => {
  it('경로 순회 문자를 제거한다', () => {
    expect(sanitizeSlug('../../etc/passwd')).toBe('etc-passwd');
  });

  it('특수문자를 제거한다', () => {
    expect(sanitizeSlug('hello@world!#$%')).toBe('helloworld');
  });

  it('반복 하이픈을 단일 하이픈으로 변환한다', () => {
    expect(sanitizeSlug('foo---bar')).toBe('foo-bar');
  });

  it('빈 결과에 대해 에러를 던진다', () => {
    expect(() => sanitizeSlug('...')).toThrow('Slug is empty after sanitization');
  });

  it('80자를 초과하면 잘린다', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeSlug(long).length).toBe(80);
  });

  it('정상적인 slug는 그대로 반환한다', () => {
    expect(sanitizeSlug('my-valid-slug_01')).toBe('my-valid-slug_01');
  });
});

describe('nodePath', () => {
  it('올바른 경로를 생성한다', () => {
    const p = nodePath('/project/graph', 'hypothesis', 'hyp-001', 'test-slug');
    expect(p).toBe('/project/graph/hypotheses/hyp-001-test-slug.md');
  });

  it('각 타입별로 올바른 디렉토리를 사용한다', () => {
    expect(nodePath('/g', 'experiment', 'exp-001', 's')).toBe('/g/experiments/exp-001-s.md');
    expect(nodePath('/g', 'finding', 'fnd-001', 's')).toBe('/g/findings/fnd-001-s.md');
    expect(nodePath('/g', 'knowledge', 'knw-001', 's')).toBe('/g/knowledge/knw-001-s.md');
    expect(nodePath('/g', 'episode', 'epi-001', 's')).toBe('/g/episodes/epi-001-s.md');
  });
});

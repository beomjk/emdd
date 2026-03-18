import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLocale, setLocale, t } from '../../../src/i18n/index.js';

describe('getLocale', () => {
  const originalEnv = process.env.EMDD_LANG;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EMDD_LANG;
    } else {
      process.env.EMDD_LANG = originalEnv;
    }
  });

  it('returns override locale when provided', () => {
    expect(getLocale('ko')).toBe('ko');
  });

  it('falls back to EMDD_LANG env var when no override', () => {
    process.env.EMDD_LANG = 'ko';
    expect(getLocale()).toBe('ko');
  });

  it('defaults to en when nothing is set', () => {
    delete process.env.EMDD_LANG;
    expect(getLocale()).toBe('en');
  });

  it('falls back to en for invalid locale', () => {
    expect(getLocale('fr')).toBe('en');
  });
});

describe('setLocale / t()', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('returns English message', () => {
    setLocale('en');
    expect(t('health.title')).toBe('EMDD Health Dashboard');
  });

  it('returns Korean message', () => {
    setLocale('ko');
    expect(t('health.title')).toBe('EMDD 건강 대시보드');
  });

  it('substitutes template variables', () => {
    setLocale('en');
    expect(t('new.created', { type: 'hypothesis', id: 'hyp-001' }))
      .toBe('Created hypothesis node: hyp-001');
  });

  it('returns key name for missing key (no crash)', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('accesses nested keys', () => {
    setLocale('en');
    expect(t('error.graph_not_found')).toBe('No graph/ directory found');
  });

  it('t() returns new locale message after setLocale', () => {
    setLocale('en');
    expect(t('health.title')).toBe('EMDD Health Dashboard');
    setLocale('ko');
    expect(t('health.title')).toBe('EMDD 건강 대시보드');
  });
});

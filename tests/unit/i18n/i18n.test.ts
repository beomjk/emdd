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

  it('override 값이 있으면 해당 로케일 반환', () => {
    expect(getLocale('ko')).toBe('ko');
  });

  it('override 없으면 EMDD_LANG 환경변수 참조', () => {
    process.env.EMDD_LANG = 'ko';
    expect(getLocale()).toBe('ko');
  });

  it('아무것도 없으면 en 기본값', () => {
    delete process.env.EMDD_LANG;
    expect(getLocale()).toBe('en');
  });

  it('잘못된 값이면 en fallback', () => {
    expect(getLocale('fr')).toBe('en');
  });
});

describe('setLocale / t()', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('영어 메시지 반환', () => {
    setLocale('en');
    expect(t('health.title')).toBe('EMDD Health Dashboard');
  });

  it('한국어 메시지 반환', () => {
    setLocale('ko');
    expect(t('health.title')).toBe('EMDD 건강 대시보드');
  });

  it('변수 치환', () => {
    setLocale('en');
    expect(t('new.created', { type: 'hypothesis', id: 'hyp-001' }))
      .toBe('Created hypothesis node: hyp-001');
  });

  it('누락 키는 키 이름 자체 반환 (crash 방지)', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('중첩 키 접근', () => {
    setLocale('en');
    expect(t('error.graph_not_found')).toBe('No graph/ directory found');
  });

  it('setLocale 후 t()가 새 로케일 메시지 반환', () => {
    setLocale('en');
    expect(t('health.title')).toBe('EMDD Health Dashboard');
    setLocale('ko');
    expect(t('health.title')).toBe('EMDD 건강 대시보드');
  });
});

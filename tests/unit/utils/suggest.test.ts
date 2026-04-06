import { describe, it, expect } from 'vitest';
import { suggest } from '../../../src/utils/suggest.js';

describe('suggest', () => {
  const candidates = ['observation', 'insight', 'negative'] as const;

  it('returns null for exact match', () => {
    expect(suggest('observation', candidates)).toBeNull();
  });

  it('suggests close match within threshold', () => {
    expect(suggest('obsrvation', candidates)).toBe('observation');
  });

  it('returns null when nothing is close', () => {
    expect(suggest('zzzzz', candidates)).toBeNull();
  });

  it('returns null for case-insensitive exact match', () => {
    expect(suggest('INSIGHT', ['insight', 'negative'])).toBeNull();
  });

  it('suggests close match case-insensitively', () => {
    expect(suggest('INSIGH', ['insight', 'negative'])).toBe('insight');
  });

  it('picks closest among multiple candidates', () => {
    expect(suggest('insigh', candidates)).toBe('insight');
  });

  it('returns null for empty candidates', () => {
    expect(suggest('test', [])).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(suggest('', candidates)).toBeNull();
  });

  it('respects custom threshold', () => {
    // 'obsrvation' is distance 1 from 'observation'
    expect(suggest('obsrvation', candidates, 1)).toBe('observation');
    // 'obxyz' is distance > 1, so null with threshold 1
    expect(suggest('obxyz', candidates, 1)).toBeNull();
  });
});

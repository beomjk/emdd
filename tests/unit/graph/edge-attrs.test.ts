import { describe, it, expect } from 'vitest';
import { getPresentAttrKeys, checkEdgeAffinity } from '../../../src/graph/edge-attrs.js';

describe('getPresentAttrKeys', () => {
  it('returns empty array for empty object', () => {
    expect(getPresentAttrKeys({})).toEqual([]);
  });

  it('returns only known edge attribute keys', () => {
    const result = getPresentAttrKeys({ strength: 0.8, foo: 'bar', severity: 'FATAL' });
    expect(result).toContain('strength');
    expect(result).toContain('severity');
    expect(result).not.toContain('foo');
    expect(result.length).toBe(2);
  });

  it('ignores undefined values', () => {
    expect(getPresentAttrKeys({ strength: undefined })).toEqual([]);
  });

  it('recognizes all five attribute names', () => {
    const all = { strength: 0.5, severity: 'FATAL', completeness: 0.7, dependencyType: 'LOGICAL', impact: 'DECISIVE' };
    expect(getPresentAttrKeys(all).length).toBe(5);
  });
});

describe('checkEdgeAffinity', () => {
  it('returns null when no attributes are present', () => {
    expect(checkEdgeAffinity('supports', [])).toBeNull();
  });

  it('returns null for valid affinity (supports + strength)', () => {
    expect(checkEdgeAffinity('supports', ['strength'])).toBeNull();
  });

  it('returns violation for invalid affinity (supports + severity)', () => {
    const result = checkEdgeAffinity('supports', ['severity']);
    expect(result).not.toBeNull();
    expect(result!.relation).toBe('supports');
    expect(result!.invalidAttrs).toEqual(['severity']);
    expect(result!.allowedAttrs).toContain('strength');
  });

  it('returns null for valid affinity (contradicts + severity)', () => {
    expect(checkEdgeAffinity('contradicts', ['severity'])).toBeNull();
  });

  it('returns null for valid affinity (answers + completeness)', () => {
    expect(checkEdgeAffinity('answers', ['completeness'])).toBeNull();
  });

  it('returns null for valid affinity (depends_on + dependencyType)', () => {
    expect(checkEdgeAffinity('depends_on', ['dependencyType'])).toBeNull();
  });

  it('returns null for valid affinity (informs + impact)', () => {
    expect(checkEdgeAffinity('informs', ['impact'])).toBeNull();
  });

  it('returns violation with allowedAttrs: null for unknown relation', () => {
    const result = checkEdgeAffinity('unknown_relation', ['strength']);
    expect(result).not.toBeNull();
    expect(result!.allowedAttrs).toBeNull();
    expect(result!.invalidAttrs).toEqual(['strength']);
  });

  it('returns violation for relation with no affinity rules (e.g. spawns)', () => {
    const result = checkEdgeAffinity('spawns', ['strength']);
    expect(result).not.toBeNull();
    expect(result!.invalidAttrs).toEqual(['strength']);
  });
});

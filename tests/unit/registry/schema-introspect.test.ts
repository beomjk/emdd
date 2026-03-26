import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodDefType, unwrapZod, getEnumValues, describeParam } from '../../../src/registry/schema-introspect.js';

describe('zodDefType', () => {
  it('returns "string" for z.string()', () => {
    expect(zodDefType(z.string())).toBe('string');
  });

  it('returns "number" for z.number()', () => {
    expect(zodDefType(z.number())).toBe('number');
  });

  it('returns "boolean" for z.boolean()', () => {
    expect(zodDefType(z.boolean())).toBe('boolean');
  });

  it('returns "enum" for z.enum()', () => {
    expect(zodDefType(z.enum(['a', 'b']))).toBe('enum');
  });

  it('returns "optional" for z.string().optional()', () => {
    expect(zodDefType(z.string().optional())).toBe('optional');
  });

  it('returns "record" for z.record()', () => {
    expect(zodDefType(z.record(z.string(), z.string()))).toBe('record');
  });
});

describe('unwrapZod', () => {
  it('strips optional wrapper', () => {
    const inner = unwrapZod(z.string().optional());
    expect(zodDefType(inner)).toBe('string');
  });

  it('strips default wrapper', () => {
    const inner = unwrapZod(z.number().default(1));
    expect(zodDefType(inner)).toBe('number');
  });

  it('strips nested optional+default wrappers', () => {
    const inner = unwrapZod(z.enum(['a', 'b']).optional().default('a'));
    expect(zodDefType(inner)).toBe('enum');
  });

  it('returns same schema for non-wrapped types', () => {
    const s = z.string();
    expect(unwrapZod(s)).toBe(s);
  });
});

describe('getEnumValues', () => {
  it('extracts enum options', () => {
    const values = getEnumValues(z.enum(['foo', 'bar', 'baz']));
    expect(values).toEqual(['foo', 'bar', 'baz']);
  });
});

describe('describeParam', () => {
  it('returns "key?" for optional fields', () => {
    expect(describeParam('type', z.string().optional())).toBe('type?');
  });

  it('returns "key" for required fields', () => {
    expect(describeParam('nodeId', z.string())).toBe('nodeId');
  });

  it('returns "key?" for fields with defaults', () => {
    expect(describeParam('depth', z.number().default(1))).toBe('depth?');
  });
});

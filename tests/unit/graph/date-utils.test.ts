import { describe, it, expect } from 'vitest';
import { normalizeDateFields, nodeDate } from '../../../src/graph/date-utils.js';

describe('normalizeDateFields', () => {
  it('converts Date instances to YYYY-MM-DD strings', () => {
    const data: Record<string, unknown> = {
      created: new Date('2026-03-25T00:00:00.000Z'),
      updated: new Date('2026-03-26T00:00:00.000Z'),
    };
    normalizeDateFields(data);
    expect(data.created).toBe('2026-03-25');
    expect(data.updated).toBe('2026-03-26');
  });

  it('leaves string dates unchanged', () => {
    const data: Record<string, unknown> = {
      created: '2026-03-25',
      updated: '2026-03-26',
    };
    normalizeDateFields(data);
    expect(data.created).toBe('2026-03-25');
    expect(data.updated).toBe('2026-03-26');
  });

  it('leaves non-date fields unchanged', () => {
    const data: Record<string, unknown> = {
      title: 'foo',
      status: 'PROPOSED',
      created: new Date('2026-03-25T00:00:00.000Z'),
    };
    normalizeDateFields(data);
    expect(data.title).toBe('foo');
    expect(data.status).toBe('PROPOSED');
    expect(data.created).toBe('2026-03-25');
  });

  it('handles missing date fields gracefully', () => {
    const data: Record<string, unknown> = { title: 'foo' };
    normalizeDateFields(data);
    expect(data.title).toBe('foo');
    expect(data.created).toBeUndefined();
  });
});

describe('nodeDate', () => {
  it('returns updated date when both present', () => {
    const d = nodeDate({ meta: { updated: '2026-03-26', created: '2026-03-25' } });
    expect(d).toEqual(new Date('2026-03-26'));
  });

  it('falls back to created when updated is missing', () => {
    const d = nodeDate({ meta: { created: '2026-03-25' } });
    expect(d).toEqual(new Date('2026-03-25'));
  });

  it('handles Date object values from gray-matter', () => {
    const d = nodeDate({ meta: { updated: new Date('2026-03-26T00:00:00.000Z') } });
    expect(d).toEqual(new Date('2026-03-26T00:00:00.000Z'));
  });

  it('returns null when no dates present', () => {
    expect(nodeDate({ meta: {} })).toBeNull();
  });

  it('returns null for unparseable date strings', () => {
    expect(nodeDate({ meta: { updated: 'not-a-date' } })).toBeNull();
  });
});

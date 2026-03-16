import { describe, it, expect } from 'vitest';
import {
  NODE_TYPES, VALID_STATUSES, NODE_TYPE_DIRS, ID_PREFIXES, PREFIX_TO_TYPE,
  REQUIRED_FIELDS, EDGE_TYPES, REVERSE_LABELS, ALL_VALID_RELATIONS,
  VALID_SEVERITIES, VALID_RISK_LEVELS,
} from '../../../src/graph/types.js';
import type { NodeType } from '../../../src/graph/types.js';

describe('NODE_TYPES', () => {
  it('contains exactly 7 types', () => {
    expect(NODE_TYPES).toHaveLength(7);
  });

  it('every type has VALID_STATUSES entry', () => {
    for (const t of NODE_TYPES) {
      expect(VALID_STATUSES).toHaveProperty(t);
      expect(VALID_STATUSES[t].length).toBeGreaterThan(0);
    }
  });

  it('every type has NODE_TYPE_DIRS entry', () => {
    for (const t of NODE_TYPES) {
      expect(NODE_TYPE_DIRS).toHaveProperty(t);
    }
  });

  it('every type has ID_PREFIXES entry', () => {
    for (const t of NODE_TYPES) {
      expect(ID_PREFIXES).toHaveProperty(t);
    }
  });

  it('every type has REQUIRED_FIELDS entry', () => {
    for (const t of NODE_TYPES) {
      expect(REQUIRED_FIELDS).toHaveProperty(t);
      expect(REQUIRED_FIELDS[t].length).toBeGreaterThan(0);
    }
  });
});

describe('ID_PREFIXES / PREFIX_TO_TYPE', () => {
  it('PREFIX_TO_TYPE is exact inverse of ID_PREFIXES', () => {
    for (const [type, prefix] of Object.entries(ID_PREFIXES)) {
      expect(PREFIX_TO_TYPE[prefix]).toBe(type);
    }
    for (const [prefix, type] of Object.entries(PREFIX_TO_TYPE)) {
      expect(ID_PREFIXES[type as NodeType]).toBe(prefix);
    }
    expect(Object.keys(PREFIX_TO_TYPE)).toHaveLength(Object.keys(ID_PREFIXES).length);
  });
});

describe('EDGE_TYPES', () => {
  it('contains 15 types (14 canonical + tests alias)', () => {
    expect(EDGE_TYPES.size).toBe(15);
  });

  it('every REVERSE_LABELS value is in EDGE_TYPES', () => {
    for (const value of Object.values(REVERSE_LABELS)) {
      expect(EDGE_TYPES.has(value)).toBe(true);
    }
  });

  it('ALL_VALID_RELATIONS size = EDGE_TYPES + REVERSE_LABELS keys', () => {
    const expected = EDGE_TYPES.size + Object.keys(REVERSE_LABELS).length;
    expect(ALL_VALID_RELATIONS.size).toBe(expected);
  });

  it('does not contain answers_to', () => {
    expect(EDGE_TYPES.has('answers_to')).toBe(false);
  });
});

describe('validation constants', () => {
  it('VALID_SEVERITIES has 3 values: FATAL, WEAKENING, TENSION', () => {
    expect([...VALID_SEVERITIES]).toEqual(['FATAL', 'WEAKENING', 'TENSION']);
  });

  it('VALID_RISK_LEVELS has 3 values: high, medium, low', () => {
    expect([...VALID_RISK_LEVELS]).toEqual(['high', 'medium', 'low']);
  });
});

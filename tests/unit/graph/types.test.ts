import { describe, it, expect } from 'vitest';
import {
  NODE_TYPES, VALID_STATUSES, NODE_TYPE_DIRS, ID_PREFIXES, PREFIX_TO_TYPE,
  REQUIRED_FIELDS, EDGE_TYPES, REVERSE_LABELS, ALL_VALID_RELATIONS,
  VALID_SEVERITIES, VALID_RISK_LEVELS,
  VALUE_PRODUCING_EDGES, EDGE, STATUS,
} from '../../../src/graph/types.js';
import type { NodeType } from '../../../src/graph/types.js';

describe('NODE_TYPES', () => {
  // @spec §6.2.1
  it('contains at least one type', () => {
    expect(NODE_TYPES.length).toBeGreaterThan(0);
  });

  // @spec §6.2.2
  it('every type has VALID_STATUSES entry', () => {
    for (const t of NODE_TYPES) {
      expect(VALID_STATUSES).toHaveProperty(t);
      expect(VALID_STATUSES[t].length).toBeGreaterThan(0);
    }
  });

  // @spec §6.2.3
  it('experiment has 5 statuses', () => {
    expect(VALID_STATUSES.experiment).toEqual(['PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'ABANDONED']);
  });

  // @spec §6.2.4
  it('finding has 4 statuses', () => {
    expect(VALID_STATUSES.finding).toEqual(['DRAFT', 'VALIDATED', 'PROMOTED', 'RETRACTED']);
  });

  // @spec §6.2.5
  it('knowledge has 4 statuses', () => {
    expect(VALID_STATUSES.knowledge).toEqual(['ACTIVE', 'DISPUTED', 'SUPERSEDED', 'RETRACTED']);
  });

  // @spec §6.2.6
  it('question has 4 statuses', () => {
    expect(VALID_STATUSES.question).toEqual(['OPEN', 'RESOLVED', 'ANSWERED', 'DEFERRED']);
  });

  // @spec §6.2.7
  it('decision has 5 statuses', () => {
    expect(VALID_STATUSES.decision).toEqual(['PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'REVERTED', 'CONTESTED']);
  });

  // @spec §6.2.8
  it('episode has 2 statuses', () => {
    expect(VALID_STATUSES.episode).toEqual(['ACTIVE', 'COMPLETED']);
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
  // @spec §6.5.1
  it('contains forward edge types', () => {
    expect(EDGE_TYPES.size).toBeGreaterThan(0);
  });

  it('includes resolves edge type', () => {
    expect(EDGE_TYPES.has('resolves')).toBe(true);
  });

  it('includes resolved_by as reverse label', () => {
    expect(REVERSE_LABELS['resolved_by']).toBe('resolves');
  });

  // @spec §6.5.2
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
  // @spec §6.7.2
  it('VALID_SEVERITIES has 3 values: FATAL, WEAKENING, TENSION', () => {
    expect([...VALID_SEVERITIES]).toEqual(['FATAL', 'WEAKENING', 'TENSION']);
  });

  it('VALID_RISK_LEVELS has 3 values: high, medium, low', () => {
    expect([...VALID_RISK_LEVELS]).toEqual(['high', 'medium', 'low']);
  });
});

describe('VALUE_PRODUCING_EDGES', () => {
  it('VALUE_PRODUCING_EDGES contains expected value-producing edge types', () => {
    const expected = [
      'answers', 'confirms', 'contradicts', 'extends', 'informs',
      'produces', 'promotes', 'resolves', 'revises', 'spawns',
      'supports', 'tests',
    ];
    for (const e of expected) {
      expect(VALUE_PRODUCING_EDGES.has(e)).toBe(true);
    }
  });
});

describe('EDGE / STATUS enum completeness', () => {
  it('EDGE const has entry for every ALL_VALID_RELATIONS member', () => {
    for (const relation of ALL_VALID_RELATIONS) {
      expect((EDGE as Record<string, string>)[relation]).toBe(relation);
    }
  });

  it('STATUS const has entry for every unique status across all node types', () => {
    const allStatuses = new Set<string>();
    for (const type of NODE_TYPES) {
      for (const s of VALID_STATUSES[type]) {
        allStatuses.add(s);
      }
    }
    for (const status of allStatuses) {
      expect((STATUS as Record<string, string>)[status]).toBe(status);
    }
  });
});

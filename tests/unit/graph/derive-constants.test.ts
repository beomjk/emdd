import { describe, it, expect } from 'vitest';
import {
  TRANSITION_TABLE,
  MANUAL_TRANSITIONS,
  THRESHOLDS,
  CEREMONY_TRIGGERS,
  TRANSITION_POLICY_DEFAULT,
  EDGE_ATTRIBUTE_NAMES,
  EDGE_ATTRIBUTE_TYPES,
  EDGE_ATTRIBUTE_RANGES,
  EDGE_ATTRIBUTE_ENUM_VALUES,
  EDGE_ATTRIBUTE_AFFINITY,
  COMPOSITION_EDGES,
  EVIDENCE_EDGES,
  GENERATION_EDGES,
  STRUCTURE_EDGES,
  IN_PROGRESS_STATUSES,
  INITIAL_STATUSES,
  NEGATIVE_STATUSES,
  POSITIVE_STATUSES,
  TERMINAL_STATUSES,
  NODE_DISPLAY_ORDER,
  ENUM_FIELD_VALIDATORS,
  ENUM_FIELD_OWNER_TYPE,
  VALID_FINDING_TYPES,
  VALID_URGENCIES,
  VALID_RISK_LEVELS,
  VALID_REVERSIBILITIES,
} from '../../../src/graph/types.js';

describe('TRANSITION_TABLE', () => {
  it('hypothesis has 10 transition rules', () => {
    expect(TRANSITION_TABLE.hypothesis).toHaveLength(10);
  });

  it('knowledge has 4 transition rules', () => {
    expect(TRANSITION_TABLE.knowledge).toHaveLength(4);
  });

  it('hypothesis PROPOSED->TESTING requires linked experiment with status RUNNING or COMPLETED', () => {
    const rules = TRANSITION_TABLE.hypothesis!.filter(
      r => r.from === 'PROPOSED' && r.to === 'TESTING',
    );
    expect(rules).toHaveLength(2);
    expect(rules[0].conditions[0].args).toMatchObject({
      type: 'experiment',
      status: 'RUNNING',
    });
    expect(rules[1].conditions[0].args).toMatchObject({
      type: 'experiment',
      status: 'COMPLETED',
    });
  });

  it('hypothesis PROPOSED->SUPPORTED requires supports relation with min_strength', () => {
    const rule = TRANSITION_TABLE.hypothesis!.find(
      r => r.from === 'PROPOSED' && r.to === 'SUPPORTED',
    );
    expect(rule).toBeDefined();
    expect(rule!.conditions[0].args).toMatchObject({
      relation: 'supports',
      min_strength: 0.7,
    });
  });

  it('knowledge ACTIVE->DISPUTED requires contradicts relation', () => {
    const rule = TRANSITION_TABLE.knowledge!.find(
      r => r.from === 'ACTIVE' && r.to === 'DISPUTED',
    );
    expect(rule).toBeDefined();
    expect(rule!.conditions[0].args).toMatchObject({
      relation: 'contradicts',
    });
  });

  it('knowledge DISPUTED->ACTIVE requires all_linked_with contradicts RETRACTED', () => {
    const rule = TRANSITION_TABLE.knowledge!.find(
      r => r.from === 'DISPUTED' && r.to === 'ACTIVE',
    );
    expect(rule).toBeDefined();
    expect(rule!.conditions[0].fn).toBe('all_linked_with');
    expect(rule!.conditions[0].args).toMatchObject({
      relation: 'contradicts',
      status: 'RETRACTED',
    });
  });
});

describe('MANUAL_TRANSITIONS', () => {
  it('hypothesis has manual transition from ANY to DEFERRED', () => {
    expect(MANUAL_TRANSITIONS.hypothesis).toEqual([
      { from: 'ANY', to: 'DEFERRED' },
    ]);
  });

  it('knowledge has manual transition from DISPUTED to RETRACTED', () => {
    expect(MANUAL_TRANSITIONS.knowledge).toEqual([
      { from: 'DISPUTED', to: 'RETRACTED' },
    ]);
  });
});

describe('THRESHOLDS', () => {
  it('has all 10 threshold keys with correct values', () => {
    expect(THRESHOLDS).toEqual({
      branch_convergence_gap: 0.3,
      branch_convergence_weeks: 2,
      branch_max_active: 3,
      branch_max_candidates: 4,
      branch_max_open_weeks: 4,
      kill_confidence: 0.3,
      kill_stale_days: 14,
      min_independent_supports: 2,
      promotion_confidence: 0.9,
      support_strength_min: 0.7,
    });
  });
});

describe('CEREMONY_TRIGGERS', () => {
  it('consolidation has 4 trigger keys with correct values', () => {
    expect(CEREMONY_TRIGGERS.consolidation).toEqual({
      all_questions_resolved: true,
      episodes_threshold: 3,
      experiment_overload_threshold: 5,
      unpromoted_findings_threshold: 5,
    });
  });
});

describe('TRANSITION_POLICY_DEFAULT', () => {
  it('is strict', () => {
    expect(TRANSITION_POLICY_DEFAULT).toBe('strict');
  });
});

describe('EDGE_ATTRIBUTE_NAMES', () => {
  it('contains all 5 attribute names sorted alphabetically', () => {
    expect([...EDGE_ATTRIBUTE_NAMES]).toEqual([
      'completeness', 'dependencyType', 'impact', 'severity', 'strength',
    ]);
  });
});

describe('EDGE_ATTRIBUTE_TYPES', () => {
  it('maps each attribute to number or enum', () => {
    expect(EDGE_ATTRIBUTE_TYPES).toMatchObject({
      completeness: 'number',
      dependencyType: 'enum',
      impact: 'enum',
      severity: 'enum',
      strength: 'number',
    });
  });
});

describe('EDGE_ATTRIBUTE_RANGES', () => {
  it('completeness has min 0 and max 1', () => {
    expect(EDGE_ATTRIBUTE_RANGES['completeness']).toEqual({ min: 0, max: 1 });
  });

  it('strength has min 0 and max 1', () => {
    expect(EDGE_ATTRIBUTE_RANGES['strength']).toEqual({ min: 0, max: 1 });
  });
});

describe('EDGE_ATTRIBUTE_ENUM_VALUES', () => {
  it('dependencyType maps to LOGICAL, PRACTICAL, TEMPORAL', () => {
    expect([...EDGE_ATTRIBUTE_ENUM_VALUES['dependencyType']]).toEqual([
      'LOGICAL', 'PRACTICAL', 'TEMPORAL',
    ]);
  });

  it('impact maps to DECISIVE, SIGNIFICANT, MINOR', () => {
    expect([...EDGE_ATTRIBUTE_ENUM_VALUES['impact']]).toEqual([
      'DECISIVE', 'SIGNIFICANT', 'MINOR',
    ]);
  });

  it('severity maps to FATAL, WEAKENING, TENSION', () => {
    expect([...EDGE_ATTRIBUTE_ENUM_VALUES['severity']]).toEqual([
      'FATAL', 'WEAKENING', 'TENSION',
    ]);
  });
});

describe('EDGE_ATTRIBUTE_AFFINITY', () => {
  it('supports has strength', () => {
    expect(EDGE_ATTRIBUTE_AFFINITY['supports']).toEqual(['strength']);
  });

  it('contradicts has severity', () => {
    expect(EDGE_ATTRIBUTE_AFFINITY['contradicts']).toEqual(['severity']);
  });

  it('confirms has strength', () => {
    expect(EDGE_ATTRIBUTE_AFFINITY['confirms']).toEqual(['strength']);
  });

  it('answers has completeness', () => {
    expect(EDGE_ATTRIBUTE_AFFINITY['answers']).toEqual(['completeness']);
  });

  it('depends_on has dependencyType', () => {
    expect(EDGE_ATTRIBUTE_AFFINITY['depends_on']).toEqual(['dependencyType']);
  });

  it('informs has impact', () => {
    expect(EDGE_ATTRIBUTE_AFFINITY['informs']).toEqual(['impact']);
  });
});

describe('Edge category sets', () => {
  it('COMPOSITION_EDGES contains correct members', () => {
    expect([...COMPOSITION_EDGES].sort()).toEqual(
      ['context_for', 'part_of', 'resolves', 'tests'].sort(),
    );
  });

  it('EVIDENCE_EDGES contains correct members', () => {
    expect([...EVIDENCE_EDGES].sort()).toEqual(
      ['confirms', 'contradicts', 'supports'].sort(),
    );
  });

  it('GENERATION_EDGES contains correct members', () => {
    expect([...GENERATION_EDGES].sort()).toEqual(
      ['answers', 'produces', 'promotes', 'revises', 'spawns'].sort(),
    );
  });

  it('STRUCTURE_EDGES contains correct members', () => {
    expect([...STRUCTURE_EDGES].sort()).toEqual(
      ['depends_on', 'extends', 'informs', 'relates_to'].sort(),
    );
  });
});

describe('Status category sets', () => {
  it('IN_PROGRESS_STATUSES contains correct members', () => {
    expect([...IN_PROGRESS_STATUSES].sort()).toEqual(
      ['CONTESTED', 'DISPUTED', 'RUNNING', 'TESTING'].sort(),
    );
  });

  it('INITIAL_STATUSES contains correct members', () => {
    expect([...INITIAL_STATUSES].sort()).toEqual(
      ['DRAFT', 'OPEN', 'PLANNED', 'PROPOSED'].sort(),
    );
  });

  it('NEGATIVE_STATUSES contains correct members', () => {
    expect([...NEGATIVE_STATUSES].sort()).toEqual(
      ['ABANDONED', 'FAILED', 'REFUTED', 'RETRACTED', 'REVERTED'].sort(),
    );
  });

  it('POSITIVE_STATUSES contains correct members', () => {
    expect([...POSITIVE_STATUSES].sort()).toEqual(
      ['ACCEPTED', 'ACTIVE', 'ANSWERED', 'COMPLETED', 'PROMOTED', 'SUPPORTED', 'VALIDATED'].sort(),
    );
  });

  it('TERMINAL_STATUSES contains correct members', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(
      ['DEFERRED', 'RESOLVED', 'REVISED', 'SUPERSEDED'].sort(),
    );
  });
});

describe('ENUM_FIELD_VALIDATORS', () => {
  it('maps all 4 enum fields to their valid value arrays', () => {
    expect(Object.keys(ENUM_FIELD_VALIDATORS).sort()).toEqual(
      ['finding_type', 'reversibility', 'risk_level', 'urgency'],
    );
  });

  it('finding_type maps to VALID_FINDING_TYPES', () => {
    expect(ENUM_FIELD_VALIDATORS['finding_type']).toEqual(VALID_FINDING_TYPES);
  });

  it('urgency maps to VALID_URGENCIES', () => {
    expect(ENUM_FIELD_VALIDATORS['urgency']).toEqual(VALID_URGENCIES);
  });

  it('risk_level maps to VALID_RISK_LEVELS', () => {
    expect(ENUM_FIELD_VALIDATORS['risk_level']).toEqual(VALID_RISK_LEVELS);
  });

  it('reversibility maps to VALID_REVERSIBILITIES', () => {
    expect(ENUM_FIELD_VALIDATORS['reversibility']).toEqual(VALID_REVERSIBILITIES);
  });

  it('every ENUM_FIELD_VALIDATORS key has an ENUM_FIELD_OWNER_TYPE entry', () => {
    for (const key of Object.keys(ENUM_FIELD_VALIDATORS)) {
      expect(ENUM_FIELD_OWNER_TYPE).toHaveProperty(key);
    }
  });

  it('every ENUM_FIELD_OWNER_TYPE key exists in ENUM_FIELD_VALIDATORS', () => {
    for (const key of Object.keys(ENUM_FIELD_OWNER_TYPE)) {
      expect(ENUM_FIELD_VALIDATORS).toHaveProperty(key);
    }
  });
});

describe('NODE_DISPLAY_ORDER', () => {
  it('has correct display order', () => {
    expect(NODE_DISPLAY_ORDER).toEqual([
      'hypothesis', 'experiment', 'finding', 'knowledge',
      'question', 'decision', 'episode',
    ]);
  });
});

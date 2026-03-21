import { describe, it, expect } from 'vitest';
import { GraphSchemaZod, type GraphSchema } from '../../../src/schema/validator.js';
import { validateReferentialIntegrity, VALID_PRESET_FNS, type ValidationError } from '../../../src/schema/validator.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeMinimalSchema(overrides: Partial<GraphSchema> = {}): GraphSchema {
  return {
    version: '1.0',
    nodeTypes: [
      { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED', 'TESTING', 'SUPPORTED'], requiredFields: ['id', 'type'] },
      { name: 'experiment', prefix: 'exp', directory: 'experiments', statuses: ['PLANNED', 'RUNNING', 'COMPLETED'], requiredFields: ['id', 'type'] },
    ],
    edgeTypes: { forward: ['supports', 'contradicts', 'revises'], reverse: { supported_by: 'supports' } },
    thresholds: { promotion_confidence: 0.9 },
    transitions: {
      hypothesis: [
        { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'RUNNING' } }] },
      ],
    },
    validValues: { severities: ['FATAL'] },
    ...overrides,
  };
}

// ── Structural Validation (Zod) ─────────────────────────────────────

describe('GraphSchemaZod structural validation', () => {
  it('accepts a valid schema', () => {
    const result = GraphSchemaZod.safeParse(makeMinimalSchema());
    expect(result.success).toBe(true);
  });

  it('rejects missing version', () => {
    const { version, ...rest } = makeMinimalSchema();
    const result = GraphSchemaZod.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects version as number', () => {
    const schema = { ...makeMinimalSchema(), version: 123 };
    const result = GraphSchemaZod.safeParse(schema);
    expect(result.success).toBe(false);
  });

  it('rejects missing nodeTypes', () => {
    const { nodeTypes, ...rest } = makeMinimalSchema();
    const result = GraphSchemaZod.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty nodeTypes array', () => {
    const schema = makeMinimalSchema({ nodeTypes: [] });
    const result = GraphSchemaZod.safeParse(schema);
    expect(result.success).toBe(false);
  });

  it('rejects nodeType missing required fields', () => {
    const schema = makeMinimalSchema({
      nodeTypes: [{ name: 'test', prefix: 'tst', directory: 'tests' } as any],
    });
    const result = GraphSchemaZod.safeParse(schema);
    expect(result.success).toBe(false);
  });

  it('rejects missing edgeTypes', () => {
    const { edgeTypes, ...rest } = makeMinimalSchema();
    const result = GraphSchemaZod.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing transitions', () => {
    const { transitions, ...rest } = makeMinimalSchema();
    const result = GraphSchemaZod.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing thresholds', () => {
    const { thresholds, ...rest } = makeMinimalSchema();
    const result = GraphSchemaZod.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects threshold with non-number value', () => {
    const schema = makeMinimalSchema({ thresholds: { bad: 'string' as any } });
    const result = GraphSchemaZod.safeParse(schema);
    expect(result.success).toBe(false);
  });

  it('accepts optional manualTransitions', () => {
    const schema = makeMinimalSchema();
    delete (schema as any).manualTransitions;
    const result = GraphSchemaZod.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('accepts optional optionalFields on nodeType', () => {
    const schema = makeMinimalSchema();
    schema.nodeTypes[0].optionalFields = ['tags', 'links'];
    const result = GraphSchemaZod.safeParse(schema);
    expect(result.success).toBe(true);
  });
});

// ── Referential Integrity ───────────────────────────────────────────

describe('validateReferentialIntegrity', () => {
  it('returns empty array for valid schema', () => {
    const errors = validateReferentialIntegrity(makeMinimalSchema());
    expect(errors).toEqual([]);
  });

  it('detects transition referencing non-existent status (from)', () => {
    const schema = makeMinimalSchema({
      transitions: {
        hypothesis: [
          { from: 'NONEXISTENT', to: 'TESTING', conditions: [{ fn: 'has_linked', args: {} }] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toMatch(/transitions\.hypothesis\[0\]/);
    expect(errors[0].message).toContain('NONEXISTENT');
  });

  it('detects transition referencing non-existent status (to)', () => {
    const schema = makeMinimalSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'INVALID', conditions: [{ fn: 'has_linked', args: {} }] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('INVALID'))).toBe(true);
  });

  it('detects condition referencing non-existent nodeType', () => {
    const schema = makeMinimalSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'nonexistent_type' } }] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('nonexistent_type'))).toBe(true);
  });

  it('detects condition referencing non-existent edgeType relation', () => {
    const schema = makeMinimalSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { relation: 'bad_relation' } }] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('bad_relation'))).toBe(true);
  });

  it('detects condition referencing invalid status for referenced type', () => {
    const schema = makeMinimalSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'BOGUS' } }] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('BOGUS'))).toBe(true);
    expect(errors.some(e => e.path.includes('conditions[0]'))).toBe(true);
  });

  it('detects unknown preset function name', () => {
    const schema = makeMinimalSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'unknown_fn', args: {} }] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('unknown_fn'))).toBe(true);
  });

  it('detects duplicate from→to transition within same nodeType', () => {
    const schema = makeMinimalSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment' } }] },
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'field_present', args: { name: 'title' } }] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.toLowerCase().includes('duplicate'))).toBe(true);
  });

  it('detects duplicate prefix across nodeTypes', () => {
    const schema = makeMinimalSchema({
      nodeTypes: [
        { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED'], requiredFields: ['id'] },
        { name: 'experiment', prefix: 'hyp', directory: 'experiments', statuses: ['PLANNED'], requiredFields: ['id'] },
      ],
      transitions: {},
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.toLowerCase().includes('duplicate prefix'))).toBe(true);
    expect(errors.some(e => e.path.includes('nodeTypes'))).toBe(true);
  });

  it('detects transition for non-existent nodeType', () => {
    const schema = makeMinimalSchema({
      transitions: {
        nonexistent: [
          { from: 'A', to: 'B', conditions: [] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('nonexistent'))).toBe(true);
  });

  it('all errors include path and reason (NFR-003)', () => {
    const schema = makeMinimalSchema({
      nodeTypes: [
        { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED'], requiredFields: ['id'] },
        { name: 'experiment', prefix: 'hyp', directory: 'experiments', statuses: ['PLANNED'], requiredFields: ['id'] },
      ],
      transitions: {
        hypothesis: [
          { from: 'INVALID', to: 'PROPOSED', conditions: [{ fn: 'bad_fn', args: { type: 'missing_type' } }] },
        ],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.length).toBeGreaterThan(0);
    for (const err of errors) {
      // Every error must have a dot-bracket path
      expect(err.path).toMatch(/\w+/);
      // Every error must have a non-empty message
      expect(err.message.length).toBeGreaterThan(0);
      // Every error must have a severity
      expect(['ERROR', 'WARNING']).toContain(err.severity);
    }
  });

  it('validates manualTransitions: rejects invalid from status', () => {
    const schema = makeMinimalSchema({
      manualTransitions: {
        hypothesis: [{ from: 'NONEXISTENT', to: 'TESTING' }],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('NONEXISTENT'))).toBe(true);
  });

  it('validates manualTransitions: rejects invalid to status', () => {
    const schema = makeMinimalSchema({
      manualTransitions: {
        hypothesis: [{ from: 'ANY', to: 'NONEXISTENT' }],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('NONEXISTENT'))).toBe(true);
  });

  it('validates manualTransitions: accepts ANY as from', () => {
    const schema = makeMinimalSchema({
      manualTransitions: {
        hypothesis: [{ from: 'ANY', to: 'TESTING' }],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors).toEqual([]);
  });

  it('validates manualTransitions: rejects non-existent nodeType', () => {
    const schema = makeMinimalSchema({
      manualTransitions: {
        nonexistent: [{ from: 'ANY', to: 'TESTING' }],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('nonexistent'))).toBe(true);
  });

  it('exports VALID_PRESET_FNS list', () => {
    expect(VALID_PRESET_FNS).toContain('has_linked');
    expect(VALID_PRESET_FNS).toContain('field_present');
    expect(VALID_PRESET_FNS).toContain('min_linked_count');
    expect(VALID_PRESET_FNS).toContain('all_linked_with');
    expect(VALID_PRESET_FNS).toHaveLength(4);
  });

  it('detects edgeAttributeAffinity referencing non-existent edge type', () => {
    const schema = makeMinimalSchema({
      edgeAttributeAffinity: {
        nonexistent_edge: ['strength'],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.some(e => e.message.includes('nonexistent_edge'))).toBe(true);
    expect(errors.some(e => e.path.includes('edgeAttributeAffinity'))).toBe(true);
  });

  it('accepts valid edgeAttributeAffinity with known edge types', () => {
    const schema = makeMinimalSchema({
      edgeAttributeAffinity: {
        supports: ['strength'],
      },
    });
    const errors = validateReferentialIntegrity(schema);
    expect(errors.filter(e => e.path.includes('edgeAttributeAffinity'))).toEqual([]);
  });
});

// ── New Schema Sections (Zod structural) ─────────────────────────────

describe('New schema sections structural validation', () => {
  it('rejects transitionPolicy with invalid mode', () => {
    const raw = { ...makeMinimalSchema(), transitionPolicy: { mode: 'invalid' } };
    const result = GraphSchemaZod.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it('accepts valid transitionPolicy modes', () => {
    for (const mode of ['strict', 'warn', 'off']) {
      const raw = { ...makeMinimalSchema(), transitionPolicy: { mode } };
      const result = GraphSchemaZod.safeParse(raw);
      expect(result.success).toBe(true);
    }
  });

  it('accepts ceremonies with valid trigger values', () => {
    const raw = {
      ...makeMinimalSchema(),
      ceremonies: {
        consolidation: { triggers: { threshold: 5, flag: true } },
      },
    };
    const result = GraphSchemaZod.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it('rejects ceremonies with string trigger value', () => {
    const raw = {
      ...makeMinimalSchema(),
      ceremonies: {
        consolidation: { triggers: { threshold: 'not_a_number' } },
      },
    };
    const result = GraphSchemaZod.safeParse(raw);
    expect(result.success).toBe(false);
  });
});

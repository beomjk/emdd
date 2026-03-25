import { describe, it, expect } from 'vitest';
import { toSchemaDefinition } from '../../../src/schema/schema-bridge.js';
import type { GraphSchema } from '../../../src/schema/validator.js';

function makeSchema(): GraphSchema {
  return {
    version: '1.0',
    nodeTypes: [
      { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED', 'TESTING'], requiredFields: ['id', 'type'] },
      { name: 'knowledge', prefix: 'knw', directory: 'knowledge', statuses: ['ACTIVE', 'DISPUTED'], requiredFields: ['id', 'type'] },
    ],
    edgeTypes: { forward: ['supports', 'contradicts'], reverse: { supported_by: 'supports' } },
    thresholds: { promotion_confidence: 0.9 },
    transitions: {
      hypothesis: [
        { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment' } }] },
      ],
    },
    validValues: { severities: ['FATAL'] },
    manualTransitions: {
      hypothesis: [{ from: 'ANY', to: 'TESTING' }],
    },
    transitionPolicy: { mode: 'strict' },
  };
}

describe('toSchemaDefinition', () => {
  it('converts GraphSchema to SchemaDefinition', () => {
    const schema = makeSchema();
    const def = toSchemaDefinition(schema);

    expect(def.presetNames).toContain('has_linked');
    expect(def.presetNames).toContain('field_present');
    expect(def.entities).toHaveProperty('hypothesis');
    expect(def.entities).toHaveProperty('knowledge');
  });

  it('maps entity statuses', () => {
    const def = toSchemaDefinition(makeSchema());
    expect(def.entities['hypothesis'].statuses).toEqual(['PROPOSED', 'TESTING']);
    expect(def.entities['knowledge'].statuses).toEqual(['ACTIVE', 'DISPUTED']);
  });

  it('maps transitions with conditions', () => {
    const def = toSchemaDefinition(makeSchema());
    const hyp = def.entities['hypothesis'];
    expect(hyp.transitions).toHaveLength(1);
    expect(hyp.transitions![0]).toEqual({
      from: 'PROPOSED',
      to: 'TESTING',
      conditions: [{ fn: 'has_linked', args: { type: 'experiment' } }],
    });
  });

  it('maps manual transitions', () => {
    const def = toSchemaDefinition(makeSchema());
    expect(def.entities['hypothesis'].manualTransitions).toEqual([
      { from: 'ANY', to: 'TESTING' },
    ]);
  });

  it('maps transition policy', () => {
    const def = toSchemaDefinition(makeSchema());
    expect(def.policy).toEqual({ mode: 'strict' });
  });

  it('handles missing transitions for a node type', () => {
    const def = toSchemaDefinition(makeSchema());
    // knowledge has no transitions defined
    expect(def.entities['knowledge'].transitions).toEqual([]);
  });

  it('handles missing manual transitions', () => {
    const schema = makeSchema();
    delete schema.manualTransitions;
    const def = toSchemaDefinition(schema);
    expect(def.entities['hypothesis'].manualTransitions).toEqual([]);
  });

  it('handles missing transition policy', () => {
    const schema = makeSchema();
    delete schema.transitionPolicy;
    const def = toSchemaDefinition(schema);
    expect(def.policy).toBeUndefined();
  });
});

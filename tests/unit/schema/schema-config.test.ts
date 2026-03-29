import { describe, it, expect } from 'vitest';
import {
  entityDefinitions,
  forwardEdges,
  reverseEdges,
  edgeCategories,
  statusCategories,
  impactClassification,
  attributeModifiers,
  validValues,
} from '../../../src/schema/schema.config.js';

describe('schema.config referential integrity', () => {
  it('transition condition type args reference valid node types', () => {
    const validTypes = new Set(Object.keys(entityDefinitions));
    for (const [typeName, entity] of Object.entries(entityDefinitions)) {
      for (const t of entity.transitions ?? []) {
        for (const c of t.conditions ?? []) {
          if (c.args.type) {
            expect(
              validTypes.has(c.args.type as string),
              `${typeName}: condition references type "${c.args.type}"`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('transition condition status args are valid for referenced type', () => {
    for (const [typeName, entity] of Object.entries(entityDefinitions)) {
      for (const t of entity.transitions ?? []) {
        for (const c of t.conditions ?? []) {
          const refType = c.args.type as string | undefined;
          const refStatus = c.args.status as string | undefined;
          if (refType && refStatus) {
            const refEntity = entityDefinitions[refType];
            expect(refEntity, `${typeName}: references unknown type "${refType}"`).toBeDefined();
            expect(
              (refEntity.statuses as readonly string[]).includes(refStatus),
              `${typeName}: "${refStatus}" not in ${refType} statuses`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('transition condition relation args reference valid edge types', () => {
    const allRelations = new Set([...forwardEdges, ...Object.keys(reverseEdges)]);
    for (const [typeName, entity] of Object.entries(entityDefinitions)) {
      for (const t of entity.transitions ?? []) {
        for (const c of t.conditions ?? []) {
          if (c.args.relation) {
            expect(
              allRelations.has(c.args.relation as string),
              `${typeName}: references unknown relation "${c.args.relation}"`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('impactClassification covers all forward edges exactly once', () => {
    const forwardSet = new Set<string>(forwardEdges);
    const classifiedEdges = new Set<string>();
    for (const [cls, def] of Object.entries(impactClassification)) {
      for (const edge of def.edges) {
        expect(classifiedEdges.has(edge), `"${edge}" appears in multiple classifications`).toBe(false);
        expect(forwardSet.has(edge), `${cls}: "${edge}" not in forward edges`).toBe(true);
        classifiedEdges.add(edge);
      }
    }
    for (const edge of forwardEdges) {
      expect(classifiedEdges.has(edge), `forward edge "${edge}" not classified`).toBe(true);
    }
  });

  it('attributeModifiers keys match validValues enums', () => {
    expect(Object.keys(attributeModifiers.severity).sort())
      .toEqual([...validValues.severities].sort());
    expect(Object.keys(attributeModifiers.impact).sort())
      .toEqual([...validValues.impacts].sort());
    expect(Object.keys(attributeModifiers.dependencyType).sort())
      .toEqual([...validValues.dependencyTypes].sort());
  });

  it('edge categories only contain forward edges', () => {
    const forwardSet = new Set(forwardEdges);
    for (const [cat, edges] of Object.entries(edgeCategories)) {
      for (const edge of edges) {
        expect(forwardSet.has(edge), `${cat}: "${edge}" not in forward edges`).toBe(true);
      }
    }
  });

  it('status categories contain only statuses defined in node types', () => {
    const allStatuses = new Set<string>();
    for (const entity of Object.values(entityDefinitions)) {
      for (const s of entity.statuses) allStatuses.add(s);
    }
    for (const [cat, statuses] of Object.entries(statusCategories)) {
      for (const s of statuses) {
        expect(allStatuses.has(s), `${cat}: "${s}" not defined in any node type`).toBe(true);
      }
    }
  });

  it('manual transition targets are valid statuses for their type', () => {
    for (const [typeName, entity] of Object.entries(entityDefinitions)) {
      for (const mt of entity.manualTransitions ?? []) {
        if (mt.from !== 'ANY') {
          expect(
            (entity.statuses as readonly string[]).includes(mt.from),
            `${typeName}: manual from "${mt.from}" not in statuses`,
          ).toBe(true);
        }
        expect(
          (entity.statuses as readonly string[]).includes(mt.to),
          `${typeName}: manual to "${mt.to}" not in statuses`,
        ).toBe(true);
      }
    }
  });
});

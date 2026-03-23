import { describe, it, expect } from 'vitest';
import { generateTypesFile } from '../../../src/schema/codegen.js';
import { loadSchema } from '../../../src/schema/loader.js';
import path from 'node:path';

describe('E2E schema propagation (T050)', () => {
  // Use the real schema as base
  let realSchema: Awaited<ReturnType<typeof loadSchema>>;

  // Load actual schema once
  it('loads real schema', async () => {
    const schemaPath = path.resolve('graph-schema.yaml');
    realSchema = await loadSchema(schemaPath);
    expect(realSchema).toBeDefined();
    expect(realSchema.nodeTypes.length).toBeGreaterThan(0);
  });

  it('(SC-002) adding edge to forward + category propagates to EDGE_TYPES, category Set, and EDGE const', async () => {
    const schemaPath = path.resolve('graph-schema.yaml');
    const schema = await loadSchema(schemaPath);

    // Add _test_e2e to edgeTypes.forward
    schema.edgeTypes.forward = [...schema.edgeTypes.forward, '_test_e2e'];

    // Add _test_e2e to edgeCategories.generation
    if (schema.edgeCategories) {
      schema.edgeCategories = {
        ...schema.edgeCategories,
        generation: [...(schema.edgeCategories.generation ?? []), '_test_e2e'],
      };
    }

    const output = generateTypesFile(schema);

    // _test_e2e in EDGE_TYPES
    expect(output).toContain("  '_test_e2e',");
    // _test_e2e in GENERATION_EDGES
    expect(output).toContain("'_test_e2e'");
    const genEdgesMatch = output.match(/GENERATION_EDGES = new Set<string>\(\[(.*?)\]\)/s);
    expect(genEdgesMatch).not.toBeNull();
    expect(genEdgesMatch![1]).toContain("'_test_e2e'");
    // _test_e2e in EDGE const object
    expect(output).toContain("  _test_e2e: '_test_e2e',");
  });

  it('(SC-003) adding status to nodeType + category propagates to VALID_STATUSES, category Set, and STATUS const', async () => {
    const schemaPath = path.resolve('graph-schema.yaml');
    const schema = await loadSchema(schemaPath);

    // Add _TEST_E2E to hypothesis statuses
    const hypType = schema.nodeTypes.find((t) => t.name === 'hypothesis');
    expect(hypType).toBeDefined();
    hypType!.statuses = [...hypType!.statuses, '_TEST_E2E'];

    // Add _TEST_E2E to statusCategories.initial
    if (schema.statusCategories) {
      schema.statusCategories = {
        ...schema.statusCategories,
        initial: [...(schema.statusCategories.initial ?? []), '_TEST_E2E'],
      };
    }

    const output = generateTypesFile(schema);

    // _TEST_E2E in VALID_STATUSES.hypothesis
    expect(output).toMatch(/hypothesis:.*'_TEST_E2E'/);
    // _TEST_E2E in INITIAL_STATUSES
    const initialMatch = output.match(/INITIAL_STATUSES = new Set<string>\(\[(.*?)\]\)/s);
    expect(initialMatch).not.toBeNull();
    expect(initialMatch![1]).toContain("'_TEST_E2E'");
    // _TEST_E2E in STATUS const object
    expect(output).toContain("  _TEST_E2E: '_TEST_E2E',");
  });

  it('(SC-008 negative) forward-only edge appears in EDGE_TYPES and EDGE but not in any category', async () => {
    const schemaPath = path.resolve('graph-schema.yaml');
    const schema = await loadSchema(schemaPath);

    // Add _test_forward_only to edgeTypes.forward ONLY (no category)
    schema.edgeTypes.forward = [...schema.edgeTypes.forward, '_test_forward_only'];

    const output = generateTypesFile(schema);

    // In EDGE_TYPES
    expect(output).toContain("'_test_forward_only',");
    // In EDGE const
    expect(output).toContain("  _test_forward_only: '_test_forward_only',");

    // NOT in any category Set
    const categoryMatches = output.matchAll(/_EDGES = new Set<string>\(\[(.*?)\]\)/gs);
    for (const match of categoryMatches) {
      expect(match[1]).not.toContain('_test_forward_only');
    }
  });

  it('(SC-008 severity compile) adding severity to validValues produces entry in const object', async () => {
    const schemaPath = path.resolve('graph-schema.yaml');
    const schema = await loadSchema(schemaPath);

    // Add _TEST_SEV to validValues.severities
    schema.validValues = {
      ...schema.validValues,
      severities: [...(schema.validValues.severities ?? []), '_TEST_SEV'],
    };

    const output = generateTypesFile(schema);

    // _TEST_SEV in VALID_SEVERITIES
    expect(output).toContain("'_TEST_SEV'");
    // _TEST_SEV in SEVERITY const object
    expect(output).toContain("  _TEST_SEV: '_TEST_SEV',");
  });
});

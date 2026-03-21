import { describe, it, expect } from 'vitest';
import { generateTypesFile } from '../../../src/schema/codegen.js';
import type { GraphSchema } from '../../../src/schema/validator.js';

function makeTestSchema(overrides: Partial<GraphSchema> = {}): GraphSchema {
  return {
    version: '1.0',
    nodeTypes: [
      { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED', 'TESTING', 'SUPPORTED'], requiredFields: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'] },
      { name: 'experiment', prefix: 'exp', directory: 'experiments', statuses: ['PLANNED', 'RUNNING', 'COMPLETED'], requiredFields: ['id', 'type', 'title', 'status', 'created', 'updated'] },
    ],
    edgeTypes: {
      forward: ['supports', 'contradicts', 'confirms'],
      reverse: { supported_by: 'supports', confirmed_by: 'confirms' },
    },
    thresholds: { promotion_confidence: 0.9, support_strength_min: 0.7, min_independent_supports: 2 },
    transitions: {
      hypothesis: [
        { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'RUNNING' } }] },
      ],
    },
    validValues: {
      severities: ['FATAL', 'WEAKENING', 'TENSION'],
      impacts: ['DECISIVE', 'SIGNIFICANT', 'MINOR'],
    },
    ...overrides,
  };
}

describe('generateTypesFile', () => {
  const output = generateTypesFile(makeTestSchema());

  // ── FR-008: Generated header ──

  it('starts with @generated header comment', () => {
    expect(output.startsWith('// @generated — DO NOT EDIT. Source: graph-schema.yaml')).toBe(true);
  });

  // ── NodeType union ──

  it('generates NodeType union with sorted entries', () => {
    expect(output).toContain("export type NodeType =");
    expect(output).toContain("  | 'experiment'");
    expect(output).toContain("  | 'hypothesis'");
    // experiment before hypothesis (alphabetical)
    const expIdx = output.indexOf("  | 'experiment'");
    const hypIdx = output.indexOf("  | 'hypothesis'");
    expect(expIdx).toBeLessThan(hypIdx);
  });

  // ── NODE_TYPES array ──

  it('generates NODE_TYPES array', () => {
    expect(output).toContain('export const NODE_TYPES: NodeType[] = [');
    expect(output).toContain("  'experiment',");
    expect(output).toContain("  'hypothesis',");
  });

  // ── NODE_TYPE_DIRS ──

  it('generates NODE_TYPE_DIRS with correct values', () => {
    expect(output).toContain('export const NODE_TYPE_DIRS: Record<NodeType, string> = {');
    expect(output).toContain("  experiment: 'experiments',");
    expect(output).toContain("  hypothesis: 'hypotheses',");
  });

  // ── ID_PREFIXES ──

  it('generates ID_PREFIXES', () => {
    expect(output).toContain('export const ID_PREFIXES: Record<NodeType, string> = {');
    expect(output).toContain("  experiment: 'exp',");
    expect(output).toContain("  hypothesis: 'hyp',");
  });

  // ── PREFIX_TO_TYPE ──

  it('generates PREFIX_TO_TYPE with sorted prefixes', () => {
    expect(output).toContain('export const PREFIX_TO_TYPE: Record<string, NodeType> = {');
    expect(output).toContain("  exp: 'experiment',");
    expect(output).toContain("  hyp: 'hypothesis',");
    // exp before hyp (alphabetical)
    const expIdx = output.indexOf("  exp: 'experiment',");
    const hypIdx = output.indexOf("  hyp: 'hypothesis',");
    expect(expIdx).toBeLessThan(hypIdx);
  });

  // ── VALID_STATUSES ──

  it('generates VALID_STATUSES preserving YAML order', () => {
    expect(output).toContain('export const VALID_STATUSES: Record<NodeType, readonly string[]> = {');
    expect(output).toContain("  hypothesis: ['PROPOSED', 'TESTING', 'SUPPORTED'],");
  });

  // ── REQUIRED_FIELDS ──

  it('generates REQUIRED_FIELDS', () => {
    expect(output).toContain('export const REQUIRED_FIELDS: Record<NodeType, readonly string[]> = {');
    expect(output).toContain("  hypothesis: ['id', 'type', 'title', 'status', 'confidence', 'created', 'updated'],");
  });

  // ── EdgeType union ──

  it('generates EdgeType union with forward + reverse keys sorted', () => {
    expect(output).toContain("export type EdgeType =");
    // forward + reverse keys = confirms, confirmed_by, contradicts, supported_by, supports
    expect(output).toContain("  | 'confirmed_by'");
    expect(output).toContain("  | 'confirms'");
    expect(output).toContain("  | 'supports'");
  });

  // ── EDGE_TYPES ──

  it('generates EDGE_TYPES Set (forward only, sorted)', () => {
    expect(output).toContain('export const EDGE_TYPES = new Set<string>([');
    expect(output).toContain("  'confirms',");
    expect(output).toContain("  'contradicts',");
    expect(output).toContain("  'supports',");
    // Should NOT contain reverse keys
    expect(output).not.toMatch(/EDGE_TYPES[\s\S]*?'supported_by'[\s\S]*?\]/);
  });

  // ── REVERSE_LABELS ──

  it('generates REVERSE_LABELS with sorted keys', () => {
    expect(output).toContain('export const REVERSE_LABELS: Record<string, string> = {');
    expect(output).toContain("  confirmed_by: 'confirms',");
    expect(output).toContain("  supported_by: 'supports',");
  });

  // ── ALL_VALID_RELATIONS ──

  it('generates ALL_VALID_RELATIONS as computed Set', () => {
    expect(output).toContain('export const ALL_VALID_RELATIONS = new Set<string>([');
    expect(output).toContain('  ...EDGE_TYPES,');
    expect(output).toContain('  ...Object.keys(REVERSE_LABELS),');
  });

  // ── THRESHOLDS ──

  it('generates THRESHOLDS with correct values', () => {
    expect(output).toContain('export const THRESHOLDS = {');
    expect(output).toContain('  min_independent_supports: 2,');
    expect(output).toContain('  promotion_confidence: 0.9,');
    expect(output).toContain('  support_strength_min: 0.7,');
    expect(output).toContain('} as const;');
  });

  it('THRESHOLDS keys are sorted alphabetically', () => {
    const minIdx = output.indexOf('  min_independent_supports:');
    const proIdx = output.indexOf('  promotion_confidence:');
    const supIdx = output.indexOf('  support_strength_min:');
    expect(minIdx).toBeLessThan(proIdx);
    expect(proIdx).toBeLessThan(supIdx);
  });

  // ── Valid Values ──

  it('generates VALID_SEVERITIES', () => {
    expect(output).toContain("export const VALID_SEVERITIES = ['FATAL', 'WEAKENING', 'TENSION'] as const;");
  });

  it('generates VALID_IMPACTS', () => {
    expect(output).toContain("export const VALID_IMPACTS = ['DECISIVE', 'SIGNIFICANT', 'MINOR'] as const;");
  });

  // ── NFR-004: Formatting Rules ──

  it('uses section separator comments', () => {
    expect(output).toMatch(/\/\/ ── Node Types ─+/);
    expect(output).toMatch(/\/\/ ── Edge Types ─+/);
    expect(output).toMatch(/\/\/ ── Thresholds ─+/);
    expect(output).toMatch(/\/\/ ── Valid Values ─+/);
    expect(output).toMatch(/\/\/ ── ID Prefixes ─+/);
  });

  it('uses 2-space indentation (no tabs)', () => {
    const lines = output.split('\n');
    const indentedLines = lines.filter(l => l.startsWith(' '));
    for (const line of indentedLines) {
      expect(line).not.toMatch(/^\t/);
      const leadingSpaces = line.match(/^( *)/)?.[1].length ?? 0;
      expect(leadingSpaces % 2).toBe(0);
    }
  });

  it('uses trailing commas on all object/array entries', () => {
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Lines that are object/array entries (not closing brackets, not type unions, not comments, not blank)
      if (
        trimmed &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('|') &&
        !trimmed.startsWith('export') &&
        !trimmed.startsWith('}') &&
        !trimmed.startsWith(']') &&
        !trimmed.startsWith(';') &&
        !trimmed.startsWith('...') &&
        trimmed !== ''
      ) {
        // Object/array entries inside { } or [ ] should end with comma
        if (/^\w+:/.test(trimmed) || /^'[^']+':/.test(trimmed) || /^'[^']+',$/.test(trimmed)) {
          // Lines opening nested structures (ending with [ or {) are not leaf entries
          if (!trimmed.endsWith('[') && !trimmed.endsWith('{')) {
            expect(trimmed.endsWith(',')).toBe(true);
          }
        }
      }
    }
  });

  // ── EDGE_ATTRIBUTE_AFFINITY ──

  it('generates EDGE_ATTRIBUTE_AFFINITY from edgeAttributeAffinity', () => {
    const affinityOutput = generateTypesFile(makeTestSchema({
      edgeAttributeAffinity: {
        supports: ['strength'],
        contradicts: ['severity'],
        confirms: ['strength'],
      },
    }));
    expect(affinityOutput).toContain('export const EDGE_ATTRIBUTE_AFFINITY: Record<string, readonly string[]> = {');
    expect(affinityOutput).toContain("  confirms: ['strength'],");
    expect(affinityOutput).toContain("  contradicts: ['severity'],");
    expect(affinityOutput).toContain("  supports: ['strength'],");
  });

  it('EDGE_ATTRIBUTE_AFFINITY keys are sorted alphabetically', () => {
    const affinityOutput = generateTypesFile(makeTestSchema({
      edgeAttributeAffinity: {
        supports: ['strength'],
        contradicts: ['severity'],
        confirms: ['strength'],
      },
    }));
    const confirmIdx = affinityOutput.indexOf("  confirms: ['strength'],");
    const contradictIdx = affinityOutput.indexOf("  contradicts: ['severity'],");
    const supportIdx = affinityOutput.indexOf("  supports: ['strength'],");
    expect(confirmIdx).toBeLessThan(contradictIdx);
    expect(contradictIdx).toBeLessThan(supportIdx);
  });

  it('omits EDGE_ATTRIBUTE_AFFINITY when schema section is absent', () => {
    const noAffinityOutput = generateTypesFile(makeTestSchema());
    expect(noAffinityOutput).not.toContain('EDGE_ATTRIBUTE_AFFINITY');
  });

  // ── TRANSITION_POLICY_DEFAULT ──

  it('generates TRANSITION_POLICY_DEFAULT from transitionPolicy', () => {
    const policyOutput = generateTypesFile(makeTestSchema({
      transitionPolicy: { mode: 'strict' },
    }));
    expect(policyOutput).toContain("export const TRANSITION_POLICY_DEFAULT = 'strict' as const;");
  });

  it('generates TRANSITION_POLICY_DEFAULT with warn mode', () => {
    const policyOutput = generateTypesFile(makeTestSchema({
      transitionPolicy: { mode: 'warn' },
    }));
    expect(policyOutput).toContain("export const TRANSITION_POLICY_DEFAULT = 'warn' as const;");
  });

  it('omits TRANSITION_POLICY_DEFAULT when schema section is absent', () => {
    const noPolicyOutput = generateTypesFile(makeTestSchema());
    expect(noPolicyOutput).not.toContain('TRANSITION_POLICY_DEFAULT');
  });

  // ── Schema change detection ──

  it('modifying schema input changes generated output', () => {
    const schema = makeTestSchema();
    const original = generateTypesFile(schema);

    const modified = makeTestSchema({
      nodeTypes: [
        ...schema.nodeTypes,
        { name: 'milestone', prefix: 'mst', directory: 'milestones', statuses: ['PLANNED', 'REACHED'], requiredFields: ['id', 'type'] },
      ],
    });
    const changed = generateTypesFile(modified);

    expect(changed).not.toBe(original);
    expect(changed).toContain("  | 'milestone'");
    expect(changed).toContain("  milestone: 'milestones',");
  });
});

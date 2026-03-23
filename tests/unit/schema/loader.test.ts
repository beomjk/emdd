import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadSchema } from '../../../src/schema/loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'graph-schema.yaml');

describe('loadSchema', () => {
  it('loads and validates the real graph-schema.yaml', async () => {
    const schema = await loadSchema(SCHEMA_PATH);
    expect(schema.version).toBe('1.0');
    expect(schema.nodeTypes).toHaveLength(7);
    expect(schema.edgeTypes.forward).toHaveLength(16);
    expect(Object.keys(schema.edgeTypes.reverse)).toHaveLength(7);
    expect(Object.keys(schema.thresholds)).toHaveLength(10);
    expect(Object.values(schema.transitions).flat()).toHaveLength(13);
  });

  it('returns typed GraphSchema object with correct structure', async () => {
    const schema = await loadSchema(SCHEMA_PATH);
    const hyp = schema.nodeTypes.find(n => n.name === 'hypothesis');
    expect(hyp).toBeDefined();
    expect(hyp!.prefix).toBe('hyp');
    expect(hyp!.directory).toBe('hypotheses');
    expect(hyp!.statuses).toContain('PROPOSED');
    expect(hyp!.requiredFields).toContain('confidence');
  });

  it('rejects invalid YAML with clear Zod error', async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'schema-test-'));
    const badPath = path.join(tmpDir, 'graph-schema.yaml');
    writeFileSync(badPath, 'version: 123\nnodeTypes: "not-array"\n');

    await expect(loadSchema(badPath)).rejects.toThrow('validation failed');

    rmSync(tmpDir, { recursive: true });
  });

  it('rejects YAML missing required fields', async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'schema-test-'));
    const badPath = path.join(tmpDir, 'graph-schema.yaml');
    // Missing nodeTypes, edgeTypes, etc.
    writeFileSync(badPath, 'version: "1.0"\n');

    await expect(loadSchema(badPath)).rejects.toThrow('validation failed');

    rmSync(tmpDir, { recursive: true });
  });

  it('throws when file does not exist', async () => {
    await expect(loadSchema('/nonexistent/graph-schema.yaml')).rejects.toThrow();
  });

  describe('findSchemaFile (walk-up via cwd)', () => {
    let cwdSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      cwdSpy?.mockRestore();
    });

    it('loadSchema() finds schema by walking up from cwd subdirectory', async () => {
      // Point cwd to a subdirectory of the project root (which has graph-schema.yaml)
      const PROJECT_ROOT = path.resolve(__dirname, '../../..');
      cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(path.join(PROJECT_ROOT, 'src'));

      const schema = await loadSchema();
      expect(schema.version).toBe('1.0');
      expect(schema.nodeTypes.length).toBeGreaterThan(0);
    });

    it('loadSchema() throws when no graph-schema.yaml in any ancestor', async () => {
      const emptyDir = mkdtempSync(path.join(tmpdir(), 'schema-walk-'));
      cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(emptyDir);

      await expect(loadSchema()).rejects.toThrow('Could not find graph-schema.yaml');

      rmSync(emptyDir, { recursive: true });
    });
  });
});

describe('loadSchema referential integrity', () => {
  let tmpDir: string;

  function writeSchema(content: string): string {
    const p = path.join(tmpDir, 'graph-schema.yaml');
    writeFileSync(p, content);
    return p;
  }

  function makeValidSchema(overrides: Record<string, unknown> = {}): string {
    const base = {
      version: '1.0',
      nodeTypes: [
        { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED', 'TESTING'], requiredFields: ['id', 'type'] },
      ],
      edgeTypes: { forward: ['supports', 'contradicts'], reverse: { supported_by: 'supports' } },
      thresholds: { promotion_confidence: 0.9 },
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'hypothesis' } }] },
        ],
      },
      validValues: { severities: ['FATAL'] },
      ...overrides,
    };
    return writeSchema(
      // Use JSON-compatible YAML for simplicity
      JSON.stringify(base),
    );
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'schema-ri-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it('accepts a valid schema without errors', async () => {
    const p = makeValidSchema();
    const schema = await loadSchema(p);
    expect(schema.version).toBe('1.0');
  });

  it('rejects transition referencing non-existent status', async () => {
    const p = makeValidSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'INVALID_STATUS', conditions: [{ fn: 'has_linked', args: { type: 'hypothesis' } }] },
        ],
      },
    });

    await expect(loadSchema(p)).rejects.toThrow(/transitions\.hypothesis\[0\]/);
    await expect(loadSchema(p)).rejects.toThrow(/INVALID_STATUS/);
  });

  it('rejects condition referencing non-existent nodeType', async () => {
    const p = makeValidSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'nonexistent' } }] },
        ],
      },
    });

    await expect(loadSchema(p)).rejects.toThrow(/nonexistent/);
  });

  it('rejects condition referencing unknown preset fn', async () => {
    const p = makeValidSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'unknown_preset', args: {} }] },
        ],
      },
    });

    await expect(loadSchema(p)).rejects.toThrow(/unknown_preset/);
  });

  it('rejects duplicate from→to transition within same nodeType', async () => {
    const p = makeValidSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'hypothesis' } }] },
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'field_present', args: { name: 'title' } }] },
        ],
      },
    });

    await expect(loadSchema(p)).rejects.toThrow(/duplicate/i);
  });

  it('rejects duplicate prefix across nodeTypes', async () => {
    const p = makeValidSchema({
      nodeTypes: [
        { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED'], requiredFields: ['id'] },
        { name: 'experiment', prefix: 'hyp', directory: 'experiments', statuses: ['PLANNED'], requiredFields: ['id'] },
      ],
      transitions: {},
    });

    await expect(loadSchema(p)).rejects.toThrow(/duplicate prefix/i);
  });

  it('rejects condition referencing invalid relation', async () => {
    const p = makeValidSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { relation: 'nonexistent_relation' } }] },
        ],
      },
    });

    await expect(loadSchema(p)).rejects.toThrow(/nonexistent_relation/);
  });

  it('rejects condition referencing invalid status for referenced type', async () => {
    const p = makeValidSchema({
      nodeTypes: [
        { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED', 'TESTING'], requiredFields: ['id'] },
        { name: 'experiment', prefix: 'exp', directory: 'experiments', statuses: ['PLANNED', 'RUNNING'], requiredFields: ['id'] },
      ],
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'TESTING', conditions: [{ fn: 'has_linked', args: { type: 'experiment', status: 'NONEXISTENT' } }] },
        ],
      },
    });

    await expect(loadSchema(p)).rejects.toThrow(/NONEXISTENT/);
  });

  it('error messages include path location (NFR-003)', async () => {
    const p = makeValidSchema({
      transitions: {
        hypothesis: [
          { from: 'PROPOSED', to: 'INVALID', conditions: [{ fn: 'has_linked', args: {} }] },
        ],
      },
    });

    try {
      await loadSchema(p);
      expect.unreachable('should have thrown');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      // Must include dot-bracket path like "transitions.hypothesis[0]"
      expect(msg).toMatch(/transitions\.hypothesis\[0\]/);
      // Must include reason
      expect(msg).toMatch(/INVALID/);
    }
  });

  it('validates manualTransitions from/to statuses', async () => {
    const p = makeValidSchema({
      manualTransitions: {
        hypothesis: [{ from: 'NONEXISTENT', to: 'TESTING' }],
      },
    });

    await expect(loadSchema(p)).rejects.toThrow(/NONEXISTENT/);
  });

  it('loads successfully when only WARNING-level issues exist', async () => {
    const p = makeValidSchema({
      edgeAttributes: {
        strength: { type: 'number', min: 0, max: 1 },
      },
      edgeAttributeAffinity: {
        supports: ['strength', 'nonexistent_attr'],
      },
    });

    // Should not throw — 'nonexistent_attr' produces a WARNING, not an ERROR
    const schema = await loadSchema(p);
    expect(schema.version).toBe('1.0');
  });

  it('accepts manualTransitions with ANY as from', async () => {
    const p = makeValidSchema({
      manualTransitions: {
        hypothesis: [{ from: 'ANY', to: 'TESTING' }],
      },
    });

    const schema = await loadSchema(p);
    expect(schema.manualTransitions?.hypothesis).toHaveLength(1);
  });
});


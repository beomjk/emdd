import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { checkCompatibility } from '../../../src/schema/compat-checker.js';
import type { GraphSchema } from '../../../src/schema/validator.js';

function makeSchema(): GraphSchema {
  return {
    version: '1.0',
    nodeTypes: [
      { name: 'hypothesis', prefix: 'hyp', directory: 'hypotheses', statuses: ['PROPOSED', 'TESTING', 'SUPPORTED'], requiredFields: ['id', 'type'] },
      { name: 'experiment', prefix: 'exp', directory: 'experiments', statuses: ['PLANNED', 'RUNNING'], requiredFields: ['id', 'type'] },
    ],
    edgeTypes: { forward: ['supports', 'contradicts'], reverse: { supported_by: 'supports' } },
    thresholds: {},
    transitions: {},
    validValues: {},
  };
}

function writeNode(dir: string, subdir: string, filename: string, frontmatter: Record<string, unknown>): void {
  const fullDir = path.join(dir, subdir);
  mkdirSync(fullDir, { recursive: true });
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map(item => {
          if (typeof item === 'object') {
            const entries = Object.entries(item as Record<string, unknown>)
              .map(([ik, iv]) => `    ${ik}: ${iv}`)
              .join('\n');
            return `  -\n${entries}`;
          }
          return `  - ${item}`;
        }).join('\n')}`;
      }
      return `${k}: ${v}`;
    })
    .join('\n');
  writeFileSync(path.join(fullDir, filename), `---\n${yaml}\n---\n\nBody text\n`);
}

describe('checkCompatibility', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'compat-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it('returns no warnings for valid nodes', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001',
      type: 'hypothesis',
      status: 'PROPOSED',
    });

    const result = await checkCompatibility(makeSchema(), tmpDir);
    expect(result.compatible).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when node uses removed nodeType', async () => {
    writeNode(tmpDir, 'unknown', 'unk-001-test.md', {
      id: 'unk-001',
      type: 'finding',
      status: 'DRAFT',
    });

    const result = await checkCompatibility(makeSchema(), tmpDir);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain('finding');
  });

  it('warns when node uses removed status', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001',
      type: 'hypothesis',
      status: 'DRAFT',
    });

    const result = await checkCompatibility(makeSchema(), tmpDir);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain('DRAFT');
  });

  it('warns when link uses invalid relation', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001',
      type: 'hypothesis',
      status: 'PROPOSED',
      links: [{ relation: 'invalid_rel', target: 'exp-001' }],
    });

    const result = await checkCompatibility(makeSchema(), tmpDir);
    expect(result.warnings.some(w => w.message.includes('invalid_rel'))).toBe(true);
  });

  it('returns empty results for empty graph directory', async () => {
    mkdirSync(path.join(tmpDir, 'hypotheses'), { recursive: true });
    const result = await checkCompatibility(makeSchema(), tmpDir);
    expect(result.compatible).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns empty results when graph directory not found', async () => {
    const result = await checkCompatibility(makeSchema(), '/nonexistent/graph');
    expect(result.compatible).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('accepts valid reverse label as relation', async () => {
    writeNode(tmpDir, 'hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001',
      type: 'hypothesis',
      status: 'PROPOSED',
      links: [{ relation: 'supported_by', target: 'fnd-001' }],
    });

    const result = await checkCompatibility(makeSchema(), tmpDir);
    expect(result.warnings).toHaveLength(0);
  });
});

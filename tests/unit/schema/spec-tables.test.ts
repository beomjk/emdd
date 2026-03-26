import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { generateTable, updateSpecTables, updateAutoMarkers } from '../../../src/schema/spec-tables.js';

// ── generateTable ───────────────────────────────────────────────────

describe('generateTable', () => {
  it('generates node-types table', () => {
    const table = generateTable('node-types');
    expect(table).toContain('| Type | Prefix | Directory |');
    expect(table).toContain('| experiment | exp | experiments |');
    expect(table).toContain('| hypothesis | hyp | hypotheses |');
  });

  it('generates statuses table', () => {
    const table = generateTable('statuses');
    expect(table).toContain('| Type | Statuses |');
    expect(table).toContain('PROPOSED, TESTING, SUPPORTED');
  });

  it('generates edge-types table', () => {
    const table = generateTable('edge-types');
    expect(table).toContain('| # | Edge Type |');
    expect(table).toContain('contradicts');
    expect(table).toContain('supports');
  });

  it('generates reverse-labels table', () => {
    const table = generateTable('reverse-labels');
    expect(table).toContain('| Reverse Label | Forward Edge |');
    expect(table).toContain('| supported_by | supports |');
  });

  it('generates thresholds table', () => {
    const table = generateTable('thresholds');
    expect(table).toContain('| Threshold | Value |');
    expect(table).toContain('| promotion_confidence | 0.9 |');
    expect(table).toContain('| min_independent_supports | 2 |');
  });

  it('generates transition-rules table with per-nodeType sections', () => {
    const table = generateTable('transition-rules');
    expect(table).toContain('**hypothesis**');
    expect(table).toContain('| From | To | Conditions |');
    expect(table).toContain('| PROPOSED | TESTING |');
  });

  it('generates manual-transitions table', () => {
    const table = generateTable('manual-transitions');
    expect(table).toContain('**hypothesis**');
    expect(table).toContain('| From | To |');
    expect(table).toContain('| ANY | DEFERRED |');
  });

  it('includes auto-generation attribution comment (FR-008)', () => {
    for (const marker of ['node-types', 'statuses', 'edge-types', 'reverse-labels', 'thresholds']) {
      const table = generateTable(marker);
      expect(table).toContain('<!-- Generated from schema.config.ts — DO NOT EDIT -->');
    }
    // Transition tables delegated to state-engine have different attribution
    for (const marker of ['transition-rules', 'manual-transitions']) {
      const table = generateTable(marker);
      expect(table).toContain('<!-- Generated via @beomjk/state-engine — DO NOT EDIT -->');
    }
  });

  it('throws for unknown marker name', () => {
    expect(() => generateTable('unknown')).toThrow('Unknown marker name');
  });
});

// ── updateSpecTables ────────────────────────────────────────────────

describe('updateSpecTables', () => {
  let tmpDir: string;
  let specPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'spec-tables-'));
    specPath = path.join(tmpDir, 'SPEC.md');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it('replaces content between AUTO markers', async () => {
    writeFileSync(specPath, [
      'Some prose before.',
      '<!-- AUTO:node-types -->',
      'old content here',
      '<!-- /AUTO:node-types -->',
      'Some prose after.',
    ].join('\n'));

    const result = await updateSpecTables(specPath);
    expect(result.updatedSections).toContain('node-types');

    const updated = readFileSync(specPath, 'utf-8');
    expect(updated).toContain('| experiment | exp | experiments |');
    expect(updated).not.toContain('old content here');
  });

  it('preserves surrounding prose', async () => {
    writeFileSync(specPath, [
      'Prose before the table.',
      '',
      '<!-- AUTO:thresholds -->',
      'old table',
      '<!-- /AUTO:thresholds -->',
      '',
      'Prose after the table.',
    ].join('\n'));

    await updateSpecTables(specPath);

    const updated = readFileSync(specPath, 'utf-8');
    expect(updated).toContain('Prose before the table.');
    expect(updated).toContain('Prose after the table.');
    expect(updated).toContain('| promotion_confidence | 0.9 |');
  });

  it('handles multiple markers', async () => {
    writeFileSync(specPath, [
      '<!-- AUTO:node-types -->',
      'old',
      '<!-- /AUTO:node-types -->',
      '',
      '<!-- AUTO:statuses -->',
      'old',
      '<!-- /AUTO:statuses -->',
    ].join('\n'));

    const result = await updateSpecTables(specPath);
    expect(result.updatedSections).toContain('node-types');
    expect(result.updatedSections).toContain('statuses');
  });

  it('warns for missing markers without modifying file', async () => {
    writeFileSync(specPath, 'No markers here.\n');

    const result = await updateSpecTables(specPath);
    expect(result.warnings).toContain('No AUTO markers found in spec file');
    expect(result.unchanged).toBe(true);

    const content = readFileSync(specPath, 'utf-8');
    expect(content).toBe('No markers here.\n');
  });

  it('throws on unpaired opening marker', async () => {
    writeFileSync(specPath, '<!-- AUTO:node-types -->\nstuff\n');

    await expect(updateSpecTables(specPath)).rejects.toThrow(/[Uu]npaired/);
  });

  it('throws on unpaired closing marker', async () => {
    writeFileSync(specPath, 'stuff\n<!-- /AUTO:node-types -->\n');

    await expect(updateSpecTables(specPath)).rejects.toThrow(/[Uu]npaired/);
  });

  it('reports unchanged when generated content matches', async () => {
    // First run generates content
    writeFileSync(specPath, [
      '<!-- AUTO:thresholds -->',
      'old',
      '<!-- /AUTO:thresholds -->',
    ].join('\n'));
    await updateSpecTables(specPath);

    // Second run should be unchanged
    const result = await updateSpecTables(specPath);
    expect(result.unchanged).toBe(true);
  });

  it('warns for unknown marker name but does not modify', async () => {
    writeFileSync(specPath, [
      '<!-- AUTO:unknown-marker -->',
      'stuff',
      '<!-- /AUTO:unknown-marker -->',
    ].join('\n'));

    const result = await updateSpecTables(specPath);
    expect(result.warnings.some(w => w.includes('unknown-marker'))).toBe(true);
  });
});

// ── updateAutoMarkers ────────────────────────────────────────────────

describe('updateAutoMarkers', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'auto-markers-'));
    filePath = path.join(tmpDir, 'DOC.md');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it('replaces marker content with custom generators', async () => {
    const generators: Record<string, () => string> = {
      'my-section': () => '<!-- Generated -->\n| Col A | Col B |\n|-------|-------|\n| a1 | b1 |',
    };

    writeFileSync(filePath, [
      'Before.',
      '<!-- AUTO:my-section -->',
      'old stuff',
      '<!-- /AUTO:my-section -->',
      'After.',
    ].join('\n'));

    const result = await updateAutoMarkers(filePath, generators);
    expect(result.updatedSections).toContain('my-section');
    expect(result.unchanged).toBe(false);

    const updated = readFileSync(filePath, 'utf-8');
    expect(updated).toContain('| a1 | b1 |');
    expect(updated).not.toContain('old stuff');
    expect(updated).toContain('Before.');
    expect(updated).toContain('After.');
  });

  it('handles multiple custom generators', async () => {
    const generators: Record<string, () => string> = {
      'alpha': () => 'Alpha content',
      'beta': () => 'Beta content',
    };

    writeFileSync(filePath, [
      '<!-- AUTO:alpha -->',
      'old-a',
      '<!-- /AUTO:alpha -->',
      '',
      '<!-- AUTO:beta -->',
      'old-b',
      '<!-- /AUTO:beta -->',
    ].join('\n'));

    const result = await updateAutoMarkers(filePath, generators);
    expect(result.updatedSections).toEqual(expect.arrayContaining(['alpha', 'beta']));

    const updated = readFileSync(filePath, 'utf-8');
    expect(updated).toContain('Alpha content');
    expect(updated).toContain('Beta content');
  });

  it('warns for markers not in the generators map', async () => {
    const generators: Record<string, () => string> = {
      'known': () => 'Known content',
    };

    writeFileSync(filePath, [
      '<!-- AUTO:known -->',
      'old',
      '<!-- /AUTO:known -->',
      '<!-- AUTO:unknown -->',
      'old',
      '<!-- /AUTO:unknown -->',
    ].join('\n'));

    const result = await updateAutoMarkers(filePath, generators);
    expect(result.updatedSections).toContain('known');
    expect(result.warnings.some(w => w.includes('unknown'))).toBe(true);
  });

  it('updateSpecTables still works as regression', async () => {
    writeFileSync(filePath, [
      '<!-- AUTO:thresholds -->',
      'old',
      '<!-- /AUTO:thresholds -->',
    ].join('\n'));

    const result = await updateSpecTables(filePath);
    expect(result.updatedSections).toContain('thresholds');

    const updated = readFileSync(filePath, 'utf-8');
    expect(updated).toContain('| promotion_confidence | 0.9 |');
  });
});

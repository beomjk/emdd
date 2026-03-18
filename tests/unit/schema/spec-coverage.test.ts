import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseAssertMarkers,
  parseSpecTags,
  calculateCoverage,
} from '../../../src/schema/spec-coverage.js';
import type { AssertMarker, SpecTag } from '../../../src/schema/spec-coverage.js';

describe('parseAssertMarkers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-spec-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts ASSERT markers from spec content', async () => {
    const specPath = join(tmpDir, 'SPEC.md');
    writeFileSync(specPath, `
# Spec

## 6.2 Node Types

<!-- ASSERT §6.2.1: there are exactly 7 node types -->

Some text.

<!-- ASSERT §6.2.2: hypothesis has 7 statuses -->

More text.
`);

    const markers = await parseAssertMarkers(specPath);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toEqual({ section: '§6.2.1', description: 'there are exactly 7 node types' });
    expect(markers[1]).toEqual({ section: '§6.2.2', description: 'hypothesis has 7 statuses' });
  });

  it('returns empty array when no markers present', async () => {
    const specPath = join(tmpDir, 'SPEC.md');
    writeFileSync(specPath, '# Spec\n\nJust text, no markers.\n');

    const markers = await parseAssertMarkers(specPath);
    expect(markers).toHaveLength(0);
  });

  it('handles markers with extra whitespace', async () => {
    const specPath = join(tmpDir, 'SPEC.md');
    writeFileSync(specPath, '<!--  ASSERT §6.5.1:  transition rules for hypothesis  -->\n');

    const markers = await parseAssertMarkers(specPath);
    expect(markers).toHaveLength(1);
    expect(markers[0].section).toBe('§6.5.1');
    expect(markers[0].description).toBe('transition rules for hypothesis');
  });
});

describe('parseSpecTags', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-tags-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts @spec tags from test files', async () => {
    const testDir = join(tmpDir, 'tests');
    mkdirSync(join(testDir, 'unit'), { recursive: true });

    writeFileSync(join(testDir, 'unit', 'types.test.ts'), `
import { describe, it, expect } from 'vitest';

// @spec §6.2.1
it('has 7 types', () => {});

// @spec §6.2.2
it('hypothesis has correct statuses', () => {});
`);

    const tags = await parseSpecTags(testDir);
    expect(tags).toHaveLength(2);
    expect(tags[0].section).toBe('§6.2.1');
    expect(tags[0].file).toContain('types.test.ts');
    expect(tags[1].section).toBe('§6.2.2');
  });

  it('returns empty array when no test files exist', async () => {
    const testDir = join(tmpDir, 'empty');
    mkdirSync(testDir, { recursive: true });

    const tags = await parseSpecTags(testDir);
    expect(tags).toHaveLength(0);
  });

  it('finds tags across multiple files', async () => {
    const testDir = join(tmpDir, 'tests');
    mkdirSync(testDir, { recursive: true });

    writeFileSync(join(testDir, 'a.test.ts'), '// @spec §6.2.1\nit("a", () => {});\n');
    writeFileSync(join(testDir, 'b.test.ts'), '// @spec §6.5.1\nit("b", () => {});\n');

    const tags = await parseSpecTags(testDir);
    expect(tags).toHaveLength(2);
    const sections = tags.map(t => t.section).sort();
    expect(sections).toEqual(['§6.2.1', '§6.5.1']);
  });
});

describe('calculateCoverage', () => {
  it('computes correct coverage for fully covered markers', () => {
    const markers: AssertMarker[] = [
      { section: '§6.2.1', description: '7 node types' },
      { section: '§6.2.2', description: 'hypothesis statuses' },
    ];
    const tags: SpecTag[] = [
      { section: '§6.2.1', file: 'types.test.ts' },
      { section: '§6.2.2', file: 'types.test.ts' },
    ];

    const report = calculateCoverage(markers, tags);
    expect(report.totalCovered).toBe(2);
    expect(report.totalAssertions).toBe(2);
    expect(report.totalCoverage).toBe(1.0);
    expect(report.passed).toBe(true);
  });

  it('computes correct coverage for partially covered markers', () => {
    const markers: AssertMarker[] = [
      { section: '§6.2.1', description: '7 node types' },
      { section: '§6.2.2', description: 'hypothesis statuses' },
      { section: '§6.5.1', description: 'transition rules' },
      { section: '§6.7.1', description: 'confidence propagation' },
    ];
    const tags: SpecTag[] = [
      { section: '§6.2.1', file: 'types.test.ts' },
      { section: '§6.5.1', file: 'transitions.test.ts' },
    ];

    const report = calculateCoverage(markers, tags);
    expect(report.totalCovered).toBe(2);
    expect(report.totalAssertions).toBe(4);
    expect(report.totalCoverage).toBe(0.5);
    expect(report.passed).toBe(false); // default threshold is 0.8
  });

  it('threshold check: passes when coverage meets threshold', () => {
    const markers: AssertMarker[] = [
      { section: '§6.2.1', description: 'a' },
      { section: '§6.2.2', description: 'b' },
    ];
    const tags: SpecTag[] = [
      { section: '§6.2.1', file: 'test.ts' },
      { section: '§6.2.2', file: 'test.ts' },
    ];

    const report = calculateCoverage(markers, tags, 0.8);
    expect(report.passed).toBe(true);
  });

  it('threshold check: fails when coverage below threshold', () => {
    const markers: AssertMarker[] = [
      { section: '§6.2.1', description: 'a' },
      { section: '§6.2.2', description: 'b' },
      { section: '§6.5.1', description: 'c' },
    ];
    const tags: SpecTag[] = [
      { section: '§6.2.1', file: 'test.ts' },
    ];

    const report = calculateCoverage(markers, tags, 0.8);
    expect(report.passed).toBe(false);
  });

  it('warns when @spec tag references non-existent ASSERT section', () => {
    const markers: AssertMarker[] = [
      { section: '§6.2.1', description: 'a' },
    ];
    const tags: SpecTag[] = [
      { section: '§6.2.1', file: 'test.ts' },
      { section: '§99.1', file: 'test.ts' },
    ];

    const report = calculateCoverage(markers, tags);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toContain('§99.1');
    expect(report.warnings[0]).toContain('non-existent');
  });

  it('0 ASSERT markers: warning and passes', () => {
    const markers: AssertMarker[] = [];
    const tags: SpecTag[] = [
      { section: '§6.2.1', file: 'test.ts' },
    ];

    const report = calculateCoverage(markers, tags);
    expect(report.warnings).toContain('No ASSERT markers found');
    expect(report.passed).toBe(true);
    expect(report.totalAssertions).toBe(0);
  });

  it('groups markers by major section', () => {
    const markers: AssertMarker[] = [
      { section: '§6.2.1', description: 'a' },
      { section: '§6.2.2', description: 'b' },
      { section: '§6.5.1', description: 'c' },
    ];
    const tags: SpecTag[] = [
      { section: '§6.2.1', file: 'test.ts' },
    ];

    const report = calculateCoverage(markers, tags);
    expect(report.sections).toHaveLength(2);
    const s62 = report.sections.find(s => s.section === '§6.2');
    expect(s62).toBeDefined();
    expect(s62!.totalCount).toBe(2);
    expect(s62!.coveredCount).toBe(1);
  });

  it('uses custom threshold', () => {
    const markers: AssertMarker[] = [
      { section: '§6.2.1', description: 'a' },
      { section: '§6.2.2', description: 'b' },
    ];
    const tags: SpecTag[] = [
      { section: '§6.2.1', file: 'test.ts' },
    ];

    // 50% coverage with 40% threshold should pass
    const report = calculateCoverage(markers, tags, 0.4);
    expect(report.passed).toBe(true);
    expect(report.threshold).toBe(0.4);
  });
});

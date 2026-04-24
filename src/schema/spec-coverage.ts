#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { glob } from 'glob';

// ── Types ──────────────────────────────────────────────────────────

export interface AssertMarker {
  section: string;
  description: string;
}

export interface SpecTag {
  section: string;
  file: string;
}

export interface SectionCoverage {
  section: string;
  assertions: { id: string; description: string; covered: boolean }[];
  coveredCount: number;
  totalCount: number;
  coveragePercent: number; // 0.0-1.0
}

export interface CoverageReport {
  sections: SectionCoverage[];
  totalCovered: number;
  totalAssertions: number;
  totalCoverage: number; // 0.0-1.0
  threshold: number; // 0.0-1.0
  passed: boolean;
  warnings: string[];
}

// ── Parsing ────────────────────────────────────────────────────────

const ASSERT_REGEX = /<!--\s*ASSERT\s+(§[\d.]+[a-z]?(?:\.[\d]+)*):\s*(.+?)\s*-->/g;
const SPEC_TAG_REGEX = /\/\/\s*@spec\s+(§[\d.]+[a-z]?(?:\.[\d]+)*)/g;

export async function parseAssertMarkers(specPath: string): Promise<AssertMarker[]> {
  const content = await readFile(specPath, 'utf-8');
  const markers: AssertMarker[] = [];
  let match: RegExpExecArray | null;

  while ((match = ASSERT_REGEX.exec(content)) !== null) {
    markers.push({
      section: match[1],
      description: match[2],
    });
  }

  return markers;
}

export async function parseSpecTags(testDir: string): Promise<SpecTag[]> {
  const files = await glob('**/*.test.ts', { cwd: testDir });
  const tags: SpecTag[] = [];

  for (const file of files) {
    const content = await readFile(join(testDir, file), 'utf-8');
    let match: RegExpExecArray | null;
    const regex = new RegExp(SPEC_TAG_REGEX.source, 'g');

    while ((match = regex.exec(content)) !== null) {
      tags.push({
        section: match[1],
        file,
      });
    }
  }

  return tags;
}

// ── Coverage Calculation ───────────────────────────────────────────

export function calculateCoverage(
  markers: AssertMarker[],
  tags: SpecTag[],
  threshold: number = 0.8,
): CoverageReport {
  const warnings: string[] = [];

  // Check for @spec tags referencing non-existent ASSERT sections
  const assertSections = new Set(markers.map((m) => m.section));
  const tagSections = new Set(tags.map((t) => t.section));

  for (const tag of tags) {
    if (!assertSections.has(tag.section)) {
      warnings.push(
        `@spec tag references non-existent ASSERT section ${tag.section} in ${tag.file}`,
      );
    }
  }

  if (markers.length === 0) {
    return {
      sections: [],
      totalCovered: 0,
      totalAssertions: 0,
      totalCoverage: 0,
      threshold,
      passed: true,
      warnings: ['No ASSERT markers found'],
    };
  }

  // Group markers by major section (e.g., §6.2)
  const sectionMap = new Map<string, AssertMarker[]>();
  for (const marker of markers) {
    // Extract major section: §6.2.1 -> §6.2, §6.7 -> §6.7
    const parts = marker.section.split('.');
    const majorSection = parts.length >= 2 ? parts.slice(0, 2).join('.') : marker.section;
    const key = majorSection.startsWith('§') ? majorSection : `§${majorSection}`;

    if (!sectionMap.has(key)) {
      sectionMap.set(key, []);
    }
    sectionMap.get(key)!.push(marker);
  }

  const sections: SectionCoverage[] = [];

  for (const [section, sectionMarkers] of sectionMap) {
    const assertions = sectionMarkers.map((m) => ({
      id: m.section,
      description: m.description,
      covered: tagSections.has(m.section),
    }));

    const coveredCount = assertions.filter((a) => a.covered).length;

    sections.push({
      section,
      assertions,
      coveredCount,
      totalCount: assertions.length,
      coveragePercent: coveredCount / assertions.length,
    });
  }

  // Sort sections
  sections.sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }));

  const totalCovered = sections.reduce((sum, s) => sum + s.coveredCount, 0);
  const totalAssertions = markers.length;
  const totalCoverage = totalAssertions > 0 ? totalCovered / totalAssertions : 0;

  return {
    sections,
    totalCovered,
    totalAssertions,
    totalCoverage,
    threshold,
    passed: totalCoverage >= threshold,
    warnings,
  };
}

// ── CLI Entry Point ────────────────────────────────────────────────

function printReport(report: CoverageReport): void {
  if (report.warnings.length > 0) {
    for (const w of report.warnings) {
      console.warn(`⚠ ${w}`);
    }
  }

  if (report.totalAssertions === 0) {
    return;
  }

  // Table header
  console.log('');
  console.log('Section        | Covered | Total | Coverage');
  console.log('-------------- | ------- | ----- | --------');

  for (const s of report.sections) {
    const pct = (s.coveragePercent * 100).toFixed(0);
    console.log(
      `${s.section.padEnd(14)} | ${String(s.coveredCount).padStart(7)} | ${String(s.totalCount).padStart(5)} | ${pct.padStart(7)}%`,
    );
  }

  console.log('-------------- | ------- | ----- | --------');
  const totalPct = (report.totalCoverage * 100).toFixed(0);
  console.log(
    `${'TOTAL'.padEnd(14)} | ${String(report.totalCovered).padStart(7)} | ${String(report.totalAssertions).padStart(5)} | ${totalPct.padStart(7)}%`,
  );
  console.log('');

  const thresholdPct = (report.threshold * 100).toFixed(0);
  if (report.passed) {
    console.log(`✓ Coverage ${totalPct}% meets threshold ${thresholdPct}%`);
  } else {
    console.log(`✗ Coverage ${totalPct}% below threshold ${thresholdPct}%`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let threshold = 80;
  const thresholdIdx = args.indexOf('--threshold');
  if (thresholdIdx !== -1 && args[thresholdIdx + 1]) {
    threshold = parseInt(args[thresholdIdx + 1], 10);
    if (isNaN(threshold)) {
      console.error('Invalid threshold value');
      process.exit(1);
    }
  }

  const specPath = join(process.cwd(), 'docs/spec/SPEC_EN.md');
  const testDir = join(process.cwd(), 'tests');

  const markers = await parseAssertMarkers(specPath);
  const tags = await parseSpecTags(testDir);
  const report = calculateCoverage(markers, tags, threshold / 100);

  printReport(report);

  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

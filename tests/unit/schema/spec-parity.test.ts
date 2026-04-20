import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const SPEC_EN = readFileSync(join(ROOT, 'docs/spec/SPEC_EN.md'), 'utf-8');
const SPEC_KO = readFileSync(join(ROOT, 'docs/spec/SPEC_KO.md'), 'utf-8');

// Extract ordered list of numbered section headers (e.g., "6.5a", "6.10").
// Strips language-specific titles so we compare only the number hierarchy.
function extractSectionNumbers(md: string): string[] {
  const out: string[] = [];
  const lines = md.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    // Match "## 6.", "### 6.2", "#### 6.5a" — numeric prefix with optional a/b suffix.
    const m = line.match(/^#{2,5}\s+(\d+(?:\.\d+[a-z]?)*)\s/);
    if (m) out.push(m[1]);
  }
  return out;
}

function extractAssertSections(md: string): string[] {
  const re = /<!--\s*ASSERT\s+§([\d.]+[a-z]?(?:\.[\d]+)*):/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out;
}

function extractAutoMarkers(md: string): string[] {
  const re = /<!--\s*AUTO:([\w-]+)\s*-->/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out.sort();
}

describe('SPEC_EN ↔ SPEC_KO structural parity', () => {
  it('section number hierarchy matches', () => {
    const en = extractSectionNumbers(SPEC_EN);
    const ko = extractSectionNumbers(SPEC_KO);
    expect(ko).toEqual(en);
  });

  it('top-level (## N) section count matches', () => {
    const enTop = extractSectionNumbers(SPEC_EN).filter(s => !s.includes('.'));
    const koTop = extractSectionNumbers(SPEC_KO).filter(s => !s.includes('.'));
    expect(koTop).toEqual(enTop);
  });

  it('AUTO marker names match between locales', () => {
    expect(extractAutoMarkers(SPEC_KO)).toEqual(extractAutoMarkers(SPEC_EN));
  });

  // ASSERT markers live only in SPEC_EN (the canonical source). Make sure
  // SPEC_KO doesn't accidentally carry ASSERTs that would drift.
  it('ASSERT markers live only in SPEC_EN', () => {
    expect(extractAssertSections(SPEC_EN).length).toBeGreaterThan(0);
    expect(extractAssertSections(SPEC_KO)).toEqual([]);
  });
});

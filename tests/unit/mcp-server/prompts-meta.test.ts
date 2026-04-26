import { describe, it, expect } from 'vitest';
import { PROMPT_META } from '../../../src/mcp-server/prompts/meta.js';
import { PROMPT_LIMITS } from '../../../src/mcp-server/prompts/prompt-limits.js';

describe('PROMPT_META', () => {
  it('defines exactly 4 prompts (session cycle)', () => {
    expect(PROMPT_META).toHaveLength(4);
  });

  it('every prompt has a non-empty name and description', () => {
    for (const meta of PROMPT_META) {
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it('prompt names are unique', () => {
    const names = PROMPT_META.map(m => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('names match the advertised session-cycle set', () => {
    expect(PROMPT_META.map(m => m.name).sort()).toEqual(
      ['consolidation', 'context-loading', 'episode-creation', 'health-review'],
    );
  });

  it('all prompts opt into graphDir and lang parameters', () => {
    for (const meta of PROMPT_META) {
      expect(meta.hasGraphDir).toBe(true);
      expect(meta.hasLang).toBe(true);
    }
  });

  it('session-cycle group has contiguous order 1..4', () => {
    const grouped = PROMPT_META
      .filter(m => m.group === 'session-cycle')
      .map(m => m.order)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(grouped).toEqual([1, 2, 3, 4]);
  });

  it('every session-cycle prompt has a numeric order', () => {
    for (const meta of PROMPT_META) {
      if (meta.group === 'session-cycle') {
        expect(typeof meta.order).toBe('number');
      }
    }
  });
});

describe('PROMPT_LIMITS', () => {
  it('all limits are positive integers', () => {
    for (const [key, value] of Object.entries(PROMPT_LIMITS)) {
      expect(Number.isInteger(value), `${key} must be integer`).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('episodeDirective is smaller than episodeArc (directives are a focused subset)', () => {
    expect(PROMPT_LIMITS.episodeDirective).toBeLessThan(PROMPT_LIMITS.episodeArc);
  });

  it('exposes expected keys', () => {
    const keys = Object.keys(PROMPT_LIMITS).sort();
    expect(keys).toEqual([
      'activeFrontier',
      'backlogDigest',
      'blockedStreakThreshold',
      'episodeArc',
      'episodeDirective',
      'openQuestions',
      'recentNodes',
    ]);
  });
});

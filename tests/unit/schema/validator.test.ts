import { describe, it, expect } from 'vitest';
import { VALID_PRESET_FNS, type ValidationError } from '../../../src/schema/validator.js';
import { BUILTIN_PRESET_NAMES } from '../../../src/schema/preset-names.js';
import { builtinPresets } from '@beomjk/state-engine/presets';

// ── ValidationError type ────────────────────────────────────────────

describe('ValidationError type', () => {
  it('has the expected shape', () => {
    const err: ValidationError = {
      path: 'test.path',
      message: 'test message',
      severity: 'ERROR',
    };
    expect(err.path).toBe('test.path');
    expect(err.message).toBe('test message');
    expect(err.severity).toBe('ERROR');
  });
});

// ── VALID_PRESET_FNS ────────────────────────────────────────────────

describe('VALID_PRESET_FNS', () => {
  it('exports VALID_PRESET_FNS list', () => {
    expect(VALID_PRESET_FNS).toContain('has_linked');
    expect(VALID_PRESET_FNS).toContain('field_present');
    expect(VALID_PRESET_FNS).toContain('field_equals');
    expect(VALID_PRESET_FNS).toContain('min_linked_count');
    expect(VALID_PRESET_FNS).toContain('all_linked_with');
    expect(VALID_PRESET_FNS).toHaveLength(5);
  });

  it('BUILTIN_PRESET_NAMES matches actual builtinPresets keys', () => {
    const actualKeys = Object.keys(builtinPresets).sort();
    const declared = [...BUILTIN_PRESET_NAMES].sort();
    expect(declared).toEqual(actualKeys);
  });
});

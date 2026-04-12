import { describe, it, expect } from 'vitest';
import {
  NODE_COLORS,
  getNodeColor,
  getStatusBorder,
  STATUS_BORDER_LEGEND,
} from '../../../src/web/constants.js';

describe('NODE_COLORS / getNodeColor', () => {
  it('returns correct color for each known type', () => {
    expect(getNodeColor('hypothesis')).toBe('#4A90D9');
    expect(getNodeColor('experiment')).toBe('#7B68EE');
    expect(getNodeColor('finding')).toBe('#50C878');
    expect(getNodeColor('knowledge')).toBe('#DAA520');
    expect(getNodeColor('question')).toBe('#FF8C42');
    expect(getNodeColor('episode')).toBe('#A0A0A0');
    expect(getNodeColor('decision')).toBe('#20B2AA');
  });

  it('returns #999 for unknown type', () => {
    expect(getNodeColor('unknown_type')).toBe('#999');
    expect(getNodeColor('')).toBe('#999');
  });

  it('NODE_COLORS has 7 entries', () => {
    expect(Object.keys(NODE_COLORS)).toHaveLength(7);
  });
});

describe('getStatusBorder', () => {
  it('returns dashed orange for invalid node', () => {
    const result = getStatusBorder({ status: 'SUPPORTED', invalid: true });
    expect(result).toEqual({ width: 2, style: 'dashed', color: '#FF9800' });
  });

  it('returns solid green for positive status', () => {
    const result = getStatusBorder({ status: 'SUPPORTED' });
    expect(result).toEqual({ width: 3, style: 'solid', color: '#2ECC71' });
  });

  it('returns dashed red for negative status', () => {
    const result = getStatusBorder({ status: 'REFUTED' });
    expect(result).toEqual({ width: 2, style: 'dashed', color: '#E74C3C' });
  });

  it('returns solid blue for in-progress status', () => {
    const result = getStatusBorder({ status: 'TESTING' });
    expect(result).toEqual({ width: 2, style: 'solid', color: '#3498DB' });
  });

  it('returns dashed gray for terminal status', () => {
    const result = getStatusBorder({ status: 'DEFERRED' });
    expect(result).toEqual({ width: 2, style: 'dashed', color: '#95A5A6' });
  });

  it('returns thin solid gray for initial/unknown status', () => {
    const result = getStatusBorder({ status: 'PROPOSED' });
    expect(result).toEqual({ width: 1, style: 'solid', color: '#95A5A6' });
  });

  it.each(['SUPPORTED', 'VALIDATED', 'ACCEPTED', 'ACTIVE', 'ANSWERED', 'COMPLETED', 'PROMOTED'])(
    'returns solid green (width 3) for positive status %s',
    (status) => {
      const result = getStatusBorder({ status });
      expect(result).toEqual({ width: 3, style: 'solid', color: '#2ECC71' });
    },
  );

  it.each(['ABANDONED', 'FAILED', 'REFUTED', 'RETRACTED', 'REVERTED'])(
    'returns dashed red (width 2) for negative status %s',
    (status) => {
      const result = getStatusBorder({ status });
      expect(result).toEqual({ width: 2, style: 'dashed', color: '#E74C3C' });
    },
  );

  it.each(['CONTESTED', 'DISPUTED', 'RUNNING', 'TESTING'])(
    'returns solid blue (width 2) for in-progress status %s',
    (status) => {
      const result = getStatusBorder({ status });
      expect(result).toEqual({ width: 2, style: 'solid', color: '#3498DB' });
    },
  );

  it.each(['DEFERRED', 'RESOLVED', 'REVISED', 'SUPERSEDED'])(
    'returns dashed gray (width 2) for terminal status %s',
    (status) => {
      const result = getStatusBorder({ status });
      expect(result).toEqual({ width: 2, style: 'dashed', color: '#95A5A6' });
    },
  );

  it.each(['DRAFT', 'OPEN', 'PLANNED', 'PROPOSED'])(
    'returns solid gray (width 1) for initial status %s',
    (status) => {
      const result = getStatusBorder({ status });
      expect(result).toEqual({ width: 1, style: 'solid', color: '#95A5A6' });
    },
  );
});

describe('STATUS_BORDER_LEGEND', () => {
  it('has exactly 6 entries', () => {
    expect(STATUS_BORDER_LEGEND).toHaveLength(6);
  });

  it('includes Invalid entry (UI-only)', () => {
    const labels = STATUS_BORDER_LEGEND.map(([label]) => label);
    expect(labels).toContain('Invalid');
  });

  it('each entry has [label, borderStyle, borderColor, borderWidth]', () => {
    for (const entry of STATUS_BORDER_LEGEND) {
      expect(entry).toHaveLength(4);
      expect(typeof entry[0]).toBe('string');
      expect(typeof entry[1]).toBe('string');
      expect(typeof entry[2]).toBe('string');
      expect(typeof entry[3]).toBe('number');
    }
  });
});

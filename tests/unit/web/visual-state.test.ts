import { describe, expect, it } from 'vitest';
import {
  GRAPH_MOTION_PROFILE,
  getClusterVisualState,
  getNodeVisualState,
  resolveGraphTheme,
} from '../../../src/web/visual-state.js';

describe('visual-state', () => {
  describe('resolveGraphTheme', () => {
    it('falls back to light for unsupported themes', () => {
      expect(resolveGraphTheme('light')).toBe('light');
      expect(resolveGraphTheme('dark')).toBe('dark');
      expect(resolveGraphTheme('sepia')).toBe('light');
      expect(resolveGraphTheme(undefined)).toBe('light');
    });
  });

  describe('GRAPH_MOTION_PROFILE', () => {
    it('defines the shared focus and layout timing contract', () => {
      expect(GRAPH_MOTION_PROFILE).toEqual({
        focusTransitionMs: 300,
        selectionEmphasisMs: 300,
        layoutTransitionMs: 500,
        groupFocusTransitionMs: 500,
      });
    });
  });

  describe('getNodeVisualState', () => {
    it('returns theme-aware selected-node tokens with non-color cues', () => {
      const token = getNodeVisualState(
        { type: 'hypothesis', status: 'SUPPORTED' },
        { theme: 'dark', stateKind: 'selected' },
      );

      expect(token.elementKind).toBe('node');
      expect(token.stateKind).toBe('selected');
      expect(token.theme).toBe('dark');
      expect(token.fillColor).toBe('#4A90D9');
      expect(token.textColor).toBe('#F5F7FA');
      expect(token.borderWidth).toBeGreaterThanOrEqual(4);
      expect(token.borderStyle).toBe('solid');
      expect(token.nonColorCue).toContain('thick-border');
    });

    it('returns invalid-node fallback styling with non-color cues', () => {
      const token = getNodeVisualState(
        { type: 'unknown', status: 'SUPPORTED', invalid: true },
        { theme: 'light' },
      );

      expect(token.stateKind).toBe('invalid');
      expect(token.fillColor).toBe('#999');
      expect(token.borderColor).toBe('#FF9800');
      expect(token.borderStyle).toBe('dashed');
      expect(token.nonColorCue).toContain('dashed-border');
    });
  });

  describe('getClusterVisualState', () => {
    it('returns grouped-region tokens with a shape cue', () => {
      const token = getClusterVisualState({ theme: 'dark', isManual: true });

      expect(token.elementKind).toBe('cluster');
      expect(token.stateKind).toBe('grouped');
      expect(token.theme).toBe('dark');
      expect(token.shape).toBe('roundrectangle');
      expect(token.borderStyle).toBe('solid');
      expect(token.nonColorCue).toContain('container-shape');
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { GRAPH_MOTION_PROFILE } from '../../../src/web/visual-state.js';

// Mock cytoscape and plugins before import
vi.mock('cytoscape', () => {
  const use = vi.fn();
  const cytoscape = Object.assign(vi.fn(), { use });
  return { default: cytoscape };
});
vi.mock('cytoscape-fcose', () => ({ default: vi.fn() }));
vi.mock('cytoscape-dagre', () => ({ default: vi.fn() }));

import {
  getForceLayout,
  getHierarchicalLayout,
  getLayoutConfig,
} from '../../../src/web/frontend/lib/cytoscape-setup.js';

describe('cytoscape-setup', () => {
  describe('getForceLayout', () => {
    it('returns fcose layout with proof quality by default', () => {
      const layout = getForceLayout();
      expect(layout).toEqual({
        name: 'fcose',
        animate: false,
        animationDuration: 0,
        quality: 'proof',
        nodeDimensionsIncludeLabels: true,
      });
    });

    it('uses animate with duration when animate=true', () => {
      const layout = getForceLayout(true);
      expect(layout.animate).toBe(true);
      expect(layout.animationDuration).toBe(GRAPH_MOTION_PROFILE.layoutTransitionMs);
    });

    it('uses default quality when initial=false', () => {
      const layout = getForceLayout(false, false);
      expect(layout.quality).toBe('default');
    });

    it('uses proof quality when initial=true', () => {
      const layout = getForceLayout(true, true);
      expect(layout.quality).toBe('proof');
    });
  });

  describe('getHierarchicalLayout', () => {
    it('returns dagre layout with TB direction', () => {
      const layout = getHierarchicalLayout();
      expect(layout.name).toBe('dagre');
      expect(layout.rankDir).toBe('TB');
      expect(layout.nodeSep).toBe(50);
      expect(layout.rankSep).toBe(80);
      expect(layout.animate).toBe(false);
      expect(layout.nodeDimensionsIncludeLabels).toBe(true);
    });

    it('uses the shared layout motion profile when animated', () => {
      const layout = getHierarchicalLayout(true);
      expect(layout.animate).toBe(true);
      expect(layout.animationDuration).toBe(GRAPH_MOTION_PROFILE.layoutTransitionMs);
    });

    it('has a sort function that orders by type tier', () => {
      const layout = getHierarchicalLayout();
      const mockNode = (type: string) => ({ data: (key: string) => key === 'type' ? type : undefined });

      // question (0) < hypothesis (1)
      expect(layout.sort(mockNode('question'), mockNode('hypothesis'))).toBeLessThan(0);
      // hypothesis (1) < experiment (2)
      expect(layout.sort(mockNode('hypothesis'), mockNode('experiment'))).toBeLessThan(0);
      // experiment (2) < finding (3)
      expect(layout.sort(mockNode('experiment'), mockNode('finding'))).toBeLessThan(0);
      // finding (3) < knowledge (4)
      expect(layout.sort(mockNode('finding'), mockNode('knowledge'))).toBeLessThan(0);
      // Same tier → 0
      expect(layout.sort(mockNode('experiment'), mockNode('episode'))).toBe(0);
      // Unknown type defaults to tier 2
      expect(layout.sort(mockNode('unknown'), mockNode('experiment'))).toBe(0);
    });
  });

  describe('getLayoutConfig', () => {
    it('returns force layout for "force" mode', () => {
      const layout = getLayoutConfig('force');
      expect(layout.name).toBe('fcose');
    });

    it('returns hierarchical layout for "hierarchical" mode', () => {
      const layout = getLayoutConfig('hierarchical');
      expect(layout.name).toBe('dagre');
    });

    it('passes animate and initial params to force layout', () => {
      const layout = getLayoutConfig('force', true, false);
      expect(layout.animate).toBe(true);
      expect((layout as any).quality).toBe('default');
    });

    it('passes animate param to hierarchical layout', () => {
      const layout = getLayoutConfig('hierarchical', true);
      expect(layout.animate).toBe(true);
    });
  });
});

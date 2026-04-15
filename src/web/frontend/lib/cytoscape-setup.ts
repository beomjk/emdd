import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import dagre from 'cytoscape-dagre';
import type { NodeType } from '../../../graph/types.js';
import type { LayoutMode } from '../../types.js';
import { GRAPH_MOTION_PROFILE } from '../../visual-state.js';

// Register plugins once
cytoscape.use(fcose);
cytoscape.use(dagre);

// Hierarchical tier order: question → hypothesis → experiment → finding → knowledge
const TYPE_TIER: Record<NodeType, number> = {
  question: 0,
  hypothesis: 1,
  experiment: 2,
  finding: 3,
  knowledge: 4,
  episode: 2,
  decision: 3,
};

const NODE_FOCUS_ZOOM = 1.5;
const GROUP_FOCUS_PADDING = 40;

export function getForceLayout(animate = false, initial = true) {
  return {
    name: 'fcose' as const,
    animate,
    animationDuration: animate ? GRAPH_MOTION_PROFILE.layoutTransitionMs : 0,
    quality: (initial ? 'proof' : 'default') as 'proof' | 'default',
    nodeDimensionsIncludeLabels: true,
  };
}

export function getHierarchicalLayout(animate = false) {
  return {
    name: 'dagre' as const,
    rankDir: 'TB',
    nodeSep: 50,
    rankSep: 80,
    animate,
    animationDuration: animate ? GRAPH_MOTION_PROFILE.layoutTransitionMs : 0,
    nodeDimensionsIncludeLabels: true,
    sort: (a: any, b: any) => {
      const tierA = TYPE_TIER[a.data('type') as NodeType] ?? 2;
      const tierB = TYPE_TIER[b.data('type') as NodeType] ?? 2;
      return tierA - tierB;
    },
  };
}

export function getLayoutConfig(mode: LayoutMode, animate = false, initial = true) {
  return mode === 'hierarchical'
    ? getHierarchicalLayout(animate)
    : getForceLayout(animate, initial);
}

export function getNodeFocusAnimation(node: cytoscape.SingularElementArgument) {
  return [
    { center: { eles: node }, zoom: NODE_FOCUS_ZOOM } as const,
    { duration: GRAPH_MOTION_PROFILE.focusTransitionMs } as const,
  ];
}

export function getClusterFocusAnimation(children: cytoscape.CollectionReturnValue) {
  return [
    { fit: { eles: children, padding: GROUP_FOCUS_PADDING } } as const,
    { duration: GRAPH_MOTION_PROFILE.groupFocusTransitionMs } as const,
  ];
}

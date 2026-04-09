import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import dagre from 'cytoscape-dagre';
import type { NodeType } from '../../../graph/types.js';

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

export function getForceLayout(animate = false, initial = true) {
  return {
    name: 'fcose' as const,
    animate,
    animationDuration: animate ? 500 : 0,
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
    animationDuration: animate ? 500 : 0,
    nodeDimensionsIncludeLabels: true,
    sort: (a: any, b: any) => {
      const tierA = TYPE_TIER[a.data('type') as NodeType] ?? 2;
      const tierB = TYPE_TIER[b.data('type') as NodeType] ?? 2;
      return tierA - tierB;
    },
  };
}

export function getLayoutConfig(mode: 'force' | 'hierarchical', animate = false, initial = true) {
  return mode === 'hierarchical'
    ? getHierarchicalLayout(animate)
    : getForceLayout(animate, initial);
}

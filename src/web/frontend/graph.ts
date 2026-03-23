import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import dagre from 'cytoscape-dagre';
import type { SerializedGraph } from '../types.js';
import type { NodeType } from '../../graph/types.js';
import { getClusterStyles } from './clusters.js';
import { getNodeColor, getStatusBorder } from './constants.js';

cytoscape.use(fcose);
cytoscape.use(dagre);

// ── Visual encoding ──────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// ── Graph rendering ──────────────────────────────────────────────────

let cy: cytoscape.Core | null = null;

export function getCy(): cytoscape.Core | null {
  return cy;
}

export function renderGraph(
  container: HTMLElement,
  graph: SerializedGraph,
  callbacks: {
    onNodeClick?: (id: string) => void;
    onNodeSelect?: (id: string) => void;
    onBackgroundClick?: () => void;
  } = {},
): cytoscape.Core {
  const elements: cytoscape.ElementDefinition[] = [];

  for (const node of graph.nodes) {
    const border = getStatusBorder(node);
    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label: truncate(node.title || node.id, 20),
        type: node.type,
        status: node.status,
        invalid: node.invalid ?? false,
        bgColor: getNodeColor(node.type),
        borderWidth: border.width,
        borderStyle: border.style,
        borderColor: border.color,
      },
    });
  }

  for (const edge of graph.edges) {
    // Only add edges where both source and target exist
    const sourceExists = graph.nodes.some((n) => n.id === edge.source);
    const targetExists = graph.nodes.some((n) => n.id === edge.target);
    if (sourceExists && targetExists) {
      elements.push({
        group: 'edges',
        data: {
          id: `${edge.source}-${edge.relation}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          relation: edge.relation,
        },
      });
    }
  }

  cy = cytoscape({
    container,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(bgColor)',
          'border-width': 'data(borderWidth)',
          'border-style': 'data(borderStyle)' as any,
          'border-color': 'data(borderColor)',
          label: 'data(label)',
          'font-size': '10px',
          'text-valign': 'bottom',
          'text-margin-y': 6,
          color: '#555',
          width: 30,
          height: 30,
        },
      },
      {
        selector: 'node[?invalid]',
        style: {
          'border-style': 'dashed',
          'border-color': '#FF9800',
          'border-width': 2,
          'background-image': 'none',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 0.8,
        },
      },
      {
        selector: 'edge:active, edge:selected',
        style: {
          label: 'data(relation)',
          'font-size': '9px',
          color: '#888',
          'text-rotation': 'autorotate',
        },
      },
      {
        selector: '.dimmed',
        style: {
          opacity: 0.15,
        },
      },
      {
        selector: '.highlighted',
        style: {
          opacity: 1,
        },
      },
      ...getClusterStyles(),
    ],
    layout: {
      name: 'fcose',
      animate: false,
      quality: 'proof',
      nodeDimensionsIncludeLabels: true,
    } as any,
    wheelSensitivity: 0.3,
  });

  // Edge label on hover
  cy.on('mouseover', 'edge', (evt) => {
    evt.target.style('label', evt.target.data('relation'));
    evt.target.style('font-size', '9px');
    evt.target.style('color', '#888');
    evt.target.style('text-rotation', 'autorotate');
  });
  cy.on('mouseout', 'edge', (evt) => {
    evt.target.style('label', '');
  });

  // Node click → detail panel
  cy.on('tap', 'node', (evt) => {
    const id = evt.target.id();
    callbacks.onNodeClick?.(id);
    callbacks.onNodeSelect?.(id);
  });

  // Background click → deselect
  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      callbacks.onBackgroundClick?.();
    }
  });

  // Track manually dragged nodes — they stay pinned across layout switches
  cy.on('drag', 'node[!isCluster]', (evt) => {
    evt.target.scratch('_manuallyPositioned', true);
  });

  // Viewport culling for 500+ node graphs
  if (graph.nodes.length >= 500) {
    setupViewportCulling(cy);
    showPerformanceHint();
  }

  return cy;
}

// ── Layout switching ────────────────────────────────────────────────

// Hierarchical tier order: question → hypothesis → experiment → finding → knowledge
// Lower tier = higher rank (top of screen)
const TYPE_TIER: Record<NodeType, number> = {
  question: 0,
  hypothesis: 1,
  experiment: 2,
  finding: 3,
  knowledge: 4,
  episode: 2,   // episodes parallel experiments
  decision: 3,  // decisions parallel findings
};

export type LayoutMode = 'force' | 'hierarchical';

let currentLayout: LayoutMode = 'force';

export function getCurrentLayout(): LayoutMode {
  return currentLayout;
}

export function switchLayout(mode: LayoutMode): void {
  if (!cy) return;
  currentLayout = mode;

  // Collect pinned node positions
  const pinnedPositions = new Map<string, { x: number; y: number }>();
  cy.nodes('[!isCluster]').forEach((node) => {
    if (node.scratch('_manuallyPositioned')) {
      pinnedPositions.set(node.id(), { ...node.position() });
    }
  });

  const layoutOptions: any = mode === 'hierarchical'
    ? {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 50,
        rankSep: 80,
        animate: true,
        animationDuration: 500,
        nodeDimensionsIncludeLabels: true,
        // Assign tier-based rank to enforce research flow direction
        sort: (a: any, b: any) => {
          const tierA = TYPE_TIER[a.data('type') as NodeType] ?? 2;
          const tierB = TYPE_TIER[b.data('type') as NodeType] ?? 2;
          return tierA - tierB;
        },
      }
    : {
        name: 'fcose',
        animate: true,
        animationDuration: 500,
        quality: 'proof',
        nodeDimensionsIncludeLabels: true,
      };

  const layout = cy.layout(layoutOptions);
  layout.run();

  // After layout completes, restore pinned positions
  if (pinnedPositions.size > 0) {
    layout.on('layoutstop', () => {
      pinnedPositions.forEach((pos, id) => {
        const node = cy!.getElementById(id);
        if (node.length > 0) {
          node.animate({ position: pos } as any, { duration: 200 });
        }
      });
    });
  }
}

// ── Local graph (ego) highlighting ───────────────────────────────────

export function highlightNeighbors(
  neighborIds: string[],
  centerId: string,
): void {
  if (!cy) return;

  const keepSet = new Set([centerId, ...neighborIds]);

  cy.nodes().forEach((node) => {
    if (keepSet.has(node.id())) {
      node.removeClass('dimmed').addClass('highlighted');
    } else {
      node.addClass('dimmed').removeClass('highlighted');
    }
  });

  cy.edges().forEach((edge) => {
    const srcId = edge.source().id();
    const tgtId = edge.target().id();
    if (keepSet.has(srcId) && keepSet.has(tgtId)) {
      edge.removeClass('dimmed').addClass('highlighted');
    } else {
      edge.addClass('dimmed').removeClass('highlighted');
    }
  });
}

export function clearHighlights(): void {
  if (!cy) return;
  cy.elements().removeClass('dimmed').removeClass('highlighted');
}

export function panToNode(nodeId: string): void {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (node.length > 0) {
    cy.animate({
      center: { eles: node },
      zoom: 1.5,
    } as any, { duration: 300 });
  }
}

export function pulseNode(nodeId: string): void {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (node.length === 0) return;

  const originalWidth = node.style('border-width');
  const originalColor = node.style('border-color');
  node.animate({
    style: { 'border-width': 6, 'border-color': '#FF6B6B' },
  } as any, {
    duration: 300,
    complete: () => {
      node.animate({
        style: { 'border-width': originalWidth, 'border-color': originalColor },
      } as any, { duration: 300 });
    },
  });
}

// ── Viewport culling for large graphs ────────────────────────────────

let cullingTimer: ReturnType<typeof setTimeout> | null = null;

function setupViewportCulling(cyInstance: cytoscape.Core): void {
  const performCulling = () => {
    const ext = cyInstance.extent();
    const pad = (ext.w + ext.h) * 0.2; // 20% padding beyond viewport
    const x1 = ext.x1 - pad;
    const y1 = ext.y1 - pad;
    const x2 = ext.x2 + pad;
    const y2 = ext.y2 + pad;

    cyInstance.nodes('[!isCluster]').forEach((node) => {
      const pos = node.position();
      const visible = pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2;
      if (visible) {
        node.style('display', 'element');
      } else {
        node.style('display', 'none');
      }
    });
  };

  const debouncedCull = () => {
    if (cullingTimer) clearTimeout(cullingTimer);
    cullingTimer = setTimeout(performCulling, 100);
  };

  cyInstance.on('viewport', debouncedCull);
  cyInstance.on('layoutstop', performCulling);
}

function showPerformanceHint(): void {
  const existing = document.querySelector('.perf-hint');
  if (existing) return;

  const hint = document.createElement('div');
  hint.className = 'perf-hint';
  hint.innerHTML = 'Large graph detected. Use <b>filters</b> or <b>local graph mode</b> for better performance.';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.className = 'perf-hint-close';
  closeBtn.addEventListener('click', () => hint.remove());
  hint.appendChild(closeBtn);

  const canvas = document.getElementById('graph-canvas');
  if (canvas) canvas.appendChild(hint);
}

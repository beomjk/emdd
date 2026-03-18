import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { SerializedGraph, SerializedNode } from '../types.js';

cytoscape.use(fcose);

// ── Visual encoding ──────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  hypothesis: '#4A90D9',
  experiment: '#7B68EE',
  finding: '#50C878',
  knowledge: '#DAA520',
  question: '#FF8C42',
  episode: '#A0A0A0',
  decision: '#20B2AA',
};

const POSITIVE_STATUSES = new Set(['SUPPORTED', 'VALIDATED', 'ACCEPTED', 'ACTIVE', 'ANSWERED', 'COMPLETED']);
const NEGATIVE_STATUSES = new Set(['REFUTED', 'RETRACTED', 'REVERTED', 'FAILED', 'ABANDONED']);
const IN_PROGRESS_STATUSES = new Set(['TESTING', 'RUNNING', 'CONTESTED', 'DISPUTED']);
const DEFERRED_STATUSES = new Set(['DEFERRED', 'SUPERSEDED', 'REVISED', 'RESOLVED']);

function getStatusBorder(node: SerializedNode): { width: number; style: string; color: string } {
  if (node.invalid) return { width: 2, style: 'dashed', color: '#FF9800' };
  const s = node.status;
  if (POSITIVE_STATUSES.has(s)) return { width: 3, style: 'solid', color: '#2ECC71' };
  if (NEGATIVE_STATUSES.has(s)) return { width: 2, style: 'dashed', color: '#E74C3C' };
  if (IN_PROGRESS_STATUSES.has(s)) return { width: 2, style: 'solid', color: '#3498DB' };
  if (DEFERRED_STATUSES.has(s)) return { width: 2, style: 'dashed', color: '#95A5A6' };
  return { width: 1, style: 'solid', color: '#95A5A6' }; // Initial/Open
}

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
        bgColor: NODE_COLORS[node.type] ?? '#999',
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

  return cy;
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

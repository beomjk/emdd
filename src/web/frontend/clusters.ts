import type cytoscape from 'cytoscape';
import type { VisualCluster } from '../types.js';

// ── Cluster colors (semi-transparent backgrounds) ───────────────────

const CLUSTER_COLORS = [
  'rgba(74, 144, 217, 0.08)',
  'rgba(123, 104, 238, 0.08)',
  'rgba(80, 200, 120, 0.08)',
  'rgba(218, 165, 32, 0.08)',
  'rgba(255, 140, 66, 0.08)',
  'rgba(32, 178, 170, 0.08)',
  'rgba(160, 160, 160, 0.08)',
  'rgba(220, 80, 80, 0.08)',
];

const CLUSTER_BORDER_COLORS = [
  'rgba(74, 144, 217, 0.3)',
  'rgba(123, 104, 238, 0.3)',
  'rgba(80, 200, 120, 0.3)',
  'rgba(218, 165, 32, 0.3)',
  'rgba(255, 140, 66, 0.3)',
  'rgba(32, 178, 170, 0.3)',
  'rgba(160, 160, 160, 0.3)',
  'rgba(220, 80, 80, 0.3)',
];

// ── Fetch clusters from API ─────────────────────────────────────────

async function fetchClusters(): Promise<VisualCluster[]> {
  const res = await fetch('/api/clusters');
  if (!res.ok) return [];
  const data = await res.json();
  return data.clusters ?? [];
}

// ── Apply clusters as compound nodes ────────────────────────────────

export async function applyClusters(
  cy: cytoscape.Core,
  callbacks?: { onClusterClick?: (cluster: VisualCluster) => void },
): Promise<VisualCluster[]> {
  const clusters = await fetchClusters();
  if (clusters.length === 0) return [];

  // Remove any existing cluster parent nodes
  cy.nodes('[?isCluster]').remove();

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const colorIdx = i % CLUSTER_COLORS.length;

    // Add compound parent node
    cy.add({
      group: 'nodes',
      data: {
        id: cluster.id,
        label: cluster.label,
        isCluster: true,
        isManual: cluster.isManual,
        bgColor: CLUSTER_COLORS[colorIdx],
        borderColor: CLUSTER_BORDER_COLORS[colorIdx],
      },
    });

    // Assign member nodes as children
    for (const nodeId of cluster.nodeIds) {
      const node = cy.getElementById(nodeId);
      if (node.length > 0 && !node.isChild()) {
        node.move({ parent: cluster.id });
      }
    }
  }

  // Cluster click → zoom to fit
  if (callbacks?.onClusterClick) {
    cy.on('tap', 'node[?isCluster]', (evt) => {
      const clusterId = evt.target.id();
      const cluster = clusters.find((c) => c.id === clusterId);
      if (cluster) callbacks.onClusterClick!(cluster);
    });
  }

  // Re-run layout to accommodate compound nodes
  cy.layout({
    name: 'fcose',
    animate: true,
    animationDuration: 500,
    quality: 'proof',
    nodeDimensionsIncludeLabels: true,
  } as any).run();

  return clusters;
}

// ── Zoom to cluster ─────────────────────────────────────────────────

export function zoomToCluster(cy: cytoscape.Core, cluster: VisualCluster): void {
  const memberNodes = cy.collection();
  for (const id of cluster.nodeIds) {
    const node = cy.getElementById(id);
    if (node.length > 0) memberNodes.merge(node);
  }

  if (memberNodes.length > 0) {
    cy.animate({
      fit: { eles: memberNodes, padding: 40 },
    } as any, { duration: 400 });
  }
}

// ── Get cluster styles for Cytoscape ────────────────────────────────

export function getClusterStyles(): cytoscape.StylesheetStyle[] {
  return [
    {
      selector: 'node[?isCluster]',
      style: {
        'background-color': 'data(bgColor)',
        'background-opacity': 1,
        'border-width': 1,
        'border-color': 'data(borderColor)',
        'border-style': 'dashed',
        shape: 'roundrectangle',
        label: 'data(label)',
        'font-size': '12px',
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': -8,
        color: '#666',
        'font-weight': 'bold',
        'padding': '16px' as any,
        'min-width': '80px' as any,
        'min-height': '60px' as any,
      } as any,
    },
    {
      selector: 'node[?isCluster][?isManual]',
      style: {
        'border-style': 'solid',
      } as any,
    },
  ];
}

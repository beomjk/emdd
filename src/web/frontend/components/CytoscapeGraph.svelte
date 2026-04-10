<script lang="ts">
  import cytoscape from 'cytoscape';
  import type { SerializedGraph, SerializedNode, VisualCluster } from '../../types.js';
  import { getNodeColor, getStatusBorder } from '../lib/constants.js';
  import { getLayoutConfig } from '../lib/cytoscape-setup.js';
  import { fetchClusters } from '../lib/api.js';
  import { dashboardState } from '../state/dashboard.svelte.js';
  import { diffGraph } from '../lib/graph-diff.js';
  import Tooltip from './Tooltip.svelte';
  import Legend from './Legend.svelte';

  let {
    graph,
    layout,
    visibleTypes,
    visibleStatuses,
    visibleEdgeTypes,
    selectedNodeId,
    neighborIds,
    onNodeClick,
    onBackgroundClick,
  }: {
    graph: SerializedGraph;
    layout: 'force' | 'hierarchical';
    visibleTypes: Set<string>;
    visibleStatuses: Set<string>;
    visibleEdgeTypes: Set<string>;
    selectedNodeId: string | null;
    neighborIds: string[];
    onNodeClick: (id: string) => void;
    onBackgroundClick: () => void;
  } = $props();

  // ── Internal state ──────────────────────────────────────────────────
  let container: HTMLElement;
  let cy: cytoscape.Core | undefined;
  let showPerfHint = $state(false);
  let cullingCleanup: (() => void) | null = null;

  // Tooltip state
  let tooltipNode = $state<SerializedNode | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let tooltipVisible = $state(false);

  // Cluster colors
  const CLUSTER_COLORS = [
    'rgba(74, 144, 217, 0.08)', 'rgba(123, 104, 238, 0.08)',
    'rgba(80, 200, 120, 0.08)', 'rgba(218, 165, 32, 0.08)',
    'rgba(255, 140, 66, 0.08)', 'rgba(32, 178, 170, 0.08)',
    'rgba(160, 160, 160, 0.08)', 'rgba(220, 80, 80, 0.08)',
  ];
  const CLUSTER_BORDER_COLORS = [
    'rgba(74, 144, 217, 0.3)', 'rgba(123, 104, 238, 0.3)',
    'rgba(80, 200, 120, 0.3)', 'rgba(218, 165, 32, 0.3)',
    'rgba(255, 140, 66, 0.3)', 'rgba(32, 178, 170, 0.3)',
    'rgba(160, 160, 160, 0.3)', 'rgba(220, 80, 80, 0.3)',
  ];

  // ── Exported API ────────────────────────────────────────────────────
  export function getCy(): cytoscape.Core | undefined {
    return cy;
  }

  export function panToNode(nodeId: string): void {
    if (!cy) return;
    const node = cy.getElementById(nodeId);
    if (node.length > 0) {
      cy.animate({ center: { eles: node }, zoom: 1.5 } as any, { duration: 300 });
    }
  }

  export function pulseNode(nodeId: string): void {
    if (!cy) return;
    const node = cy.getElementById(nodeId);
    if (node.length === 0) return;
    const origW = node.style('border-width');
    const origC = node.style('border-color');
    node.animate(
      { style: { 'border-width': 6, 'border-color': '#FF6B6B' } } as any,
      {
        duration: 300,
        complete: () => {
          node.animate(
            { style: { 'border-width': origW, 'border-color': origC } } as any,
            { duration: 300 },
          );
        },
      },
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  function getCssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
  }

  function findNode(id: string): SerializedNode | undefined {
    return graph.nodes.find((n) => n.id === id);
  }

  function getCyStyles(): cytoscape.StylesheetStyle[] {
    return [
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
          color: getCssVar('--cy-node-text'),
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
          'line-color': getCssVar('--cy-edge-color'),
          'target-arrow-color': getCssVar('--cy-edge-color'),
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
          color: getCssVar('--cy-edge-label'),
          'text-rotation': 'autorotate',
        },
      },
      { selector: '.dimmed', style: { opacity: 0.15 } },
      { selector: '.highlighted', style: { opacity: 1 } },
      // Cluster styles
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
          color: getCssVar('--cy-node-text'),
          'font-weight': 'bold',
          padding: '16px' as any,
          'min-width': '80px' as any,
          'min-height': '60px' as any,
        } as any,
      },
      {
        selector: 'node[?isCluster][?isManual]',
        style: { 'border-style': 'solid' } as any,
      },
    ];
  }

  // ── Viewport culling for 500+ nodes ─────────────────────────────────
  function setupViewportCulling(cyInst: cytoscape.Core): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const performCulling = () => {
      const ext = cyInst.extent();
      const pad = (ext.w + ext.h) * 0.2;
      const x1 = ext.x1 - pad, y1 = ext.y1 - pad;
      const x2 = ext.x2 + pad, y2 = ext.y2 + pad;

      cyInst.nodes('[!isCluster]').forEach((node) => {
        const pos = node.position();
        node.style('display', (pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2) ? 'element' : 'none');
      });
    };

    const debouncedCull = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(performCulling, 100);
    };

    cyInst.on('viewport', debouncedCull);
    cyInst.on('layoutstop', performCulling);

    return () => { if (timer) clearTimeout(timer); };
  }

  // ── Cluster application ─────────────────────────────────────────────
  async function applyClustersToGraph(cyInst: cytoscape.Core, signal?: AbortSignal): Promise<void> {
    try {
      const { clusters } = await fetchClusters();
      if (signal?.aborted) return;
      if (!clusters || clusters.length === 0) return;

      cyInst.nodes('[?isCluster]').remove();

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const colorIdx = i % CLUSTER_COLORS.length;

        cyInst.add({
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

        for (const nodeId of cluster.nodeIds) {
          const node = cyInst.getElementById(nodeId);
          if (node.length > 0 && !node.isChild()) {
            node.move({ parent: cluster.id });
          }
        }
      }
    } catch {
      // Silent degradation — graph still renders without clusters
    }
  }

  // ── Previous graph reference for incremental updates ────────────────
  let prevGraph: SerializedGraph | null = null;
  let clusterAbort: AbortController | null = null;

  // Node data builder for diffGraph (reuses buildElements logic for single node)
  function buildNodeDataForDiff(node: SerializedNode) {
    const border = getStatusBorder(node);
    return {
      id: node.id,
      label: truncate(node.title || node.id, 20),
      fullTitle: node.title || node.id,
      type: node.type,
      status: node.status,
      confidence: node.confidence,
      tags: node.tags,
      bodyPreview: node.bodyPreview,
      invalid: node.invalid ?? false,
      bgColor: getNodeColor(node.type),
      borderWidth: border.width,
      borderStyle: border.style,
      borderColor: border.color,
    };
  }

  function buildEdgeDataForDiff(edge: { source: string; target: string; relation: string }, validNodeIds: Set<string>) {
    if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) return null;
    return {
      id: `${edge.source}-${edge.relation}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
    };
  }

  // ── Init effect: create Cytoscape instance once ────────────────────
  $effect(() => {
    if (!container) return;

    const inst = cytoscape({
      container,
      style: getCyStyles(),
      wheelSensitivity: 0.3,
    });
    cy = inst;

    // Tooltip hover
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

    inst.on('mouseover', 'node[!isCluster]', (evt) => {
      if (tooltipTimer) clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(() => {
        const n = evt.target;
        const pos = n.renderedPosition();
        tooltipNode = findNode(n.id()) ?? null;
        tooltipX = pos.x;
        tooltipY = pos.y;
        tooltipVisible = true;
      }, 300);
    });

    inst.on('mouseout', 'node', () => {
      if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
      tooltipVisible = false;
    });

    inst.on('tap', 'node[!isCluster]', (evt) => {
      if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
      tooltipVisible = false;
      onNodeClick(evt.target.id());
    });

    inst.on('tap', (evt) => {
      if (evt.target === inst) onBackgroundClick();
    });

    // Edge label on hover
    inst.on('mouseover', 'edge', (evt) => {
      evt.target.style('label', evt.target.data('relation'));
      evt.target.style('font-size', '9px');
      evt.target.style('color', getCssVar('--cy-edge-label'));
      evt.target.style('text-rotation', 'autorotate');
    });
    inst.on('mouseout', 'edge', (evt) => {
      evt.target.style('label', '');
    });

    // Track manually dragged nodes
    inst.on('drag', 'node[!isCluster]', (evt) => {
      evt.target.scratch('_manuallyPositioned', true);
    });

    return () => {
      clusterAbort?.abort();
      if (cullingCleanup) { cullingCleanup(); cullingCleanup = null; }
      if (tooltipTimer) clearTimeout(tooltipTimer);
      prevGraph = null;
      inst.destroy();
      cy = undefined;
    };
  });

  // ── Data sync effect: incremental graph updates ────────────────────
  $effect(() => {
    const _g = graph;
    if (!cy || !_g) return;

    const delta = diffGraph(prevGraph, _g, buildNodeDataForDiff, buildEdgeDataForDiff);
    const isInitial = prevGraph === null;
    prevGraph = _g;

    cy.batch(() => {
      // Remove elements
      for (const id of delta.removedEdgeIds) {
        cy!.getElementById(id).remove();
      }
      for (const id of delta.removedNodeIds) {
        cy!.getElementById(id).remove();
      }

      // Add elements
      for (const nodeData of delta.addedNodes) {
        cy!.add({ group: 'nodes', data: nodeData });
      }
      for (const edgeData of delta.addedEdges) {
        cy!.add({ group: 'edges', data: edgeData });
      }

      // Update existing element data
      for (const { id, data } of delta.updatedNodes) {
        cy!.getElementById(id).data(data);
      }
    });

    // Run layout only when topology changed
    if (delta.topologyChanged) {
      const layoutConfig = getLayoutConfig(layout, !isInitial, isInitial) as any;
      cy.layout(layoutConfig).run();
    }

    // Viewport culling for large graphs
    if (_g.nodes.length >= 500) {
      showPerfHint = true;
      if (!cullingCleanup) {
        cullingCleanup = setupViewportCulling(cy!);
      }
    } else {
      showPerfHint = false;
      if (cullingCleanup) { cullingCleanup(); cullingCleanup = null; }
    }

    // Apply clusters only when topology changes (async, guarded)
    if (delta.topologyChanged || isInitial) {
      clusterAbort?.abort();
      clusterAbort = new AbortController();
      applyClustersToGraph(cy, clusterAbort.signal);
    }
  });

  // ── Effect: layout switching ────────────────────────────────────────
  let prevLayout: string | null = null;
  $effect(() => {
    const _l = layout;
    if (!cy) return;
    // Skip first run (initial layout applied in main effect)
    if (prevLayout === null) { prevLayout = _l; return; }
    if (_l === prevLayout) return;
    prevLayout = _l;

    // Collect pinned positions
    const pinned = new Map<string, { x: number; y: number }>();
    cy.nodes('[!isCluster]').forEach((node) => {
      if (node.scratch('_manuallyPositioned')) {
        pinned.set(node.id(), { ...node.position() });
      }
    });

    const layoutObj = cy.layout(getLayoutConfig(_l, true, false) as any);

    if (pinned.size > 0) {
      layoutObj.on('layoutstop', () => {
        pinned.forEach((pos, id) => {
          const node = cy!.getElementById(id);
          if (node.length > 0) {
            node.animate({ position: pos } as any, { duration: 200 });
          }
        });
      });
    }

    layoutObj.run();
  });

  // ── Effect: filter visibility ───────────────────────────────────────
  $effect(() => {
    if (!cy) return;
    const _vt = visibleTypes;
    const _vs = visibleStatuses;
    const _ve = visibleEdgeTypes;

    cy.batch(() => {
      cy!.nodes('[!isCluster]').forEach((node) => {
        const type = node.data('type');
        const status = node.data('status') ?? '';
        const show = _vt.has(type) && (_vs.has(status) || !status);
        node.style('display', show ? 'element' : 'none');
      });

      cy!.edges().forEach((edge) => {
        const rel = edge.data('relation');
        const srcVisible = edge.source().style('display') !== 'none';
        const tgtVisible = edge.target().style('display') !== 'none';
        edge.style('display', _ve.has(rel) && srcVisible && tgtVisible ? 'element' : 'none');
      });

      // Hide cluster compound nodes when all children hidden
      cy!.nodes('[?isCluster]').forEach((cluster) => {
        const children = cluster.children();
        const anyVisible = children.some((c) => c.style('display') !== 'none');
        cluster.style('display', anyVisible ? 'element' : 'none');
      });
    });
  });

  // ── Effect: neighbor highlighting ───────────────────────────────────
  $effect(() => {
    if (!cy) return;
    const _sel = selectedNodeId;
    const _neigh = neighborIds;

    cy.batch(() => {
      if (!_sel || _neigh.length === 0) {
        cy!.elements().removeClass('dimmed').removeClass('highlighted');
        return;
      }

      const keepSet = new Set([_sel, ..._neigh]);
      cy!.nodes().forEach((node) => {
        if (keepSet.has(node.id())) {
          node.removeClass('dimmed').addClass('highlighted');
        } else {
          node.addClass('dimmed').removeClass('highlighted');
        }
      });
      cy!.edges().forEach((edge) => {
        const s = edge.source().id();
        const t = edge.target().id();
        if (keepSet.has(s) && keepSet.has(t)) {
          edge.removeClass('dimmed').addClass('highlighted');
        } else {
          edge.addClass('dimmed').removeClass('highlighted');
        }
      });
    });
  });

  // ── Effect: theme change → refresh Cytoscape styles ────────────────
  let prevTheme: string | null = null;
  $effect(() => {
    const _t = dashboardState.theme;
    if (!cy) return;
    if (prevTheme === null) { prevTheme = _t; return; }
    if (_t === prevTheme) return;
    prevTheme = _t;
    cy.style().fromJson(getCyStyles()).update();
  });
</script>

<div class="graph-canvas" id="graph-canvas">
  <div class="cy-container" bind:this={container}></div>

  <Tooltip node={tooltipNode} x={tooltipX} y={tooltipY} visible={tooltipVisible} />
  <Legend />

  {#if showPerfHint}
    <div class="perf-hint">
      Large graph detected. Use <b>filters</b> or <b>local graph mode</b> for better performance.
      <button class="perf-hint-close" onclick={() => showPerfHint = false}>&times;</button>
    </div>
  {/if}
</div>

<style>
  .graph-canvas {
    position: relative;
    flex: 1;
    overflow: hidden;
    background: var(--bg-graph);
  }
  .cy-container {
    width: 100%;
    height: 100%;
  }
</style>

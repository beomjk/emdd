<script lang="ts">
  import { untrack } from 'svelte';
  import cytoscape from 'cytoscape';
  import type { SerializedGraph, SerializedNode, LayoutMode } from '../../types.js';
  import { getNodeColor, getStatusBorder, GRAPH_MOTION_PROFILE } from '../lib/constants.js';
  import {
    getClusterFocusAnimation,
    getLayoutConfig,
    getNodeFocusAnimation,
  } from '../lib/cytoscape-setup.js';
  import { fetchClusters } from '../lib/api.js';
  import { diffGraph } from '../lib/graph-diff.js';
  import Tooltip from './Tooltip.svelte';
  import Legend from './Legend.svelte';

  let {
    graph,
    layout,
    theme,
    visibleTypes,
    visibleStatuses,
    visibleEdgeTypes,
    selectedNodeId,
    neighborIds,
    onNodeClick,
    onBackgroundClick,
  }: {
    graph: SerializedGraph;
    layout: LayoutMode;
    theme: string;
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
  // Shared filter predicate — viewport culling must respect filter state
  let isFilterVisible: (node: cytoscape.NodeSingular) => boolean = () => true;

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
  export function panToNode(nodeId: string): void {
    if (!cy) return;
    const node = cy.getElementById(nodeId);
    if (node.length > 0) {
      const [animation, options] = getNodeFocusAnimation(node);
      cy.animate(animation as any, options);
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
        duration: GRAPH_MOTION_PROFILE.selectionEmphasisMs,
        complete: () => {
          node.animate(
            { style: { 'border-width': origW, 'border-color': origC } } as any,
            { duration: GRAPH_MOTION_PROFILE.selectionEmphasisMs },
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
  // Current edge-type filter set — updated by the filter effect so culling
  // can respect the active edge-type filter without needing prop access.
  let currentVisibleEdgeTypes: Set<string> = new Set();

  // Single source of truth for "which non-cluster node should be visible
  // right now". The filter effect writes this; culling, culling teardown,
  // and the filter effect itself all read it — eliminating three drifted
  // copies that previously caused the culling/filter conflict bug.
  function applyNodeAndEdgeVisibility(
    cyInst: cytoscape.Core,
    opts: { viewportFilter?: (node: cytoscape.NodeSingular) => boolean } = {},
  ): void {
    const viewportFilter = opts.viewportFilter;
    cyInst.batch(() => {
      cyInst.nodes('[!isCluster]').forEach((node) => {
        const show =
          isFilterVisible(node) && (viewportFilter ? viewportFilter(node) : true);
        node.style('display', show ? 'element' : 'none');
      });

      // Edges: hide when either endpoint was culled or the edge-type is off.
      // Cytoscape does not auto-hide edges when endpoints have display:none,
      // so we propagate visibility explicitly.
      cyInst.edges().forEach((edge) => {
        const rel = edge.data('relation');
        const srcVisible = edge.source().style('display') !== 'none';
        const tgtVisible = edge.target().style('display') !== 'none';
        const edgeTypeOk = currentVisibleEdgeTypes.has(rel);
        edge.style(
          'display',
          edgeTypeOk && srcVisible && tgtVisible ? 'element' : 'none',
        );
      });

      // Cluster compound parents are hidden when every child is hidden.
      // Without this pass, culling leaves empty dashed boxes at viewport
      // edges even when their members have scrolled off-screen.
      cyInst.nodes('[?isCluster]').forEach((cluster) => {
        const children = cluster.children();
        const anyVisible = children.some((c) => c.style('display') !== 'none');
        cluster.style('display', anyVisible ? 'element' : 'none');
      });
    });
  }

  function setupViewportCulling(cyInst: cytoscape.Core): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const performCulling = () => {
      const ext = cyInst.extent();
      const pad = (ext.w + ext.h) * 0.2;
      const x1 = ext.x1 - pad, y1 = ext.y1 - pad;
      const x2 = ext.x2 + pad, y2 = ext.y2 + pad;
      applyNodeAndEdgeVisibility(cyInst, {
        viewportFilter: (node) => {
          const pos = node.position();
          return pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2;
        },
      });
    };

    const debouncedCull = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(performCulling, 100);
    };

    cyInst.on('viewport', debouncedCull);
    cyInst.on('layoutstop', performCulling);

    return () => {
      if (timer) clearTimeout(timer);
      cyInst.off('viewport', debouncedCull);
      cyInst.off('layoutstop', performCulling);
    };
  }

  // ── Cluster application ─────────────────────────────────────────────
  // Track previous cluster membership to skip unnecessary rebuilds.
  // Key: cluster.id, Value: sorted nodeIds joined by ','
  let prevClusterFingerprint: Map<string, string> | null = null;

  function clusterMembershipChanged(
    clusters: { id: string; nodeIds: string[] }[],
  ): boolean {
    if (!prevClusterFingerprint) return true;
    if (clusters.length !== prevClusterFingerprint.size) return true;
    for (const c of clusters) {
      const prev = prevClusterFingerprint.get(c.id);
      if (prev === undefined) return true;
      const curr = [...c.nodeIds].sort().join(',');
      if (prev !== curr) return true;
    }
    return false;
  }

  function buildClusterFingerprint(
    clusters: { id: string; nodeIds: string[] }[],
  ): Map<string, string> {
    const map = new Map<string, string>();
    for (const c of clusters) {
      map.set(c.id, [...c.nodeIds].sort().join(','));
    }
    return map;
  }

  async function applyClustersToGraph(cyInst: cytoscape.Core, signal?: AbortSignal): Promise<void> {
    try {
      const { clusters } = await fetchClusters(signal ? { signal } : undefined);
      if (signal?.aborted) return;

      // Skip full rebuild when cluster membership is unchanged.
      if (!clusterMembershipChanged(clusters ?? [])) return;

      // Orphan cluster children BEFORE removing the compound parents.
      // Cytoscape cascades removal to descendants, so removing the parent
      // without orphaning first would also delete every clustered domain node.
      const existingClusters = cyInst.nodes('[?isCluster]');
      existingClusters.children().move({ parent: null });
      existingClusters.remove();

      if (clusters && clusters.length > 0) {
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
      }

      prevClusterFingerprint = buildClusterFingerprint(clusters ?? []);

      // Re-apply filter visibility so that freshly-added cluster parents
      // correctly collapse when all their children are hidden. Without this
      // pass, a cluster added after the user already has filters active would
      // render as an empty dashed box until the next filter toggle.
      applyNodeAndEdgeVisibility(cyInst);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('[emdd] cluster fetch failed, rendering graph without clusters:', err);
    }
  }

  // ── Previous graph reference for incremental updates ────────────────
  let prevGraph: SerializedGraph | null = null;
  let clusterAbort: AbortController | null = null;
  // Retain the active layout so we can stop it before starting a new one.
  // Two effects kick off layouts (data-sync + layout-switch); without this
  // guard they can run concurrently and produce non-deterministic positions.
  let activeLayout: cytoscape.Layouts | null = null;

  function runLayout(cyInst: cytoscape.Core, config: unknown): cytoscape.Layouts {
    if (activeLayout) {
      try { activeLayout.stop(); } catch { /* stop is best-effort */ }
    }
    const layoutObj = cyInst.layout(config as cytoscape.LayoutOptions);
    activeLayout = layoutObj;
    return layoutObj;
  }

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

    // Cluster parent tap → fit viewport to the cluster's children.
    // Restores the "click cluster to zoom" UX that lived in the pre-migration
    // clusters.ts and would otherwise be silently dropped.
    inst.on('tap', 'node[?isCluster]', (evt) => {
      const cluster = evt.target;
      const children = cluster.children();
      if (children.length === 0) return;
      const [animation, options] = getClusterFocusAnimation(children);
      inst.animate(animation as any, options);
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
      if (activeLayout) {
        try { activeLayout.stop(); } catch { /* stop is best-effort */ }
        activeLayout = null;
      }
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

    // Run layout only when topology changed. Read `layout` via untrack so
    // that changing the layout mode does not re-trigger this data-sync effect
    // — the dedicated layout-switch effect (below) handles that case.
    if (delta.topologyChanged) {
      const layoutConfig = getLayoutConfig(untrack(() => layout), !isInitial, isInitial);
      runLayout(cy, layoutConfig).run();
    }

    // Viewport culling for large graphs
    if (_g.nodes.length >= 500) {
      showPerfHint = true;
      if (!cullingCleanup) {
        cullingCleanup = setupViewportCulling(cy!);
      }
    } else {
      showPerfHint = false;
      if (cullingCleanup) {
        cullingCleanup();
        cullingCleanup = null;
        // Culling turnoff must re-apply current filter visibility instead of
        // forcing everything to 'element' — otherwise deselected filter chips
        // silently reappear until the user next toggles a filter.
        applyNodeAndEdgeVisibility(cy!);
      }
    }

    // Refetch clusters whenever any input that influences community detection
    // changes: topology (adds/removes) OR node-data updates. Backend cluster
    // detection uses tag overlap + types to weight edges and to label
    // communities, so a tag rename with no link change still shifts the
    // resulting clusters. Refetching on updatedNodes catches this.
    const clusterInputsChanged =
      delta.topologyChanged || delta.updatedNodes.length > 0;
    if (clusterInputsChanged || isInitial) {
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

    const layoutObj = runLayout(cy, getLayoutConfig(_l, true, false));

    if (pinned.size > 0) {
      // Use `.one()` so the listener fires exactly once — otherwise a rapid
      // layout toggle stops the previous layout, its listener fires with a
      // stale `pinned` closure from the earlier run, and nodes jitter toward
      // old positions before the new layout's listener takes effect.
      layoutObj.one('layoutstop', () => {
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

    // Update shared predicate + edge-type set so viewport culling respects filters
    isFilterVisible = (node) => {
      const type = node.data('type');
      const status = node.data('status') ?? '';
      return _vt.has(type) && (_vs.has(status) || !status);
    };
    currentVisibleEdgeTypes = _ve;

    applyNodeAndEdgeVisibility(cy);
  });

  // ── Effect: neighbor highlighting ───────────────────────────────────
  $effect(() => {
    if (!cy) return;
    const _sel = selectedNodeId;
    const _neigh = neighborIds;

    cy.batch(() => {
      if (!_sel) {
        cy!.elements().removeClass('dimmed').removeClass('highlighted');
        return;
      }

      const keepSet = new Set([_sel, ..._neigh]);
      cy!.nodes('[!isCluster]').forEach((node) => {
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
    const _t = theme;
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
      <button class="perf-hint-close" aria-label="Dismiss performance hint" onclick={() => showPerfHint = false}>&times;</button>
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

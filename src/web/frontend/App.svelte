<script lang="ts">
  import type { SerializedGraph } from '../types.js';
  import { dashboardState } from './state/dashboard.svelte.js';
  import { filterState } from './state/filters.svelte.js';
  import { fetchGraph, fetchNeighbors } from './lib/api.js';
  import CytoscapeGraph from './components/CytoscapeGraph.svelte';
  import DetailPanel from './components/DetailPanel.svelte';
  import Filters from './components/Filters.svelte';
  import SearchBar from './components/SearchBar.svelte';
  import HealthSidebar from './components/HealthSidebar.svelte';

  let graphRef: CytoscapeGraph | undefined = $state();
  let hopDepth = $state(2);
  let neighborIds = $state<string[]>([]);
  let loading = $state(true);

  async function loadGraph(): Promise<void> {
    try {
      const graph = await fetchGraph();
      dashboardState.setGraph(graph);
      filterState.initFromGraph(graph);
    } catch {
      // Error is set by api.ts
    } finally {
      loading = false;
    }
  }

  async function selectNode(id: string): Promise<void> {
    dashboardState.selectNode(id);
    try {
      const result = await fetchNeighbors(id, hopDepth);
      neighborIds = result.neighbors ?? [];
    } catch {
      neighborIds = [];
    }
    graphRef?.panToNode(id);
  }

  function deselectNode(): void {
    dashboardState.deselectNode();
    neighborIds = [];
  }

  async function handleDepthChange(newDepth: number): Promise<void> {
    hopDepth = newDepth;
    if (!dashboardState.selectedNodeId) return;
    try {
      const result = await fetchNeighbors(dashboardState.selectedNodeId, newDepth);
      neighborIds = result.neighbors ?? [];
    } catch {
      neighborIds = [];
    }
  }

  function handleNodeClickFromDetail(id: string): void {
    selectNode(id);
  }

  function handleSearchNavigate(id: string): void {
    graphRef?.panToNode(id);
    graphRef?.pulseNode(id);
  }

  // Load graph on mount
  $effect(() => {
    loadGraph();
  });
</script>

<div class="dashboard">
  <!-- Toolbar -->
  <header class="toolbar">
    <div class="toolbar-title">EMDD Dashboard</div>
    {#if dashboardState.graph && dashboardState.graph.nodes.length > 0}
      <Filters
        types={filterState.allTypes}
        statuses={filterState.allStatuses}
        edgeTypes={filterState.allEdgeTypes}
      />
      <SearchBar
        nodes={dashboardState.graph.nodes}
        visibleTypes={filterState.visibleTypes}
        visibleStatuses={filterState.visibleStatuses}
        onNavigate={handleSearchNavigate}
      />
    {/if}
  </header>

  <!-- Main content -->
  <div class="main-area">
    {#if loading}
      <div class="loading-state">Loading graph...</div>
    {:else if dashboardState.error && !dashboardState.graph}
      <div class="error-state">{dashboardState.error}</div>
    {:else if !dashboardState.graph || dashboardState.graph.nodes.length === 0}
      <div class="empty-state">
        <p>No nodes found in the graph.</p>
        <p class="empty-hint">Create some nodes with <code>emdd add</code> to get started.</p>
      </div>
    {:else}
      <HealthSidebar onNodeClick={selectNode} />

      <CytoscapeGraph
        bind:this={graphRef}
        graph={dashboardState.graph}
        layout={dashboardState.layout}
        visibleTypes={filterState.visibleTypes}
        visibleStatuses={filterState.visibleStatuses}
        visibleEdgeTypes={filterState.visibleEdgeTypes}
        selectedNodeId={dashboardState.selectedNodeId}
        {neighborIds}
        onNodeClick={selectNode}
        onBackgroundClick={deselectNode}
      />

      <DetailPanel
        node={dashboardState.selectedNode ?? null}
        depth={hopDepth}
        onDepthChange={handleDepthChange}
        onNodeClick={handleNodeClickFromDetail}
        onClose={deselectNode}
      />
    {/if}
  </div>

  <!-- Error toast -->
  {#if dashboardState.error && dashboardState.graph}
    <div class="toast show">{dashboardState.error}</div>
  {/if}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  .toolbar {
    height: var(--toolbar-height, 48px);
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    gap: 12px;
  }
  .toolbar-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
  }
  .main-area {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  .loading-state,
  .error-state,
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 14px;
  }
  .empty-hint {
    font-size: 12px;
    color: var(--text-faint);
    margin-top: 4px;
  }
  .empty-hint :global(code) {
    background: var(--bg-code);
    padding: 1px 4px;
    border-radius: 2px;
  }
  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 8px 16px;
    background: var(--toast-bg);
    color: var(--toast-color);
    border-radius: 4px;
    font-size: 13px;
    z-index: 100;
  }
</style>

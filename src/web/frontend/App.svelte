<script lang="ts">
  import type { LayoutMode } from '../types.js';
  import { dashboardState } from './state/dashboard.svelte.js';
  import { filterState } from './state/filters.svelte.js';
  import { sseState } from './state/sse.svelte.js';
  import { fetchGraph, fetchNeighbors, fetchExportHtml, triggerRefresh } from './lib/api.js';
  import CytoscapeGraph from './components/CytoscapeGraph.svelte';
  import DetailPanel from './components/DetailPanel.svelte';
  import Filters from './components/Filters.svelte';
  import SearchBar from './components/SearchBar.svelte';
  import HealthSidebar from './components/HealthSidebar.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import Toast from './components/Toast.svelte';

  let graphRef: CytoscapeGraph | undefined = $state();
  let hopDepth = $state(2);
  let neighborIds = $state<string[]>([]);
  let loading = $state(true);
  let toastMessage = $state('');
  let toastVisible = $state(false);
  let toastType = $state<'info' | 'error'>('info');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  // Abort in-flight neighbor fetch when selection changes or depth changes
  let neighborAbort: AbortController | null = null;
  // Single shared abort controller for any in-flight graph load:
  // initial loadGraph, manual refresh, and SSE updates all share this slot
  // so the most recent request always wins and earlier ones are cancelled.
  let graphLoadAbort: AbortController | null = null;
  let exportAbort: AbortController | null = null;

  async function refetchNeighbors(id: string, depth: number): Promise<void> {
    neighborAbort?.abort();
    neighborAbort = new AbortController();
    const signal = neighborAbort.signal;
    try {
      const result = await fetchNeighbors(id, depth, { signal });
      if (signal.aborted) return;
      neighborIds = (result.neighbors ?? []).map((n) => n.id);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      neighborIds = [];
      showToast(e instanceof Error ? e.message : 'Failed to load neighbors', 'error');
    }
  }

  async function loadGraph(): Promise<void> {
    graphLoadAbort?.abort();
    graphLoadAbort = new AbortController();
    const signal = graphLoadAbort.signal;
    dashboardState.error = null;
    try {
      const graph = await fetchGraph({ signal });
      if (signal.aborted) return;
      dashboardState.setGraph(graph);
      filterState.initFromGraph(graph);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : 'Failed to load graph';
      dashboardState.error = msg;
    } finally {
      if (!signal.aborted) loading = false;
    }
  }

  async function selectNode(id: string): Promise<void> {
    dashboardState.selectNode(id);
    focusGraphNode(id);
    await refetchNeighbors(id, hopDepth);
  }

  function focusGraphNode(id: string): void {
    graphRef?.panToNode(id);
    graphRef?.pulseNode(id, { keepSelectedCue: true });
  }

  function deselectNode(): void {
    neighborAbort?.abort();
    dashboardState.deselectNode();
    neighborIds = [];
  }

  async function handleDepthChange(newDepth: number): Promise<void> {
    hopDepth = newDepth;
    if (!dashboardState.selectedNodeId) return;
    await refetchNeighbors(dashboardState.selectedNodeId, newDepth);
  }

  function handleNodeClickFromDetail(id: string): void {
    void selectNode(id);
  }

  function handleSearchNavigate(id: string): void {
    void selectNode(id);
  }

  async function handleExport(): Promise<void> {
    try {
      const types = [...filterState.visibleTypes];
      const statuses = [...filterState.visibleStatuses];
      // Guard: an empty filter array means "select nothing", but the server's
      // contract is that a missing/empty param means "no filter" (show all).
      // Without this check, deselecting every type silently exports the full
      // graph — the opposite of what the user asked for.
      if (types.length === 0 || statuses.length === 0) {
        showToast('Select at least one type and one status to export', 'error');
        return;
      }
      const edgeTypes = [...filterState.visibleEdgeTypes];
      exportAbort?.abort();
      exportAbort = new AbortController();
      const html = await fetchExportHtml(
        dashboardState.layout,
        types,
        statuses,
        edgeTypes,
        dashboardState.theme,
        { signal: exportAbort.signal },
      );
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'emdd-graph.html';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to export', 'error');
    }
  }

  async function handleRefresh(): Promise<void> {
    graphLoadAbort?.abort();
    graphLoadAbort = new AbortController();
    const signal = graphLoadAbort.signal;
    try {
      await triggerRefresh({ signal });
      if (signal.aborted) return;
      const prevSelectedId = dashboardState.selectedNodeId;
      const graph = await fetchGraph({ signal });
      if (signal.aborted) return;
      // Preserve user filter selections across manual refresh (mirrors SSE path)
      filterState.mergeFromGraph(graph);
      const selectionPreserved = dashboardState.restoreSelection(prevSelectedId, graph);
      // Belt-and-braces: clear loading in case refresh was somehow invoked
      // while the initial loadGraph was still pending (shared abort slot).
      loading = false;
      // Refresh neighbors if selection survives — mirrors handleGraphUpdated
      if (prevSelectedId) {
        if (selectionPreserved) {
          await refetchNeighbors(prevSelectedId, hopDepth);
        } else {
          neighborIds = [];
        }
      }
      showToast('Graph refreshed');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      loading = false;
      showToast(e instanceof Error ? e.message : 'Failed to refresh', 'error');
    }
  }

  function showToast(msg: string, type: 'info' | 'error' = 'info'): void {
    toastMessage = msg;
    toastType = type;
    toastVisible = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible = false; }, 3000);
  }

  async function handleGraphUpdated(): Promise<void> {
    // Guard against concurrent SSE events (and racing initial load / refresh)
    // by sharing a single abort slot with loadGraph + handleRefresh.
    graphLoadAbort?.abort();
    graphLoadAbort = new AbortController();
    const signal = graphLoadAbort.signal;
    try {
      const prevSelectedId = dashboardState.selectedNodeId;
      const graph = await fetchGraph({ signal });
      if (signal.aborted) return;
      filterState.mergeFromGraph(graph);
      const selectionPreserved = dashboardState.restoreSelection(prevSelectedId, graph);
      // Clear any lingering initial-load state: if this SSE event fired while
      // the initial loadGraph was still in flight, its finally{} skipped
      // `loading = false` because the signal was aborted. Set it here so the
      // loading overlay drops regardless of how the initial fetch terminated.
      loading = false;
      // Re-select previous node if still exists, and refresh its neighbors
      // since the underlying graph may have added/removed edges.
      if (prevSelectedId) {
        if (selectionPreserved) {
          await refetchNeighbors(prevSelectedId, hopDepth);
        } else {
          neighborIds = [];
        }
      }
      showToast('Graph updated');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      loading = false;
      showToast(e instanceof Error ? e.message : 'Failed to update graph', 'error');
    }
  }

  // Load graph on mount + set up SSE
  $effect(() => {
    loadGraph();
    const unsubSse = sseState.onGraphUpdated(handleGraphUpdated);
    sseState.connect();
    return () => {
      unsubSse();
      sseState.disconnect();
      neighborAbort?.abort();
      graphLoadAbort?.abort();
      exportAbort?.abort();
      if (toastTimer) clearTimeout(toastTimer);
    };
  });
</script>

<div class="dashboard">
  <!-- Toolbar -->
  <header class="toolbar">
    <div class="toolbar-title">EMDD Dashboard</div>
    <ThemeToggle />
    {#if dashboardState.graph && dashboardState.graph.nodes.length > 0}
      <label class="layout-selector">
        <span class="sr-only">Layout</span>
        <select
          aria-label="Layout"
          value={dashboardState.layout}
          onchange={(e) => dashboardState.setLayout((e.target as HTMLSelectElement).value as LayoutMode)}
        >
          <option value="force">Force</option>
          <option value="hierarchical">Hierarchical</option>
        </select>
      </label>
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
      <button class="toolbar-btn" aria-label="Export" onclick={handleExport}>Export</button>
      <button class="toolbar-btn" aria-label="Refresh" onclick={handleRefresh}>Refresh</button>
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
        <p class="empty-hint">Create some nodes with <code>emdd new &lt;type&gt; &lt;slug&gt;</code> to get started.</p>
      </div>
    {:else}
      <HealthSidebar onNodeClick={selectNode} />

      <CytoscapeGraph
        bind:this={graphRef}
        graph={dashboardState.graph}
        layout={dashboardState.layout}
        theme={dashboardState.theme}
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

  <!-- Unified toast (info/error) -->
  <Toast message={toastMessage} visible={toastVisible} type={toastType} />
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
  .layout-selector {
    display: flex;
    align-items: center;
  }
  .layout-selector select {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
  }
  .toolbar-btn {
    padding: 4px 10px;
    border: 1px solid var(--border-btn);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
  }
  .toolbar-btn:hover {
    background: var(--bg-hover);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>

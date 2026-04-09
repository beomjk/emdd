<script lang="ts">
  import type { HealthReport, PromoteCandidate, CheckResult } from '../../../web/types.js';
  import { fetchHealth, fetchPromotionCandidates, fetchConsolidation } from '../lib/api.js';
  import { getNodeColor } from '../lib/constants.js';

  interface Props {
    onNodeClick: (id: string) => void;
  }

  const { onNodeClick }: Props = $props();

  let health = $state<HealthReport | null>(null);
  let candidates = $state<PromoteCandidate[]>([]);
  let consolidation = $state<CheckResult | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const REASON_LABELS: Record<string, string> = {
    confidence: 'High confidence',
    de_facto: 'De facto usage',
    both: 'Confidence + usage',
  };

  function handleNodeClick(e: MouseEvent, id: string): void {
    e.preventDefault();
    onNodeClick(id);
  }

  // Derived values
  const avgConfStr = $derived(
    health?.avgConfidence != null
      ? `${(health.avgConfidence * 100).toFixed(0)}%`
      : 'N/A',
  );

  const sortedTypes = $derived(
    health
      ? Object.entries(health.byType)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])
      : [],
  );

  const maxTypeCount = $derived(
    sortedTypes.length > 0 ? Math.max(...sortedTypes.map(([, c]) => c)) : 1,
  );

  const statusEntries = $derived(
    health
      ? Object.entries(health.statusDistribution).filter(
          ([, statuses]) => Object.values(statuses).some((c) => c > 0),
        )
      : [],
  );

  const hasConsolidation = $derived(
    consolidation &&
      (consolidation.triggers.length > 0 ||
        consolidation.orphanFindings.length > 0 ||
        consolidation.deferredItems.length > 0),
  );

  $effect(() => {
    loadData();
  });

  async function loadData(): Promise<void> {
    loading = true;
    error = null;

    const results = await Promise.allSettled([
      fetchHealth(),
      fetchPromotionCandidates(),
      fetchConsolidation(),
    ]);

    const [healthResult, promoResult, consolResult] = results;

    if (healthResult.status === 'fulfilled') {
      health = healthResult.value;
    }
    if (promoResult.status === 'fulfilled') {
      candidates = promoResult.value.candidates;
    }
    if (consolResult.status === 'fulfilled') {
      consolidation = consolResult.value;
    }

    // All failed
    if (results.every((r) => r.status === 'rejected')) {
      error = 'Failed to load health data';
    }

    loading = false;
  }
</script>

<aside class="health-sidebar">
  {#if loading}
    <div class="sidebar-loading">Loading...</div>
  {:else if error && !health}
    <div class="sidebar-error">{error}</div>
  {:else if health}
    <!-- Overview metrics -->
    <div class="sidebar-section">
      <h4 class="sidebar-heading">Overview</h4>
      <div class="metric-grid">
        <div class="metric">
          <span class="metric-value">{health.totalNodes}</span>
          <span class="metric-label">Nodes</span>
        </div>
        <div class="metric">
          <span class="metric-value">{health.totalEdges}</span>
          <span class="metric-label">Edges</span>
        </div>
        <div class="metric">
          <span class="metric-value">{health.linkDensity.toFixed(2)}</span>
          <span class="metric-label">Density</span>
        </div>
        <div class="metric">
          <span class="metric-value">{avgConfStr}</span>
          <span class="metric-label">Avg Conf</span>
        </div>
        <div class="metric">
          <span class="metric-value">{health.openQuestions}</span>
          <span class="metric-label">Open Q's</span>
        </div>
      </div>
    </div>

    <!-- Type distribution -->
    {#if sortedTypes.length > 0}
      <div class="sidebar-section">
        <h4 class="sidebar-heading">Types</h4>
        {#each sortedTypes as [type, count]}
          <div class="type-bar-row">
            <span class="type-bar-label">{type}</span>
            <div class="type-bar-track">
              <div
                class="type-bar-fill"
                style:width="{(count / maxTypeCount) * 100}%"
                style:background-color={getNodeColor(type)}
              ></div>
            </div>
            <span class="type-bar-count">{count}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Status distribution -->
    {#if statusEntries.length > 0}
      <div class="sidebar-section">
        <h4 class="sidebar-heading">Status</h4>
        {#each statusEntries as [type, statuses]}
          <div class="status-group">
            <span class="status-group-label">{type}</span>
            <div class="status-badges">
              {#each Object.entries(statuses).filter(([, c]) => c > 0) as [status, count]}
                <span class="status-badge">{status} <b>{count}</b></span>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Gaps -->
    {#if health.gapDetails.length > 0}
      <div class="sidebar-section">
        <h4 class="sidebar-heading">Gaps</h4>
        {#each health.gapDetails as gap}
          <div class="gap-item">
            <span class="gap-type">{gap.type.replace(/_/g, ' ')}</span>
            <span class="gap-message">{gap.message}</span>
            <span class="gap-nodes">
              {#each gap.nodeIds as nodeId, i}
                {#if i > 0}, {/if}
                <button class="node-link" onclick={(e: MouseEvent) => handleNodeClick(e, nodeId)}>
                  {nodeId}
                </button>
              {/each}
            </span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Deferred items -->
    {#if health.deferredItems.length > 0}
      <div class="sidebar-section">
        <h4 class="sidebar-heading">Deferred</h4>
        <span class="gap-nodes">
          {#each health.deferredItems as itemId, i}
            {#if i > 0}, {/if}
            <button class="node-link" onclick={(e: MouseEvent) => handleNodeClick(e, itemId)}>
              {itemId}
            </button>
          {/each}
        </span>
      </div>
    {/if}

    <!-- Promotion candidates -->
    {#if candidates.length > 0}
      <div class="sidebar-section">
        <h4 class="sidebar-heading">Ready for Promotion</h4>
        {#each candidates as c}
          <div class="promo-item">
            <button class="node-link" onclick={(e: MouseEvent) => handleNodeClick(e, c.id)}>
              {c.id}
            </button>
            <span class="promo-detail">
              conf: {(c.confidence * 100).toFixed(0)}% · {c.supports} supports · {REASON_LABELS[c.reason] ?? c.reason}
            </span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Consolidation -->
    {#if hasConsolidation}
      <div class="sidebar-section">
        <h4 class="sidebar-heading">Consolidation Needed</h4>
        {#each consolidation!.triggers as trigger}
          <div class="gap-item">
            <span class="gap-message">{trigger.message}</span>
          </div>
        {/each}
        {#if consolidation!.orphanFindings.length > 0}
          <div class="orphan-row">
            <span class="orphan-label">Orphan findings:</span>
            {#each consolidation!.orphanFindings as oId, i}
              {#if i > 0}, {/if}
              <button class="node-link" onclick={(e: MouseEvent) => handleNodeClick(e, oId)}>
                {oId}
              </button>
            {/each}
          </div>
        {/if}
        {#if consolidation!.deferredItems.length > 0}
          <div class="orphan-row">
            <span class="orphan-label">Deferred:</span>
            {#each consolidation!.deferredItems as dId, i}
              {#if i > 0}, {/if}
              <button class="node-link" onclick={(e: MouseEvent) => handleNodeClick(e, dId)}>
                {dId}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <hr class="sidebar-divider" />
  {/if}
</aside>

<style>
  .health-sidebar {
    width: var(--sidebar-width, 280px);
    overflow-y: auto;
    padding: 12px;
    background: var(--bg-surface);
    border-right: 1px solid var(--border-color);
    font-size: 12px;
  }
  .sidebar-loading,
  .sidebar-error {
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }
  .sidebar-section {
    margin-bottom: 12px;
  }
  .sidebar-heading {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 6px 0;
  }
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px;
    background: var(--bg-primary);
    border-radius: 4px;
  }
  .metric-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }
  .metric-label {
    font-size: 9px;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  .type-bar-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
  }
  .type-bar-label {
    width: 72px;
    font-size: 11px;
    color: var(--text-secondary);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .type-bar-track {
    flex: 1;
    height: 8px;
    background: var(--bg-primary);
    border-radius: 2px;
    overflow: hidden;
  }
  .type-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .type-bar-count {
    width: 20px;
    text-align: right;
    font-size: 11px;
    color: var(--text-muted);
  }
  .status-group {
    margin-bottom: 6px;
  }
  .status-group-label {
    font-size: 11px;
    color: var(--text-muted);
  }
  .status-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 2px;
  }
  .status-badge {
    font-size: 10px;
    padding: 1px 5px;
    background: var(--bg-primary);
    border-radius: 3px;
    color: var(--text-secondary);
  }
  .gap-item {
    margin-bottom: 6px;
  }
  .gap-type {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: capitalize;
  }
  .gap-message {
    display: block;
    font-size: 11px;
    color: var(--text-secondary);
  }
  .gap-nodes {
    display: block;
    margin-top: 2px;
    font-size: 11px;
  }
  .node-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--color-link, #4A90D9);
    cursor: pointer;
    font-size: 11px;
    text-decoration: underline;
  }
  .node-link:hover {
    color: var(--color-link-hover, #2a6cb7);
  }
  .promo-item {
    margin-bottom: 4px;
  }
  .promo-detail {
    font-size: 11px;
    color: var(--text-muted);
  }
  .orphan-row {
    margin-top: 4px;
    font-size: 11px;
  }
  .orphan-label {
    color: var(--text-muted);
  }
  .sidebar-divider {
    border: none;
    border-top: 1px solid var(--border-separator);
    margin: 12px 0;
  }
</style>

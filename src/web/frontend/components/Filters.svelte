<script lang="ts">
  import { filterState } from '../state/filters.svelte.js';

  interface Props {
    types: string[];
    statuses: string[];
    edgeTypes: string[];
  }

  let { types, statuses, edgeTypes }: Props = $props();
</script>

<div class="filters">
  <div class="filter-section filter-section-types">
    <span class="filter-label">Types</span>
    <div class="filter-buttons">
      {#each types as type}
        <button
          class="filter-btn"
          class:active={filterState.visibleTypes.has(type)}
          onclick={() => filterState.toggleType(type)}
        >{type}</button>
      {/each}
    </div>
  </div>

  <div class="filter-section filter-section-statuses">
    <span class="filter-label">Statuses</span>
    <div class="filter-buttons">
      {#each statuses as status}
        <button
          class="filter-btn"
          class:active={filterState.visibleStatuses.has(status)}
          onclick={() => filterState.toggleStatus(status)}
        >{status}</button>
      {/each}
    </div>
  </div>

  <div class="filter-section filter-section-edges">
    <span class="filter-label">Edges</span>
    <div class="filter-buttons">
      {#each edgeTypes as edgeType}
        <button
          class="filter-btn"
          class:active={filterState.visibleEdgeTypes.has(edgeType)}
          onclick={() => filterState.toggleEdgeType(edgeType)}
        >{edgeType}</button>
      {/each}
    </div>
  </div>

  <button
    class="reset-btn"
    class:hidden={!filterState.hasActiveFilters}
    onclick={() => filterState.resetAll()}
  >Reset Filters</button>
</div>

<style>
  .filters {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 4px 0;
  }
  .filter-section {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .filter-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .filter-buttons {
    display: flex;
    gap: 2px;
  }
  .filter-btn {
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .filter-btn:hover {
    background: var(--bg-hover);
  }
  .filter-btn.active {
    background: var(--bg-active, rgba(74, 144, 217, 0.15));
    color: var(--text-primary);
    border-color: var(--accent-color, #4A90D9);
  }
  .reset-btn {
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: transparent;
    color: var(--text-warning, #E74C3C);
    cursor: pointer;
  }
  .reset-btn:hover {
    background: var(--bg-hover);
  }
  .reset-btn.hidden {
    visibility: hidden;
  }
</style>

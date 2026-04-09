<script lang="ts">
  import type { SerializedNode } from '../../types.js';

  interface Props {
    nodes: SerializedNode[];
    visibleTypes: Set<string>;
    visibleStatuses: Set<string>;
    onNavigate: (id: string) => void;
  }

  let { nodes, visibleTypes, visibleStatuses, onNavigate }: Props = $props();

  let query = $state('');
  let debouncedQuery = $state('');
  let currentIndex = $state(0);
  let hasNavigated = $state(false);

  // Debounce search query (300ms)
  $effect(() => {
    const q = query;
    const timer = setTimeout(() => { debouncedQuery = q; }, 300);
    return () => clearTimeout(timer);
  });

  const matches = $derived.by(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter((n) => {
      if (!visibleTypes.has(n.type)) return false;
      if (!visibleStatuses.has(n.status)) return false;
      return n.id.toLowerCase().startsWith(q) || n.title.toLowerCase().includes(q);
    });
  });

  const hasResults = $derived(debouncedQuery.trim().length > 0);

  // Reset navigation state when debounced query changes
  $effect(() => {
    debouncedQuery; // track
    currentIndex = 0;
    hasNavigated = false;
  });

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      if (matches.length === 0) return;
      if (e.shiftKey) {
        currentIndex = ((currentIndex - 1) + matches.length) % matches.length;
      } else {
        if (hasNavigated) {
          currentIndex = (currentIndex + 1) % matches.length;
        }
        hasNavigated = true;
      }
      onNavigate(matches[currentIndex].id);
    } else if (e.key === 'Escape') {
      query = '';
      currentIndex = 0;
      hasNavigated = false;
    }
  }

  function nextMatch(): void {
    if (matches.length === 0) return;
    currentIndex = (currentIndex + 1) % matches.length;
    hasNavigated = true;
    onNavigate(matches[currentIndex].id);
  }

  function prevMatch(): void {
    if (matches.length === 0) return;
    currentIndex = ((currentIndex - 1) + matches.length) % matches.length;
    hasNavigated = true;
    onNavigate(matches[currentIndex].id);
  }
</script>

<div class="search-bar">
  <input
    type="text"
    placeholder="Search nodes..."
    bind:value={query}
    onkeydown={handleKeyDown}
  />

  {#if hasResults}
    <div class="search-results">
      {#if matches.length === 0}
        <span class="no-match">No matches</span>
      {:else}
        <span class="match-count">{currentIndex + 1} / {matches.length}</span>
        <button class="nav-btn" aria-label="Previous match" onclick={prevMatch}>&#x25B2;</button>
        <button class="nav-btn" aria-label="Next match" onclick={nextMatch}>&#x25BC;</button>
        <div class="match-list">
          {#each matches as match, i}
            <button
              class="match-item"
              class:active={i === currentIndex}
              onclick={() => { currentIndex = i; onNavigate(match.id); }}
            >
              <span class="match-id">{match.id}</span>
              <span class="match-title">{match.title}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  input {
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--bg-primary);
    color: var(--text-primary);
    width: 180px;
    outline: none;
  }
  input:focus {
    border-color: var(--accent-color, #4A90D9);
  }
  .search-results {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .no-match {
    color: var(--text-warning, #E74C3C);
  }
  .match-count {
    white-space: nowrap;
  }
  .nav-btn {
    padding: 1px 4px;
    font-size: 10px;
    border: 1px solid var(--border-color);
    border-radius: 2px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    line-height: 1;
  }
  .nav-btn:hover {
    background: var(--bg-hover);
  }
  .match-list {
    position: absolute;
    top: 100%;
    left: 0;
    max-height: 200px;
    overflow-y: auto;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    z-index: 50;
    width: 280px;
    margin-top: 2px;
  }
  .match-item {
    display: flex;
    gap: 8px;
    padding: 4px 8px;
    font-size: 11px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    width: 100%;
    text-align: left;
  }
  .match-item:hover,
  .match-item.active {
    background: var(--bg-hover);
  }
  .match-id {
    font-weight: 600;
    color: var(--accent-color, #4A90D9);
    flex-shrink: 0;
  }
  .match-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
  }
</style>

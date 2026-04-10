<script lang="ts">
  import type { SerializedNode } from '../../types.js';
  import { getNodeColor } from '../lib/constants.js';
  import { fetchNodeDetail, type NodeDetailResponse } from '../lib/api.js';

  let {
    node,
    depth,
    onDepthChange,
    onNodeClick,
    onClose,
  }: {
    node: SerializedNode | null;
    depth: number;
    onDepthChange: (depth: number) => void;
    onNodeClick: (id: string) => void;
    onClose: () => void;
  } = $props();

  let detail = $state<NodeDetailResponse | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let fetchAbort: AbortController | null = null;

  const hopDepths = [1, 2, 3];

  // Fetch full detail when node changes
  $effect(() => {
    const _n = node;
    if (!_n) {
      detail = null;
      return;
    }
    fetchAbort?.abort();
    fetchAbort = new AbortController();
    const signal = fetchAbort.signal;
    loading = true;
    error = null;
    fetchNodeDetail(_n.id, { signal })
      .then((d) => { if (!signal.aborted) detail = d; })
      .catch((e) => { if (!signal.aborted) error = `Node not found: ${_n.id}`; })
      .finally(() => { if (!signal.aborted) loading = false; });

    return () => { fetchAbort?.abort(); };
  });

  function renderMarkdown(md: string): string {
    return md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  function confidenceColor(pct: number): string {
    return pct >= 80 ? '#2ECC71' : pct >= 50 ? '#F39C12' : '#E74C3C';
  }
</script>

{#if node}
  <aside class="detail-panel open">
    {#if loading}
      <div class="detail-loading">Loading...</div>
    {:else if error}
      <p class="detail-error">{error}</p>
    {:else if detail}
      {#if detail.invalid}
        <!-- Invalid node view -->
        <div class="detail-content">
          <h3 class="detail-title">{detail.title || detail.id}</h3>
          <div class="detail-badges">
            <span class="badge-type" style="background:{getNodeColor(detail.type)}">{detail.type}</span>
          </div>
          <div class="invalid-warning">
            <strong class="invalid-label">&#9888; Invalid Node</strong>
            <p class="invalid-error">{detail.parseError ?? 'Unknown error'}</p>
          </div>
        </div>
      {:else}
        <!-- Normal node view -->
        <div class="detail-content">
          <div class="detail-header">
            <span class="detail-id">{detail.id}</span>
            <button class="detail-close" onclick={onClose}>&times;</button>
          </div>
          <h3 class="detail-title">{detail.title}</h3>
          <div class="detail-badges">
            <span class="badge-type" style="background:{getNodeColor(detail.type)}">{detail.type}</span>
            {#if detail.status}
              <span class="badge-status">{detail.status}</span>
            {/if}
          </div>

          {#if detail.confidence != null}
            {@const pct = Math.round(detail.confidence * 100)}
            <div class="confidence-section">
              <div class="confidence-label">
                <span>Confidence</span><span>{pct}%</span>
              </div>
              <div class="confidence-track">
                <div class="confidence-bar" style="width:{pct}%;background:{confidenceColor(pct)}"></div>
              </div>
            </div>
          {/if}

          {#if detail.tags && detail.tags.length > 0}
            <div class="detail-tags">
              {#each detail.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}

          <!-- Hop depth controls -->
          <div class="hop-section">
            <span class="hop-label">Local graph:</span>
            {#each hopDepths as d}
              <button
                class="hop-btn"
                class:active={d === depth}
                onclick={() => onDepthChange(d)}
              >{d} hop</button>
            {/each}
          </div>

          <!-- Linked nodes -->
          {#if detail.links && detail.links.length > 0}
            <div class="links-section">
              <strong class="links-heading">Links</strong>
              {#each detail.links as link}
                <div class="link-item">
                  <button class="link-target" onclick={() => onNodeClick(link.target)}>
                    {link.target}
                  </button>
                  <span class="link-relation">{link.relation}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Markdown body -->
          {#if detail.body}
            <hr class="detail-separator" />
            <div class="detail-body">{@html renderMarkdown(detail.body)}</div>
          {/if}
        </div>
      {/if}
    {/if}
  </aside>
{/if}

<style>
  .detail-panel {
    width: var(--detail-width, 320px);
    height: 100%;
    overflow-y: auto;
    background: var(--bg-surface);
    border-left: 1px solid var(--border-color);
    padding: 12px;
    flex-shrink: 0;
  }
  .detail-loading {
    color: var(--text-muted);
    font-size: 13px;
    padding: 16px 0;
  }
  .detail-error {
    color: var(--text-faint);
    font-size: 13px;
  }
  .detail-content {
    margin-bottom: 12px;
  }
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .detail-id {
    font-size: 11px;
    color: var(--text-faint);
  }
  .detail-close {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 16px;
    color: var(--text-faint);
    padding: 0;
    line-height: 1;
  }
  .detail-close:hover {
    color: var(--text-primary);
  }
  .detail-title {
    font-size: 15px;
    margin: 4px 0;
    color: var(--text-primary);
  }
  .detail-badges {
    display: flex;
    gap: 6px;
    margin: 6px 0;
  }
  .badge-type {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
  }
  .badge-status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    background: var(--bg-badge);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
  }
  .confidence-section {
    margin: 4px 0;
  }
  .confidence-label {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
  }
  .confidence-track {
    height: 6px;
    background: var(--bg-bar-track);
    border-radius: 3px;
    overflow: hidden;
  }
  .confidence-bar {
    height: 100%;
    border-radius: 3px;
  }
  .detail-tags {
    margin: 8px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 2px;
    background: var(--bg-badge);
    font-size: 11px;
    color: var(--text-secondary);
  }
  .hop-section {
    margin: 10px 0;
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .hop-label {
    font-size: 11px;
    color: var(--text-muted);
  }
  .hop-btn {
    padding: 2px 8px;
    border: 1px solid var(--border-btn);
    border-radius: 3px;
    background: var(--bg-surface);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 11px;
  }
  .hop-btn.active {
    border-color: var(--color-link);
    background: var(--color-link);
    color: #fff;
  }
  .links-section {
    margin: 10px 0;
  }
  .links-heading {
    font-size: 12px;
    color: var(--text-primary);
  }
  .link-item {
    margin: 3px 0;
    font-size: 12px;
  }
  .link-target {
    background: none;
    border: none;
    padding: 0;
    color: var(--color-link);
    text-decoration: none;
    cursor: pointer;
    font-size: 12px;
  }
  .link-target:hover {
    text-decoration: underline;
  }
  .link-relation {
    color: var(--text-faint);
    font-size: 11px;
    margin-left: 4px;
  }
  .detail-separator {
    border: none;
    border-top: 1px solid var(--border-separator);
    margin: 12px 0;
  }
  .detail-body {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-primary);
  }
  .detail-body :global(h2) { font-size: 15px; margin: 8px 0 4px; }
  .detail-body :global(h3) { font-size: 14px; margin: 6px 0 3px; }
  .detail-body :global(h4) { font-size: 13px; margin: 4px 0 2px; }
  .detail-body :global(code) {
    background: var(--bg-code);
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 11px;
  }
  .detail-body :global(ul) {
    padding-left: 16px;
    margin: 4px 0;
  }
  .detail-body :global(li) {
    margin: 2px 0;
  }
  .invalid-warning {
    padding: 12px;
    background: var(--bg-warning, #fff3e0);
    border: 1px solid var(--border-invalid, #FF9800);
    border-radius: 4px;
    margin-top: 12px;
  }
  .invalid-label {
    color: var(--text-warning-strong, #e65100);
  }
  .invalid-error {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>

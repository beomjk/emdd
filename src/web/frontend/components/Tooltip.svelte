<script lang="ts">
  import type { SerializedNode } from '../../types.js';
  import { getNodeColor } from '../lib/constants.js';

  let { node, x, y, visible }: {
    node: SerializedNode | null;
    x: number;
    y: number;
    visible: boolean;
  } = $props();
</script>

{#if visible && node}
  <div class="node-tooltip" style="left:{x + 15}px;top:{y}px">
    <div class="node-tooltip-title">{node.title || node.id}</div>
    <div class="node-tooltip-badges">
      <span class="badge-type" style="background:{getNodeColor(node.type)}">{node.type}</span>
      {#if node.status}
        <span class="badge-status">{node.status}</span>
      {/if}
    </div>
    {#if node.confidence != null}
      <div class="node-tooltip-confidence">Confidence: {Math.round(node.confidence * 100)}%</div>
    {/if}
    {#if node.tags && node.tags.length > 0}
      <div class="node-tooltip-tags">
        {#each node.tags.slice(0, 3) as tag}
          <span class="node-tooltip-tag">{tag}</span>
        {/each}
        {#if node.tags.length > 3}
          <span class="node-tooltip-tag">+{node.tags.length - 3}</span>
        {/if}
      </div>
    {/if}
    {#if node.bodyPreview}
      <div class="node-tooltip-body">{node.bodyPreview}</div>
    {/if}
  </div>
{/if}

<style>
  .node-tooltip {
    position: absolute;
    z-index: 50;
    max-width: 280px;
    padding: 8px 10px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    pointer-events: none;
    font-size: 12px;
    line-height: 1.4;
  }
  .node-tooltip-title {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 4px;
    color: var(--text-primary);
  }
  .node-tooltip-badges {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
  }
  .badge-type {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
  }
  .badge-status {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--bg-badge);
    color: var(--text-secondary);
    font-size: 10px;
  }
  .node-tooltip-confidence {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  .node-tooltip-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-bottom: 4px;
  }
  .node-tooltip-tag {
    display: inline-block;
    padding: 0 4px;
    border-radius: 2px;
    background: var(--bg-badge);
    font-size: 10px;
    color: var(--text-secondary);
  }
  .node-tooltip-body {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
</style>

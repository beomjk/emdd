<script lang="ts">
  import type { SerializedNode } from '../../types.js';
  import { getNodeColor } from '../lib/constants.js';

  let { node, x, y, visible }: {
    node: SerializedNode | null;
    x: number;
    y: number;
    visible: boolean;
  } = $props();

  let tooltipEl: HTMLDivElement | undefined = $state();
  let clampedX = $state(0);
  let clampedY = $state(0);

  // Clamp the tooltip inside the viewport. If the tooltip would overflow the
  // right edge, flip it to the left of the node. Vertically center on the
  // node's rendered position. Runs after mount and whenever x/y/node change.
  $effect(() => {
    if (!visible || !node || !tooltipEl) return;
    // Read dimensions AFTER the conditional block has rendered the element.
    const rect = tooltipEl.getBoundingClientRect();
    const parent = tooltipEl.offsetParent as HTMLElement | null;
    const bounds = parent?.getBoundingClientRect() ?? { width: window.innerWidth, height: window.innerHeight };
    const margin = 8;

    // Default: 15px to the right of the node, vertically centered.
    let left = x + 15;
    let top = y - rect.height / 2;

    // Flip to the left side if the right edge would overflow.
    if (left + rect.width + margin > bounds.width) {
      left = x - rect.width - 15;
    }
    // Clamp within viewport.
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    if (top + rect.height + margin > bounds.height) {
      top = bounds.height - rect.height - margin;
    }
    clampedX = left;
    clampedY = top;
  });
</script>

{#if visible && node}
  <div bind:this={tooltipEl} class="node-tooltip" style="left:{clampedX}px;top:{clampedY}px">
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

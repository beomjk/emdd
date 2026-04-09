<script lang="ts">
  import { NODE_COLORS, STATUS_BORDER_LEGEND } from '../lib/constants.js';

  const typeEntries: [string, string][] = Object.entries(NODE_COLORS).map(
    ([type, color]) => [type.charAt(0).toUpperCase() + type.slice(1), color],
  );
</script>

<div class="legend">
  <div class="legend-heading">Node Types</div>
  {#each typeEntries as [label, color]}
    <div class="legend-item">
      <span class="legend-color" style="background-color:{color}"></span>
      {label}
    </div>
  {/each}

  <hr class="legend-separator" />

  <div class="legend-heading">Status Borders</div>
  <div class="legend-details">
    {#each STATUS_BORDER_LEGEND as [label, borderStyle, borderColor, borderWidth]}
      <div class="legend-item">
        <span class="legend-border-sample" style="border-top:{borderWidth}px {borderStyle} {borderColor}"></span>
        {label}
      </div>
    {/each}
  </div>
</div>

<style>
  .legend {
    position: absolute;
    bottom: 10px;
    right: 10px;
    padding: 10px 12px;
    background: var(--legend-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 11px;
    z-index: 20;
    max-width: 160px;
  }
  .legend-heading {
    font-weight: 600;
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 3px 0;
    color: var(--text-secondary);
  }
  .legend-color {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .legend-separator {
    border: none;
    border-top: 1px solid var(--border-separator);
    margin: 8px 0;
  }
  .legend-details {
    display: flex;
    flex-direction: column;
  }
  .legend-border-sample {
    display: inline-block;
    width: 20px;
    flex-shrink: 0;
  }
</style>

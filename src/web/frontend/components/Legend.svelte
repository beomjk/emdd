<script lang="ts">
  import {
    GRAPH_STATE_CUE_LEGEND,
    NODE_COLORS,
    STATUS_BORDER_LEGEND,
  } from '../lib/constants.js';

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

  <hr class="legend-separator" />

  <div class="legend-heading">State Cues</div>
  <div class="legend-details">
    {#each GRAPH_STATE_CUE_LEGEND as [label, cueClass, description]}
      <div class="legend-item legend-cue-item">
        <span class={`legend-cue-sample ${cueClass}`}></span>
        <span class="legend-cue-copy">
          <span class="legend-cue-label">{label}</span>
          <span class="legend-cue-description">{description}</span>
        </span>
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
    max-width: 220px;
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
  .legend-cue-item {
    align-items: flex-start;
  }
  .legend-cue-sample {
    display: inline-block;
    width: 18px;
    height: 14px;
    margin-top: 2px;
    border-radius: 999px;
    flex-shrink: 0;
    background: rgba(74, 144, 217, 0.16);
  }
  .legend-cue-sample.selected {
    border: 3px solid var(--accent-color);
    box-shadow: 0 0 0 3px var(--cy-selection-underlay);
    background: var(--bg-surface);
  }
  .legend-cue-sample.highlighted {
    box-shadow: 0 0 0 4px var(--cy-highlight-underlay);
    background: var(--bg-surface);
  }
  .legend-cue-sample.grouped {
    width: 22px;
    border-radius: 8px;
    border: 2px dashed var(--cy-cluster-border);
    background: var(--cy-cluster-bg);
  }
  .legend-cue-sample.invalid {
    background: var(--bg-surface);
    border: 2px dashed var(--border-invalid);
  }
  .legend-cue-copy {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .legend-cue-label {
    color: var(--text-secondary);
    font-weight: 600;
  }
  .legend-cue-description {
    color: var(--text-muted);
    line-height: 1.35;
  }
</style>

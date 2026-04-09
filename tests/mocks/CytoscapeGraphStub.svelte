<script lang="ts">
  import type { SerializedGraph } from '../../src/web/types.js';

  let {
    graph,
    layout,
    visibleTypes,
    visibleStatuses,
    visibleEdgeTypes,
    selectedNodeId,
    neighborIds,
    onNodeClick,
    onBackgroundClick,
  }: {
    graph: SerializedGraph;
    layout: 'force' | 'hierarchical';
    visibleTypes: Set<string>;
    visibleStatuses: Set<string>;
    visibleEdgeTypes: Set<string>;
    selectedNodeId: string | null;
    neighborIds: string[];
    onNodeClick: (id: string) => void;
    onBackgroundClick: () => void;
  } = $props();

  export function getCy() { return undefined; }
  export function panToNode(_id: string) {}
  export function pulseNode(_id: string) {}
</script>

<div data-testid="cytoscape-stub" data-graph-nodes={graph.nodes.length}></div>

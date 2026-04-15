import type { SerializedGraph, SerializedNode, LayoutMode } from '../../types.js';

let _graph = $state<SerializedGraph | null>(null);
let _selectedNodeId = $state<string | null>(null);
let _layout = $state<LayoutMode>('force');
let _theme = $state<'light' | 'dark'>('light');
let _error = $state<string | null>(null);

const _selectedNode = $derived(
  _graph?.nodes.find((n) => n.id === _selectedNodeId),
);

export const dashboardState = {
  get graph() { return _graph; },
  set graph(v: SerializedGraph | null) { _graph = v; },

  get selectedNodeId() { return _selectedNodeId; },
  set selectedNodeId(v: string | null) { _selectedNodeId = v; },

  get layout() { return _layout; },
  set layout(v: LayoutMode) { _layout = v; },

  get theme() { return _theme; },
  set theme(v: 'light' | 'dark') { _theme = v; },

  get error() { return _error; },
  set error(v: string | null) { _error = v; },

  get selectedNode(): SerializedNode | undefined { return _selectedNode; },

  selectNode(id: string) { _selectedNodeId = id; },
  deselectNode() { _selectedNodeId = null; },
  setGraph(graph: SerializedGraph) { _graph = graph; },
  setLayout(mode: LayoutMode) { _layout = mode; },
  toggleTheme() { _theme = _theme === 'light' ? 'dark' : 'light'; },
  restoreSelection(id: string | null, graph: SerializedGraph) {
    _graph = graph;
    if (!id) {
      _selectedNodeId = null;
      return false;
    }

    const exists = graph.nodes.some((node) => node.id === id);
    _selectedNodeId = exists ? id : null;
    return exists;
  },
};

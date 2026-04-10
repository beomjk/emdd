import { render, screen, waitFor } from '@testing-library/svelte';
import { vi } from 'vitest';
import { makeGraph, makeNode } from '../../../fixtures/component-fixtures.js';

vi.mock('../../../../src/web/frontend/lib/api.js', () => ({
  fetchGraph: vi.fn(),
  fetchNeighbors: vi.fn(),
  fetchNodeDetail: vi.fn(),
  fetchExportHtml: vi.fn(),
  triggerRefresh: vi.fn(),
}));

vi.mock('../../../../src/web/frontend/state/sse.svelte.js', () => ({
  sseState: {
    connected: false,
    lastUpdate: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    onGraphUpdated: vi.fn(),
  },
}));

// Stub child components that depend on browser APIs
function createStubComponent(testId: string) {
  const component = function ($$anchor: any, _$$props: any) {
    const div = document.createElement('div');
    div.setAttribute('data-testid', testId);
    $$anchor.before(div);
  };
  (component as any).__svelte_meta = { loc: {} };
  (component as any)['$$' as any] = true;
  return component;
}

vi.mock('../../../../src/web/frontend/components/CytoscapeGraph.svelte', () => ({
  default: createStubComponent('cytoscape-stub'),
}));

vi.mock('../../../../src/web/frontend/components/HealthSidebar.svelte', () => ({
  default: createStubComponent('health-sidebar-stub'),
}));

import App from '../../../../src/web/frontend/App.svelte';
import { fetchGraph, fetchNeighbors, fetchNodeDetail, fetchExportHtml, triggerRefresh } from '../../../../src/web/frontend/lib/api.js';
import { dashboardState } from '../../../../src/web/frontend/state/dashboard.svelte.js';
import { sseState } from '../../../../src/web/frontend/state/sse.svelte.js';

const mockFetchGraph = vi.mocked(fetchGraph);
const mockFetchNeighbors = vi.mocked(fetchNeighbors);
const mockFetchExportHtml = vi.mocked(fetchExportHtml);
const mockTriggerRefresh = vi.mocked(triggerRefresh);
const mockSseState = vi.mocked(sseState);

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton state between tests
    dashboardState.graph = null;
    dashboardState.selectedNodeId = null;
    dashboardState.error = null;
    // DetailPanel calls fetchNodeDetail when a node is selected — provide default mocks
    vi.mocked(fetchNeighbors).mockResolvedValue({ center: '', depth: 2, neighbors: [] });
    vi.mocked(fetchNodeDetail).mockResolvedValue({
      id: 'hyp-001', title: 'Test', type: 'hypothesis', body: null,
    });
  });

  describe('loading state', () => {
    it('shows "Loading graph..." before fetchGraph resolves', () => {
      mockFetchGraph.mockReturnValue(new Promise(() => {}));
      render(App);
      expect(screen.getByText('Loading graph...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when fetchGraph fails and no graph is loaded', async () => {
      mockFetchGraph.mockRejectedValue(new Error('Network error'));
      render(App);
      await waitFor(() => {
        expect(screen.queryByText('Loading graph...')).not.toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows "No nodes found" for empty graph', async () => {
      mockFetchGraph.mockResolvedValue(makeGraph([], []));
      render(App);
      await waitFor(() => {
        expect(screen.getByText('No nodes found in the graph.')).toBeInTheDocument();
      });
    });

    it('shows hint about emdd add', async () => {
      mockFetchGraph.mockResolvedValue(makeGraph([], []));
      render(App);
      await waitFor(() => {
        expect(screen.getByText('emdd add')).toBeInTheDocument();
      });
    });
  });

  describe('graph loaded', () => {
    it('renders graph area when nodes exist', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        expect(screen.queryByText('Loading graph...')).not.toBeInTheDocument();
        expect(screen.queryByText('No nodes found in the graph.')).not.toBeInTheDocument();
      });
    });
  });

  describe('sidebar', () => {
    it('renders HealthSidebar when graph is loaded', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        expect(screen.getByTestId('health-sidebar-stub')).toBeInTheDocument();
      });
    });

    it('does not render HealthSidebar during loading', () => {
      mockFetchGraph.mockReturnValue(new Promise(() => {}));
      render(App);
      expect(screen.queryByTestId('health-sidebar-stub')).not.toBeInTheDocument();
    });

    it('does not render HealthSidebar for empty graph', async () => {
      mockFetchGraph.mockResolvedValue(makeGraph([], []));
      render(App);
      await waitFor(() => {
        expect(screen.getByText('No nodes found in the graph.')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('health-sidebar-stub')).not.toBeInTheDocument();
    });
  });

  describe('toolbar', () => {
    it('renders "EMDD Dashboard" title', () => {
      mockFetchGraph.mockReturnValue(new Promise(() => {}));
      render(App);
      expect(screen.getByText('EMDD Dashboard')).toBeInTheDocument();
    });

    it('renders Filters when graph is loaded', async () => {
      const graph = makeGraph(
        [makeNode(), makeNode({ id: 'exp-001', type: 'experiment', status: 'TESTING' })],
        [],
      );
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        // Filters renders section labels
        expect(screen.getByText('Types')).toBeInTheDocument();
        expect(screen.getByText('Statuses')).toBeInTheDocument();
        expect(screen.getByText('Edges')).toBeInTheDocument();
      });
    });

    it('renders SearchBar when graph is loaded', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
      });
    });

    it('does not render Filters or SearchBar during loading', () => {
      mockFetchGraph.mockReturnValue(new Promise(() => {}));
      render(App);
      expect(screen.queryByText('Types')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search nodes...')).not.toBeInTheDocument();
    });

    it('does not render Filters or SearchBar for empty graph', async () => {
      mockFetchGraph.mockResolvedValue(makeGraph([], []));
      render(App);
      await waitFor(() => {
        expect(screen.getByText('No nodes found in the graph.')).toBeInTheDocument();
      });
      expect(screen.queryByText('Types')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search nodes...')).not.toBeInTheDocument();
    });
  });

  describe('layout selector', () => {
    it('renders layout select when graph is loaded', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        const select = screen.getByRole('combobox', { name: /layout/i });
        expect(select).toBeInTheDocument();
      });
    });

    it('has force and hierarchical options', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        const select = screen.getByRole('combobox', { name: /layout/i });
        const options = select.querySelectorAll('option');
        expect(options).toHaveLength(2);
        expect(options[0]).toHaveValue('force');
        expect(options[1]).toHaveValue('hierarchical');
      });
    });

    it('defaults to force layout', async () => {
      dashboardState.layout = 'force';
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        const select = screen.getByRole('combobox', { name: /layout/i }) as HTMLSelectElement;
        expect(select.value).toBe('force');
      });
    });

    it('updates dashboardState.layout on change', async () => {
      dashboardState.layout = 'force';
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        screen.getByRole('combobox', { name: /layout/i });
      });
      const select = screen.getByRole('combobox', { name: /layout/i }) as HTMLSelectElement;
      // Simulate change
      select.value = 'hierarchical';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => {
        expect(dashboardState.layout).toBe('hierarchical');
      });
    });

    it('does not render layout select during loading', () => {
      mockFetchGraph.mockReturnValue(new Promise(() => {}));
      render(App);
      expect(screen.queryByRole('combobox', { name: /layout/i })).not.toBeInTheDocument();
    });

    it('does not render layout select for empty graph', async () => {
      mockFetchGraph.mockResolvedValue(makeGraph([], []));
      render(App);
      await waitFor(() => {
        expect(screen.getByText('No nodes found in the graph.')).toBeInTheDocument();
      });
      expect(screen.queryByRole('combobox', { name: /layout/i })).not.toBeInTheDocument();
    });
  });

  describe('theme toggle', () => {
    it('renders ThemeToggle button in toolbar', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
      });
    });

    it('renders ThemeToggle even during loading', () => {
      mockFetchGraph.mockReturnValue(new Promise(() => {}));
      render(App);
      expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
    });
  });

  describe('SSE integration', () => {
    it('calls sseState.connect on mount', async () => {
      mockFetchGraph.mockResolvedValue(makeGraph([makeNode()], []));
      render(App);
      await waitFor(() => {
        expect(mockSseState.connect).toHaveBeenCalled();
      });
    });

    it('registers onGraphUpdated handler', async () => {
      mockFetchGraph.mockResolvedValue(makeGraph([makeNode()], []));
      render(App);
      await waitFor(() => {
        expect(mockSseState.onGraphUpdated).toHaveBeenCalledWith(expect.any(Function));
      });
    });
  });

  describe('toast', () => {
    it('shows error toast when error exists with loaded graph', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        expect(screen.getByTestId('cytoscape-stub')).toBeInTheDocument();
      });
      dashboardState.error = 'Something went wrong';
      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });
    });
  });

  describe('export button', () => {
    it('renders export button when graph is loaded', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      render(App);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
      });
    });

    it('does not render export button during loading', () => {
      mockFetchGraph.mockReturnValue(new Promise(() => {}));
      render(App);
      expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    });

    it('does not render export button for empty graph', async () => {
      mockFetchGraph.mockResolvedValue(makeGraph([], []));
      render(App);
      await waitFor(() => {
        expect(screen.getByText('No nodes found in the graph.')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    });

    it('calls fetchExportHtml with layout and filter params on click', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      mockFetchExportHtml.mockResolvedValue('<html></html>');

      // Mock URL.createObjectURL and link click
      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

      render(App);
      await waitFor(() => {
        screen.getByRole('button', { name: /export/i });
      });

      const btn = screen.getByRole('button', { name: /export/i });
      await btn.click();

      await waitFor(() => {
        expect(mockFetchExportHtml).toHaveBeenCalledWith(
          dashboardState.layout,
          expect.any(Array),
          expect.any(Array),
        );
      });

      vi.unstubAllGlobals();
    });
  });

  describe('SSE graph update flow', () => {
    it('re-fetches graph when SSE handler is called', async () => {
      const graph1 = makeGraph([makeNode()], []);
      const graph2 = makeGraph([makeNode(), makeNode({ id: 'exp-001', type: 'experiment' })], []);
      mockFetchGraph.mockResolvedValueOnce(graph1).mockResolvedValueOnce(graph2);

      render(App);
      await waitFor(() => {
        expect(mockSseState.onGraphUpdated).toHaveBeenCalled();
      });

      // Capture the registered SSE handler and invoke it
      const handler = mockSseState.onGraphUpdated.mock.calls[0][0] as () => Promise<void>;
      await handler();

      // fetchGraph should have been called twice (initial load + SSE update)
      expect(mockFetchGraph).toHaveBeenCalledTimes(2);
    });

    it('preserves selected node if it still exists after SSE update', async () => {
      const node = makeNode({ id: 'hyp-001' });
      const graph1 = makeGraph([node], []);
      const graph2 = makeGraph([node], []);
      mockFetchGraph.mockResolvedValueOnce(graph1).mockResolvedValueOnce(graph2);

      render(App);
      await waitFor(() => {
        expect(mockSseState.onGraphUpdated).toHaveBeenCalled();
      });

      // Select a node
      dashboardState.selectNode('hyp-001');

      // Trigger SSE update
      const handler = mockSseState.onGraphUpdated.mock.calls[0][0] as () => Promise<void>;
      await handler();

      expect(dashboardState.selectedNodeId).toBe('hyp-001');
    });

    it('deselects node if it was removed after SSE update', async () => {
      const node = makeNode({ id: 'hyp-001' });
      const graph1 = makeGraph([node], []);
      const graph2 = makeGraph([], []); // node removed
      mockFetchGraph.mockResolvedValueOnce(graph1).mockResolvedValueOnce(graph2);

      render(App);
      await waitFor(() => {
        expect(mockSseState.onGraphUpdated).toHaveBeenCalled();
      });

      // Select a node
      dashboardState.selectNode('hyp-001');

      // Trigger SSE update
      const handler = mockSseState.onGraphUpdated.mock.calls[0][0] as () => Promise<void>;
      await handler();

      expect(dashboardState.selectedNodeId).toBeNull();
    });
  });

  describe('refresh flow', () => {
    it('calls triggerRefresh and re-fetches graph on Refresh click', async () => {
      const graph = makeGraph([makeNode()], []);
      mockFetchGraph.mockResolvedValue(graph);
      mockTriggerRefresh.mockResolvedValue({ reloaded: true, loadedAt: '', nodeCount: 1 });

      render(App);
      await waitFor(() => {
        screen.getByRole('button', { name: /refresh/i });
      });

      const btn = screen.getByRole('button', { name: /refresh/i });
      await btn.click();

      await waitFor(() => {
        expect(mockTriggerRefresh).toHaveBeenCalled();
        // Initial load + refresh
        expect(mockFetchGraph).toHaveBeenCalledTimes(2);
      });
    });
  });
});

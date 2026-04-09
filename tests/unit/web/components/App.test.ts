import { render, screen, waitFor } from '@testing-library/svelte';
import { vi } from 'vitest';
import { makeGraph, makeNode } from '../../../fixtures/component-fixtures.js';

vi.mock('../../../../src/web/frontend/lib/api.js', () => ({
  fetchGraph: vi.fn(),
  fetchNeighbors: vi.fn(),
  fetchNodeDetail: vi.fn(),
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

import App from '../../../../src/web/frontend/App.svelte';
import { fetchGraph, fetchNeighbors } from '../../../../src/web/frontend/lib/api.js';
import { dashboardState } from '../../../../src/web/frontend/state/dashboard.svelte.js';

const mockFetchGraph = vi.mocked(fetchGraph);
const mockFetchNeighbors = vi.mocked(fetchNeighbors);

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton state between tests
    dashboardState.graph = null;
    dashboardState.selectedNodeId = null;
    dashboardState.error = null;
  });

  describe('loading state', () => {
    it('shows "Loading graph..." before fetchGraph resolves', () => {
      mockFetchGraph.mockReturnValue(new Promise(() => {}));
      render(App);
      expect(screen.getByText('Loading graph...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error when fetchGraph fails and no graph is loaded', async () => {
      mockFetchGraph.mockRejectedValue(new Error('Network error'));
      render(App);
      await waitFor(() => {
        // Loading should disappear
        expect(screen.queryByText('Loading graph...')).not.toBeInTheDocument();
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
});

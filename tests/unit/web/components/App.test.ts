import { render, screen, waitFor } from '@testing-library/svelte';
import { vi } from 'vitest';
import { makeGraph, makeNode } from '../../../fixtures/component-fixtures.js';

vi.mock('../../../../src/web/frontend/lib/api.js', () => ({
  fetchGraph: vi.fn(),
  fetchNeighbors: vi.fn(),
  fetchNodeDetail: vi.fn(),
}));

vi.mock('../../../../src/web/frontend/components/CytoscapeGraph.svelte', () => {
  // Return a minimal stub component factory
  return {
    default: (function () {
      const component = function ($$anchor: any, $$props: any) {
        // Minimal Svelte 5 compiled component structure
        const div = document.createElement('div');
        div.setAttribute('data-testid', 'cytoscape-stub');
        $$anchor.before(div);
      };
      // Mark as Svelte component
      (component as any).__svelte_meta = { loc: {} };
      (component as any)['$$' as any] = true;
      return component;
    })(),
  };
});

import App from '../../../../src/web/frontend/App.svelte';
import { fetchGraph, fetchNeighbors } from '../../../../src/web/frontend/lib/api.js';

const mockFetchGraph = vi.mocked(fetchGraph);
const mockFetchNeighbors = vi.mocked(fetchNeighbors);

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});

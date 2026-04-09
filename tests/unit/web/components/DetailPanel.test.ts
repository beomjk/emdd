import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi } from 'vitest';
import DetailPanel from '../../../../src/web/frontend/components/DetailPanel.svelte';
import { makeNode, makeNodeDetail } from '../../../fixtures/component-fixtures.js';

vi.mock('../../../../src/web/frontend/lib/api.js', () => ({
  fetchNodeDetail: vi.fn(),
}));

import { fetchNodeDetail } from '../../../../src/web/frontend/lib/api.js';
const mockFetchNodeDetail = vi.mocked(fetchNodeDetail);

describe('DetailPanel', () => {
  const defaultCallbacks = {
    onDepthChange: vi.fn(),
    onNodeClick: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when node is null', () => {
    it('renders nothing', () => {
      const { container } = render(DetailPanel, {
        props: { node: null, depth: 2, ...defaultCallbacks },
      });
      expect(container.querySelector('.detail-panel')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading text while fetching', () => {
      // Never-resolving promise to keep loading state
      mockFetchNodeDetail.mockReturnValue(new Promise(() => {}));
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetchNodeDetail.mockRejectedValue(new Error('Not found'));
      render(DetailPanel, {
        props: { node: makeNode({ id: 'bad-001' }), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('Node not found: bad-001')).toBeInTheDocument();
      });
    });
  });

  describe('normal node display', () => {
    beforeEach(() => {
      mockFetchNodeDetail.mockResolvedValue(makeNodeDetail() as any);
    });

    it('displays node id', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('hyp-001')).toBeInTheDocument();
      });
    });

    it('displays node title', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('Test Hypothesis')).toBeInTheDocument();
      });
    });

    it('renders type badge', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('hypothesis')).toBeInTheDocument();
      });
    });

    it('renders status badge', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('PROPOSED')).toBeInTheDocument();
      });
    });

    it('renders confidence bar with correct percentage', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('Confidence')).toBeInTheDocument();
      });
    });

    it('applies orange color for confidence 50-79%', async () => {
      const { container } = render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        const bar = container.querySelector('.confidence-bar') as HTMLElement;
        expect(bar).toBeInTheDocument();
        expect(bar.style.background).toBe('rgb(243, 156, 18)'); // #F39C12
      });
    });

    it('renders tags', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('ml')).toBeInTheDocument();
        expect(screen.getByText('vision')).toBeInTheDocument();
      });
    });

    it('renders linked nodes', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('exp-001')).toBeInTheDocument();
        expect(screen.getByText('tested_by')).toBeInTheDocument();
      });
    });

    it('renders markdown body', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('This is the body.')).toBeInTheDocument();
      });
    });
  });

  describe('invalid node display', () => {
    it('shows warning badge and parse error', async () => {
      mockFetchNodeDetail.mockResolvedValue(
        makeNodeDetail({ invalid: true, parseError: 'Bad YAML front matter' }) as any,
      );
      render(DetailPanel, {
        props: { node: makeNode({ invalid: true }), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText(/Invalid Node/)).toBeInTheDocument();
        expect(screen.getByText('Bad YAML front matter')).toBeInTheDocument();
      });
    });
  });

  describe('interactions', () => {
    beforeEach(() => {
      mockFetchNodeDetail.mockResolvedValue(makeNodeDetail() as any);
    });

    it('calls onClose when close button is clicked', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => screen.getByText('Test Hypothesis'));
      const closeBtn = screen.getByText('\u00D7'); // ×
      await fireEvent.click(closeBtn);
      expect(defaultCallbacks.onClose).toHaveBeenCalled();
    });

    it('calls onNodeClick when link button is clicked', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => screen.getByText('exp-001'));
      await fireEvent.click(screen.getByText('exp-001'));
      expect(defaultCallbacks.onNodeClick).toHaveBeenCalledWith('exp-001');
    });

    it('renders hop depth buttons (1, 2, 3)', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => {
        expect(screen.getByText('1 hop')).toBeInTheDocument();
        expect(screen.getByText('2 hop')).toBeInTheDocument();
        expect(screen.getByText('3 hop')).toBeInTheDocument();
      });
    });

    it('highlights the active depth button', async () => {
      const { container } = render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => screen.getByText('2 hop'));
      const buttons = container.querySelectorAll('.hop-btn');
      const activeBtn = Array.from(buttons).find((b) => b.classList.contains('active'));
      expect(activeBtn).toHaveTextContent('2 hop');
    });

    it('calls onDepthChange when hop button is clicked', async () => {
      render(DetailPanel, {
        props: { node: makeNode(), depth: 2, ...defaultCallbacks },
      });
      await waitFor(() => screen.getByText('3 hop'));
      await fireEvent.click(screen.getByText('3 hop'));
      expect(defaultCallbacks.onDepthChange).toHaveBeenCalledWith(3);
    });
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi } from 'vitest';
import SearchBar from '../../../../src/web/frontend/components/SearchBar.svelte';
import { makeNode } from '../../../fixtures/component-fixtures.js';

describe('SearchBar', () => {
  const nodes = [
    makeNode({ id: 'hyp-001', title: 'Machine Learning Hypothesis', type: 'hypothesis', status: 'PROPOSED' }),
    makeNode({ id: 'hyp-002', title: 'Deep Learning Study', type: 'hypothesis', status: 'TESTING' }),
    makeNode({ id: 'exp-001', title: 'ML Experiment One', type: 'experiment', status: 'PROPOSED' }),
    makeNode({ id: 'fnd-001', title: 'Finding on Accuracy', type: 'finding', status: 'SUPPORTED' }),
  ];

  const allTypes = new Set(['hypothesis', 'experiment', 'finding']);
  const allStatuses = new Set(['PROPOSED', 'TESTING', 'SUPPORTED']);

  const defaultProps = {
    nodes,
    visibleTypes: allTypes,
    visibleStatuses: allStatuses,
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders search input', () => {
      render(SearchBar, { props: defaultProps });
      expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    });

    it('shows no results initially', () => {
      const { container } = render(SearchBar, { props: defaultProps });
      expect(container.querySelector('.search-results')).not.toBeInTheDocument();
    });
  });

  describe('search by ID prefix', () => {
    it('matches nodes by ID prefix', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => {
        expect(screen.getByText('hyp-001')).toBeInTheDocument();
        expect(screen.getByText('hyp-002')).toBeInTheDocument();
      });
    });

    it('shows match count', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => {
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
      });
    });
  });

  describe('search by title substring', () => {
    it('matches nodes by title substring (case-insensitive)', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'machine' } });
      await waitFor(() => {
        expect(screen.getByText('hyp-001')).toBeInTheDocument();
      });
    });
  });

  describe('filtered visibility', () => {
    it('excludes nodes whose type is not visible', async () => {
      vi.useRealTimers();
      const filteredTypes = new Set(['hypothesis']); // only hypothesis visible
      render(SearchBar, {
        props: { ...defaultProps, visibleTypes: filteredTypes },
      });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'exp' } });
      await waitFor(() => {
        // exp-001 is type 'experiment' which is not in visibleTypes
        expect(screen.queryByText('exp-001')).not.toBeInTheDocument();
      });
    });

    it('excludes nodes whose status is not visible', async () => {
      vi.useRealTimers();
      const filteredStatuses = new Set(['PROPOSED']); // only PROPOSED visible
      render(SearchBar, {
        props: { ...defaultProps, visibleStatuses: filteredStatuses },
      });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => {
        // hyp-001 is PROPOSED (visible), hyp-002 is TESTING (not visible)
        expect(screen.getByText('hyp-001')).toBeInTheDocument();
        expect(screen.queryByText('hyp-002')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('calls onNavigate with current match on Enter', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => screen.getByText('hyp-001'));
      await fireEvent.keyDown(input, { key: 'Enter' });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith('hyp-001');
    });

    it('cycles to next match on Enter', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => screen.getByText('hyp-001'));
      await fireEvent.keyDown(input, { key: 'Enter' });
      await fireEvent.keyDown(input, { key: 'Enter' });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith('hyp-002');
    });

    it('cycles to previous match on Shift+Enter', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => screen.getByText('hyp-001'));
      // Go to second match
      await fireEvent.keyDown(input, { key: 'Enter' });
      await fireEvent.keyDown(input, { key: 'Enter' });
      // Go back
      await fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      expect(defaultProps.onNavigate).toHaveBeenLastCalledWith('hyp-001');
    });

    it('clears search on Escape', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => screen.getByText('hyp-001'));
      await fireEvent.keyDown(input, { key: 'Escape' });
      await waitFor(() => {
        expect(input.value).toBe('');
        expect(screen.queryByText('hyp-001')).not.toBeInTheDocument();
      });
    });
  });

  describe('navigation buttons', () => {
    it('has prev and next buttons', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => {
        expect(screen.getByLabelText('Previous match')).toBeInTheDocument();
        expect(screen.getByLabelText('Next match')).toBeInTheDocument();
      });
    });

    it('next button navigates to next match', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => screen.getByLabelText('Next match'));
      await fireEvent.click(screen.getByLabelText('Next match'));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith('hyp-002');
    });

    it('prev button navigates to previous match', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => screen.getByLabelText('Next match'));
      // Navigate forward first
      await fireEvent.click(screen.getByLabelText('Next match'));
      await fireEvent.click(screen.getByLabelText('Previous match'));
      expect(defaultProps.onNavigate).toHaveBeenLastCalledWith('hyp-001');
    });
  });

  describe('empty results', () => {
    it('shows no match message when search has no results', async () => {
      vi.useRealTimers();
      render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'zzzzz' } });
      await waitFor(() => {
        expect(screen.getByText('No matches')).toBeInTheDocument();
      });
    });
  });

  describe('currentIndex clamping on narrowed matches', () => {
    // Regression: filter change narrows `matches`, leaving currentIndex
    // pointing past the end. Without the clamp effect, Next/Prev and the
    // `matches[currentIndex]` access would produce undefined and crash.
    it('does not crash when filter narrows matches to fewer than currentIndex', async () => {
      vi.useRealTimers();
      const onNavigate = vi.fn();
      const { rerender } = render(SearchBar, {
        props: { ...defaultProps, onNavigate },
      });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => screen.getByLabelText('Next match'));

      // Navigate to index 1 (second match)
      await fireEvent.click(screen.getByLabelText('Next match'));
      expect(onNavigate).toHaveBeenLastCalledWith('hyp-002');

      // Narrow matches by removing TESTING status from the visible set.
      // Only hyp-001 (PROPOSED) remains.
      await rerender({
        ...defaultProps,
        onNavigate,
        visibleStatuses: new Set(['PROPOSED', 'SUPPORTED']),
      });

      // Should not throw, and Next should land on the single remaining match
      const nextBtn = screen.getByLabelText('Next match');
      expect(() => fireEvent.click(nextBtn)).not.toThrow();
      await waitFor(() => {
        expect(onNavigate).toHaveBeenLastCalledWith('hyp-001');
      });
    });

    it('resets match count display when filter narrows below current index', async () => {
      vi.useRealTimers();
      const { rerender } = render(SearchBar, { props: defaultProps });
      const input = screen.getByPlaceholderText('Search nodes...');
      await fireEvent.input(input, { target: { value: 'hyp' } });
      await waitFor(() => screen.getByText(/1 \/ 2/));

      // Click Next to advance currentIndex to 1
      await fireEvent.click(screen.getByLabelText('Next match'));
      await waitFor(() => screen.getByText(/2 \/ 2/));

      // Narrow to 1 match
      await rerender({
        ...defaultProps,
        visibleStatuses: new Set(['PROPOSED', 'SUPPORTED']),
      });

      // Count should clamp to "1 / 1"
      await waitFor(() => {
        expect(screen.getByText(/1 \/ 1/)).toBeInTheDocument();
      });
    });
  });
});

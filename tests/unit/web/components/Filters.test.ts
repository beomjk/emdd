import { render, screen, fireEvent } from '@testing-library/svelte';
import { vi } from 'vitest';
import Filters from '../../../../src/web/frontend/components/Filters.svelte';

// Mock filterState module
vi.mock('../../../../src/web/frontend/state/filters.svelte.js', () => {
  const state = {
    visibleTypes: new Set(['hypothesis', 'experiment']),
    visibleStatuses: new Set(['PROPOSED', 'TESTING']),
    visibleEdgeTypes: new Set(['tested_by', 'supported_by']),
    hasActiveFilters: false,
    toggleType: vi.fn(),
    toggleStatus: vi.fn(),
    toggleEdgeType: vi.fn(),
    resetAll: vi.fn(),
  };
  return { filterState: state };
});

import { filterState } from '../../../../src/web/frontend/state/filters.svelte.js';
const mockFilterState = vi.mocked(filterState);

describe('Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset filterState for each test
    mockFilterState.visibleTypes = new Set(['hypothesis', 'experiment']);
    mockFilterState.visibleStatuses = new Set(['PROPOSED', 'TESTING']);
    mockFilterState.visibleEdgeTypes = new Set(['tested_by', 'supported_by']);
    mockFilterState.hasActiveFilters = false;
  });

  describe('rendering', () => {
    it('renders type filter buttons', () => {
      render(Filters, {
        props: {
          types: ['hypothesis', 'experiment'],
          statuses: ['PROPOSED', 'TESTING'],
          edgeTypes: ['tested_by', 'supported_by'],
        },
      });
      expect(screen.getByText('hypothesis')).toBeInTheDocument();
      expect(screen.getByText('experiment')).toBeInTheDocument();
    });

    it('renders status filter buttons', () => {
      render(Filters, {
        props: {
          types: ['hypothesis'],
          statuses: ['PROPOSED', 'TESTING'],
          edgeTypes: ['tested_by'],
        },
      });
      expect(screen.getByText('PROPOSED')).toBeInTheDocument();
      expect(screen.getByText('TESTING')).toBeInTheDocument();
    });

    it('renders edge type filter buttons', () => {
      render(Filters, {
        props: {
          types: ['hypothesis'],
          statuses: ['PROPOSED'],
          edgeTypes: ['tested_by', 'supported_by'],
        },
      });
      expect(screen.getByText('tested_by')).toBeInTheDocument();
      expect(screen.getByText('supported_by')).toBeInTheDocument();
    });

    it('renders section labels', () => {
      render(Filters, {
        props: {
          types: ['hypothesis'],
          statuses: ['PROPOSED'],
          edgeTypes: ['tested_by'],
        },
      });
      expect(screen.getByText('Types')).toBeInTheDocument();
      expect(screen.getByText('Statuses')).toBeInTheDocument();
      expect(screen.getByText('Edges')).toBeInTheDocument();
    });

    it('renders Reset Filters button', () => {
      render(Filters, {
        props: {
          types: ['hypothesis'],
          statuses: ['PROPOSED'],
          edgeTypes: ['tested_by'],
        },
      });
      expect(screen.getByText('Reset Filters')).toBeInTheDocument();
    });
  });

  describe('visual state', () => {
    it('marks visible types as active', () => {
      const { container } = render(Filters, {
        props: {
          types: ['hypothesis', 'experiment', 'finding'],
          statuses: [],
          edgeTypes: [],
        },
      });
      // hypothesis and experiment are in visibleTypes, finding is not
      const buttons = container.querySelectorAll('.filter-btn');
      const labels = Array.from(buttons).map((b) => ({
        text: b.textContent,
        active: b.classList.contains('active'),
      }));
      const hypBtn = labels.find((l) => l.text === 'hypothesis');
      const findBtn = labels.find((l) => l.text === 'finding');
      expect(hypBtn?.active).toBe(true);
      expect(findBtn?.active).toBe(false);
    });

    it('shows Reset Filters button only when filters are active', () => {
      mockFilterState.hasActiveFilters = true;
      const { container } = render(Filters, {
        props: {
          types: ['hypothesis'],
          statuses: ['PROPOSED'],
          edgeTypes: ['tested_by'],
        },
      });
      const resetBtn = container.querySelector('.reset-btn');
      expect(resetBtn).not.toHaveClass('hidden');
    });

    it('hides Reset Filters button when no filters are active', () => {
      mockFilterState.hasActiveFilters = false;
      const { container } = render(Filters, {
        props: {
          types: ['hypothesis'],
          statuses: ['PROPOSED'],
          edgeTypes: ['tested_by'],
        },
      });
      const resetBtn = container.querySelector('.reset-btn');
      expect(resetBtn).toHaveClass('hidden');
    });
  });

  describe('interactions', () => {
    it('calls toggleType when type button is clicked', async () => {
      render(Filters, {
        props: {
          types: ['hypothesis', 'experiment'],
          statuses: [],
          edgeTypes: [],
        },
      });
      await fireEvent.click(screen.getByText('hypothesis'));
      expect(mockFilterState.toggleType).toHaveBeenCalledWith('hypothesis');
    });

    it('calls toggleStatus when status button is clicked', async () => {
      render(Filters, {
        props: {
          types: [],
          statuses: ['PROPOSED', 'TESTING'],
          edgeTypes: [],
        },
      });
      await fireEvent.click(screen.getByText('TESTING'));
      expect(mockFilterState.toggleStatus).toHaveBeenCalledWith('TESTING');
    });

    it('calls toggleEdgeType when edge type button is clicked', async () => {
      render(Filters, {
        props: {
          types: [],
          statuses: [],
          edgeTypes: ['tested_by', 'supported_by'],
        },
      });
      await fireEvent.click(screen.getByText('supported_by'));
      expect(mockFilterState.toggleEdgeType).toHaveBeenCalledWith('supported_by');
    });

    it('calls resetAll when Reset Filters button is clicked', async () => {
      mockFilterState.hasActiveFilters = true;
      render(Filters, {
        props: {
          types: ['hypothesis'],
          statuses: ['PROPOSED'],
          edgeTypes: ['tested_by'],
        },
      });
      await fireEvent.click(screen.getByText('Reset Filters'));
      expect(mockFilterState.resetAll).toHaveBeenCalled();
    });
  });

  describe('empty states', () => {
    it('renders nothing for empty types array', () => {
      const { container } = render(Filters, {
        props: {
          types: [],
          statuses: ['PROPOSED'],
          edgeTypes: ['tested_by'],
        },
      });
      // Types section should have no buttons
      const typesSection = container.querySelector('.filter-section-types');
      expect(typesSection?.querySelectorAll('.filter-btn').length ?? 0).toBe(0);
    });
  });
});

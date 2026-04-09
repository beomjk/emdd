import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, type Mock } from 'vitest';

// Mock api module
vi.mock('../../../../src/web/frontend/lib/api.js', () => ({
  fetchHealth: vi.fn(),
  fetchPromotionCandidates: vi.fn(),
  fetchConsolidation: vi.fn(),
}));

import {
  fetchHealth,
  fetchPromotionCandidates,
  fetchConsolidation,
} from '../../../../src/web/frontend/lib/api.js';
import HealthSidebar from '../../../../src/web/frontend/components/HealthSidebar.svelte';

const mockFetchHealth = fetchHealth as Mock;
const mockFetchPromotionCandidates = fetchPromotionCandidates as Mock;
const mockFetchConsolidation = fetchConsolidation as Mock;

// ── Test data ───────────────────────────────────────────────────────

const sampleHealth = {
  totalNodes: 14,
  totalEdges: 22,
  byType: {
    hypothesis: 5,
    experiment: 3,
    finding: 4,
    knowledge: 1,
    question: 1,
    episode: 0,
    decision: 0,
  },
  statusDistribution: {
    hypothesis: { PROPOSED: 2, TESTING: 2, SUPPORTED: 1 },
    experiment: { PLANNED: 1, RUNNING: 1, COMPLETED: 1 },
  },
  avgConfidence: 0.72,
  openQuestions: 1,
  linkDensity: 1.57,
  gaps: ['untested_hypothesis'],
  gapDetails: [
    {
      type: 'untested_hypothesis' as const,
      nodeIds: ['hyp-003', 'hyp-005'],
      message: '2 hypotheses lack experiments',
    },
  ],
  deferredItems: ['fnd-002'],
  affinityViolations: [],
};

const sampleCandidates = {
  candidates: [
    {
      id: 'hyp-001',
      confidence: 0.92,
      supports: 3,
      reason: 'confidence' as const,
    },
  ],
};

const sampleConsolidation = {
  triggers: [
    { type: 'finding_count', message: '4 findings ready for consolidation' },
  ],
  promotionCandidates: [],
  orphanFindings: ['fnd-004'],
  deferredItems: [],
};

// ── Helpers ─────────────────────────────────────────────────────────

function setupMocks(
  health = sampleHealth,
  candidates = sampleCandidates,
  consolidation = sampleConsolidation,
) {
  mockFetchHealth.mockResolvedValue(health);
  mockFetchPromotionCandidates.mockResolvedValue(candidates);
  mockFetchConsolidation.mockResolvedValue(consolidation);
}

// ── Tests ───────────────────────────────────────────────────────────

describe('HealthSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching', () => {
      // Never resolve the promises
      mockFetchHealth.mockReturnValue(new Promise(() => {}));
      mockFetchPromotionCandidates.mockReturnValue(new Promise(() => {}));
      mockFetchConsolidation.mockReturnValue(new Promise(() => {}));

      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('metrics rendering', () => {
    it('displays overview metrics (nodes, edges, density, confidence, open questions)', async () => {
      setupMocks();
      const { container } = render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });
      const metricValues = container.querySelectorAll('.metric-value');
      const values = Array.from(metricValues).map((el) => el.textContent);
      expect(values).toContain('14');
      expect(values).toContain('22');
      expect(values).toContain('1.57');
      expect(values).toContain('72%');
      expect(values).toContain('1'); // openQuestions
    });

    it('shows N/A when avgConfidence is null', async () => {
      setupMocks({ ...sampleHealth, avgConfidence: null });
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });

    it('renders section headings', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });
      expect(screen.getByText('Types')).toBeInTheDocument();
    });
  });

  describe('type distribution', () => {
    it('renders type bars for non-zero types sorted by count', async () => {
      setupMocks();
      const { container } = render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(container.querySelector('.type-bar-label')).not.toBeNull();
      });
      const barLabels = container.querySelectorAll('.type-bar-label');
      const labels = Array.from(barLabels).map((el) => el.textContent);
      expect(labels).toContain('hypothesis');
      expect(labels).toContain('experiment');
      expect(labels).toContain('finding');
      expect(labels).toContain('knowledge');
      expect(labels).toContain('question');
      // Zero-count types should not render
      expect(labels).not.toContain('episode');
      expect(labels).not.toContain('decision');
    });

    it('displays count numbers for each type', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // hypothesis count
      });
      expect(screen.getByText('3')).toBeInTheDocument(); // experiment count
      expect(screen.getByText('4')).toBeInTheDocument(); // finding count
    });
  });

  describe('status distribution', () => {
    it('renders status badges grouped by type', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
      expect(screen.getByText(/PROPOSED/)).toBeInTheDocument();
      expect(screen.getByText(/TESTING/)).toBeInTheDocument();
      expect(screen.getByText(/SUPPORTED/)).toBeInTheDocument();
    });
  });

  describe('gaps', () => {
    it('renders gap details with clickable node IDs', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Gaps')).toBeInTheDocument();
      });
      expect(screen.getByText('2 hypotheses lack experiments')).toBeInTheDocument();
      expect(screen.getByText('hyp-003')).toBeInTheDocument();
      expect(screen.getByText('hyp-005')).toBeInTheDocument();
    });

    it('does not render gaps section when gapDetails is empty', async () => {
      setupMocks({ ...sampleHealth, gapDetails: [] });
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });
      expect(screen.queryByText('Gaps')).not.toBeInTheDocument();
    });

    it('calls onNodeClick when gap node link is clicked', async () => {
      setupMocks();
      const onNodeClick = vi.fn();
      render(HealthSidebar, { props: { onNodeClick } });

      await waitFor(() => {
        expect(screen.getByText('hyp-003')).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByText('hyp-003'));
      expect(onNodeClick).toHaveBeenCalledWith('hyp-003');
    });
  });

  describe('deferred items', () => {
    it('renders deferred items with clickable node IDs', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Deferred')).toBeInTheDocument();
      });
      expect(screen.getByText('fnd-002')).toBeInTheDocument();
    });

    it('does not render deferred section when empty', async () => {
      setupMocks({ ...sampleHealth, deferredItems: [] });
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });
      expect(screen.queryByText('Deferred')).not.toBeInTheDocument();
    });

    it('calls onNodeClick when deferred node link is clicked', async () => {
      setupMocks();
      const onNodeClick = vi.fn();
      render(HealthSidebar, { props: { onNodeClick } });

      await waitFor(() => {
        expect(screen.getByText('fnd-002')).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByText('fnd-002'));
      expect(onNodeClick).toHaveBeenCalledWith('fnd-002');
    });
  });

  describe('promotion candidates', () => {
    it('renders promotion candidates with details', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Ready for Promotion')).toBeInTheDocument();
      });
      expect(screen.getByText('hyp-001')).toBeInTheDocument();
      expect(screen.getByText(/92%/)).toBeInTheDocument();
      expect(screen.getByText(/3 supports/)).toBeInTheDocument();
      expect(screen.getByText(/High confidence/)).toBeInTheDocument();
    });

    it('does not render section when no candidates', async () => {
      setupMocks(sampleHealth, { candidates: [] });
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });
      expect(screen.queryByText('Ready for Promotion')).not.toBeInTheDocument();
    });

    it('calls onNodeClick when promotion candidate is clicked', async () => {
      setupMocks();
      const onNodeClick = vi.fn();
      render(HealthSidebar, { props: { onNodeClick } });

      await waitFor(() => {
        expect(screen.getByText('hyp-001')).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByText('hyp-001'));
      expect(onNodeClick).toHaveBeenCalledWith('hyp-001');
    });
  });

  describe('consolidation triggers', () => {
    it('renders consolidation trigger messages', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Consolidation Needed')).toBeInTheDocument();
      });
      expect(screen.getByText('4 findings ready for consolidation')).toBeInTheDocument();
    });

    it('renders orphan findings with clickable links', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('fnd-004')).toBeInTheDocument();
      });
    });

    it('does not render section when no triggers/orphans/deferred', async () => {
      setupMocks(sampleHealth, sampleCandidates, {
        triggers: [],
        promotionCandidates: [],
        orphanFindings: [],
        deferredItems: [],
      });
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });
      expect(screen.queryByText('Consolidation Needed')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows error state when all API calls fail', async () => {
      mockFetchHealth.mockRejectedValue(new Error('Network error'));
      mockFetchPromotionCandidates.mockRejectedValue(new Error('Network error'));
      mockFetchConsolidation.mockRejectedValue(new Error('Network error'));

      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
      });
    });

    it('renders available data when some API calls fail', async () => {
      mockFetchHealth.mockResolvedValue(sampleHealth);
      mockFetchPromotionCandidates.mockRejectedValue(new Error('fail'));
      mockFetchConsolidation.mockRejectedValue(new Error('fail'));

      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        // Health data should still render
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('14')).toBeInTheDocument();
      });
      // Promotion and consolidation sections should not render
      expect(screen.queryByText('Ready for Promotion')).not.toBeInTheDocument();
      expect(screen.queryByText('Consolidation Needed')).not.toBeInTheDocument();
    });
  });

  describe('API calls', () => {
    it('fetches all three endpoints on mount', async () => {
      setupMocks();
      render(HealthSidebar, { props: { onNodeClick: vi.fn() } });

      await waitFor(() => {
        expect(mockFetchHealth).toHaveBeenCalledTimes(1);
      });
      expect(mockFetchPromotionCandidates).toHaveBeenCalledTimes(1);
      expect(mockFetchConsolidation).toHaveBeenCalledTimes(1);
    });
  });
});

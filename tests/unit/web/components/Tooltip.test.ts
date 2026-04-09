import { render, screen } from '@testing-library/svelte';
import Tooltip from '../../../../src/web/frontend/components/Tooltip.svelte';
import { makeNode } from '../../../fixtures/component-fixtures.js';

describe('Tooltip', () => {
  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      const { container } = render(Tooltip, {
        props: { node: makeNode(), x: 100, y: 100, visible: false },
      });
      expect(container.querySelector('.node-tooltip')).not.toBeInTheDocument();
    });

    it('renders nothing when node is null', () => {
      const { container } = render(Tooltip, {
        props: { node: null, x: 100, y: 100, visible: true },
      });
      expect(container.querySelector('.node-tooltip')).not.toBeInTheDocument();
    });

    it('renders tooltip when visible and node is provided', () => {
      const { container } = render(Tooltip, {
        props: { node: makeNode(), x: 100, y: 100, visible: true },
      });
      expect(container.querySelector('.node-tooltip')).toBeInTheDocument();
    });
  });

  describe('content rendering', () => {
    it('displays node title', () => {
      render(Tooltip, {
        props: { node: makeNode({ title: 'My Hypothesis' }), x: 0, y: 0, visible: true },
      });
      expect(screen.getByText('My Hypothesis')).toBeInTheDocument();
    });

    it('displays node id when title is empty', () => {
      render(Tooltip, {
        props: { node: makeNode({ title: '', id: 'hyp-042' }), x: 0, y: 0, visible: true },
      });
      expect(screen.getByText('hyp-042')).toBeInTheDocument();
    });

    it('renders type badge with correct color', () => {
      const { container } = render(Tooltip, {
        props: { node: makeNode({ type: 'hypothesis' }), x: 0, y: 0, visible: true },
      });
      const badge = container.querySelector('.badge-type') as HTMLElement;
      expect(badge).toHaveTextContent('hypothesis');
      // jsdom normalizes hex to rgb
      expect(badge.style.background).toBe('rgb(74, 144, 217)');
    });

    it('renders status badge when status is present', () => {
      render(Tooltip, {
        props: { node: makeNode({ status: 'PROPOSED' }), x: 0, y: 0, visible: true },
      });
      expect(screen.getByText('PROPOSED')).toBeInTheDocument();
    });

    it('omits status badge when status is empty', () => {
      const { container } = render(Tooltip, {
        props: { node: makeNode({ status: '' }), x: 0, y: 0, visible: true },
      });
      expect(container.querySelector('.badge-status')).not.toBeInTheDocument();
    });

    it('displays confidence as percentage', () => {
      render(Tooltip, {
        props: { node: makeNode({ confidence: 0.85 }), x: 0, y: 0, visible: true },
      });
      expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
    });

    it('omits confidence section when confidence is undefined', () => {
      const { container } = render(Tooltip, {
        props: { node: makeNode({ confidence: undefined }), x: 0, y: 0, visible: true },
      });
      expect(container.querySelector('.node-tooltip-confidence')).not.toBeInTheDocument();
    });

    it('renders up to 3 tags', () => {
      render(Tooltip, {
        props: {
          node: makeNode({ tags: ['ml', 'vision', 'nlp'] }),
          x: 0, y: 0, visible: true,
        },
      });
      expect(screen.getByText('ml')).toBeInTheDocument();
      expect(screen.getByText('vision')).toBeInTheDocument();
      expect(screen.getByText('nlp')).toBeInTheDocument();
    });

    it('shows overflow indicator for more than 3 tags', () => {
      render(Tooltip, {
        props: {
          node: makeNode({ tags: ['a', 'b', 'c', 'd', 'e'] }),
          x: 0, y: 0, visible: true,
        },
      });
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('omits tags section when tags are empty', () => {
      const { container } = render(Tooltip, {
        props: { node: makeNode({ tags: [] }), x: 0, y: 0, visible: true },
      });
      expect(container.querySelector('.node-tooltip-tags')).not.toBeInTheDocument();
    });

    it('renders bodyPreview when present', () => {
      render(Tooltip, {
        props: {
          node: makeNode({ bodyPreview: 'This is a preview...' }),
          x: 0, y: 0, visible: true,
        },
      });
      expect(screen.getByText('This is a preview...')).toBeInTheDocument();
    });

    it('omits body section when bodyPreview is absent', () => {
      const { container } = render(Tooltip, {
        props: { node: makeNode({ bodyPreview: undefined }), x: 0, y: 0, visible: true },
      });
      expect(container.querySelector('.node-tooltip-body')).not.toBeInTheDocument();
    });
  });

  describe('positioning', () => {
    it('positions with x+15 for left and y for top', () => {
      const { container } = render(Tooltip, {
        props: { node: makeNode(), x: 200, y: 150, visible: true },
      });
      const tooltip = container.querySelector('.node-tooltip') as HTMLElement;
      expect(tooltip.style.left).toBe('215px');
      expect(tooltip.style.top).toBe('150px');
    });
  });
});

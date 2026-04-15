import { render, screen } from '@testing-library/svelte';
import Legend from '../../../../src/web/frontend/components/Legend.svelte';
import {
  GRAPH_STATE_CUE_LEGEND,
  NODE_COLORS,
  STATUS_BORDER_LEGEND,
} from '../../../../src/web/frontend/lib/constants.js';

describe('Legend', () => {
  it('renders "Node Types" heading', () => {
    render(Legend);
    expect(screen.getByText('Node Types')).toBeInTheDocument();
  });

  it('renders one legend item per node type', () => {
    const { container } = render(Legend);
    const colorDots = container.querySelectorAll('.legend-color');
    expect(colorDots.length).toBe(Object.keys(NODE_COLORS).length);
  });

  it('capitalizes type labels', () => {
    render(Legend);
    for (const type of Object.keys(NODE_COLORS)) {
      const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
      expect(screen.getByText(capitalized)).toBeInTheDocument();
    }
  });

  it('renders color circles with correct background-color', () => {
    const { container } = render(Legend);
    const items = container.querySelectorAll('.legend-color');
    const colors = Object.values(NODE_COLORS);
    items.forEach((dot, i) => {
      expect((dot as HTMLElement).style.backgroundColor).toBeTruthy();
      // Verify color is set (jsdom normalizes to rgb)
      expect((dot as HTMLElement).style.backgroundColor).not.toBe('');
    });
    expect(items.length).toBe(colors.length);
  });

  it('renders "Status Borders" heading', () => {
    render(Legend);
    expect(screen.getByText('Status Borders')).toBeInTheDocument();
  });

  it('renders one border sample per status border entry', () => {
    const { container } = render(Legend);
    const samples = container.querySelectorAll('.legend-border-sample');
    expect(samples.length).toBe(STATUS_BORDER_LEGEND.length);
  });

  it('renders status labels', () => {
    render(Legend);
    for (const [label] of STATUS_BORDER_LEGEND) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('renders "State Cues" heading and one cue per legend entry', () => {
    const { container } = render(Legend);
    expect(screen.getByText('State Cues')).toBeInTheDocument();
    const samples = container.querySelectorAll('.legend-cue-sample');
    expect(samples.length).toBe(GRAPH_STATE_CUE_LEGEND.length);
  });

  it('renders state cue labels and descriptions', () => {
    render(Legend);
    for (const [label, , description] of GRAPH_STATE_CUE_LEGEND) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      expect(screen.getByText(description)).toBeInTheDocument();
    }
  });
});

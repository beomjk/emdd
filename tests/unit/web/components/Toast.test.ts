import { render, screen } from '@testing-library/svelte';
import { vi, beforeEach, afterEach } from 'vitest';
import Toast from '../../../../src/web/frontend/components/Toast.svelte';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders message when visible is true', () => {
    render(Toast, { props: { message: 'Graph updated', visible: true } });
    expect(screen.getByText('Graph updated')).toBeInTheDocument();
  });

  it('does not render when visible is false', () => {
    render(Toast, { props: { message: 'Graph updated', visible: false } });
    expect(screen.queryByText('Graph updated')).not.toBeInTheDocument();
  });

  it('has toast role for accessibility', () => {
    render(Toast, { props: { message: 'Hello', visible: true } });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays the correct message text', () => {
    render(Toast, { props: { message: 'Custom message', visible: true } });
    expect(screen.getByText('Custom message')).toBeInTheDocument();
  });
});

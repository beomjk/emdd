import { render, screen, fireEvent } from '@testing-library/svelte';
import { vi, beforeEach, afterEach } from 'vitest';
import ThemeToggle from '../../../../src/web/frontend/components/ThemeToggle.svelte';
import { dashboardState } from '../../../../src/web/frontend/state/dashboard.svelte.js';

describe('ThemeToggle', () => {
  let getItemSpy: ReturnType<typeof vi.fn>;
  let setItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dashboardState.theme = 'light';
    document.documentElement.dataset.theme = 'light';
    getItemSpy = vi.fn().mockReturnValue(null);
    setItemSpy = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a toggle button', () => {
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: /theme/i });
    expect(btn).toBeInTheDocument();
  });

  it('toggles theme from light to dark on click', async () => {
    dashboardState.theme = 'light';
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: /theme/i });
    await fireEvent.click(btn);
    expect(dashboardState.theme).toBe('dark');
  });

  it('toggles theme from dark to light on click', async () => {
    dashboardState.theme = 'dark';
    document.documentElement.dataset.theme = 'dark';
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: /theme/i });
    await fireEvent.click(btn);
    expect(dashboardState.theme).toBe('light');
  });

  it('sets document.documentElement.dataset.theme on click', async () => {
    dashboardState.theme = 'light';
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: /theme/i });
    await fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists theme to localStorage on click', async () => {
    dashboardState.theme = 'light';
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: /theme/i });
    await fireEvent.click(btn);
    expect(setItemSpy).toHaveBeenCalledWith('emdd-theme', 'dark');
  });

  it('restores theme from localStorage on mount', () => {
    getItemSpy.mockReturnValue('dark');
    render(ThemeToggle);
    expect(dashboardState.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

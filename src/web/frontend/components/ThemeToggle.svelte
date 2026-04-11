<script lang="ts">
  import { dashboardState } from '../state/dashboard.svelte.js';

  function toggle(): void {
    dashboardState.toggleTheme();
    document.documentElement.dataset.theme = dashboardState.theme;
    localStorage.setItem('emdd-theme', dashboardState.theme);
  }

  // Restore persisted theme on mount, fall back to system preference.
  // When no explicit preference is saved, subscribe to OS-level changes so
  // auto dark mode (sunset trigger, night shift, etc.) updates the dashboard
  // live instead of requiring a page reload.
  $effect(() => {
    const saved = localStorage.getItem('emdd-theme');
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    let theme: 'light' | 'dark';
    if (saved === 'dark' || saved === 'light') {
      theme = saved;
    } else {
      theme = mql.matches ? 'dark' : 'light';
    }
    dashboardState.theme = theme;
    document.documentElement.dataset.theme = theme;

    const onSystemChange = (e: MediaQueryListEvent): void => {
      if (localStorage.getItem('emdd-theme')) return; // explicit preference wins
      const next = e.matches ? 'dark' : 'light';
      dashboardState.theme = next;
      document.documentElement.dataset.theme = next;
    };
    mql.addEventListener('change', onSystemChange);
    return () => mql.removeEventListener('change', onSystemChange);
  });
</script>

<button class="theme-toggle" aria-label="Toggle theme" onclick={toggle}>
  {dashboardState.theme === 'light' ? '\u263E' : '\u2600'}
</button>

<style>
  .theme-toggle {
    background: none;
    border: 1px solid var(--border-btn);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 16px;
    color: var(--text-primary);
    line-height: 1;
  }
  .theme-toggle:hover {
    background: var(--bg-hover);
  }
</style>

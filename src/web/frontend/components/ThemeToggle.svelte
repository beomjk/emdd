<script lang="ts">
  import { dashboardState } from '../state/dashboard.svelte.js';

  function toggle(): void {
    dashboardState.toggleTheme();
    document.documentElement.dataset.theme = dashboardState.theme;
    localStorage.setItem('emdd-theme', dashboardState.theme);
  }

  // Restore persisted theme on mount, fall back to system preference
  $effect(() => {
    const saved = localStorage.getItem('emdd-theme');
    let theme: 'light' | 'dark';
    if (saved === 'dark' || saved === 'light') {
      theme = saved;
    } else {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    dashboardState.theme = theme;
    document.documentElement.dataset.theme = theme;
    return undefined;
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

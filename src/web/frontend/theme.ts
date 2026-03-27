import { getCy } from './graph.js';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'emdd-theme';

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return getSystemTheme();
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  updateCytoscapeTheme(theme === 'dark');
  updateThemeButton(theme);
}

function updateThemeButton(theme: Theme): void {
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '\u2600' : '\u263D';
}

export function updateCytoscapeTheme(isDark: boolean): void {
  const cy = getCy();
  if (!cy) return;

  const nodeText = isDark ? '#b0b8c8' : '#555';
  const edgeColor = isDark ? '#3a4a65' : '#ccc';
  const edgeLabel = isDark ? '#8090a8' : '#888';

  cy.batch(() => {
    cy.style()
      .selector('node')
      .style({ color: nodeText })
      .selector('edge')
      .style({
        'line-color': edgeColor,
        'target-arrow-color': edgeColor,
      })
      .selector('edge:active, edge:selected')
      .style({ color: edgeLabel })
      .update();
  });
}

export function toggleTheme(): void {
  const current = getTheme();
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
}

export function initTheme(): void {
  applyTheme(getTheme());

  // Listen for system theme changes (only applies when no explicit preference stored)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(getSystemTheme());
    }
  });
}

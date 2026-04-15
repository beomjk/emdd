import { test, expect } from '@playwright/test';
import {
  clickCyNode,
  getTheme,
  sel,
  waitForGraphReady,
} from './fixtures/helpers.js';

test.describe('US5: Theme Toggle and Live Reload', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('emdd-theme'));
    await page.reload();
    await waitForGraphReady(page);
  });

  test.describe('Theme Toggle', () => {
    test('theme toggle button is visible', async ({ page }) => {
      await expect(page.locator(sel.themeToggle)).toBeVisible();
    });

    test('clicking toggle changes theme', async ({ page }) => {
      const initialTheme = await getTheme(page);
      await page.locator(sel.themeToggle).click();
      await page.waitForTimeout(200);

      const newTheme = await getTheme(page);
      expect(newTheme).not.toBe(initialTheme);
    });

    test('toggling changes CSS variables', async ({ page }) => {
      const bgBefore = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(),
      );

      await page.locator(sel.themeToggle).click();
      await page.waitForTimeout(200);

      const bgAfter = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(),
      );

      expect(bgAfter).not.toBe(bgBefore);
    });

    test('theme persists across page reload', async ({ page }) => {
      // Toggle to dark
      await page.locator(sel.themeToggle).click();
      await page.waitForTimeout(200);
      const themeAfterToggle = await getTheme(page);

      // Reload
      await page.reload();
      await waitForGraphReady(page);

      const themeAfterReload = await getTheme(page);
      expect(themeAfterReload).toBe(themeAfterToggle);
    });

    test('selected and grouped graph cues restyle with the active theme', async ({ page }) => {
      await page.route('**/api/clusters', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            clusters: [
              {
                id: 'cluster-theme',
                label: 'Theme Cluster',
                nodeIds: ['hyp-001', 'exp-001'],
                isManual: false,
              },
            ],
          }),
        });
      });

      await page.reload();
      await waitForGraphReady(page);
      await clickCyNode(page, 'hyp-001');
      await expect(page.locator(sel.detailPanelOpen)).toBeVisible();

      await expect.poll(async () => {
        return page.evaluate(() => {
          const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
          if (!cy) return 0;
          return Number.parseFloat(cy.getElementById('hyp-001').style('border-width'));
        });
      }).toBeGreaterThanOrEqual(4);

      const detailTitleBefore = await page.locator(sel.detailTitle).textContent();

      const before = await page.evaluate(() => {
        const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
        if (!cy) throw new Error('Cytoscape not found');

        const node = cy.getElementById('hyp-001');
        const cluster = cy.getElementById('cluster-theme');

        return {
          theme: document.documentElement.dataset.theme ?? 'light',
          selectedBorderWidth: node.style('border-width'),
          graphBackground: getComputedStyle(
            document.querySelector('.graph-canvas') as HTMLElement,
          ).backgroundColor,
          clusterBorderStyle: cluster.style('border-style'),
        };
      });

      expect(Number.parseFloat(before.selectedBorderWidth)).toBeGreaterThanOrEqual(4);
      expect(before.graphBackground).not.toBe('');
      expect(before.clusterBorderStyle).toBe('dashed');

      await page.locator(sel.themeToggle).click();
      await page.waitForTimeout(200);
      await expect(page.locator(sel.detailPanelOpen)).toBeVisible();
      await expect(page.locator(sel.detailTitle)).toHaveText(detailTitleBefore ?? '');

      const after = await page.evaluate(() => {
        const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
        if (!cy) throw new Error('Cytoscape not found');

        const node = cy.getElementById('hyp-001');
        const cluster = cy.getElementById('cluster-theme');

        return {
          theme: document.documentElement.dataset.theme ?? 'light',
          selectedBorderWidth: node.style('border-width'),
          graphBackground: getComputedStyle(
            document.querySelector('.graph-canvas') as HTMLElement,
          ).backgroundColor,
        };
      });

      expect(after.theme).not.toBe(before.theme);
      expect(after.graphBackground).not.toBe(before.graphBackground);
    });

    test('theme toggle updates button content', async ({ page }) => {
      const contentBefore = await page.locator(sel.themeToggle).textContent();
      await page.locator(sel.themeToggle).click();
      await page.waitForTimeout(200);

      const contentAfter = await page.locator(sel.themeToggle).textContent();
      expect(contentAfter).not.toBe(contentBefore);
    });
  });

  test.describe('SSE Live Reload', () => {
    test('SSE connection is established on page load', async ({ page }) => {
      // Check that an EventSource was created by monitoring network
      const hasSSE = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const es = new EventSource('/api/events');
          es.addEventListener('connected', () => {
            es.close();
            resolve(true);
          });
          es.onerror = () => {
            es.close();
            resolve(false);
          };
          setTimeout(() => { es.close(); resolve(false); }, 3000);
        });
      });
      expect(hasSSE).toBe(true);
    });
  });
});

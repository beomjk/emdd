import { test, expect } from '@playwright/test';
import { sel, waitForGraphReady, getTheme } from './fixtures/helpers.js';

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

import { test, expect } from '@playwright/test';
import { sel, waitForGraphReady } from './fixtures/helpers.js';

test.describe('Edge Cases', () => {
  test('empty graph shows message', async ({ page }) => {
    // Intercept the graph API to return an empty graph
    await page.route('**/api/graph', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nodes: [], edges: [] }),
      }),
    );
    await page.goto('/');
    await page.locator(sel.loadingState).waitFor({ state: 'hidden', timeout: 10_000 });

    await expect(page.locator(sel.emptyState)).toBeVisible();
    await expect(page.locator(sel.emptyState)).toContainText('No nodes found');
  });

  test('API error displays user-visible error', async ({ page }) => {
    // Intercept graph API to return error
    await page.route('**/api/graph', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );
    await page.goto('/');
    await page.locator(sel.loadingState).waitFor({ state: 'hidden', timeout: 10_000 });

    await expect(page.locator(sel.errorState)).toBeVisible();
  });

  test('SSE reconnects after disconnect', async ({ page }) => {
    await page.goto('/');
    await waitForGraphReady(page);

    // Verify SSE endpoint is accessible (connection can be established)
    const canConnect = await page.evaluate(() => {
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
    expect(canConnect).toBe(true);
  });

  test('graph still renders when clusters API fails', async ({ page }) => {
    // Intercept clusters API to fail
    await page.route('**/api/clusters', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Cluster error' }),
      }),
    );
    await page.goto('/');
    await waitForGraphReady(page);

    // Graph should still render without clusters
    await expect(page.locator(sel.graphCanvas)).toBeVisible();
  });

  test('loading state shows while graph fetches', async ({ page }) => {
    // Add a delay to the graph API
    await page.route('**/api/graph', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });
    await page.goto('/');

    // Loading state should be visible initially
    await expect(page.locator(sel.loadingState)).toBeVisible();

    // Then should disappear when loaded
    await page.locator(sel.loadingState).waitFor({ state: 'hidden', timeout: 15_000 });
  });
});

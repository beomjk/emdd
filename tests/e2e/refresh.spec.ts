import { test, expect } from '@playwright/test';
import { clickCyNode, sel, FIXTURE, waitForGraphReady, getCyNodeCount } from './fixtures/helpers.js';

test.describe('US6: Refresh Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGraphReady(page);
  });

  test('refresh button is visible when graph is loaded', async ({ page }) => {
    await expect(page.locator(sel.refreshBtn)).toBeVisible();
  });

  test('clicking refresh reloads the graph and shows success toast', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/refresh') || url.endsWith('/api/graph')) {
        apiRequests.push(`${req.method()} ${new URL(url).pathname}`);
      }
    });

    await page.locator(sel.refreshBtn).click();

    await expect(page.locator(sel.toast)).toBeVisible();
    await expect(page.locator(sel.toast)).toContainText(/refreshed/i);

    // Refresh path: POST /api/refresh then GET /api/graph
    expect(apiRequests).toEqual(
      expect.arrayContaining(['POST /api/refresh', 'GET /api/graph']),
    );

    // Graph should still be rendered after refresh
    await expect(page.locator(sel.graphCanvas)).toBeVisible();
    expect(await getCyNodeCount(page)).toBe(FIXTURE.nodeCount);
  });

  test('refresh preserves filter selections', async ({ page }) => {
    // Toggle a type filter off
    const typeButtons = page.locator(`${sel.filterSectionTypes} ${sel.filterBtn}`);
    const firstBtn = typeButtons.first();
    const labelBefore = (await firstBtn.textContent()) ?? '';
    // force: true — canvas can intercept pointer events (see filters-search spec)
    await firstBtn.click({ force: true });
    await page.waitForTimeout(200);

    // Refresh
    await page.locator(sel.refreshBtn).click();
    await expect(page.locator(sel.toast)).toContainText(/refreshed/i);

    // Same button should still be inactive (filter preserved across refresh)
    const typeButtonAfter = page.locator(
      `${sel.filterSectionTypes} ${sel.filterBtn}`,
      { hasText: labelBefore.trim() },
    ).first();
    await expect(typeButtonAfter).not.toHaveClass(/\bactive\b/);
  });

  test('refresh keeps the selected node visibly selected when it still exists', async ({ page }) => {
    await clickCyNode(page, 'hyp-001');
    await expect(page.locator(sel.detailPanelOpen)).toBeVisible();

    await page.locator(sel.refreshBtn).click();
    await expect(page.locator(sel.toast)).toContainText(/refreshed/i);
    await expect(page.locator(sel.detailPanelOpen)).toBeVisible();
    await expect(page.locator(sel.detailId)).toContainText('hyp-001');

    await expect.poll(async () => {
      return page.evaluate(() => {
        const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
        if (!cy) return 0;
        return Number.parseFloat(cy.getElementById('hyp-001').style('border-width'));
      });
    }).toBeGreaterThanOrEqual(4);
  });
});

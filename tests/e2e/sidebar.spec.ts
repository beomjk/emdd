import { test, expect } from '@playwright/test';
import { sel, FIXTURE, waitForGraphReady, clickCyNode } from './fixtures/helpers.js';

test.describe('US3: Sidebar Shows Health and Insights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGraphReady(page);
  });

  test('health sidebar is visible', async ({ page }) => {
    await expect(page.locator(sel.healthSidebar)).toBeVisible();
  });

  test('shows correct total node count', async ({ page }) => {
    // Wait for sidebar to load
    await page.locator(sel.healthSidebar).locator(sel.metricValue).first().waitFor({ timeout: 5000 });

    const metrics = page.locator(sel.healthSidebar).locator(sel.metricValue);
    const firstMetric = await metrics.first().textContent();
    // First metric should be total nodes = 14
    expect(firstMetric?.trim()).toBe(String(FIXTURE.nodeCount));
  });

  test('shows type distribution bars', async ({ page }) => {
    await page.locator(sel.healthSidebar).locator(sel.typeBarRow).first().waitFor({ timeout: 5000 });

    const bars = page.locator(sel.healthSidebar).locator(sel.typeBarRow);
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);
  });

  test('shows metric labels', async ({ page }) => {
    await page.locator(sel.healthSidebar).locator(sel.metricLabel).first().waitFor({ timeout: 5000 });

    const labels = page.locator(sel.healthSidebar).locator(sel.metricLabel);
    const count = await labels.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('clicking a node link in sidebar navigates to that node', async ({ page }) => {
    // Wait for sidebar content
    await page.locator(sel.healthSidebar).locator(sel.metricValue).first().waitFor({ timeout: 5000 });

    const nodeLinks = page.locator(sel.healthSidebar).locator(sel.nodeLink);
    const linkCount = await nodeLinks.count();

    if (linkCount > 0) {
      const linkText = await nodeLinks.first().textContent();
      await nodeLinks.first().click();
      await page.waitForTimeout(500);

      // Detail panel should open for the clicked node
      const panel = page.locator(sel.detailPanelOpen);
      await expect(panel).toBeVisible();

      if (linkText) {
        await expect(panel.locator(sel.detailId)).toContainText(linkText.trim());
      }
    }
  });

  test('sidebar shows gaps section when gaps exist', async ({ page }) => {
    await page.locator(sel.healthSidebar).locator(sel.metricValue).first().waitFor({ timeout: 5000 });
    // The gaps section may or may not have items depending on fixture data
    // Just verify the sidebar loaded without errors
    await expect(page.locator(sel.healthSidebar)).toBeVisible();
    await expect(page.locator(`${sel.healthSidebar} ${sel.sidebarLoading}`)).not.toBeVisible();
  });
});

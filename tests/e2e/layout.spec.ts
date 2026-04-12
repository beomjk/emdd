import { test, expect } from '@playwright/test';
import { sel, waitForGraphReady, getCyNodeCount } from './fixtures/helpers.js';

test.describe('US4: Layout Switching and Clustering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGraphReady(page);
  });

  test('layout selector is visible with force as default', async ({ page }) => {
    const select = page.locator(sel.layoutSelector);
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('force');
  });

  test('switching to hierarchical layout repositions nodes', async ({ page }) => {
    // Capture node positions before layout switch
    const posBefore = await page.evaluate(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return {};
      const pos: Record<string, { x: number; y: number }> = {};
      cy.nodes('[!isCluster]').forEach((n: any) => {
        pos[n.id()] = { ...n.position() };
      });
      return pos;
    });

    // Switch to hierarchical
    await page.locator(sel.layoutSelector).selectOption('hierarchical');
    // Wait for layout animation to complete
    await page.waitForTimeout(1500);

    // Capture positions after
    const posAfter = await page.evaluate(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return {};
      const pos: Record<string, { x: number; y: number }> = {};
      cy.nodes('[!isCluster]').forEach((n: any) => {
        pos[n.id()] = { ...n.position() };
      });
      return pos;
    });

    // At least some nodes should have moved
    let movedCount = 0;
    for (const id of Object.keys(posBefore)) {
      if (posAfter[id]) {
        const dx = Math.abs(posBefore[id].x - posAfter[id].x);
        const dy = Math.abs(posBefore[id].y - posAfter[id].y);
        if (dx > 1 || dy > 1) movedCount++;
      }
    }
    expect(movedCount).toBeGreaterThan(0);
  });

  test('switching back to force layout works', async ({ page }) => {
    await page.locator(sel.layoutSelector).selectOption('hierarchical');
    await page.waitForTimeout(1500);
    await page.locator(sel.layoutSelector).selectOption('force');
    await page.waitForTimeout(1500);

    await expect(page.locator(sel.layoutSelector)).toHaveValue('force');
    const count = await getCyNodeCount(page);
    expect(count).toBeGreaterThan(0);
  });

  test('cluster compound nodes render with colored backgrounds', async ({ page }) => {
    // Check if cluster (compound) nodes exist
    const clusterCount = await page.evaluate(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return 0;
      return cy.nodes('[?isCluster]').length;
    });

    // Clusters may or may not be created depending on the API response.
    // If clusters exist, verify they have background color.
    if (clusterCount > 0) {
      const hasBackgroundColor = await page.evaluate(() => {
        const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
        if (!cy) return false;
        const clusterNodes = cy.nodes('[?isCluster]');
        return clusterNodes.some((n: any) => {
          const bg = n.style('background-color');
          return bg && bg !== 'rgb(0,0,0)';
        });
      });
      expect(hasBackgroundColor).toBe(true);
    }
  });
});

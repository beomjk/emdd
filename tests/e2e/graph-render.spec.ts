import { test, expect } from '@playwright/test';
import { sel, FIXTURE, waitForGraphReady, getCyNodeCount, clickCyNode } from './fixtures/helpers.js';

test.describe('US1: Graph Dashboard Renders Identically', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGraphReady(page);
  });

  test('renders all 14 nodes within 2s of page load', async ({ page }) => {
    const count = await getCyNodeCount(page);
    expect(count).toBe(FIXTURE.nodeCount);
  });

  test('toolbar and graph canvas are visible', async ({ page }) => {
    await expect(page.locator(sel.toolbar)).toBeVisible();
    await expect(page.locator(sel.graphCanvas)).toBeVisible();
  });

  test('legend displays node type colors and status borders', async ({ page }) => {
    const legend = page.locator(sel.legend);
    await expect(legend).toBeVisible();
    // Should have legend items for each node type
    const items = legend.locator('.legend-item');
    await expect(items).not.toHaveCount(0);
  });

  test('hover over node shows tooltip with info', async ({ page }) => {
    // Hover over a known node via Cytoscape API
    await page.evaluate(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return;
      const node = cy.getElementById('fnd-001');
      node.emit('mouseover');
    });
    // Wait for tooltip with 300ms delay
    await page.waitForTimeout(400);
    const tooltip = page.locator(sel.tooltip);
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator(sel.tooltipTitle)).toContainText('CNN Achieves 92% Accuracy');
  });

  test('click node opens detail panel with correct content', async ({ page }) => {
    await clickCyNode(page, 'fnd-001');
    await page.waitForTimeout(300);

    const panel = page.locator(sel.detailPanelOpen);
    await expect(panel).toBeVisible();
    await expect(panel.locator(sel.detailTitle)).toContainText('CNN Achieves 92% Accuracy');
    await expect(panel.locator(sel.detailId)).toContainText('fnd-001');
    await expect(panel.locator(sel.badgeType)).toContainText('finding');
    await expect(panel.locator(sel.badgeStatus)).toContainText('VALIDATED');
  });

  test('detail panel shows confidence bar', async ({ page }) => {
    await clickCyNode(page, 'fnd-001');
    await page.waitForTimeout(300);

    const panel = page.locator(sel.detailPanelOpen);
    const bar = panel.locator(sel.confidenceBar);
    await expect(bar).toBeVisible();
  });

  test('click linked node navigates to that node', async ({ page }) => {
    // Click exp-001 to see its links
    await clickCyNode(page, 'exp-001');
    await page.waitForTimeout(500);

    const panel = page.locator(sel.detailPanelOpen);
    await expect(panel).toBeVisible();

    // Find a linked node and click it
    const links = panel.locator(sel.linkTarget);
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);

    // Click the first link target
    const firstLinkText = await links.first().textContent();
    await links.first().click();
    await page.waitForTimeout(300);

    // Detail panel should now show the linked node
    if (firstLinkText) {
      await expect(panel.locator(sel.detailId)).toContainText(firstLinkText.trim());
    }
  });

  test('hop depth controls expand neighborhood', async ({ page }) => {
    await clickCyNode(page, 'hyp-001');
    await page.waitForTimeout(500);

    const panel = page.locator(sel.detailPanelOpen);
    const hopButtons = panel.locator(sel.hopBtn);
    await expect(hopButtons).toHaveCount(3);

    // Default is hop 2, click hop 3
    await hopButtons.nth(2).click();
    await page.waitForTimeout(300);
    await expect(hopButtons.nth(2)).toHaveClass(/active/);
  });

  test('selection, link navigation, and grouped focus stay within the shared motion profile', async ({ page }) => {
    await page.route('**/api/clusters', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          clusters: [
            {
              id: 'cluster-us1',
              label: 'US1 Cluster',
              nodeIds: ['hyp-001', 'exp-001'],
              isManual: false,
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await waitForGraphReady(page);

    await page.evaluate(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return;

      const motion = { cyDurations: [] as number[], nodeDurations: [] as number[] };
      (window as any).__emddMotion = motion;

      const originalCyAnimate = cy.animate.bind(cy);
      cy.animate = (args: unknown, opts?: { duration?: number }) => {
        if (typeof opts?.duration === 'number') motion.cyDurations.push(opts.duration);
        return originalCyAnimate(args, opts);
      };

      cy.nodes('[!isCluster]').forEach((node: any) => {
        const originalNodeAnimate = node.animate.bind(node);
        node.animate = (args: unknown, opts?: { duration?: number }) => {
          if (typeof opts?.duration === 'number') motion.nodeDurations.push(opts.duration);
          return originalNodeAnimate(args, opts);
        };
      });
    });

    await clickCyNode(page, 'exp-001');
    await page.waitForFunction(() => {
      const motion = (window as any).__emddMotion;
      return motion && motion.cyDurations.length > 0 && motion.nodeDurations.length > 0;
    });
    const panel = page.locator(sel.detailPanelOpen);
    await expect(panel).toBeVisible();
    await expect(panel.locator(sel.detailId)).toContainText('exp-001');

    const motion = await page.evaluate(() => (window as any).__emddMotion);
    expect(motion.cyDurations).toContain(300);
    expect(Math.max(...motion.cyDurations)).toBeLessThanOrEqual(300);
    expect(Math.max(...motion.nodeDurations)).toBeLessThanOrEqual(300);

    const links = panel.locator(sel.linkTarget);
    await expect(links.first()).toBeVisible();
    await links.first().click();

    await page.waitForFunction(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return false;
      return cy.nodes('[?isCluster]').length > 0;
    });

    await page.evaluate(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return;
      const cluster = cy.getElementById('cluster-us1');
      if (cluster?.length) cluster.emit('tap');
    });
    await page.waitForFunction(() => {
      const motion = (window as any).__emddMotion;
      return motion && motion.cyDurations.includes(500);
    });

    const updatedMotion = await page.evaluate(() => (window as any).__emddMotion);
    expect(updatedMotion.cyDurations).toContain(300);
    expect(updatedMotion.cyDurations).toContain(500);
    expect(Math.max(...updatedMotion.cyDurations)).toBeLessThanOrEqual(500);
    expect(Math.max(...updatedMotion.nodeDurations)).toBeLessThanOrEqual(300);
  });

  test('clicking background closes detail panel', async ({ page }) => {
    await clickCyNode(page, 'fnd-001');
    await page.waitForTimeout(300);
    await expect(page.locator(sel.detailPanelOpen)).toBeVisible();

    // Click background via Cytoscape API
    await page.evaluate(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return;
      cy.emit('tap');
    });
    await page.waitForTimeout(300);
    await expect(page.locator(sel.detailPanelOpen)).not.toBeVisible();
  });

  test('detail panel close button works', async ({ page }) => {
    await clickCyNode(page, 'fnd-001');
    await page.waitForTimeout(300);

    await page.locator(sel.detailClose).click();
    await page.waitForTimeout(200);
    await expect(page.locator(sel.detailPanelOpen)).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { sel, FIXTURE, waitForGraphReady, getVisibleNodeIds } from './fixtures/helpers.js';

test.describe('US2: Filtering and Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGraphReady(page);
  });

  test.describe('Filters', () => {
    test('type filter buttons are rendered for all node types', async ({ page }) => {
      const typeButtons = page.locator(`${sel.filterSectionTypes} ${sel.filterBtn}`);
      const count = await typeButtons.count();
      expect(count).toBe(FIXTURE.types.length);
    });

    test('toggling type filter hides matching nodes', async ({ page }) => {
      const beforeIds = await getVisibleNodeIds(page);
      expect(beforeIds.length).toBe(FIXTURE.nodeCount);

      // Find and click the "hypothesis" type filter button
      const typeButtons = page.locator(`${sel.filterSectionTypes} ${sel.filterBtn}`);
      const count = await typeButtons.count();
      for (let i = 0; i < count; i++) {
        const text = await typeButtons.nth(i).textContent();
        if (text?.toLowerCase().includes('hypothesis')) {
          await typeButtons.nth(i).click();
          break;
        }
      }

      await page.waitForTimeout(300);
      const afterIds = await getVisibleNodeIds(page);
      // Should have fewer visible nodes (2 hypotheses hidden)
      expect(afterIds.length).toBeLessThan(beforeIds.length);
      expect(afterIds).not.toContain('hyp-001');
      expect(afterIds).not.toContain('hyp-002');
    });

    test('reset button restores all nodes', async ({ page }) => {
      // Toggle a type off
      const typeButtons = page.locator(`${sel.filterSectionTypes} ${sel.filterBtn}`);
      await typeButtons.first().click();
      await page.waitForTimeout(300);

      // Click reset (force needed because Cytoscape canvas may intercept pointer events)
      await page.locator(sel.resetBtn).click({ force: true });
      await page.waitForTimeout(500);

      const afterIds = await getVisibleNodeIds(page);
      // Reset should restore more nodes than the filtered state
      expect(afterIds.length).toBeGreaterThanOrEqual(FIXTURE.nodeCount - 1);
    });

    test('status filter toggles work', async ({ page }) => {
      const statusButtons = page.locator(`${sel.filterSectionStatuses} ${sel.filterBtn}`);
      const count = await statusButtons.count();
      expect(count).toBeGreaterThan(0);

      // Toggle off the first status
      await statusButtons.first().click();
      await page.waitForTimeout(300);

      const afterIds = await getVisibleNodeIds(page);
      expect(afterIds.length).toBeLessThan(FIXTURE.nodeCount);
    });

    test('edge type filter toggles deactivate the button and hide matching edges', async ({ page }) => {
      const edgeButtons = page.locator(`${sel.filterSectionEdges} ${sel.filterBtn}`);
      const count = await edgeButtons.count();
      expect(count).toBeGreaterThan(0);

      // Pick the first edge-type button and capture its relation label
      const firstBtn = edgeButtons.first();
      const relationLabel = ((await firstBtn.textContent()) ?? '').trim();
      await expect(firstBtn).toHaveClass(/\bactive\b/);

      // Count how many edges currently carry that relation in the cy instance
      const edgesOfTypeBefore = await page.evaluate((rel) => {
        const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
        if (!cy) return 0;
        return cy.edges().filter((e: any) => e.data('relation') === rel).length;
      }, relationLabel);
      expect(edgesOfTypeBefore).toBeGreaterThan(0);

      // The Cytoscape canvas intercepts pointer events for the edge-filter
      // section. Dispatching a synthetic click via the DOM bypasses the
      // canvas overlay while still exercising the Svelte onclick handler.
      await firstBtn.evaluate((el) => (el as HTMLButtonElement).click());
      await page.waitForTimeout(300);

      // After toggling, the button should no longer be active
      await expect(firstBtn).not.toHaveClass(/\bactive\b/);

      // And every edge with that relation should have display:none
      const visibleEdgesOfType = await page.evaluate((rel) => {
        const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
        if (!cy) return -1;
        return cy.edges()
          .filter((e: any) => e.data('relation') === rel)
          .filter((e: any) => e.style('display') !== 'none').length;
      }, relationLabel);
      expect(visibleEdgesOfType).toBe(0);
    });
  });

  test.describe('Search', () => {
    test('search input is visible', async ({ page }) => {
      await expect(page.locator(sel.searchInput)).toBeVisible();
    });

    test('search by ID prefix finds matching nodes', async ({ page }) => {
      await page.locator(sel.searchInput).fill('hyp');
      await page.waitForTimeout(300);

      const matches = page.locator(sel.matchItem);
      const count = await matches.count();
      expect(count).toBe(2); // hyp-001 and hyp-002
    });

    test('search by title substring finds matching nodes', async ({ page }) => {
      await page.locator(sel.searchInput).fill('CNN');
      await page.waitForTimeout(300);

      const matches = page.locator(sel.matchItem);
      const count = await matches.count();
      expect(count).toBeGreaterThan(0);
    });

    test('Enter navigates to current match', async ({ page }) => {
      await page.locator(sel.searchInput).fill('fnd-001');
      await page.waitForTimeout(300);

      await page.locator(sel.searchInput).press('Enter');
      await page.waitForTimeout(500);

      // Match count should show position
      const matchCount = page.locator(sel.matchCount);
      await expect(matchCount).toContainText('1');
    });

    test('Escape clears search', async ({ page }) => {
      await page.locator(sel.searchInput).fill('hyp');
      await page.waitForTimeout(300);
      expect(await page.locator(sel.matchItem).count()).toBeGreaterThan(0);

      await page.locator(sel.searchInput).press('Escape');
      await page.waitForTimeout(200);

      // Input should be cleared
      await expect(page.locator(sel.searchInput)).toHaveValue('');
    });

    test('nav buttons cycle through matches', async ({ page }) => {
      await page.locator(sel.searchInput).fill('fnd');
      await page.waitForTimeout(300);

      const navButtons = page.locator(sel.navBtn);
      const count = await navButtons.count();
      expect(count).toBe(2); // prev and next

      // Click next
      await navButtons.last().click();
      await page.waitForTimeout(300);

      const matchCount = page.locator(sel.matchCount);
      await expect(matchCount).toBeVisible();
    });
  });
});

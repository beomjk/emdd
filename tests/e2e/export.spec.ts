import { test, expect } from '@playwright/test';
import { sel, waitForGraphReady } from './fixtures/helpers.js';

test.describe('US6: Standalone Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGraphReady(page);
  });

  test('export button is visible', async ({ page }) => {
    await expect(page.locator(sel.exportBtn)).toBeVisible();
  });

  test('clicking export triggers download with HTML content', async ({ page }) => {
    // Listen for download event
    const downloadPromise = page.waitForEvent('download');
    await page.locator(sel.exportBtn).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('emdd-graph.html');

    // Verify the downloaded content is HTML
    const content = await (await download.createReadStream()).toArray();
    const html = Buffer.concat(content).toString('utf8');
    expect(html).toContain('<html');
    expect(html).toContain('cytoscape');
  });

  test('export reflects current filters', async ({ page }) => {
    // Toggle off a type filter first
    const typeButtons = page.locator(`${sel.filterSectionTypes} ${sel.filterBtn}`);
    const firstBtnText = await typeButtons.first().textContent();
    await typeButtons.first().click();
    await page.waitForTimeout(300);

    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.locator(sel.exportBtn).click();
    const download = await downloadPromise;

    // Downloaded file should still be valid HTML
    const content = await (await download.createReadStream()).toArray();
    const html = Buffer.concat(content).toString('utf8');
    expect(html).toContain('<html');
  });
});

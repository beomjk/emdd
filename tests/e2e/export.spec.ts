import { test, expect, type Download } from '@playwright/test';
import { clickCyNode, getTheme, sel, waitForGraphReady } from './fixtures/helpers.js';

async function readDownloadedHtml(download: Download) {
  const stream = await download.createReadStream() as NodeJS.ReadableStream & {
    toArray(): Promise<Uint8Array[]>;
  };
  const content = await stream.toArray();
  return Buffer.concat(content).toString('utf8');
}

function extractElements(html: string): Array<{ group: string; data: Record<string, unknown> }> {
  const match = html.match(/var elements = (\[[\s\S]*?\]);\r?\nvar cy = cytoscape\(/);
  if (!match) {
    throw new Error('Exported HTML did not contain embedded elements JSON');
  }
  return JSON.parse(match[1]);
}

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
    const html = await readDownloadedHtml(download);
    expect(html).toContain('<html');
    expect(html).toContain('cytoscape');
  });

  test('export reflects current filters and drops filtered-out clusters', async ({ page }) => {
    await page.route('**/api/clusters', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clusters: [
            {
              id: 'cluster-filtered',
              label: 'Filtered Cluster',
              nodeIds: ['hyp-001'],
              isManual: false,
            },
          ],
        }),
      });
    });
    await page.reload();
    await waitForGraphReady(page);

    await page
      .locator(sel.filterSectionTypes)
      .getByRole('button', { name: /^hypothesis$/i })
      .click();

    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.locator(sel.exportBtn).click();
    const download = await downloadPromise;

    const html = await readDownloadedHtml(download);
    const elements = extractElements(html);

    expect(html).toContain('<html');
    expect(elements.some((element) => element.data.id === 'hyp-001')).toBe(false);
    expect(elements.some((element) => element.data.id === 'cluster-filtered')).toBe(false);
  });

  test('export preserves active theme and layout without transient selection state', async ({ page }) => {
    if (await getTheme(page) !== 'dark') {
      await page.locator(sel.themeToggle).click();
      await page.waitForTimeout(200);
    }

    await page.locator(sel.layoutSelector).selectOption('hierarchical');
    await page.waitForTimeout(700);
    await clickCyNode(page, 'hyp-001');
    await expect(page.locator(sel.detailPanelOpen)).toBeVisible();
    const liveSelectedBorderWidth = await page.evaluate(() => {
      const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
      if (!cy) return 0;
      return Number.parseFloat(cy.getElementById('hyp-001').style('border-width'));
    });
    expect(liveSelectedBorderWidth).toBeGreaterThanOrEqual(4);

    const downloadPromise = page.waitForEvent('download');
    await page.locator(sel.exportBtn).click();
    const download = await downloadPromise;

    const html = await readDownloadedHtml(download);
    const elements = extractElements(html);
    const exportedNode = elements.find(
      (element) => element.group === 'nodes' && element.data.id === 'hyp-001',
    );

    expect(html).toContain('data-theme="dark"');
    expect(html).toContain("name: 'dagre'");
    expect(exportedNode).toBeDefined();
    expect(Number(exportedNode?.data.borderWidth ?? 0)).toBeLessThan(4);
    expect(exportedNode?.data.borderColor).not.toBe('#FF6B6B');
    expect(html).not.toContain('selected-node');
  });
});

import { expect, test, type Page } from '@playwright/test';

async function enterMobileTexts(page: Page, left: string, right: string) {
  await page.getByRole('button', { name: 'Edit Text' }).click();
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.locator('#input-left').fill(left);
  await page.getByRole('button', { name: 'Modified', exact: true }).click();
  await page.locator('#input-right').fill(right);
}

test.describe('mobile experience', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('uses one full-width editor without horizontal overflow', async ({ page }) => {
    await expect(page.getByRole('heading', { name: "What's the Diff" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
    await expect(page.locator('#pane-left')).toBeVisible();
    await expect(page.locator('#pane-right')).toBeHidden();

    await page.locator('#input-left').fill('original text');
    await page.getByRole('button', { name: 'Modified', exact: true }).click();
    await expect(page.locator('#pane-left')).toBeHidden();
    await expect(page.locator('#pane-right')).toBeVisible();
    await page.locator('#input-right').fill('modified text');
    await page.getByRole('button', { name: 'Original', exact: true }).click();
    await expect(page.locator('#input-left')).toHaveValue('original text');
    await page.getByRole('button', { name: 'Modified', exact: true }).click();
    await expect(page.locator('#input-right')).toHaveValue('modified text');

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      scrollWidth: document.body.scrollWidth,
      targets: [...document.querySelectorAll<HTMLElement>(
        '#mobile-more-btn, .mode-option, .mobile-pane-option, .btn.icon-btn'
      )].filter(element => element.getClientRects().length > 0)
        .map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    for (const target of layout.targets) {
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('renders and navigates a unified diff', async ({ page }) => {
    await enterMobileTexts(
      page,
      'Header\nThe quick brown fox.\nShared line.\nFooter',
      'Header\nThe quick red fox.\nShared line.\nAdded note.\nFooter'
    );
    await page.getByRole('button', { name: 'View Diff' }).click();

    await expect(page.locator('#diff-unified')).toBeVisible();
    await expect(page.locator('#pane-left')).toBeHidden();
    await expect(page.locator('#pane-right')).toBeHidden();
    await expect(page.locator('#diff-left .diff-row')).toHaveCount(0);
    await expect(page.locator('#diff-right .diff-row')).toHaveCount(0);
    await expect(page.locator('.unified-removed')).toContainText('brown');
    await expect(page.locator('.unified-added').filter({ hasText: 'red' })).toBeVisible();
    await expect(page.locator('.unified-unchanged').filter({ hasText: 'Shared line' })).toBeVisible();
    await expect(page.locator('.unified-removed .diff-removed')).toBeVisible();
    await expect(page.locator('.unified-added .diff-added')).toBeVisible();
    await expect(page.locator('#minimap')).toBeHidden();
    await expect(page.locator('footer')).toBeHidden();

    await page.getByRole('button', { name: 'Next change' }).click();
    await expect(page.locator('#diff-counter')).toHaveText('1/2');
    await expect(page.locator('.unified-change.diff-row-active')).toHaveCount(1);
    await page.getByRole('button', { name: 'Previous change' }).click();
    await expect(page.locator('#diff-counter')).toHaveText('2/2');
    await page.getByRole('button', { name: 'Next change' }).click();
    await expect(page.locator('#diff-counter')).toHaveText('1/2');
  });

  test('provides an aligned, keyboard-accessible action sheet', async ({ page }) => {
    await enterMobileTexts(page, 'left value', 'right value');
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('dialog', { name: 'More actions' })).toBeVisible();
    await expect(page.locator('#more-sheet-close')).toBeFocused();

    const labelStarts = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.sheet-action')]
      .map(action => action.children[action.children.length - 1].getBoundingClientRect().left));
    expect(Math.max(...labelStarts) - Math.min(...labelStarts)).toBeLessThan(1);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'More actions' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'More' })).toBeFocused();

    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'More actions' })).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Close settings' }).click();
    await expect(page.getByRole('button', { name: 'More' })).toBeFocused();

    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Swap texts' }).click();
    await page.getByRole('button', { name: 'Original', exact: true }).click();
    await expect(page.locator('#input-left')).toHaveValue('right value');
    await page.getByRole('button', { name: 'Modified', exact: true }).click();
    await expect(page.locator('#input-right')).toHaveValue('left value');

    await page.getByRole('button', { name: 'View Diff' }).click();
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Clear all text' }).click();
    await expect(page.getByRole('button', { name: 'Edit Text' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#input-left')).toHaveValue('');
    await expect(page.locator('#input-right')).toHaveValue('');
  });

  test('handles empty, identical, one-sided, and long text diffs', async ({ page }) => {
    await enterMobileTexts(page, '', '');
    await page.getByRole('button', { name: 'View Diff' }).click();
    await expect(page.locator('#diff-counter')).toHaveText('0/0');

    await enterMobileTexts(page, 'same line', 'same line');
    await page.getByRole('button', { name: 'View Diff' }).click();
    await expect(page.locator('.unified-change')).toHaveCount(0);
    await expect(page.locator('.unified-unchanged')).toContainText('same line');

    await enterMobileTexts(page, 'kept\n', 'kept\ninserted\n');
    await page.getByRole('button', { name: 'View Diff' }).click();
    await expect(page.locator('.unified-change-added')).toHaveCount(1);

    await enterMobileTexts(page, 'kept\ndeleted\n', 'kept\n');
    await page.getByRole('button', { name: 'View Diff' }).click();
    await expect(page.locator('.unified-change-removed')).toHaveCount(1);

    const longText = 'x'.repeat(500);
    await enterMobileTexts(page, longText, `${longText}y`);
    await page.getByRole('button', { name: 'View Diff' }).click();
    const widths = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  });
});

test('switches renderers at the 768px breakpoint without losing text', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 844 });
  await page.goto('/index.html');
  await page.locator('#input-left').fill('left\nold');
  await page.getByRole('button', { name: 'Modified', exact: true }).click();
  await page.locator('#input-right').fill('left\nnew');
  await page.getByRole('button', { name: 'View Diff' }).click();
  await expect(page.locator('#diff-unified')).toBeVisible();
  await expect(page.locator('#diff-unified .unified-row')).toHaveCount(3);
  await expect(page.locator('#diff-left .diff-row')).toHaveCount(0);
  await expect(page.locator('#diff-right .diff-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next change' }).click();
  await expect(page.locator('#diff-counter')).toHaveText('1/1');

  await page.setViewportSize({ width: 768, height: 844 });
  await expect(page.locator('#diff-unified')).toBeHidden();
  await expect(page.locator('#diff-left')).toBeVisible();
  await expect(page.locator('#diff-right')).toBeVisible();
  await expect(page.locator('#diff-unified .unified-row')).toHaveCount(0);
  await expect(page.locator('#diff-left .diff-row')).toHaveCount(2);
  await expect(page.locator('#diff-right .diff-row')).toHaveCount(2);
  await expect(page.locator('#diff-counter')).toHaveText('1/1');
  await expect(page.locator('.pane .diff-row-active')).toHaveCount(2);

  await page.setViewportSize({ width: 767, height: 844 });
  await expect(page.locator('#diff-unified')).toBeVisible();
  await expect(page.locator('#diff-unified .unified-row')).toHaveCount(3);
  await expect(page.locator('#diff-left .diff-row')).toHaveCount(0);
  await expect(page.locator('#diff-right .diff-row')).toHaveCount(0);
  await expect(page.locator('#diff-counter')).toHaveText('1/1');
  await expect(page.locator('.unified-change.diff-row-active')).toHaveCount(1);

  await page.getByRole('button', { name: 'Edit Text' }).click();
  await expect(page.locator('#input-left')).toHaveValue('left\nold');
  await expect(page.locator('#input-right')).toHaveValue('left\nnew');
});

test('fits the paired desktop layout in phone landscape', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/index.html');
  await expect(page.locator('#pane-left')).toBeVisible();
  await expect(page.locator('#pane-right')).toBeVisible();
  const widths = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
});

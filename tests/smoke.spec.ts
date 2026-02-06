import { expect, test } from '@playwright/test';

test('basic diff flow works', async ({ page }) => {
  await page.goto('/index.html');

  await page.fill('#input-left', 'line1\nline2\nline3');
  await page.fill('#input-right', 'line1\nline two\nline3\nline4');

  await page.click('#mode-toggle');

  await expect(page.locator('#diff-left')).toBeVisible();
  await expect(page.locator('#diff-right')).toBeVisible();
  await expect(page.locator('#nav-controls')).toBeVisible();

  await expect(page.locator('.diff-row-changed').first()).toBeVisible();

  const counter = page.locator('#diff-counter');
  await expect(counter).toContainText('/');
  await expect(counter).not.toHaveText('0/0');

  await expect(page.locator('#next-diff')).toBeEnabled();
  await expect(page.locator('#prev-diff')).toBeEnabled();

  await page.click('#next-diff');
  await expect(counter).toHaveText(/\d+\/\d+/);

  await page.click('#prev-diff');
  await expect(counter).toContainText('/');
});

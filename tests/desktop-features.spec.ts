import { expect, test } from '@playwright/test';

test.describe('core desktop workflows', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('edits, autosaves, swaps, copies, and clears both panes', async ({ page, context }) => {
    await expect(page.locator('#pane-left')).toBeVisible();
    await expect(page.locator('#pane-right')).toBeVisible();

    await page.locator('#input-left').fill('original text');
    await page.locator('#input-right').fill('modified text');
    await expect.poll(() => page.evaluate(() => ({
      left: localStorage.getItem('wtd_input_left'),
      right: localStorage.getItem('wtd_input_right')
    }))).toEqual({ left: 'original text', right: 'modified text' });

    await page.reload();
    await expect(page.locator('#input-left')).toHaveValue('original text');
    await expect(page.locator('#input-right')).toHaveValue('modified text');

    await page.locator('#swap-btn').click();
    await expect(page.locator('#input-left')).toHaveValue('modified text');
    await expect(page.locator('#input-right')).toHaveValue('original text');

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#copy-left').click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('modified text');

    await page.locator('#clear-btn').click();
    await expect(page.locator('#input-left')).toHaveValue('');
    await expect(page.locator('#input-right')).toHaveValue('');
    await expect.poll(() => page.evaluate(() => ({
      left: localStorage.getItem('wtd_input_left'),
      right: localStorage.getItem('wtd_input_right')
    }))).toEqual({ left: null, right: null });
  });

  test('renders paired line and word diffs with navigation and a minimap', async ({ page }) => {
    const sharedLines = Array.from({ length: 80 }, (_, index) => `shared line ${index + 1}`);
    const leftLines = [...sharedLines];
    const rightLines = [...sharedLines];
    leftLines[10] = 'the quick brown fox';
    rightLines[10] = 'the quick red fox';
    leftLines[60] = 'old ending';
    rightLines[60] = 'new ending';

    await page.locator('#input-left').fill(leftLines.join('\n'));
    await page.locator('#input-right').fill(rightLines.join('\n'));
    await page.locator('[data-mode="diff"]').click();

    await expect(page.locator('#diff-left')).toBeVisible();
    await expect(page.locator('#diff-right')).toBeVisible();
    await expect(page.locator('#nav-controls')).toBeVisible();
    await expect(page.locator('#minimap')).toBeVisible();
    await expect(page.locator('#diff-left .diff-removed').filter({ hasText: 'brown' })).toBeVisible();
    await expect(page.locator('#diff-right .diff-added').filter({ hasText: 'red' })).toBeVisible();
    await expect(page.locator('.minimap-marker')).toHaveCount(2);
    await expect(page.locator('#diff-counter')).toHaveText('0/2');

    const minimapBox = await page.locator('#minimap').boundingBox();
    expect(minimapBox).not.toBeNull();
    await page.locator('#minimap').click({ position: { x: 8, y: Math.round(minimapBox!.height * 0.25) } });
    await expect(page.locator('#diff-counter')).toHaveText('1/2');
    await expect(page.locator('.pane .diff-row-active')).toHaveCount(2);

    await page.locator('#next-diff').click();
    await expect(page.locator('#diff-counter')).toHaveText('2/2');
    await page.locator('#next-diff').click();
    await expect(page.locator('#diff-counter')).toHaveText('1/2');
    await page.locator('#prev-diff').click();
    await expect(page.locator('#diff-counter')).toHaveText('2/2');

    await page.locator('#diff-left').evaluate(element => {
      element.scrollTop = 300;
      element.dispatchEvent(new Event('scroll'));
    });
    await expect.poll(() => page.locator('#diff-right').evaluate(element => element.scrollTop)).toBe(300);

    await page.locator('label[title="Toggle Synchronized Scrolling"]').click();
    const rightBefore = await page.locator('#diff-right').evaluate(element => element.scrollTop);
    await page.locator('#diff-left').evaluate(element => {
      element.scrollTop = 600;
      element.dispatchEvent(new Event('scroll'));
    });
    await expect.poll(() => page.locator('#diff-right').evaluate(element => element.scrollTop)).toBe(rightBefore);
  });

  test('loads dropped text files into both panes and persists them', async ({ page }) => {
    const leftTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['original file contents'], 'original.txt', { type: 'text/plain' }));
      return transfer;
    });
    const rightTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['modified file contents'], 'modified.txt', { type: 'text/plain' }));
      return transfer;
    });

    await page.dispatchEvent('#pane-left', 'drop', { dataTransfer: leftTransfer });
    await page.dispatchEvent('#pane-right', 'drop', { dataTransfer: rightTransfer });
    await expect(page.locator('#input-left')).toHaveValue('original file contents');
    await expect(page.locator('#input-right')).toHaveValue('modified file contents');
    await expect.poll(() => page.evaluate(() => ({
      left: localStorage.getItem('wtd_input_left'),
      right: localStorage.getItem('wtd_input_right')
    }))).toEqual({ left: 'original file contents', right: 'modified file contents' });
  });

  test('persists rich-text settings and converts rich paste and copy formats', async ({ page }) => {
    await page.locator('#settings-btn').click();
    const pasteSetting = page.locator('#settings-modal label').filter({ hasText: 'Paste rich text as Markdown' });
    const copySetting = page.locator('#settings-modal label').filter({ hasText: 'Copy Markdown as rich text' });
    await pasteSetting.click();
    await copySetting.click();
    await expect(page.locator('#setting-paste-markdown')).toBeChecked();
    await expect(page.locator('#setting-copy-richtext')).toBeChecked();
    await page.locator('#settings-close').click();

    await page.reload();
    await page.locator('#settings-btn').click();
    await expect(page.locator('#setting-paste-markdown')).toBeChecked();
    await expect(page.locator('#setting-copy-richtext')).toBeChecked();
    await page.locator('#settings-close').click();

    const input = page.locator('#input-left');
    await input.focus();
    const pastedValue = await input.evaluate(element => {
      const clipboard = new DataTransfer();
      clipboard.setData('text/html', '<h2>Heading</h2><p>Hello <strong>desktop</strong>.</p>');
      element.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard
      }));
      return (element as HTMLTextAreaElement).value;
    });
    expect(pastedValue).toContain('## Heading');
    expect(pastedValue).toContain('Hello **desktop**.');

    await input.fill('# Heading\n\n**Bold** text');
    await input.selectText();
    const copied = await input.evaluate(element => {
      const clipboard = new DataTransfer();
      element.dispatchEvent(new ClipboardEvent('copy', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard
      }));
      return {
        plain: clipboard.getData('text/plain'),
        html: clipboard.getData('text/html')
      };
    });
    expect(copied.plain).toBe('# Heading\n\n**Bold** text');
    expect(copied.html).toContain('<h1>Heading</h1>');
    expect(copied.html).toContain('<strong>Bold</strong>');
  });
});

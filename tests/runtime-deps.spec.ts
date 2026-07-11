import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('loads all runtime libraries from local vendor assets', async ({ page }) => {
  const runtime = await page.evaluate(() => ({
    diff: typeof (window as typeof window & { Diff?: unknown }).Diff,
    turndown: typeof (window as typeof window & { TurndownService?: unknown }).TurndownService,
    marked: typeof (window as typeof window & { marked?: unknown }).marked,
    resources: performance.getEntriesByType('resource').map(entry => entry.name)
  }));

  expect(runtime.diff).toBe('object');
  expect(runtime.turndown).toBe('function');
  expect(runtime.marked).toBe('object');
  expect(runtime.resources.some(name => name.endsWith('/vendor/diff.min.js'))).toBe(true);
  expect(runtime.resources.some(name => name.endsWith('/vendor/turndown.js'))).toBe(true);
  expect(runtime.resources.some(name => name.endsWith('/vendor/marked.js'))).toBe(true);
  expect(runtime.resources.some(name => name.includes('unpkg.com') || name.includes('cdn.jsdelivr.net'))).toBe(false);
});

test('converts rich pasted HTML to Markdown with vendored Turndown', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('wtd_paste_markdown', 'true'));
  await page.reload();

  const input = page.locator('#input-left');
  await input.focus();
  const value = await input.evaluate(element => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/html', '<h2>Heading</h2><p>Hello <strong>mobile</strong>.</p>');
    element.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboard
    }));
    return (element as HTMLTextAreaElement).value;
  });

  expect(value).toContain('## Heading');
  expect(value).toContain('Hello **mobile**.');
});

test('converts copied Markdown to rich HTML with vendored Marked', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('wtd_copy_richtext', 'true'));
  await page.reload();

  const input = page.locator('#input-left');
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

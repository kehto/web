import { test, expect, type Page } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

async function openFreshPlayground(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      // Best effort; the following reload still exercises the default UI path.
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });
}

async function chatFrameSlotHeight(page: Page): Promise<number> {
  return page.locator('#chat-frame-container').evaluate((el) =>
    Math.round(el.getBoundingClientRect().height),
  );
}

test('napplet height control defaults to 330px and persists user changes', async ({ page }) => {
  await openFreshPlayground(page);

  await expect(page.locator('#napplet-height-value')).toHaveText('330px');
  await expect.poll(() => chatFrameSlotHeight(page)).toBe(330);

  await page.locator('#napplet-height-slider').evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = '420';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect(page.locator('#napplet-height-value')).toHaveText('420px');
  await expect.poll(() => chatFrameSlotHeight(page)).toBe(420);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });

  await expect(page.locator('#napplet-height-value')).toHaveText('420px');
  await expect.poll(() => chatFrameSlotHeight(page)).toBe(420);
});

test('per-napplet ACL panels start collapsed and can expand or collapse together', async ({ page }) => {
  await demoBeforeEach(page);

  const chatAcl = page.locator('#chat-acl');
  await expect(chatAcl.locator('.acl-summary-toggle')).toContainText('8 allowed', { timeout: 10_000 });
  await expect(chatAcl.locator('.acl-summary-toggle')).toContainText('0 blocked');
  await expect(chatAcl.locator('.acl-panel')).toHaveAttribute('data-expanded', 'false');
  await expect(chatAcl.locator('.acl-controls')).toBeHidden();

  const panelCount = await page.locator('.acl-panel').count();
  expect(panelCount).toBeGreaterThan(0);

  await page.locator('#acl-expand-all-btn').click();
  await expect(page.locator('#acl-expand-all-btn')).toHaveText('collapse all ACL');
  await expect.poll(() => page.locator('.acl-panel[data-expanded="true"]').count()).toBe(panelCount);
  await expect(chatAcl.locator('.acl-controls')).toBeVisible();

  await chatAcl.locator('button[title^="relay:write"]').click();
  await expect(chatAcl.locator('.acl-summary-toggle')).toContainText('7 allowed');
  await expect(chatAcl.locator('.acl-summary-toggle')).toContainText('1 blocked');

  await page.locator('#acl-expand-all-btn').click();
  await expect(page.locator('#acl-expand-all-btn')).toHaveText('expand all ACL');
  await expect.poll(() => page.locator('.acl-panel[data-expanded="false"]').count()).toBe(panelCount);
  await expect(chatAcl.locator('.acl-controls')).toBeHidden();
});

test('debugger pane can be hidden and restored across reloads', async ({ page }) => {
  await openFreshPlayground(page);

  await expect(page.locator('#debugger-section')).toBeVisible();
  await page.locator('#debugger-toggle-btn').click();

  await expect(page.locator('#debugger-toggle-btn')).toHaveText('show debugger');
  await expect(page.locator('#debugger-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#debugger-section')).toBeHidden();
  await expect(page.locator('#resize-handle')).toBeHidden();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });

  await expect(page.locator('#debugger-toggle-btn')).toHaveText('show debugger');
  await expect(page.locator('#debugger-section')).toBeHidden();

  await page.locator('#debugger-toggle-btn').click();
  await expect(page.locator('#debugger-toggle-btn')).toHaveText('hide debugger');
  await expect(page.locator('#debugger-section')).toBeVisible();
});

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

test('color mode persists user selection across reloads', async ({ page }) => {
  await openFreshPlayground(page);

  await expect(page.locator('[data-color-mode="flash"]')).toHaveClass(/color-mode-active/);

  await page.locator('[data-color-mode="last-message"]').click();
  await expect(page.locator('[data-color-mode="last-message"]')).toHaveClass(/color-mode-active/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('kehto.playground.colorMode'))).toBe('last-message');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });

  await expect(page.locator('[data-color-mode="last-message"]')).toHaveClass(/color-mode-active/);
  await expect(page.locator('[data-color-mode="flash"]')).not.toHaveClass(/color-mode-active/);
});

test('theme selection persists across reloads and applies to the shell', async ({ page }) => {
  await demoBeforeEach(page);

  const themeFrame = page.frameLocator('#theme-switcher-frame-container iframe');
  await expect(themeFrame.locator('#theme-status')).toContainText('ready', { timeout: 10_000 });

  await themeFrame.locator('#theme-dark-btn').evaluate((el) => {
    (el as HTMLButtonElement).click();
  });

  await expect(themeFrame.locator('#theme-dark-btn')).toHaveAttribute('data-active', 'true', { timeout: 5_000 });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 10)');
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(224, 224, 224)');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('kehto.playground.theme.v1'))).toContain('"title":"Dark"');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });

  await expect(themeFrame.locator('#theme-status')).toContainText('ready', { timeout: 10_000 });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 10)');
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(224, 224, 224)');
  await expect(themeFrame.locator('#theme-dark-btn')).toHaveAttribute('data-active', 'true', { timeout: 5_000 });
});

test('per-napplet ACL panels persist expansion, capability changes, and block state', async ({ page }) => {
  // Four full page.reload() cycles, each re-binding the whole napplet roster
  // before ACL state restores from localStorage. The default 30s budget is too
  // tight on slow CI runners, so give the reload-heavy flow generous headroom.
  test.setTimeout(120_000);
  await demoBeforeEach(page);

  const chatAcl = page.locator('#chat-acl');
  await expect(chatAcl.locator('.acl-summary-toggle')).toContainText('7 allowed', { timeout: 10_000 });
  await expect(chatAcl.locator('.acl-summary-toggle')).toContainText('0 blocked');
  await expect(chatAcl.locator('.acl-panel')).toHaveAttribute('data-expanded', 'false', { timeout: 10_000 });
  await expect(chatAcl.locator('.acl-controls')).toBeHidden();

  const panelCount = await page.locator('.acl-panel').count();
  expect(panelCount).toBeGreaterThan(0);

  await page.locator('#acl-expand-all-btn').evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(page.locator('#acl-expand-all-btn')).toHaveText('collapse all ACL');
  await expect.poll(() => page.locator('.acl-panel[data-expanded="true"]').count()).toBe(panelCount);
  await expect(chatAcl.locator('.acl-controls')).toBeVisible();

  await chatAcl.locator('button[title^="relay:write"]').click();
  await expect(chatAcl.locator('.acl-summary-toggle')).toContainText('6 allowed');
  await expect(chatAcl.locator('.acl-summary-toggle')).toContainText('1 blocked');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('napplet:acl'))).not.toBeNull();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });

  const reloadedChatAcl = page.locator('#chat-acl');
  await expect(reloadedChatAcl.locator('.acl-summary-toggle')).toContainText('6 allowed', { timeout: 10_000 });
  await expect(reloadedChatAcl.locator('.acl-summary-toggle')).toContainText('1 blocked');
  await expect(reloadedChatAcl.locator('.acl-panel')).toHaveAttribute('data-expanded', 'true', { timeout: 10_000 });
  await expect(reloadedChatAcl.locator('.acl-controls')).toBeVisible();
  await expect(reloadedChatAcl.locator('[data-acl-capability="relay:write"]')).toHaveAttribute('data-enabled', 'false', { timeout: 10_000 });

  await reloadedChatAcl.locator('[data-acl-block]').click();
  await expect(reloadedChatAcl.locator('.acl-summary-toggle')).toContainText('0 allowed');
  await expect(reloadedChatAcl.locator('.acl-summary-toggle')).toContainText('7 blocked');
  await expect(reloadedChatAcl.locator('[data-acl-block]')).toHaveAttribute('data-blocked', 'true', { timeout: 10_000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });

  const blockedChatAcl = page.locator('#chat-acl');
  await expect(blockedChatAcl.locator('[data-acl-block]')).toHaveAttribute('data-blocked', 'true', { timeout: 10_000 });
  await expect(blockedChatAcl.locator('.acl-summary-toggle')).toContainText('0 allowed');
  await expect(blockedChatAcl.locator('.acl-summary-toggle')).toContainText('7 blocked');
  await expect(blockedChatAcl.locator('[data-acl-capability="relay:write"]')).toHaveAttribute('data-enabled', 'false', { timeout: 10_000 });

  await blockedChatAcl.locator('[data-acl-block]').click({ force: true });
  await expect(blockedChatAcl.locator('[data-acl-block]')).toHaveAttribute('data-blocked', 'false', { timeout: 10_000 });
  await expect(blockedChatAcl.locator('.acl-summary-toggle')).toContainText('6 allowed');
  await expect(blockedChatAcl.locator('.acl-summary-toggle')).toContainText('1 blocked');

  await page.locator('#acl-expand-all-btn').evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(page.locator('#acl-expand-all-btn')).toHaveText('expand all ACL');
  await expect.poll(() => page.locator('.acl-panel[data-expanded="false"]').count()).toBe(panelCount);
  await expect(blockedChatAcl.locator('.acl-controls')).toBeHidden();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });
  await expect(page.locator('#chat-acl .acl-panel')).toHaveAttribute('data-expanded', 'false', { timeout: 10_000 });
  await expect(page.locator('#chat-acl .acl-controls')).toBeHidden();
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

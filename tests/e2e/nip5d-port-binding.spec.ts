/**
 * NIP-5D port-bound identity in a real sandboxed iframe
 * (nostr-protocol/nips#2303 @ 51ef0cd; packaged in napplet/web#302).
 *
 * The vulnerability: a Window survives same-frame navigation, so a napplet
 * could replace itself with unverified content that inherited its identity
 * and grants. The shell now binds identity to the napplet.hello port and
 * revokes + removes the frame on any evidence the verified document changed.
 */
import { test, expect, type Page } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

async function loadReadyNapplet(page: Page): Promise<string> {
  await aclBeforeEach(page);
  const windowId = await page.evaluate(() => window.__loadNapplet__('nap-storage'));
  await waitForNappletReady(page, windowId);
  await expect(page.frameLocator(`#${windowId}`).locator('#nap-status')).toContainText('value:fixture-v1');
  return windowId;
}

async function nappletFrame(page: Page, windowId: string) {
  const handle = await page.locator(`#${windowId}`).elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error(`missing frame ${windowId}`);
  return frame;
}

async function expectRevoked(page: Page, windowId: string, reasons: readonly string[]): Promise<void> {
  await page.waitForFunction(
    (wid) => window.__getRevocations__().some((entry) => entry.windowId === wid),
    windowId,
    { timeout: 10_000 },
  );
  const revocation = await page.evaluate(
    (wid) => window.__getRevocations__().find((entry) => entry.windowId === wid),
    windowId,
  );
  expect(reasons).toContain(revocation?.reason);
  await expect(page.locator(`#${windowId}`)).toHaveCount(0);
  expect(await page.evaluate((wid) => window.__nappletReady__(wid), windowId)).toBe(false);
}

test('binds the napplet over its hello port without window-level NAP traffic', async ({ page }) => {
  const windowId = await loadReadyNapplet(page);
  const windowLevel = await page.evaluate(() => window.__TEST_MESSAGES__.map((message) => message.raw));
  // The tap only sees window-level messages: NAP envelopes never travel there.
  expect(JSON.stringify(windowLevel)).not.toContain('storage.');
  expect(await page.evaluate(() => window.__getRevocations__())).toEqual([]);
  expect(await page.evaluate((wid) => window.__getNapMessage__(wid, 'storage.get') !== null, windowId)).toBe(true);
});

test('revokes and removes a napplet that navigates its own frame', async ({ page }) => {
  const windowId = await loadReadyNapplet(page);
  const frame = await nappletFrame(page, windowId);
  // Same-frame navigation to unverified content keeps the Window but not the port.
  await frame.evaluate(() => {
    location.href = 'data:text/html,<script>parent.postMessage({type:"storage.get",id:"stolen",key:"nap-storage-key"},"*")</script>';
  }).catch(() => undefined);
  await expectRevoked(page, windowId, ['second-load', 'port-closed', 'window-message', 'second-hello']);
});

test('revokes a napplet that posts a NAP envelope at window level', async ({ page }) => {
  const windowId = await loadReadyNapplet(page);
  const frame = await nappletFrame(page, windowId);
  await frame.evaluate(() => parent.postMessage({ type: 'storage.get', id: 'forged', key: 'nap-storage-key' }, '*'));
  await expectRevoked(page, windowId, ['window-message']);
});

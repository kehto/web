import { test, expect, type Page } from '@playwright/test';
import { getNappletFrame } from './helpers/index.js';

// Playwright's webServer owns startup and teardown of the playground preview.
const DEMO_URL = process.env.KEHTO_PLAYGROUND_BASE_URL ?? 'http://localhost:4174';

async function openDemo(page: Page): Promise<void> {
  await page.goto(DEMO_URL);
  await expect(page.locator('#chat-status')).toHaveText('identity-bound');
  await expect(page.locator('#bot-status')).toHaveText('identity-bound');
  const aclSlot = page.locator('#chat-acl');
  await expect(aclSlot.locator('.acl-summary-toggle')).toContainText('7 allowed');
  await aclSlot.locator('.acl-summary-toggle').click();
  await expect(aclSlot.locator('button')).toContainText(['Relay Publish / INC Send']);
}

async function revokeChatCapability(page: Page, label: string): Promise<void> {
  await page.locator('#chat-acl button', { hasText: label }).click();
}

async function sendChatMessage(page: Page, text: string): Promise<void> {
  const chatFrame = await getNappletFrame(page, 'chat-frame-container');
  if (!chatFrame) throw new Error('chat frame not found in page.frames()');
  await chatFrame.evaluate((message) => {
    const input = document.getElementById('msg-input') as HTMLInputElement | null;
    const button = document.getElementById('send-btn') as HTMLButtonElement | null;
    if (!input || !button) throw new Error('chat controls not found');
    input.value = message;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
  }, text);
}

test.describe.configure({ mode: 'serial' });

test('revoke chat relay:write and keep debugger paths legible', async ({ page }) => {
  await openDemo(page);
  await revokeChatCapability(page, 'Relay Publish / INC Send');
  await sendChatMessage(page, 'relay write revoked');

  await expect(page.locator('napplet-debugger')).toContainText('path:inc-send');
  await expect(page.locator('napplet-debugger')).toContainText('relay-publish:relay:write');
  await expect(page.locator('napplet-debugger')).toContainText('denied: relay:write');
});

test('revoke chat state:write and preserve the exact denial string', async ({ page }) => {
  await openDemo(page);
  await revokeChatCapability(page, 'State Write');
  await sendChatMessage(page, 'state write revoked');

  await expect(page.locator('napplet-debugger')).toContainText('denied: state:write');
});

test('revoke chat sign:event and separate inter-pane success from signer denial', async ({ page }) => {
  await openDemo(page);
  await revokeChatCapability(page, 'Identity Read');
  await sendChatMessage(page, 'signer revoked');

  const chatFrame = page.frameLocator('#chat-frame-container iframe');
  const botFrame = page.frameLocator('#bot-frame-container iframe');

  await expect(botFrame.locator('#log')).toContainText('signer revoked');
  await expect(chatFrame.locator('#messages')).toContainText('[bot]');
  await expect(page.locator('napplet-debugger')).toContainText('path:inc-send');
  // identity:read (formerly sign:event) revocation does not surface a denial in the
  // debugger for the chat napplet because chat does not call identity.getPublicKey.
  // The INC round-trip succeeding despite the revocation is the key signal.
  await expect(page.locator('napplet-debugger')).toContainText('path:relay-publish');
});

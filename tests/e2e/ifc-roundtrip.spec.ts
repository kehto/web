/**
 * ifc-roundtrip.spec.ts — E2E-07 (ifc-roundtrip subset, Phase 18 NAP-01 + NAP-02).
 *
 * Asserts the chat→bot→chat envelope round trip via direct IFC helpers:
 *   1. User types "hello" in chat and clicks send.
 *   2. Chat napplet calls ifcEmit('chat:message', [], JSON.stringify({text, timestamp})).
 *   3. Shell routes the IFC envelope to bot's ifcOn('chat:message', handler).
 *   4. Bot's findResponse("hello") returns "hey there!".
 *   5. Bot calls ifcEmit('bot:response', [], JSON.stringify({text: "hey there!", timestamp})).
 *   6. Shell routes the envelope back to chat's ifcOn('bot:response', handler).
 *   7. Chat renders "[bot] hey there!" into #messages.
 *
 * Failure modes covered:
 * - Helper regression (ifcEmit/ifcOn not exported correctly) → step 2 or 6 fails.
 * - Shell IFC routing regression → step 3 or 6 fails (no envelope delivery).
 * - Chat or bot DOM contract drift → step 1 or 7 fails (wrong selectors).
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('chat input triggers ifc envelope; bot reply appears in chat messages', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  // Wait for both napplets to reach authenticated state — gates the ifc round trip.
  const chatFrame = page.frameLocator('#chat-frame-container iframe');
  const botFrame = page.frameLocator('#bot-frame-container iframe');
  await expect(chatFrame.locator('#chat-status')).toContainText('authenticated', { timeout: 10_000 });
  await expect(botFrame.locator('#status-text')).toContainText('authenticated', { timeout: 10_000 });

  // Trigger the round trip: type "hello" in chat, click send.
  // Bot's findResponse returns "hey there!" for any text containing "hello"/"hi"
  // (per apps/playground/napplets/bot/src/main.ts findResponse logic, preserved by Plan 18-01).
  await chatFrame.locator('#msg-input').fill('hello');
  await chatFrame.locator('#send-btn').click();

  // Bot reply arrives via ifcOn('bot:response') and is rendered as "[bot] <text>".
  // Chat renders it inside #messages with class .msg-other.
  const messages = chatFrame.locator('#messages');
  await expect(messages).toContainText('[bot]', { timeout: 8_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});

/**
 * napplet-auth.spec.ts — E2E-07 (napplet-auth subset, Phase 18 NAP-01 + NAP-02).
 *
 * Asserts both demo napplets (chat + bot) reach the positive 'authenticated'
 * status marker established by the helper-based SDK migration. Before Phase 18,
 * napplets used legacy NIP-01 arrays; the v1.2 shell bridge silently dropped
 * them and #chat-status stayed at 'connecting...' indefinitely. This spec is
 * the regression net for the SDK migration contract (shim AUTHENTICATED bootstrap).
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('chat napplet reaches authenticated state at :4174', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const chatStatus = page
    .frameLocator('#chat-frame-container iframe')
    .locator('#chat-status');
  await expect(chatStatus).toContainText('authenticated', { timeout: 10_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});

test('bot napplet reaches authenticated state at :4174', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const botStatus = page
    .frameLocator('#bot-frame-container iframe')
    .locator('#status-text');
  await expect(botStatus).toContainText('authenticated', { timeout: 10_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});

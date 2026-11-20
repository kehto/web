/**
 * nap-inc Layer-A spec — E2E-09 Phase 21.
 *
 * Drives fixture-nap-inc via harness driver globals at :4173.
 *
 * The fixture imports incEmit/incOn from `@napplet/nap/inc/sdk` and posts the
 * canonical `inc.*` wire: inc.subscribe / inc.emit / inc.subscribe.result.
 *
 * Asserts:
 *   1. Fixture loads and reaches __nappletReady__ (session registered).
 *   2. The fixture's inc.subscribe envelope was dispatched (incOn on init).
 *   3. The fixture's #nap-status sentinel reflects 'ready'
 *      (inc.subscribe.result received — proves the envelope round-tripped).
 *   4. Triggering #nap-inc-emit-btn dispatches an inc.emit envelope (visible via __getNapMessage__).
 *
 * No demo server dependency.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nap-inc: inc.subscribe envelope dispatched and fixture sentinel reaches ready', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  const windowId = await page.evaluate(() => window.__loadNapplet__('nap-inc'));
  await waitForNappletReady(page, windowId);

  // Wait for inc.subscribe envelope to be recorded by the harness.
  await page.waitForFunction(
    (wid) => window.__getNapMessage__(wid, 'inc.subscribe') !== null,
    windowId,
    { timeout: 10_000 },
  );

  const envelope = await page.evaluate(
    (wid) => window.__getNapMessage__(wid, 'inc.subscribe'),
    windowId,
  );
  expect(envelope).not.toBeNull();
  expect((envelope as { type: string }).type).toBe('inc.subscribe');

  // Fixture sets #nap-status to 'ready' after incOn returns (inc.subscribe.result received).
  const statusLocator = page.frameLocator(`#${windowId}`).locator('#nap-status');
  await expect(statusLocator).toContainText('ready', { timeout: 8_000 });

  // Trigger the emit button — dispatches inc.emit envelope to the harness.
  // Button clicks via frame.evaluate because sandboxed iframes are cross-origin.
  const frame = page.frames().find(f => f.url().includes('/nap-inc/'));
  if (frame) {
    await frame.evaluate(() => {
      (document.getElementById('nap-inc-emit-btn') as HTMLButtonElement | null)?.click();
    });
  }

  await page.waitForFunction(
    (wid) => window.__getNapMessage__(wid, 'inc.emit') !== null,
    windowId,
    { timeout: 8_000 },
  );

  const emitEnvelope = await page.evaluate(
    (wid) => window.__getNapMessage__(wid, 'inc.emit'),
    windowId,
  );
  expect(emitEnvelope).not.toBeNull();
  expect((emitEnvelope as { type: string }).type).toBe('inc.emit');

  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});

// NAP-INC napplet/naps master 377bf939c6c906817084b43dd21d424de646dbc2 (kehto/web#331):
// two live instances of the same manifest d tag are distinct endpoints.
test('nap-inc: same-d-tag instances get opaque endpoint identifiers usable as channel targets', async ({ page }) => {
  test.setTimeout(45_000);
  await aclBeforeEach(page);

  const receiver = await page.evaluate(() => window.__loadNapplet__('nap-inc'));
  const emitter = await page.evaluate(() => window.__loadNapplet__('nap-inc'));
  await waitForNappletReady(page, receiver);
  await waitForNappletReady(page, emitter);
  for (const windowId of [receiver, emitter]) {
    await page.waitForFunction((wid) => window.__getNapMessage__(wid, 'inc.subscribe.result') !== null, windowId, { timeout: 10_000 });
  }

  await page.frameLocator(`#${emitter}`).locator('#nap-inc-emit-btn').dispatchEvent('click');
  await page.waitForFunction((wid) => window.__getNapMessage__(wid, 'inc.event') !== null, receiver, { timeout: 8_000 });
  await expect(page.frameLocator(`#${receiver}`).locator('#nap-inc-log .inc-event')).toHaveCount(1);

  const event = await page.evaluate((wid) => window.__getNapMessage__(wid, 'inc.event'), receiver) as unknown as { sender: string };
  expect(event.sender).toMatch(/^[0-9a-f]{32}$/);
  expect(event.sender).not.toContain('nap-inc');
  expect(event.sender).not.toContain(emitter);
  // Source exclusion: the emitting instance gets no echo even though it shares the d tag.
  expect(await page.evaluate((wid) => window.__getNapMessage__(wid, 'inc.event'), emitter)).toBeNull();

  const outcome = await page.evaluate(([from, to, target]) => {
    window.__injectEnvelope__(from, { type: 'inc.channel.open', id: 'by-dtag', target: 'nap-inc' } as never);
    const byDTag = window.__getNapMessage__(from, 'inc.channel.open.result');
    window.__injectEnvelope__(from, { type: 'inc.channel.open', id: 'by-endpoint', target } as never);
    return {
      byDTag,
      byEndpoint: window.__getNapMessage__(from, 'inc.channel.open.result'),
      opened: window.__getNapMessage__(to, 'inc.channel.opened'),
    };
  }, [receiver, emitter, event.sender]) as unknown as {
    byDTag: Record<string, unknown>; byEndpoint: Record<string, unknown>; opened: Record<string, unknown>;
  };
  expect(outcome.byDTag).toEqual({ type: 'inc.channel.open.result', id: 'by-dtag', error: 'target not found' });
  expect(outcome.byEndpoint).toMatchObject({ id: 'by-endpoint', peer: event.sender });
  expect(outcome.byEndpoint).not.toHaveProperty('error');
  expect(outcome.opened).toMatchObject({ channelId: outcome.byEndpoint.channelId });
  expect(outcome.opened.peer).toMatch(/^[0-9a-f]{32}$/);
  expect(outcome.opened.peer).not.toBe(event.sender);

  // The endpoint going away closes the channel for the survivor.
  await page.evaluate((wid) => window.__unloadNapplet__(wid), emitter);
  await page.waitForFunction((wid) => window.__getNapMessage__(wid, 'inc.channel.closed') !== null, receiver, { timeout: 8_000 });
  expect(await page.evaluate((wid) => window.__getNapMessage__(wid, 'inc.channel.closed'), receiver)).toEqual({
    type: 'inc.channel.closed', channelId: outcome.byEndpoint.channelId, reason: 'peer destroyed',
  });
});

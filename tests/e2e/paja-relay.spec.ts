/**
 * Paja NAP-RELAY browser flows: publish, publishEncrypted, subscribe, and live
 * relay:write revocation.
 *
 * Spec check: NAP-RELAY napplet/naps#2@9f30b35 (Shell Behavior: sign and forward
 * relay.publish, encrypt+sign+forward relay.publishEncrypted, deliver relay.event
 * then relay.eose, honour relay.close; failures are `ok: false` + `error`).
 *
 * Every assertion is taken at both ends: the napplet-visible result and the
 * event that actually reached the in-test relay.
 */
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type NostrEvent } from 'nostr-tools/pure';
import type { PajaServer } from '../../packages/paja/dist/index.js';
import { installMemoryRelay, type MemoryRelay } from './helpers/memory-relay.js';
import {
  installKeySigner,
  openFlowTarget,
  readLog,
  readTracked,
  settleApproving,
  startFlowRuntime,
  startFlowTarget,
  type FlowTarget,
  type FlowWindow,
  type KeySigner,
} from './helpers/paja-flows.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

test.beforeEach(async ({ page }) => { await installPajaApprovalDriver(page); });

const RELAY_URL = 'wss://paja-relay-flows.example';

let target: FlowTarget;
let runtime: PajaServer;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  target = await startFlowTarget(['relay']);
  runtime = await startFlowRuntime(target, RELAY_URL);
});

test.afterAll(async () => {
  await runtime.close();
  await target.close();
});

async function prepare(page: Page): Promise<{ relay: MemoryRelay; signer: KeySigner; frame: FrameLocator }> {
  const relay = await installMemoryRelay(page, RELAY_URL);
  const signer = await installKeySigner(page, generateSecretKey());
  const frame = await openFlowTarget(page, runtime);
  await page.locator('#signer-nip07').click();
  await expect(page.locator('#signer-status')).toContainText('NIP-07 connected');
  return { relay, signer, frame };
}

async function startPublish(frame: FrameLocator, key: string, content: string): Promise<void> {
  await frame.locator('body').evaluate((_body, input) => {
    const flow = window as unknown as FlowWindow;
    flow.__track(input.key, flow.napplet.relay.publish({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: input.content,
    }));
  }, { key, content });
}

test('relay.publish signs through the host signer and forwards the signed event to the relay', async ({ page }) => {
  test.setTimeout(60_000);
  const { relay, signer, frame } = await prepare(page);

  await startPublish(frame, 'publish', 'hello from paja');
  const { result, approved } = await settleApproving(page, frame, 'publish');

  expect(approved).toContain('Sign this Nostr event?');
  expect(result.ok).toBe(true);
  const event = (result as { value: NostrEvent }).value;
  expect(event).toMatchObject({ kind: 1, content: 'hello from paja', pubkey: signer.pubkey });
  expect(verifyEvent(event)).toBe(true);
  await expect.poll(() => relay.published.map((published) => published.id)).toContain(event.id);
  expect(signer.signed.map((template) => template.content)).toContain('hello from paja');
  await expect(page.locator('#message-log [data-message-type="relay.publish"]')).not.toHaveCount(0);
});

test('relay.publishEncrypted forwards NIP-44 ciphertext only the recipient can read', async ({ page }) => {
  test.setTimeout(60_000);
  const { relay, signer, frame } = await prepare(page);
  const recipientKey = generateSecretKey();
  const recipient = getPublicKey(recipientKey);

  await frame.locator('body').evaluate((_body, peer) => {
    const flow = window as unknown as FlowWindow;
    flow.__track('encrypted', flow.napplet.relay.publishEncrypted({
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', peer]],
      content: 'secret for the recipient',
    }, peer, 'nip44'));
  }, recipient);
  const { result } = await settleApproving(page, frame, 'encrypted');

  expect(result.ok).toBe(true);
  const event = (result as { value: NostrEvent }).value;
  expect(verifyEvent(event)).toBe(true);
  expect(event.pubkey).toBe(signer.pubkey);
  expect(event.content).not.toContain('secret for the recipient');
  expect(nip44.decrypt(event.content, nip44.getConversationKey(recipientKey, signer.pubkey))).toBe('secret for the recipient');
  await expect.poll(() => relay.published.map((published) => published.id)).toContain(event.id);
  await expect(page.locator('#message-log [data-message-type="relay.publishEncrypted"]')).not.toHaveCount(0);
});

test('relay.subscribe delivers stored events, EOSE, live events, and stops after close', async ({ page }) => {
  test.setTimeout(60_000);
  const { relay, frame } = await prepare(page);
  const author = generateSecretKey();
  const authorPubkey = getPublicKey(author);
  const note = (content: string, createdAt: number) => finalizeEvent({ kind: 1, created_at: createdAt, tags: [], content }, author);
  const stored = note('stored note', 1_800_000_000);
  relay.store(stored);

  await frame.locator('body').evaluate((_body, authors) => {
    const flow = window as unknown as FlowWindow;
    const handle = flow.napplet.relay.subscribe(
      { kinds: [1], authors },
      (result: { event?: { content?: string } }) => flow.__push('events', result.event?.content ?? null),
      () => flow.__push('eose', true),
    );
    (window as unknown as { __subscription: { close(): void } }).__subscription = handle;
  }, [authorPubkey]);

  await expect.poll(() => readLog(frame, 'events')).toEqual(['stored note']);
  await expect.poll(() => readLog(frame, 'eose')).toEqual([true]);
  expect(relay.requests.some((filters) => filters.some((filter) => filter.authors?.includes(authorPubkey)))).toBe(true);

  relay.store(note('live note', 1_800_000_001));
  await expect.poll(() => readLog(frame, 'events')).toEqual(['stored note', 'live note']);

  const closedBefore = relay.closed.length;
  await frame.locator('body').evaluate(() => (window as unknown as { __subscription: { close(): void } }).__subscription.close());
  await expect.poll(() => relay.closed.length).toBeGreaterThan(closedBefore);
  relay.store(note('after close', 1_800_000_002));
  await frame.locator('body').evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(await readLog(frame, 'events')).toEqual(['stored note', 'live note']);
});

test('revoking relay:write denies the next publish before signing and re-granting restores it', async ({ page }) => {
  test.setTimeout(90_000);
  const { relay, signer, frame } = await prepare(page);
  const relayWrite = page.locator('#acl-controls [data-acl-capability="relay:write"]');

  await startPublish(frame, 'control', 'control publish');
  expect((await settleApproving(page, frame, 'control')).result.ok).toBe(true);
  await expect(relayWrite).toHaveAttribute('data-enabled', 'true');

  await relayWrite.click();
  await expect(relayWrite).toHaveAttribute('data-enabled', 'false');
  const publishedBefore = relay.published.length;
  const signedBefore = signer.signed.length;
  await startPublish(frame, 'denied', 'denied publish');
  await expect.poll(() => readTracked(frame, 'denied')).not.toBeNull();
  const denied = await readTracked(frame, 'denied');
  expect(denied).toMatchObject({ ok: false, error: expect.stringContaining('relay:write') });
  await expect(page.locator('#paja-confirmation-dialog')).not.toBeVisible();
  expect(signer.signed.length).toBe(signedBefore);
  expect(relay.published.length).toBe(publishedBefore);

  await relayWrite.click();
  await expect(relayWrite).toHaveAttribute('data-enabled', 'true');
  await startPublish(frame, 'regranted', 'regranted publish');
  const { result } = await settleApproving(page, frame, 'regranted');
  expect(result.ok).toBe(true);
  await expect.poll(() => relay.published.map((event) => event.content)).toContain('regranted publish');
});

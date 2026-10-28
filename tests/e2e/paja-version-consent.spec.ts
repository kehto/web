import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { finalizeEvent, getPublicKey, verifyEvent, type EventTemplate } from 'nostr-tools/pure';
import { naddrEncode } from 'nostr-tools/nip19';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';

// NAP-LINK #53@50a2cd4, NAP-RELAY #2@9f30b35, NAP-OUTBOX #32@8865f73.
// Host policy binds approvals to verified publisher/artifact and signer, never wire-supplied context.
const relay = 'wss://consent-relay.example';
const blossom = 'https://consent-blobs.example';
const origin = 'http://127.0.0.1:47690';
const signingKey = new Uint8Array(32).fill(11);
const publisher = new Uint8Array(32).fill(12);
const makeArtifact = (version: number) => Buffer.from(`<!doctype html><html><body><output id="ready">waiting</output><script>
window.replies = [];
window.addEventListener('message', event => { if (event.source === parent) window.replies.push(event.data); });
window.napplet.shell.ready().then(() => document.getElementById('ready').textContent = 'ready');
</script><!-- version ${version} --></body></html>`);

async function prepare(page: Page) {
  const signed: unknown[] = [];
  const published: Array<ReturnType<typeof finalizeEvent>> = [];
  const nativeDialogs: string[] = [];
  let revision = 1;
  let author = publisher;
  await page.exposeFunction('signConsentEvent', (event: EventTemplate) => {
    signed.push(event);
    return finalizeEvent(event, signingKey);
  });
  await page.addInitScript(({ pubkey, relayUrl }) => {
    const host = window as unknown as { nostr: unknown; signConsentEvent(event: unknown): Promise<unknown>; opened: unknown[] };
    host.nostr = { getPublicKey: async () => pubkey, getRelays: async () => ({ [relayUrl]: { read: true, write: true } }), signEvent: (event: unknown) => host.signConsentEvent(event) };
    host.opened = [];
    window.open = ((url: unknown, target: unknown, features: unknown) => {
      host.opened.push({ url, target, features, activation: navigator.userActivation.isActive });
      return null;
    }) as typeof window.open;
  }, { pubkey: getPublicKey(signingKey), relayUrl: relay });
  page.on('dialog', async dialog => { nativeDialogs.push(dialog.type()); await dialog.dismiss(); });
  const config = createPajaRuntimeHostConfig({ maxWaitMs: 2_000, simulation: { relay: { mode: 'live', urls: [relay] } } });
  const script = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  await page.route(`${origin}/**`, route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.json') ? 'application/json' : 'text/html', body: path.endsWith('.js') ? script : path.endsWith('.json') ? JSON.stringify(config) : renderPajaHtml(config) });
  });
  const artifact = () => makeArtifact(revision);
  const hash = () => createHash('sha256').update(artifact()).digest('hex');
  const manifest = () => finalizeEvent({ kind: 35129, created_at: 1_700_000_000 + revision, content: 'Consent fixture', tags: [['d', 'consent-fixture'], ['x', hash()], ['title', 'Consent fixture'], ['server', blossom]] }, author);
  await page.route(`${blossom}/**`, route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'text/html', body: artifact() }));
  await page.routeWebSocket(`${relay}/`, socket => socket.onMessage(message => {
    const [action, id, filter] = JSON.parse(String(message));
    if (action === 'EVENT') {
      published.push(id);
      socket.send(JSON.stringify(['OK', id.id, true, '']));
    }
    if (action === 'REQ') {
      const event = manifest();
      if ((!filter.kinds || filter.kinds.includes(event.kind)) && (!filter.authors || filter.authors.includes(event.pubkey))) socket.send(JSON.stringify(['EVENT', id, event]));
      socket.send(JSON.stringify(['EOSE', id]));
    }
  }));
  const load = async () => {
    const pointer = naddrEncode({ kind: 35129, pubkey: getPublicKey(author), identifier: 'consent-fixture', relays: [relay] });
    await page.goto(`${origin}/?naddr=${pointer}`);
    await expect(page.locator('#signer-status')).toContainText('NIP-07 connected');
    await expect(page.frameLocator('iframe').last().locator('#ready')).toHaveText('ready');
  };
  const send = async (message: Record<string, unknown>) => page.frameLocator('iframe').last().locator('body').evaluate((_body, payload) => parent.postMessage(payload, '*'), message);
  const reply = async (id: string) => page.frameLocator('iframe').last().locator('body').evaluate((_body, requestId) => (window as unknown as { replies: Array<Record<string, unknown>> }).replies.find(value => value.id === requestId), id);
  const publish = (id: string, kind = 1, type = 'relay.publish') => send({ type, id, event: { kind, created_at: Math.floor(Date.now() / 1000), tags: [], content: id }, ...(type === 'outbox.publish' ? { options: { relays: [relay], toOutbox: false } } : {}) });
  return { load, send, reply, publish, signed, published, nativeDialogs, hash, nextVersion: () => { revision++; }, otherPublisher: () => { author = new Uint8Array(32).fill(13); revision = 1; } };
}

test('persists combined approval for one verified version and revokes it without native dialogs', async ({ page }) => {
  const fixture = await prepare(page);
  await fixture.load();
  await fixture.publish('first');
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Sign this Nostr event?');
  await expect(page.locator('#paja-confirmation-details')).toContainText(fixture.hash());
  await page.locator('#paja-signer-consent-version').check();
  for (const [width, height] of [[200, 160], [320, 560], [900, 600], [2400, 1200]]) {
    await page.setViewportSize({ width: width!, height: height! });
    expect(await page.locator('#paja-confirmation-dialog .dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect(page.locator('#paja-signer-consent-version')).toBeChecked();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '/tmp/paja-version-consent-modal.png', fullPage: true });
  expect(fixture.published).toHaveLength(0);
  await page.locator('#paja-confirmation-approve').click();
  await expect.poll(() => fixture.reply('first')).toMatchObject({ ok: true });
  await fixture.publish('second', 7);
  await expect.poll(() => fixture.reply('second')).toMatchObject({ ok: true });
  await page.reload();
  await expect(page.frameLocator('iframe').last().locator('#ready')).toHaveText('ready');
  await fixture.publish('outbox', 1, 'outbox.publish');
  await expect.poll(() => fixture.reply('outbox')).toMatchObject({ ok: true });
  await expect.poll(() => fixture.published.length).toBe(3);
  expect(fixture.published.every(event => verifyEvent(event))).toBe(true);
  expect(fixture.signed).toHaveLength(3);
  await expect(page.locator('#paja-confirmation-dialog')).not.toBeVisible();
  await page.locator('#signer-consent-clear').click();
  await fixture.publish('revoked');
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Sign this Nostr event?');
  await page.keyboard.press('Escape');
  await expect.poll(() => fixture.reply('revoked')).toMatchObject({ ok: false });
  expect(fixture.published).toHaveLength(3);
  expect(fixture.nativeDialogs).toEqual([]);
});

test('requires new approval for changed artifact and publisher, and cancels on tab removal', async ({ page }) => {
  const fixture = await prepare(page);
  await fixture.load();
  await fixture.publish('grant');
  await expect(page.locator('#paja-signer-consent-version')).toBeVisible();
  await page.locator('#paja-signer-consent-version').check();
  await page.locator('#paja-confirmation-approve').click();
  await expect.poll(() => fixture.reply('grant')).toMatchObject({ ok: true });
  fixture.nextVersion();
  await page.reload();
  await expect(page.frameLocator('iframe').last().locator('#ready')).toHaveText('ready');
  await fixture.publish('new-version');
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Sign this Nostr event?');
  await page.locator('#paja-confirmation-deny').click();
  await expect.poll(() => fixture.reply('new-version')).toMatchObject({ ok: false });
  fixture.otherPublisher();
  await fixture.load();
  await fixture.publish('other-publisher');
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Sign this Nostr event?');
  // Removing the endpoint while its request is pending must close the modal.
  await page.evaluate(() => {
    const host = window.__KEHTO_PAJA__!;
    host.closeTab(host.getState().activeTabId!);
  });
  await expect(page.locator('#paja-confirmation-dialog')).not.toBeVisible();
  expect(fixture.published).toHaveLength(1);
});

test('confirms each NAP-LINK destination and opens only on the host approval click', async ({ page }) => {
  const fixture = await prepare(page);
  await fixture.load();
  await fixture.send({ type: 'link.open', id: 'deny-link', url: 'https://example.com/docs', options: { label: 'Read documentation' } });
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Open external link?');
  await expect(page.locator('#paja-confirmation-details')).toContainText('https://example.com/docs');
  await expect(page.locator('#paja-signer-consent')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { opened: unknown[] }).opened)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect.poll(() => fixture.reply('deny-link')).toMatchObject({ status: 'denied' });
  await fixture.send({ type: 'link.open', id: 'open-link', url: 'https://example.com/docs' });
  await expect(page.locator('#paja-confirmation-dialog')).toBeVisible();
  await page.locator('#paja-confirmation-approve').click();
  await expect.poll(() => fixture.reply('open-link')).toMatchObject({ status: 'opened' });
  expect(await page.evaluate(() => (window as unknown as { opened: unknown[] }).opened)).toEqual([{ url: 'https://example.com/docs', target: '_blank', features: 'noopener,noreferrer', activation: true }]);
  expect(fixture.nativeDialogs).toEqual([]);
});


test('offers combined consent at publication and prompts again when the active signer changes', async ({ page }) => {
  const fixture = await prepare(page);
  await fixture.load();
  await fixture.publish('signed');
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Sign this Nostr event?');
  await page.locator('#paja-confirmation-approve').click();
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Publish this Nostr event?');
  await page.locator('#paja-signer-consent-version').check();
  await page.locator('#paja-confirmation-approve').click();
  await expect.poll(() => fixture.reply('signed')).toMatchObject({ ok: true });
  await page.evaluate(() => window.__KEHTO_PAJA__!.useDevSigner());
  await expect(page.locator('#signer-status')).toContainText('dev connected');
  await fixture.publish('different-account');
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Sign this Nostr event?');
  await page.locator('#paja-confirmation-deny').click();
  await expect.poll(() => fixture.reply('different-account')).toMatchObject({ ok: false });
  expect(fixture.published).toHaveLength(1);
});

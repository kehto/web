import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';

interface TargetServer {
  readonly url: string;
  readonly requestOrigins: string[];
  close(): Promise<void>;
}

interface BlossomPut {
  readonly bytes: Buffer;
  readonly authorization: string;
  readonly contentType: string;
}

interface BlossomTestServer extends TargetServer {
  readonly puts: BlossomPut[];
  readonly requestMethods: string[];
  omitSizeOnce(): void;
}

const shimPrelude = readFileSync(
  new URL('../../packages/shell/node_modules/@napplet/shim/dist/prelude.global.js', import.meta.url),
  'utf8',
);

let targetServer: TargetServer;
let runtimeServer: PajaServer;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  targetServer = await startTargetServer();
  runtimeServer = await startPajaServer({
    options: {
      targetUrl: targetServer.url,
      port: 0,
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });
});

test.afterAll(async () => {
  await runtimeServer.close();
  await targetServer.close();
});

test('hosts one sandboxed target iframe and reinitializes it on reload', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(runtimeServer.url);

  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('.brand')).toHaveText('@kehto/paja');
  await expect.poll(async () => page.locator('.brand').evaluate((brand) => {
    const product = brand.querySelector('.brand-product');
    if (!(product instanceof HTMLElement)) return false;
    return getComputedStyle(brand).color !== getComputedStyle(product).color;
  })).toBe(true);
  await expect(page.locator('footer.bottom')).toBeVisible();
  await expect(page.locator('.console')).toBeVisible();
  await expect(page.locator('#interface-toggles [data-interface-domain="identity"]')).toHaveAttribute('data-enabled', 'true');
  await expect(page.locator('#acl-controls [data-acl-capability="state:write"]')).toHaveAttribute('data-enabled', 'true');
  await expect(page.locator('#signer-status')).toContainText('every sign/publish request prompts');
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('#napplet-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#napplet-frame')).not.toHaveAttribute('sandbox', /allow-same-origin/);

  const targetFrame = page.frameLocator('#napplet-frame');
  await expect(targetFrame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
  await expect(targetFrame.locator('#injected-domains')).toHaveText('identity,outbox,resource,keys');
  await expect(targetFrame.locator('#shell-init-type')).toHaveText('shell.init');
  await expect(targetFrame.locator('#shell-init-domains')).toContainText('relay,identity,storage,inc');
  await expect(targetFrame.locator('#shell-init-domains')).toContainText('upload,intent');
  await expect.poll(async () => targetFrame.locator('body').evaluate(() => {
    const napplet = (window as Window & {
      napplet?: { media?: unknown; shell?: { supports(domain: string): boolean; services: readonly string[] } };
    }).napplet;
    return {
      mediaReceiver: typeof napplet?.media,
      mediaSupported: napplet?.shell?.supports('media'),
      mediaService: napplet?.shell?.services.includes('media'),
    };
  })).toEqual({ mediaReceiver: 'object', mediaSupported: true, mediaService: true });
  await expect(targetFrame.locator('#service-results')).toContainText('storage.set.result');
  await expect(targetFrame.locator('#service-results')).toContainText('config.values');
  await expect(targetFrame.locator('#service-results')).toContainText('theme.get.result');
  await expect(targetFrame.locator('#service-results')).toContainText('notify.send.result');
  await expect(targetFrame.locator('#service-results')).toContainText('identity.getPublicKey.result');
  await expect(targetFrame.locator('#service-results')).toContainText('upload.upload.result');
  await expect(targetFrame.locator('#service-results')).toContainText('intent.available.result');
  await expect(targetFrame.locator('#service-results')).toContainText('cvm.discover.result');
  await expect(targetFrame.locator('#service-results')).toContainText('outbox.publish.result');
  await expect(targetFrame.locator('#identity-pubkey')).toHaveText('');
  await expect(page.locator('#paja-confirmation-dialog')).not.toBeVisible();
  await expect(page.locator('#message-log .log-row')).not.toHaveCount(0);
  await page.locator('#message-filter').fill('identity.getPublicKey');
  await expect(page.locator('#message-log .log-row')).not.toHaveCount(0);
  await expect(page.locator('#message-log .log-row').first()).toContainText('identity.getPublicKey');
  await page.locator('#message-filter').fill('');
  await expect(page.locator('#lifecycle-status')).toHaveText('ready');
  await expect(page.locator('#simulation-status')).toContainText('identity:anon relay:live:4 storage:local upload:memory:simulator theme:dark off:none');

  const firstLoadId = await targetFrame.locator('#load-id').textContent();
  expect(firstLoadId).toBeTruthy();

  const firstGeneration = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation ?? -1);
  await page.locator('#reload-target').click();

  await expect(page.locator('iframe')).toHaveCount(1);
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation)).toBe(firstGeneration + 1);
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
  await expect.poll(() => page.frames().some((frame) => frame.url() === 'about:srcdoc'), { timeout: 15_000 }).toBe(true);
  await expect(page.locator('#napplet-frame')).toHaveAttribute('data-target-url', targetServer.url);
  const reloadedFrame = page.frameLocator('#napplet-frame');
  await expect(reloadedFrame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
  const secondLoadId = await reloadedFrame.locator('#load-id').textContent();
  expect(secondLoadId).toBeTruthy();
  expect(secondLoadId).not.toBe(firstLoadId);

  const state = await page.evaluate(() => window.__KEHTO_PAJA__?.getState());
  expect(state).toMatchObject({
    generation: 1,
    status: 'ready',
    iframeCount: 1,
    initSent: true,
  });
  expect(state?.services).toEqual(expect.arrayContaining([
    'config',
    'common',
    'count',
    'cvm',
    'identity',
    'intent',
    'keys',
    'link',
    'lists',
    'media',
    'notify',
    'outbox',
    'relay',
    'resource',
    'serial',
    'theme',
    'upload',
    'ble',
    'webrtc',
  ]));

  await page.locator('#acl-controls [data-acl-capability="state:write"]').click();
  await expect(page.locator('#acl-controls [data-acl-capability="state:write"]')).toHaveAttribute('data-enabled', 'false');
  await page.locator('#reload-target').click();
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
  await expect(page.frameLocator('#napplet-frame').locator('#storage-error')).toContainText('denied', { timeout: 15_000 });

  await page.locator('#interface-toggles [data-interface-domain="media"]').click();
  await expect(page.locator('#interface-toggles [data-interface-domain="media"]')).toHaveAttribute('data-enabled', 'false');
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
  await expect(page.frameLocator('#napplet-frame').locator('#shell-init-domains')).not.toContainText('media', { timeout: 15_000 });
  await expect.poll(async () => page.frameLocator('#napplet-frame').locator('body').evaluate(() => {
    const napplet = (window as Window & {
      napplet?: { media?: unknown; shell?: { supports(domain: string): boolean; services: readonly string[] } };
    }).napplet;
    return {
      mediaReceiver: typeof napplet?.media,
      mediaSupported: napplet?.shell?.supports('media'),
      mediaService: napplet?.shell?.services.includes('media'),
    };
  })).toEqual({ mediaReceiver: 'undefined', mediaSupported: false, mediaService: false });
});

test('executes every advertised development NAP over the Paja bridge', async ({ page }) => {
  test.setTimeout(120_000);
  const relayEvent = finalizeEvent({
    kind: 1,
    created_at: 1_800_000_000,
    tags: [],
    content: 'Paja relay fixture',
  }, generateSecretKey());
  const domains = [
    'relay', 'outbox', 'storage', 'identity', 'keys', 'config', 'resource',
    'theme', 'notify', 'media', 'upload', 'intent', 'count', 'link',
    'common', 'lists', 'serial', 'ble', 'webrtc', 'cvm', 'inc',
  ];
  const completeRuntime = await startPajaServer({
    options: {
      targetUrl: `${targetServer.url}?manualTraffic=1&required=${domains.join(',')}`,
      port: 0,
      simulation: {
        relay: { mode: 'memory', fixtures: [relayEvent] },
      },
    },
    now: new Date('2026-08-02T00:00:00.000Z'),
  });

  try {
    await page.goto(completeRuntime.url);
    const frame = page.frameLocator('#napplet-frame');
    await expect(frame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    await expect(frame.locator('#injected-domains')).toHaveText(domains.join(','));
    await page.locator('#signer-dev').click();
    await expect(page.locator('#signer-status')).toContainText('dev connected');
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
    await expect(frame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    const services = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().services ?? []);
    expect(services).toEqual(expect.arrayContaining(domains.filter((domain) => domain !== 'inc' && domain !== 'storage')));

    await sendFixtureMessage(frame, { type: 'storage.set', id: 'all-storage', key: 'coverage', value: 'complete' });
    await expect.poll(() => readFixtureMessage(frame, 'storage.set.result', 'all-storage')).not.toBeNull();
    await sendFixtureMessage(frame, { type: 'config.get', id: 'all-config' });
    await expect.poll(() => readFixtureMessage(frame, 'config.values', 'all-config')).not.toBeNull();
    await sendFixtureMessage(frame, { type: 'theme.get', id: 'all-theme' });
    await expect.poll(() => readFixtureMessage(frame, 'theme.get.result', 'all-theme')).not.toBeNull();
    await sendFixtureMessage(frame, { type: 'notify.send', id: 'all-notify', title: 'NAP coverage' });
    await expect.poll(() => readFixtureMessage(frame, 'notify.send.result', 'all-notify')).toMatchObject({
      notificationId: expect.any(String),
    });
    await sendFixtureMessage(frame, { type: 'identity.getPublicKey', id: 'all-identity' });
    await expect.poll(() => readFixtureMessage(frame, 'identity.getPublicKey.result', 'all-identity')).toMatchObject({
      pubkey: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await sendFixtureMessage(frame, { type: 'upload.info', id: 'all-upload' });
    await expect.poll(() => readFixtureMessage(frame, 'upload.info.result', 'all-upload')).toMatchObject({
      info: { rails: [expect.objectContaining({ rail: 'dev-memory', enabled: true })] },
    });
    await sendFixtureMessage(frame, { type: 'intent.available', id: 'all-intent', archetype: 'missing-handler' });
    await expect.poll(() => readFixtureMessage(frame, 'intent.available.result', 'all-intent')).toMatchObject({
      availability: { available: false },
    });

    await page.evaluate(() => {
      const host = window as Window & { __pajaForwardedKeys?: Array<Record<string, unknown>> };
      host.__pajaForwardedKeys = [];
      window.addEventListener('keydown', (event) => {
        host.__pajaForwardedKeys?.push({
          key: event.key,
          code: event.code,
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
        });
      });
    });
    await sendFixtureMessage(frame, {
      type: 'keys.registerAction',
      id: 'all-keys-register',
      action: { id: 'paja.coverage', label: 'Paja coverage', defaultKey: 'shift+ctrl+p' },
    });
    await expect.poll(() => readFixtureMessage(frame, 'keys.registerAction.result', 'all-keys-register')).toMatchObject({
      actionId: 'paja.coverage',
      binding: 'Ctrl+Shift+P',
    });
    await sendFixtureMessage(frame, {
      type: 'keys.forward', key: 'j', code: 'KeyJ', ctrl: true, alt: false, shift: true, meta: false,
    });
    await expect.poll(() => page.evaluate(() => {
      const host = window as Window & { __pajaForwardedKeys?: Array<Record<string, unknown>> };
      return host.__pajaForwardedKeys ?? [];
    })).toEqual([{ key: 'j', code: 'KeyJ', ctrl: true, shift: true }]);

    await sendFixtureMessage(frame, {
      type: 'relay.subscribe',
      id: 'all-relay-subscribe',
      subId: 'all-relay-sub',
      filters: [{ kinds: [1] }],
      relay: 'wss://explicit.paja.test',
    });
    await expect.poll(() => readFixtureMessage(frame, 'relay.eose', 'all-relay-sub', 'subId')).not.toBeNull();
    await sendFixtureMessage(frame, {
      type: 'outbox.publish',
      id: 'all-outbox-publish',
      event: { kind: 1, content: 'Paja outbox publish', tags: [] },
      options: { toOutbox: false, relays: ['wss://explicit.paja.test'] },
    });
    await approvePajaConfirmation(page, 'Sign this Nostr event?');
    await approvePajaConfirmation(page, 'Publish this Nostr event?');
    await expect.poll(() => readFixtureMessage(frame, 'outbox.publish.result', 'all-outbox-publish')).toMatchObject({
      ok: true,
      eventId: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await sendFixtureMessage(frame, { type: 'count.query', id: 'all-count', filters: [{ kinds: [1] }] });
    await expect.poll(() => readFixtureMessage(frame, 'count.query.result', 'all-count')).toMatchObject({
      ok: true,
      count: 2,
      approximate: false,
    });

    await sendFixtureMessage(frame, { type: 'resource.bytes', requestId: 'all-resource', url: targetServer.url });
    await expect.poll(() => readFixtureMessage(frame, 'resource.bytes.result', 'all-resource', 'requestId')).toMatchObject({
      status: 200,
      bodyBase64: expect.any(String),
    });
    await sendFixtureMessage(frame, {
      type: 'media.session.create', owner: 'napplet', id: 'all-media', sessionId: 'paja-media', metadata: { title: 'Paja track' },
    });
    await expect.poll(() => readFixtureMessage(frame, 'media.session.create.result', 'all-media')).toMatchObject({
      sessionId: 'paja-media', owner: 'napplet',
    });
    await sendFixtureMessage(frame, { type: 'common.getProfile', id: 'all-common' });
    await expect.poll(() => readFixtureMessage(frame, 'common.getProfile.result', 'all-common')).toMatchObject({
      ok: true,
      profile: { name: 'paja', displayName: 'Kehto Paja' },
    });

    const item = { itemType: 'event', value: relayEvent.id };
    await sendFixtureMessage(frame, { type: 'lists.supported', id: 'all-lists-supported' });
    await expect.poll(() => readFixtureMessage(frame, 'lists.supported.result', 'all-lists-supported')).toMatchObject({
      lists: [expect.objectContaining({ type: 'bookmarks' })],
    });
    await sendFixtureMessage(frame, {
      type: 'lists.add', id: 'all-lists-add', list: { type: 'bookmarks' }, items: [item], options: { create: true },
    });
    await expect.poll(() => readFixtureMessage(frame, 'lists.add.result', 'all-lists-add')).toMatchObject({ ok: true, added: 1 });
    await sendFixtureMessage(frame, {
      type: 'lists.remove', id: 'all-lists-remove', list: { type: 'bookmarks' }, items: [item],
    });
    await expect.poll(() => readFixtureMessage(frame, 'lists.remove.result', 'all-lists-remove')).toMatchObject({ ok: true, removed: 1 });

    // Exercise the development firewall as configured: continue after its
    // 20-operation initialization window instead of disabling the policy.
    await page.waitForTimeout(3_100);

    await sendFixtureMessage(frame, {
      type: 'serial.open', id: 'all-serial-open', request: { options: { baudRate: 9_600 }, label: 'coverage' },
    });
    await expect.poll(() => readFixtureMessage(frame, 'serial.open.result', 'all-serial-open')).not.toBeNull();
    const serialSession = await readNestedString(frame, 'serial.open.result', 'all-serial-open', ['session', 'id']);
    await sendFixtureMessage(frame, { type: 'serial.write', id: 'all-serial-write', sessionId: serialSession, data: [1, 2, 3] });
    await expect.poll(() => readFixtureMessage(frame, 'serial.write.result', 'all-serial-write')).not.toBeNull();
    await sendFixtureMessage(frame, { type: 'serial.close', id: 'all-serial-close', sessionId: serialSession });
    await expect.poll(() => readFixtureMessage(frame, 'serial.close.result', 'all-serial-close')).not.toBeNull();

    const bleTarget = { service: 'battery_service', characteristic: 'battery_level' };
    await sendFixtureMessage(frame, {
      type: 'ble.open', id: 'all-ble-open', request: { acceptAllDevices: true, optionalServices: ['battery_service'], label: 'coverage' },
    });
    await expect.poll(() => readFixtureMessage(frame, 'ble.open.result', 'all-ble-open')).not.toBeNull();
    const bleSession = await readNestedString(frame, 'ble.open.result', 'all-ble-open', ['session', 'id']);
    await sendFixtureMessage(frame, { type: 'ble.services', id: 'all-ble-services', sessionId: bleSession });
    await expect.poll(() => readFixtureMessage(frame, 'ble.services.result', 'all-ble-services')).toMatchObject({
      services: [expect.objectContaining({ uuid: 'battery_service' })],
    });
    await sendFixtureMessage(frame, { type: 'ble.read', id: 'all-ble-read', sessionId: bleSession, target: bleTarget });
    await expect.poll(() => readFixtureMessage(frame, 'ble.read.result', 'all-ble-read')).toMatchObject({ data: [87] });
    await sendFixtureMessage(frame, { type: 'ble.write', id: 'all-ble-write', sessionId: bleSession, target: bleTarget, data: [88] });
    await expect.poll(() => readFixtureMessage(frame, 'ble.write.result', 'all-ble-write')).not.toBeNull();
    await sendFixtureMessage(frame, { type: 'ble.close', id: 'all-ble-close', sessionId: bleSession });
    await expect.poll(() => readFixtureMessage(frame, 'ble.close.result', 'all-ble-close')).not.toBeNull();

    await sendFixtureMessage(frame, {
      type: 'webrtc.open', id: 'all-webrtc-open', request: { scope: { type: 'direct', pubkey: '7'.repeat(64) }, channel: 'coverage' },
    });
    await expect.poll(() => readFixtureMessage(frame, 'webrtc.open.result', 'all-webrtc-open')).not.toBeNull();
    const webrtcSession = await readNestedString(frame, 'webrtc.open.result', 'all-webrtc-open', ['session', 'id']);
    await sendFixtureMessage(frame, { type: 'webrtc.send', id: 'all-webrtc-send', sessionId: webrtcSession, payload: { body: 'hello' } });
    await expect.poll(() => readFixtureMessage(frame, 'webrtc.send.result', 'all-webrtc-send')).not.toBeNull();
    await expect.poll(() => readFixtureMessage(frame, 'webrtc.event', 'message', 'event.type')).toMatchObject({
      event: expect.objectContaining({ sessionId: webrtcSession, payload: { body: 'hello' } }),
    });
    await sendFixtureMessage(frame, { type: 'webrtc.close', id: 'all-webrtc-close', sessionId: webrtcSession, reason: 'complete' });
    await expect.poll(() => readFixtureMessage(frame, 'webrtc.close.result', 'all-webrtc-close')).not.toBeNull();

    await sendFixtureMessage(frame, { type: 'cvm.discover', id: 'all-cvm-discover' });
    await expect.poll(() => readFixtureMessage(frame, 'cvm.discover.result', 'all-cvm-discover')).toMatchObject({
      servers: [expect.objectContaining({ name: 'Kehto Paja ContextVM' })],
    });
    await sendFixtureMessage(frame, {
      type: 'cvm.request',
      id: 'all-cvm-request',
      server: { pubkey: '0'.repeat(64), relays: ['wss://relay.kehto.dev'] },
      message: { jsonrpc: '2.0', id: 'mcp-1', method: 'tools/list' },
    });
    await expect.poll(() => readFixtureMessage(frame, 'cvm.request.result', 'all-cvm-request')).toMatchObject({
      message: { jsonrpc: '2.0', id: 'mcp-1', result: { echoed: true, method: 'tools/list' } },
    });

    await sendFixtureMessage(frame, { type: 'link.open', id: 'all-link-deny', url: `${targetServer.url}denied`, options: { label: 'Denied link' } });
    await sendFixtureMessage(frame, { type: 'link.open', id: 'all-link-open', url: `${targetServer.url}opened`, options: { label: 'Allowed link' } });
    await expect(page.locator('#paja-confirmation-title')).toHaveText('Open external link?');
    await expect(page.locator('#paja-confirmation-details')).toContainText('Denied link');
    await page.keyboard.press('Escape');
    await expect.poll(() => readFixtureMessage(frame, 'link.open.result', 'all-link-deny')).toMatchObject({ status: 'denied' });
    await expect(page.locator('#paja-confirmation-details')).toContainText('Allowed link');
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#paja-confirmation-approve').click();
    const popup = await popupPromise;
    await expect.poll(() => readFixtureMessage(frame, 'link.open.result', 'all-link-open')).toMatchObject({ status: 'opened' });
    expect(popup.url()).toContain('/opened');
    await popup.close();
    await expect(page.locator('#paja-confirmation-dialog')).not.toBeVisible();
  } finally {
    await completeRuntime.close();
  }
});

test('applies simulation config and compact theme adjustment', async ({ page }) => {
  test.setTimeout(60_000);
  const pubkey = '4'.repeat(64);
  const customTargetUrl = `${targetServer.url}?required=identity,resource,keys,theme`;
  const customRuntime = await startPajaServer({
    options: {
      targetUrl: customTargetUrl,
      port: 0,
      simulation: {
        identity: { mode: 'fixed', pubkey },
        relay: { mode: 'disabled' },
        capabilities: { domains: { relay: false, outbox: false } },
        theme: { mode: 'light' },
        config: { values: { density: 'compact' } },
      },
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });

  try {
    await page.goto(customRuntime.url);
    await expect(page.locator('#simulation-status')).toContainText('identity:fixed relay:off');
    await expect(page.locator('#simulation-status')).toContainText('theme:light');

    const targetFrame = page.frameLocator('#napplet-frame');
    await expect(targetFrame.locator('#target-status')).toHaveText('shell-init received');
    await expect(targetFrame.locator('#shell-init-domains')).not.toContainText('relay');
    await expect(targetFrame.locator('#shell-init-domains')).not.toContainText('outbox');
    await expect(targetFrame.locator('#identity-pubkey')).toHaveText(pubkey);
    await expect(targetFrame.locator('#config-density')).toHaveText('compact');
    await expect(targetFrame.locator('#theme-background')).toHaveText('#f7f5ed');
    await expect(targetFrame.locator('#theme-changed-count')).toHaveText('0');
    await expect(targetFrame.locator('#theme-changed-background')).toHaveText('');
    await expect(targetFrame.locator('#theme-callback-get-background')).toHaveText('');
    const themeChangedBefore = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
      .filter((entry) => entry.direction === 'shell->napplet' && entry.type === 'theme.changed').length ?? 0);
    const themeSubscriptionsBefore = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
      .filter((entry) => entry.direction === 'napplet->shell' && /^theme\.(subscribe|unsubscribe)$/.test(entry.type)).length ?? 0);

    await page.locator('#simulation-theme').selectOption('dark');
    await expect(page.locator('#simulation-status')).toContainText('theme:dark');
    await expect(targetFrame.locator('#theme-changed-count')).toHaveText('1');
    await expect(targetFrame.locator('#theme-changed-background')).toHaveText('#101211');
    await expect(targetFrame.locator('#theme-callback-get-background')).toHaveText('#101211');
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
      .filter((entry) => entry.direction === 'shell->napplet' && entry.type === 'theme.changed').length ?? 0)).toBe(themeChangedBefore + 1);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
      .filter((entry) => entry.direction === 'napplet->shell' && /^theme\.(subscribe|unsubscribe)$/.test(entry.type)).length ?? 0)).toBe(themeSubscriptionsBefore);
    const firstGeneration = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation ?? -1);
    await page.locator('#reload-target').click();
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation)).toBe(firstGeneration + 1);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
    await expect.poll(() => page.frames().some((frame) => frame.url() === 'about:srcdoc'), { timeout: 15_000 }).toBe(true);
    await expect(page.locator('#napplet-frame')).toHaveAttribute('data-target-url', customTargetUrl);
    const reloadedFrame = page.frameLocator('#napplet-frame');
    await expect(reloadedFrame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    await expect(reloadedFrame.locator('#theme-background')).toHaveText('#101211', { timeout: 15_000 });
  } finally {
    await customRuntime.close();
  }
});

test('shows error details and routes signing through NIP-07', async ({ page }) => {
  test.setTimeout(60_000);
  const pubkey = '7'.repeat(64);
  await page.addInitScript((signerPubkey) => {
    const signedEvents: unknown[] = [];
    const host = window as unknown as {
      nostr?: unknown;
      __pajaTestSignerEvents?: unknown[];
    };
    host.__pajaTestSignerEvents = signedEvents;
    host.nostr = {
      getPublicKey: async () => signerPubkey,
      getRelays: async () => ({ 'wss://relay.test': { read: true, write: true } }),
      signEvent: async (event: Record<string, unknown>) => {
        signedEvents.push(event);
        return {
          ...event,
          id: '8'.repeat(64),
          pubkey: signerPubkey,
          sig: '9'.repeat(128),
          kind: typeof event.kind === 'number' ? event.kind : 1,
          tags: Array.isArray(event.tags) ? event.tags : [],
          content: typeof event.content === 'string' ? event.content : '',
          created_at: typeof event.created_at === 'number' ? event.created_at : Math.floor(Date.now() / 1000),
        };
      },
    };
  }, pubkey);

  await page.goto(runtimeServer.url);
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');

  await expect(page.locator('#signer-status')).toContainText('NIP-07 connected');
  await expect(page.locator('#signer-status')).toContainText(pubkey);
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().signer.method)).toBe('nip07');
  await approvePajaConfirmation(page, 'Sign this Nostr event?');
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');

  const targetFrame = page.frameLocator('#napplet-frame');
  await expect(targetFrame.locator('#identity-pubkey')).toHaveText(pubkey, { timeout: 15_000 });
  await expect.poll(async () => page.evaluate(() => {
    const host = window as unknown as { __pajaTestSignerEvents?: unknown[] };
    return host.__pajaTestSignerEvents?.length ?? 0;
  })).toBeGreaterThan(0);

  await targetFrame.locator('body').evaluate(() => {
    window.parent.postMessage({
      type: 'resource.info.error',
      id: 'manual-error',
      error: 'visible boom',
    }, '*');
  });
  await page.locator('#message-filter').fill('visible boom');
  await expect(page.locator('#message-log')).toContainText('resource.info.error');
  await expect(page.locator('#message-log .log-row[data-error="true"]')).toContainText('visible boom');
});

test('routes standard identity follows and OUTBOX profile queries without a target-CORS false positive', async ({ page }) => {
  test.setTimeout(60_000);
  const accountSecret = generateSecretKey();
  const followedSecret = generateSecretKey();
  const accountPubkey = getPublicKey(accountSecret);
  const followedPubkey = getPublicKey(followedSecret);
  const contactList = finalizeEvent({
    kind: 3,
    created_at: 1_700_000_000,
    tags: [['p', followedPubkey]],
    content: '',
  }, accountSecret);
  const profile = finalizeEvent({
    kind: 0,
    created_at: 1_700_000_001,
    tags: [],
    content: JSON.stringify({ name: 'followed fixture' }),
  }, followedSecret);
  const socialRuntime = await startPajaServer({
    options: {
      targetUrl: `${targetServer.url}?manualTraffic=1`,
      port: 0,
      simulation: {
        relay: {
          mode: 'memory',
          fixtures: [contactList, profile],
        },
      },
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });

  try {
    await page.goto(socialRuntime.url);
    await expect.poll(() => targetServer.requestOrigins.includes('null')).toBe(true);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
    await page.evaluate((pubkey) => {
      const host = window as Window & { nostr?: unknown };
      host.nostr = {
        getPublicKey: async () => pubkey,
        getRelays: async () => ({ 'wss://relay.test': { read: true, write: true } }),
        signEvent: async (event: Record<string, unknown>) => ({
          ...event,
          id: '8'.repeat(64),
          pubkey,
          sig: '9'.repeat(128),
          kind: typeof event.kind === 'number' ? event.kind : 1,
          tags: Array.isArray(event.tags) ? event.tags : [],
          content: typeof event.content === 'string' ? event.content : '',
          created_at: typeof event.created_at === 'number' ? event.created_at : Math.floor(Date.now() / 1000),
        }),
      };
    }, accountPubkey);
    await page.locator('#signer-nip07').click();
    await expect(page.locator('#signer-status')).toContainText('NIP-07 connected');
    await expect(page.locator('#signer-status')).toContainText(accountPubkey);

    const corsErrorLogged = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
      .some((entry) => entry.type === 'paja.target.cors.error') ?? false);
    expect(corsErrorLogged).toBe(false);

    const frame = page.frameLocator('#napplet-frame');
    await expect(frame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    await sendFixtureMessage(frame, { type: 'identity.getPublicKey', id: 'social-pubkey' });
    await expect.poll(() => readFixtureMessage(frame, 'identity.getPublicKey.result', 'social-pubkey')).toMatchObject({
      pubkey: accountPubkey,
    });

    await sendFixtureMessage(frame, { type: 'identity.getFollows', id: 'social-follows' });
    await expect.poll(() => readFixtureMessage(frame, 'identity.getFollows.result', 'social-follows')).toMatchObject({
      pubkeys: [followedPubkey],
    });

    await sendFixtureMessage(frame, {
      type: 'outbox.query',
      id: 'social-profile',
      filters: [{ kinds: [0], authors: [followedPubkey] }],
      options: { authors: [followedPubkey] },
    });
    await expect.poll(() => readFixtureMessage(frame, 'outbox.query.result', 'social-profile')).toMatchObject({
      events: [expect.objectContaining({ event: expect.objectContaining({ id: profile.id, kind: 0 }) })],
    });
  } finally {
    await socialRuntime.close();
  }
});

test('stores disclosed bytes through a signed Blossom upload and fails closed on denial or incomplete proof', async ({ page }) => {
  test.setTimeout(60_000);
  const blossom = await startBlossomServer();
  const uploadTargetUrl = `${targetServer.url}?required=upload&manualTraffic=1`;
  const uploadRuntime = await startPajaServer({
    options: {
      targetUrl: uploadTargetUrl,
      port: 0,
      simulation: {
        relay: { mode: 'disabled' },
        capabilities: { domains: { relay: false, outbox: false } },
        upload: {
          mode: 'blossom',
          servers: [blossom.url],
          maxBytes: 1024,
          mimeTypes: ['application/octet-stream'],
        },
      },
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });
  let putsBeforeConsent = 0;

  try {
    await page.goto(uploadRuntime.url);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
    await page.locator('#signer-dev').click();
    await expect(page.locator('#signer-status')).toContainText('dev connected');
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');

    const frame = page.frameLocator('#napplet-frame');
    await expect(frame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    await sendFixtureMessage(frame, { type: 'upload.info', id: 'info-1' });
    await expect.poll(() => readFixtureMessage(frame, 'upload.info.result', 'info-1')).toMatchObject({
      info: {
        rails: [{ rail: 'blossom', enabled: true, returns: ['http'] }],
        maxBytes: 1024,
        mimeTypes: ['application/octet-stream'],
      },
    });
    expect(blossom.requestMethods).toEqual([]);

    const bytes = [0, 1, 2, 3, 254, 255];
    const expectedSha = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    await sendUploadMessage(frame, 'real-upload', bytes);
    await expectUploadConfirmation(page, blossom, putsBeforeConsent);
    await page.locator('#paja-confirmation-approve').click();
    await approvePajaConfirmation(page, 'Sign this Nostr event?');
    await expect.poll(() => readFixtureMessage(frame, 'upload.upload.result', 'real-upload')).toMatchObject({
      result: {
        ok: true,
        status: 'complete',
        rail: 'blossom',
        url: `${blossom.url}/${expectedSha}`,
        sha256: expectedSha,
        size: bytes.length,
        mimeType: 'application/octet-stream',
        nip94: [
          ['url', `${blossom.url}/${expectedSha}`],
          ['m', 'application/octet-stream'],
          ['x', expectedSha],
          ['size', String(bytes.length)],
        ],
      },
    });
    expect(blossom.puts).toHaveLength(1);
    expect([...blossom.puts[0]!.bytes]).toEqual(bytes);
    expect(blossom.puts[0]!.contentType).toBe('application/octet-stream');
    const authEvent = decodeNostrAuthorization(blossom.puts[0]!.authorization);
    expect(verifyEvent(authEvent as Parameters<typeof verifyEvent>[0])).toBe(true);
    expect(authEvent.kind).toBe(24_242);
    expect(authEvent.tags).toContainEqual(['t', 'upload']);
    expect(authEvent.tags).toContainEqual(['x', expectedSha]);
    expect(Number(authEvent.tags.find((tag) => tag[0] === 'expiration')?.[1])).toBeGreaterThan(authEvent.created_at);

    putsBeforeConsent = 1;
    await sendUploadMessage(frame, 'denied-upload', [9, 9]);
    await expectUploadConfirmation(page, blossom, putsBeforeConsent);
    await page.keyboard.press('Escape');
    await expect.poll(() => readFixtureMessage(frame, 'upload.upload.result', 'denied-upload')).toMatchObject({
      result: { ok: false, status: 'cancelled', error: 'user cancelled' },
    });
    expect(blossom.puts).toHaveLength(1);

    blossom.omitSizeOnce();
    await sendUploadMessage(frame, 'missing-size', [7, 8, 9]);
    await expectUploadConfirmation(page, blossom, putsBeforeConsent);
    await page.locator('#paja-confirmation-approve').click();
    await approvePajaConfirmation(page, 'Sign this Nostr event?');
    await expect.poll(() => readFixtureMessage(frame, 'upload.upload.result', 'missing-size')).toMatchObject({
      result: { ok: false, status: 'failed', error: 'server returned invalid size' },
    });
    expect(blossom.puts).toHaveLength(2);
    await expect(page.locator('#paja-confirmation-dialog')).not.toBeVisible();
  } finally {
    await uploadRuntime.close();
    await blossom.close();
  }
});

test('boots modern injected-domain targets through mandatory NAP-SHELL', async ({ page }) => {
  test.setTimeout(60_000);
  const modernRuntime = await startPajaServer({
    options: {
      targetUrl: `${targetServer.url}?shellReady=0&required=identity,keys`,
      port: 0,
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });

  try {
    await page.goto(modernRuntime.url);

    const targetFrame = page.frameLocator('#napplet-frame');
    await expect(targetFrame.locator('#injected-domains')).toHaveText('identity,keys');
    await expect.poll(async () => targetFrame.locator('body').evaluate(() => {
      const shell = (window as Window & {
        napplet?: { shell?: Record<string, unknown> };
      }).napplet?.shell;
      return typeof shell?.ready === 'function'
        && typeof shell.supports === 'function'
        && typeof shell.onReady === 'function'
        && Array.isArray(shell.services);
    })).toBe(true);
    await expect(targetFrame.locator('#target-status')).toHaveText('napplet namespace ready', { timeout: 15_000 });
    await expect(targetFrame.locator('#identity-pubkey')).toHaveText('');
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');

    const state = await page.evaluate(() => window.__KEHTO_PAJA__?.getState());
    expect(state).toMatchObject({
      status: 'ready',
      initSent: true,
    });
  } finally {
    await modernRuntime.close();
  }
});

test('keeps canonical INC protected through the real shim assignment in an opaque Paja srcdoc', async ({ page }) => {
  test.setTimeout(120_000);
  const incRuntime = await startPajaServer({
    options: {
      targetUrl: `${targetServer.url}?incProbe=1`,
      port: 0,
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });

  try {
    await page.goto(incRuntime.url);
    const frame = page.frameLocator('#napplet-frame');
    await expect(frame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    await expect(frame.locator('#inc-shim-status')).toHaveText('protected callable');
    await expect(frame.locator('#inc-emit-topic')).toHaveText('napplet:phase102/probe');
    await expect(frame.locator('#inc-emit-payload')).toHaveText('{"value":"a b","plus":"a+b"}');
    await expect(frame.locator('#inc-emit-return')).toHaveText('undefined');
    await expect(frame.locator('#inc-channel-list')).toHaveText('empty');
    await expect(frame.locator('#inc-channel-open')).toHaveText('target not found');
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
      .filter((entry) => entry.type === 'inc.emit')
      .map((entry) => entry.preview) ?? [])).toEqual([
      '{"type":"inc.emit","topic":"napplet:phase102/probe","payload":{"value":"a b","plus":"a+b"}}',
    ]);

    await sendIncEvent(page, { value: 'delivered' });
    await expect(frame.locator('#inc-event')).toHaveText('napplet:phase102/probe|paja-parent|{"value":"delivered"}');
    await expect(frame.locator('#inc-callback-count')).toHaveText('1');

    const firstLoadId = await frame.locator('#load-id').textContent();
    const firstGeneration = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation ?? -1);
    await page.locator('#reload-target').click();
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation)).toBe(firstGeneration + 1);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
    const reloadedFrame = page.frameLocator('#napplet-frame');
    await expect(reloadedFrame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    expect(await reloadedFrame.locator('#load-id').textContent()).not.toBe(firstLoadId);
    await expect(reloadedFrame.locator('#inc-shim-status')).toHaveText('protected callable');
    await expect(reloadedFrame.locator('#inc-callback-count')).toHaveText('0');

    await sendIncEvent(page, { value: 'fresh' });
    await expect(reloadedFrame.locator('#inc-event')).toHaveText('napplet:phase102/probe|paja-parent|{"value":"fresh"}');
    await expect(reloadedFrame.locator('#inc-callback-count')).toHaveText('1');
  } finally {
    await incRuntime.close();
  }
});

async function startTargetServer(): Promise<TargetServer> {
  let loadCount = 0;
  const requestOrigins: string[] = [];
  const server = createServer((request, response) => {
    requestOrigins.push(typeof request.headers.origin === 'string' ? request.headers.origin : '');
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (requestUrl.pathname === '/shim-prelude.js') {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'text/javascript; charset=utf-8',
      });
      response.end(shimPrelude);
      return;
    }
    if (requestUrl.pathname !== '/') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    loadCount += 1;
    response.writeHead(200, {
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(renderTargetHtml(loadCount, {
      requiredDomains: readRequiredDomains(requestUrl),
      shellReady: requestUrl.searchParams.get('shellReady') !== '0',
      manualTraffic: requestUrl.searchParams.get('manualTraffic') === '1',
      incProbe: requestUrl.searchParams.get('incProbe') === '1',
    }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Target server did not bind to a TCP port.');
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    requestOrigins,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
  };
}

function readRequiredDomains(url: URL): string[] {
  const raw = url.searchParams.get('required');
  if (!raw) return ['identity', 'outbox', 'resource', 'keys'];
  return raw.split(',').map((domain) => domain.trim()).filter(Boolean);
}

function renderTargetHtml(
  loadCount: number,
  options: { requiredDomains: readonly string[]; shellReady: boolean; manualTraffic: boolean; incProbe: boolean },
): string {
  const requiredDomainsJson = JSON.stringify(options.requiredDomains);
  const shellReadyJson = JSON.stringify(options.shellReady);
  const manualTrafficJson = JSON.stringify(options.manualTraffic);
  const incProbeJson = JSON.stringify(options.incProbe);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Kehto Paja fixture</title>
  </head>
  <body>
    <div id="target-status">booting</div>
    <div id="injected-domains"></div>
    <div id="load-id">${loadCount}</div>
    <div id="shell-init-type"></div>
    <div id="shell-init-domains"></div>
    <div id="service-results"></div>
    <div id="identity-pubkey"></div>
    <div id="config-density"></div>
    <div id="theme-background"></div>
    <div id="theme-changed-count">0</div>
    <div id="theme-changed-background"></div>
    <div id="theme-callback-get-background"></div>
    <div id="storage-error"></div>
    <div id="inc-shim-status"></div>
    <div id="inc-emit-topic"></div>
    <div id="inc-emit-payload"></div>
    <div id="inc-emit-return"></div>
    <div id="inc-event"></div>
    <div id="inc-callback-count"></div>
    <div id="inc-channel-list"></div>
    <div id="inc-channel-open"></div>
    ${options.incProbe ? `<script src="/shim-prelude.js"></script>
    <script>window.NappletShimPrelude.install({ domains: ${requiredDomainsJson} });</script>` : ''}
    <script>
      const seenTypes = new Set();
      const pajaTestMessages = [];
      window.__pajaTestMessages = pajaTestMessages;
      window.__sendPajaMessage = (message) => window.parent.postMessage(message, '*');
      const serviceResults = document.getElementById('service-results');
      const requiredDomains = ${requiredDomainsJson};
      const injectedDomains = requiredDomains.filter((domain) =>
        window.napplet && typeof window.napplet[domain] === 'object'
      );
      document.getElementById('injected-domains').textContent = injectedDomains.join(',');
      if (injectedDomains.length !== requiredDomains.length) {
        document.getElementById('target-status').textContent = 'Required shell domains unavailable';
        throw new Error('Required shell domains unavailable');
      }
      const theme = window.napplet && window.napplet.theme;
      let themeChangedCount = 0;
      if (theme && typeof theme.onChanged === 'function' && typeof theme.get === 'function') {
        theme.onChanged((changedTheme) => {
          themeChangedCount += 1;
          document.getElementById('theme-changed-count').textContent = String(themeChangedCount);
          document.getElementById('theme-changed-background').textContent = changedTheme && changedTheme.colors && changedTheme.colors.background || '';
          void theme.get().then((currentTheme) => {
            document.getElementById('theme-callback-get-background').textContent = currentTheme && currentTheme.colors && currentTheme.colors.background || '';
          });
        });
      }
      const sendShellReady = ${shellReadyJson};
      const incProbe = ${incProbeJson};
      let incCallbackCount = 0;
      function runIncProbe() {
        const inc = window.napplet && window.napplet.inc;
        const protectedInc = inc
          && typeof inc.emit === 'function'
          && typeof inc.on === 'function'
          && inc.channel
          && typeof inc.channel.list === 'function'
          && typeof inc.channel.open === 'function';
        document.getElementById('inc-shim-status').textContent = protectedInc ? 'protected callable' : 'missing protected INC';
        if (!protectedInc) return;
        inc.on('napplet:phase102/probe', (event) => {
          incCallbackCount += 1;
          document.getElementById('inc-event').textContent = [event.topic, event.sender, JSON.stringify(event.payload)].join('|');
          document.getElementById('inc-callback-count').textContent = String(incCallbackCount);
        });
        const emitResult = inc.emit('napplet:phase102/probe?value=a%20b&plus=a+b');
        document.getElementById('inc-emit-topic').textContent = 'napplet:phase102/probe';
        document.getElementById('inc-emit-payload').textContent = '{"value":"a b","plus":"a+b"}';
        document.getElementById('inc-emit-return').textContent = String(emitResult);
        document.getElementById('inc-callback-count').textContent = String(incCallbackCount);
        void inc.channel.list().then((channels) => {
          document.getElementById('inc-channel-list').textContent = channels.length === 0 ? 'empty' : 'unexpected channels';
        });
        void inc.channel.open('missing-paja-peer').then(
          () => { document.getElementById('inc-channel-open').textContent = 'unexpected open'; },
          (error) => { document.getElementById('inc-channel-open').textContent = error instanceof Error ? error.message : String(error); },
        );
      }
      function renderResult(message) {
        pajaTestMessages.push(message);
        const type = message.type;
        seenTypes.add(type);
        serviceResults.textContent = Array.from(seenTypes).sort().join(',');
        if (type === 'identity.getPublicKey.result') {
          document.getElementById('identity-pubkey').textContent = message.pubkey || '';
        }
        if (type === 'config.values') {
          document.getElementById('config-density').textContent = message.values && message.values.density || '';
        }
        if (type === 'theme.get.result') {
          document.getElementById('theme-background').textContent = message.theme && message.theme.colors && message.theme.colors.background || '';
        }
        if (type === 'storage.set.result') {
          document.getElementById('storage-error').textContent = message.error || '';
        }
      }
      function sendServiceTraffic() {
        const bytes = new TextEncoder().encode('kehto-paja').buffer;
        const messages = [
          { type: 'storage.set', id: 'storage-1', key: 'phase', value: '92' },
          { type: 'config.get', id: 'config-1' },
          { type: 'theme.get', id: 'theme-1' },
          { type: 'notify.send', id: 'notify-1', title: 'hello from fixture' },
          { type: 'identity.getPublicKey', id: 'identity-1' },
          { type: 'upload.upload', id: 'upload-1', request: { data: bytes, mimeType: 'text/plain', filename: 'paja.txt' } },
          { type: 'intent.available', id: 'intent-1', archetype: 'paja-target' },
          { type: 'cvm.discover', id: 'cvm-1' },
          { type: 'outbox.publish', id: 'outbox-1', event: { kind: 1, content: 'hello from paja fixture', tags: [] } },
        ];
        for (const message of messages) window.parent.postMessage(message, '*');
      }
      let shellInitialized = false;
      function handleShellInit(environment) {
        if (shellInitialized) return;
        shellInitialized = true;
        document.getElementById('shell-init-type').textContent = 'shell.init';
        document.getElementById('shell-init-domains').textContent = environment.capabilities.domains.join(',');
        document.getElementById('target-status').textContent = 'shell-init received';
        if (!${manualTrafficJson}) sendServiceTraffic();
        if (incProbe) runIncProbe();
      }
      if (sendShellReady) {
        window.addEventListener('message', (event) => {
          if (!event.data || typeof event.data.type !== 'string') return;
          if (event.data.type === 'shell.init') {
            handleShellInit(event.data);
            return;
          }
          renderResult(event.data);
        });
        if (incProbe) window.napplet.shell.onReady(handleShellInit);
        window.parent.postMessage({ type: 'shell.ready' }, '*');
      } else {
        window.napplet.identity.getPublicKey()
          .then((pubkey) => {
            document.getElementById('identity-pubkey').textContent = pubkey || '';
            document.getElementById('target-status').textContent = 'napplet namespace ready';
          })
          .catch((error) => {
            document.getElementById('target-status').textContent = error instanceof Error ? error.message : String(error);
          });
      }
    </script>
  </body>
</html>`;
}

async function sendFixtureMessage(frame: FrameLocator, message: Record<string, unknown>): Promise<void> {
  await frame.locator('body').evaluate((_body, payload) => {
    const fixtureWindow = window as Window & {
      __sendPajaMessage?: (message: Record<string, unknown>) => void;
    };
    fixtureWindow.__sendPajaMessage?.(payload);
  }, message);
}

async function sendIncEvent(page: Page, payload: Record<string, unknown>): Promise<void> {
  await page.locator('#napplet-frame').evaluate((frame, eventPayload) => {
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('Missing Paja iframe.');
    frame.contentWindow?.postMessage({
      type: 'inc.event',
      topic: 'napplet:phase102/probe',
      sender: 'paja-parent',
      payload: eventPayload,
    }, '*');
  }, payload);
}

async function sendUploadMessage(frame: FrameLocator, id: string, bytes: number[]): Promise<void> {
  await frame.locator('body').evaluate((_body, payload) => {
    const fixtureWindow = window as Window & {
      __sendPajaMessage?: (message: Record<string, unknown>) => void;
    };
    fixtureWindow.__sendPajaMessage?.({
      type: 'upload.upload',
      id: payload.id,
      request: {
        data: new Uint8Array(payload.bytes).buffer,
        filename: `${payload.id}.bin`,
        mimeType: 'application/octet-stream',
      },
    });
  }, { id, bytes });
}

async function readFixtureMessage(
  frame: FrameLocator,
  type: string,
  id: string,
  idField = 'id',
): Promise<Record<string, unknown> | null> {
  return frame.locator('body').evaluate((_body, expected) => {
    const messages = (window as Window & {
      __pajaTestMessages?: Array<Record<string, unknown>>;
    }).__pajaTestMessages ?? [];
    const readPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, value);
    return messages.find((message) => message.type === expected.type && readPath(message, expected.idField) === expected.id) ?? null;
  }, { type, id, idField });
}

async function readNestedString(
  frame: FrameLocator,
  type: string,
  id: string,
  path: string[],
): Promise<string> {
  const value = await frame.locator('body').evaluate((_body, expected) => {
    const messages = (window as Window & {
      __pajaTestMessages?: Array<Record<string, unknown>>;
    }).__pajaTestMessages ?? [];
    const message = messages.find((candidate) => candidate.type === expected.type && candidate.id === expected.id);
    return expected.path.reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, message);
  }, { type, id, path });
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing ${path.join('.')} in ${type} (${id}).`);
  }
  return value;
}

async function approvePajaConfirmation(page: Page, title: string): Promise<void> {
  const dialog = page.locator('#paja-confirmation-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#paja-confirmation-title')).toHaveText(title);
  await page.locator('#paja-confirmation-approve').click();
}

async function expectUploadConfirmation(
  page: Page,
  blossom: BlossomTestServer,
  putsBeforeConsent: number,
): Promise<void> {
  await expect(page.locator('#paja-confirmation-dialog')).toBeVisible();
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Upload this file?');
  await expect(page.locator('#paja-confirmation-summary')).toContainText('dev-target');
  const details = page.locator('#paja-confirmation-details');
  await expect(details).toContainText('application/octet-stream');
  await expect(details).toContainText(blossom.url);
  await expect(details).toContainText('public and durable');
  expect(blossom.puts).toHaveLength(putsBeforeConsent);
}

function decodeNostrAuthorization(value: string): {
  readonly kind: number;
  readonly created_at: number;
  readonly tags: string[][];
  readonly [key: string]: unknown;
} {
  expect(value).toMatch(/^Nostr /);
  return JSON.parse(Buffer.from(value.slice('Nostr '.length), 'base64').toString('utf8')) as {
    kind: number;
    created_at: number;
    tags: string[][];
  };
}

async function startBlossomServer(): Promise<BlossomTestServer> {
  const puts: BlossomPut[] = [];
  const requestMethods: string[] = [];
  let omitSize = false;
  let url = '';
  const server = createServer((request, response) => {
    requestMethods.push(request.method ?? 'UNKNOWN');
    response.setHeader('access-control-allow-origin', '*');
    response.setHeader('access-control-allow-methods', 'PUT, OPTIONS');
    response.setHeader('access-control-allow-headers', 'authorization, content-type');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== 'PUT' || request.url !== '/upload') {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
      return;
    }
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const bytes = Buffer.concat(chunks);
      const authorization = String(request.headers.authorization ?? '');
      const contentType = String(request.headers['content-type'] ?? '');
      puts.push({ bytes, authorization, contentType });
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const descriptor = {
        url: `${url}/${sha256}`,
        sha256,
        ...(!omitSize ? { size: bytes.byteLength } : {}),
        type: contentType,
      };
      omitSize = false;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(descriptor));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Blossom server did not bind to a TCP port.');
  }
  url = `http://127.0.0.1:${address.port}`;
  return {
    url,
    puts,
    requestMethods,
    omitSizeOnce() {
      omitSize = true;
    },
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
  };
}

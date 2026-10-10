import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { expect, test, type Page } from '@playwright/test';
import { NAPPLET_KIND_NAMED } from '../../packages/nip/dist/5d/index.js';
import { finalizeEvent } from 'nostr-tools/pure';
import { naddrEncode } from 'nostr-tools/nip19';
import {
  createPajaRuntimeHostConfig,
  normalizePajaSimulation,
  renderPajaHtml,
  type PajaHostConfig,
} from '../../packages/paja/dist/index.js';

const RELAY = 'wss://intent-links-fixture.example';
const LAUNCHER_CATALOG_ID = 'nip5d:35129:24653eac434488002cc06bbfb7f10fe18991e35f9fe4302dbea6d2353dc0ab1c:paja-intent-launcher';
const TEST_KEY = Uint8Array.from('44'.repeat(32).match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));

interface PointerServer {
  readonly url: string;
  readonly blobs: Map<string, Buffer>;
  setConfig(config: PajaHostConfig): void;
  close(): Promise<void>;
}

interface SignedTarget {
  readonly event: ReturnType<typeof finalizeEvent>;
  readonly pointer: string;
  readonly hash: string;
  readonly bytes: Buffer;
}

test.describe('Paja intent links', () => {
  test('builds a link from a verified tab and delivers its copied JSON link after fresh navigation', async ({ browser }) => {
    test.setTimeout(60_000);
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'builder-target', delayedTargetHtml(), 'napplet:profile/open', ['subject', 'note']);
    server.blobs.set(target.hash, target.bytes);
    const context = await browser.newContext({ viewport: { width: 375, height: 720 } });
    const builderPage = await context.newPage();
    await configureRuntime(builderPage, server, [target.event], target.pointer);

    try {
      await builderPage.goto(server.url);
      await expect.poll(() => builderPage.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs[0]?.status)).toBe('ready');
      const create = builderPage.getByRole('button', { name: 'Create intent link for builder-target' });
      await expect(create).toBeVisible();
      await create.click();
      const builder = builderPage.getByRole('dialog', { name: 'Create intent link' });
      await expect(builder).toBeVisible();
      await expect(builder.getByLabel('Convention')).toHaveValue('napplet:profile/open');
      await builder.getByLabel('Routing').selectOption('exact');
      await builder.getByLabel('Payload mode').selectOption('json');
      await builder.getByRole('textbox', { name: 'JSON payload' }).fill('{"value":null,"items":[1,"two"]}');
      await expect(builder.locator('output')).toHaveText('napplet:profile/open');
      await builder.getByRole('button', { name: 'Copy link' }).click();
      await expect(builder.locator('[role="status"]')).toContainText(/Link copied|Copy the selected link/);
      const copied = await builder.getByLabel('Copyable URL').inputValue();
      expect(copied).toContain('intent=napplet%3Aprofile%2Fopen');
      expect(copied).toContain('naddr=');
      expect(copied).toContain('payload=');

      await builderPage.keyboard.press('Escape');
      await expect(builder).toBeHidden();
      await expect(create).toBeFocused();

      // This second document has no pointer startup. The copied intent alone
      // opens a review, then the user explicitly launches it.
      const incomingPage = await context.newPage();
      await configureRuntime(incomingPage, server, [target.event]);
      await incomingPage.goto(copied);
      const review = incomingPage.getByRole('dialog', { name: 'Review intent link' });
      await expect(review).toBeVisible();
      await expect(incomingPage.locator('iframe')).toHaveCount(0);
      await review.getByRole('button', { name: 'Launch' }).click();
      await expect(incomingPage.frameLocator('iframe').locator('#delivery-count')).toHaveText('1', { timeout: 15_000 });
      await expect(incomingPage.frameLocator('iframe').locator('#delivery-payload')).toHaveText('{"value":null,"items":[1,"two"]}');
    } finally {
      await context.close();
      await server.close();
    }
  });

  test('reuses a warm verified handler without replaying or opening a second target tab', async ({ page }) => {
    test.setTimeout(45_000);
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'warm-target', delayedTargetHtml(), 'napplet:profile/open', []);
    server.blobs.set(target.hash, target.bytes);
    await configureRuntime(page, server, [target.event], target.pointer);

    try {
      await page.goto(server.url);
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs[0]?.status)).toBe('ready');
      const create = page.getByRole('button', { name: 'Create intent link for warm-target' });
      for (const [value, count] of [[1, 1], [2, 2]] as const) {
        await create.click();
        const builder = page.getByRole('dialog', { name: 'Create intent link' });
        await builder.getByLabel('Routing').selectOption('exact');
        await builder.getByLabel('Payload mode').selectOption('json');
        await builder.getByRole('textbox', { name: 'JSON payload' }).fill(JSON.stringify({ value }));
        await builder.getByRole('button', { name: 'Test intent' }).click();
        const review = page.getByRole('dialog', { name: 'Review intent link' });
        await expect(review).toBeVisible();
        await review.getByRole('button', { name: 'Launch' }).click();
        await expect(page.frameLocator('iframe').locator('#delivery-count')).toHaveText(String(count), { timeout: 15_000 });
        await expect(page.frameLocator('iframe').locator('#delivery-payload')).toHaveText(JSON.stringify({ value }));
        await expect(page.locator('iframe')).toHaveCount(1);
        await review.getByRole('button', { name: 'Cancel' }).click();
        await expect(review).toBeHidden();
      }
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
        .filter((entry) => entry.type === 'intent.deliver').length)).toBe(2);
    } finally {
      await server.close();
    }
  });

  test('hydrates saved handler facts without running tabs, then lets a saved default beat a recommendation', async ({ browser }) => {
    test.setTimeout(60_000);
    const server = await startIntentServer();
    const defaultTarget = createSignedTarget(server.url, 'default-target', delayedTargetHtml('default'), 'napplet:profile/open', []);
    const recommendedTarget = createSignedTarget(server.url, 'recommended-target', delayedTargetHtml('recommended'), 'napplet:profile/open', []);
    server.blobs.set(defaultTarget.hash, defaultTarget.bytes);
    server.blobs.set(recommendedTarget.hash, recommendedTarget.bytes);
    const context = await browser.newContext();
    const setup = await context.newPage();
    await configureRuntime(setup, server, [defaultTarget.event, recommendedTarget.event]);

    try {
      await setup.goto(server.url);
      await expect.poll(() => setup.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
      await setup.evaluate(async ([defaultPointer, recommendedPointer]) => {
        await window.__KEHTO_PAJA__!.loadPointer(defaultPointer);
        await window.__KEHTO_PAJA__!.loadPointer(recommendedPointer);
      }, [defaultTarget.pointer, recommendedTarget.pointer]);
      await expect.poll(() => setup.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs.length)).toBe(2);

      // Saving a default requires an explicit compatible-handler selection.
      await setup.getByRole('button', { name: 'Create intent link for default-target' }).click();
      let builder = setup.getByRole('dialog', { name: 'Create intent link' });
      await builder.getByRole('button', { name: 'Test intent' }).click();
      let review = setup.getByRole('dialog', { name: 'Review intent link' });
      await review.getByRole('button', { name: 'Launch' }).click();
      await expect(review.getByLabel('Compatible handler')).toBeEnabled();
      await review.getByLabel('Compatible handler').selectOption({ label: 'default-target' });
      await review.getByLabel('Set as my default for this role').check();
      await review.getByRole('button', { name: 'Use handler' }).click();
      await expect(setup.frameLocator('iframe[title="Napplet runtime target: default-target"]').locator('#delivery-target')).toHaveText('default', { timeout: 15_000 });
      await review.getByRole('button', { name: 'Cancel' }).click();

      // The recommendation link is also created from a verified current manifest.
      await setup.getByRole('button', { name: 'Create intent link for recommended-target' }).click();
      builder = setup.getByRole('dialog', { name: 'Create intent link' });
      await builder.getByLabel('Routing').selectOption('recommend');
      const recommendedLink = await builder.getByLabel('Copyable URL').inputValue();
      expect(recommendedLink).toContain('%23naddr');
      await builder.getByRole('button', { name: 'Cancel' }).click();

      const incoming = await context.newPage();
      await configureRuntime(incoming, server, [defaultTarget.event, recommendedTarget.event]);
      const recommendationPrompts: string[] = [];
      incoming.on('dialog', (dialog) => {
        recommendationPrompts.push(dialog.message());
        void dialog.dismiss();
      });
      await incoming.goto(recommendedLink);
      review = incoming.getByRole('dialog', { name: 'Review intent link' });
      await expect(review).toBeVisible();
      // Incoming boot only hydrates saved verified catalog facts; it does not run
      // either saved tab before the explicit Launch.
      await expect(incoming.locator('iframe')).toHaveCount(0);
      await review.getByRole('button', { name: 'Launch' }).click();
      await expect(incoming.frameLocator('iframe').locator('#delivery-target')).toHaveText('default', { timeout: 15_000 });
      expect(recommendationPrompts).toEqual([]);
    } finally {
      await context.close();
      await server.close();
    }
  });

  test('reviews a signed exact link, accepts through the ephemeral launcher, and retains delayed delivery after launcher teardown', async ({ page }) => {
    test.setTimeout(60_000);
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'profile-target', delayedTargetHtml(), 'napplet:profile/open', ['subject', 'note']);
    server.blobs.set(target.hash, target.bytes);
    await configureRuntime(page, server, [target.event]);
    const incoming = intentHref(server.url, target.pointer, { answer: null, list: [1, true], text: 'kept' });

    try {
      await page.goto(incoming);
      const review = page.getByRole('dialog', { name: 'Review intent link' });
      await expect(review).toBeVisible();
      await expect(page.locator('#paja-intent-link-target')).toContainText('names one verified target');
      await expect(page.locator('iframe')).toHaveCount(0);

      await expect(page.locator('#paja-intent-link-status')).toHaveText('Review the URI and payload, then explicitly launch.');
      await review.getByRole('button', { name: 'Launch' }).click();
      await expect(page.frameLocator('iframe').locator('#delivery-count')).toHaveText('1', { timeout: 15_000 });
      await expect(page.frameLocator('iframe').locator('#delivery-payload')).toHaveText('{"answer":null,"list":[1,true],"text":"kept"}');
      await expect(page.frameLocator('iframe').locator('#delivery-sender')).toHaveText(LAUNCHER_CATALOG_ID);
      await expect(page.locator('iframe')).toHaveCount(1);
      await expect(page.locator('#paja-intent-link-status')).toContainText('Delivered to the verified target.');

      // An outer page is not a registered napplet/launcher window. Its forged invoke
      // message must not acquire the launcher identity or create a second delivery.
      await page.evaluate(() => window.postMessage({
        type: 'intent.invoke',
        id: 'forged-outer-window',
        request: { archetype: 'profile', action: 'open', convention: 'napplet:profile/open' },
      }, '*'));
      await expect(page.frameLocator('iframe').locator('#delivery-count')).toHaveText('1');
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
        .filter((entry) => entry.type === 'intent.deliver').length)).toBe(1);

      // Reloading an incoming link returns to review. It must never replay the
      // already accepted navigation merely because a tab snapshot exists.
      await page.reload();
      await expect(page.getByRole('dialog', { name: 'Review intent link' })).toBeVisible();
      await expect(page.locator('iframe')).toHaveCount(0);
      await page.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      await server.close();
    }
  });

  test('does not invoke on cancel, and an exact target mismatch stays failed until the user deliberately changes routing', async ({ page }) => {
    test.setTimeout(45_000);
    const server = await startIntentServer();
    const incompatible = createSignedTarget(server.url, 'incompatible-profile', delayedTargetHtml(), 'napplet:profile/view', ['subject']);
    server.blobs.set(incompatible.hash, incompatible.bytes);
    await configureRuntime(page, server, [incompatible.event]);

    try {
      await page.goto(intentHref(server.url, incompatible.pointer, { subject: 'cancelled' }));
      const review = page.getByRole('dialog', { name: 'Review intent link' });
      await expect(review).toBeVisible();
      await review.getByRole('button', { name: 'Cancel' }).click();
      await expect(review).toBeHidden();
      await expect(page.locator('iframe')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
        .filter((entry) => entry.type === 'intent.deliver').length)).toBe(0);

      await page.goto(intentHref(server.url, incompatible.pointer, { subject: 'mismatch' }));
      await expect(review).toBeVisible();
      await review.getByRole('button', { name: 'Launch' }).click();
      await expect(page.locator('#paja-intent-link-status')).toContainText('does not advertise this exact intent convention');
      await expect(page.locator('iframe')).toHaveCount(0);
      await review.getByRole('button', { name: 'Retry' }).click();
      await expect(page.locator('#paja-intent-link-status')).toContainText('does not advertise this exact intent convention');
      await review.getByRole('button', { name: 'Choose another' }).click();
      await expect(page.locator('#paja-intent-link-target')).toContainText('saved default, recommendation, or ask you to choose');
      await expect(page.locator('iframe')).toHaveCount(0);
    } finally {
      await server.close();
    }
  });

  for (const [label, payload] of [
    ['primitive', false],
    ['null', null],
    ['array', ['one', 2, null]],
  ] as const) {
    test(`preserves a ${label} JSON payload across review and delivery`, async ({ page }) => {
      test.setTimeout(45_000);
      const server = await startIntentServer();
      const target = createSignedTarget(server.url, `payload-${label}`, delayedTargetHtml(), 'napplet:profile/open', []);
      server.blobs.set(target.hash, target.bytes);
      await configureRuntime(page, server, [target.event]);

      try {
        await page.goto(intentHref(server.url, target.pointer, payload));
        await page.getByRole('dialog', { name: 'Review intent link' }).getByRole('button', { name: 'Launch' }).click();
        await expect(page.frameLocator('iframe').locator('#delivery-count')).toHaveText('1', { timeout: 15_000 });
        await expect(page.frameLocator('iframe').locator('#delivery-payload')).toHaveText(JSON.stringify(payload));
      } finally {
        await server.close();
      }
    });
  }
});

async function configureRuntime(
  page: Page,
  server: PointerServer,
  events: readonly ReturnType<typeof finalizeEvent>[],
  pointer?: string,
): Promise<void> {
  server.setConfig({
    ...createPajaRuntimeHostConfig({ maxWaitMs: 2_000, ...(pointer === undefined ? {} : { pointer }) }),
    simulation: normalizePajaSimulation({ relay: { mode: 'live', urls: [RELAY] } }),
  });
  await page.routeWebSocket(`${RELAY}/`, (socket) => {
    socket.onMessage((message) => {
      const request = JSON.parse(String(message)) as unknown[];
      if (request[0] !== 'REQ' || typeof request[1] !== 'string') return;
      for (const event of events) socket.send(JSON.stringify(['EVENT', request[1], event]));
      socket.send(JSON.stringify(['EOSE', request[1]]));
    });
  });
}

function intentHref(base: string, pointer: string, payload: unknown): string {
  return `${base}?intent=${encodeURIComponent('napplet:profile/open')}`
    + `&naddr=${encodeURIComponent(pointer)}&payload=${encodeURIComponent(JSON.stringify(payload))}`;
}

function createSignedTarget(
  serverUrl: string,
  dTag: string,
  html: string,
  convention: string,
  parameters: readonly string[],
): SignedTarget {
  const bytes = Buffer.from(html);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const event = finalizeEvent({
    kind: NAPPLET_KIND_NAMED,
    created_at: 1_760_000_000,
    content: `Verified ${dTag} target`,
    tags: [
      ['d', dTag],
      ['x', hash],
      ['server', `${serverUrl}blossom`],
      ['R', 'intent'],
      ['z', 'profile'],
      ['i', convention, ...parameters],
      ['title', dTag],
    ],
  }, TEST_KEY);
  return {
    event,
    pointer: naddrEncode({ identifier: dTag, pubkey: event.pubkey, kind: NAPPLET_KIND_NAMED, relays: [RELAY] }),
    hash,
    bytes,
  };
}

function delayedTargetHtml(label = ''): string {
  return `<!doctype html><html><body>
    <output id="delivery-count">0</output><output id="delivery-payload"></output><output id="delivery-sender"></output><output id="delivery-target">${label}</output>
    <script>
      let count = 0;
      window.parent.postMessage({ type: 'shell.ready' }, '*');
      setTimeout(() => window.napplet.intent.onDelivery((delivery) => {
        count += 1;
        document.getElementById('delivery-count').textContent = String(count);
        document.getElementById('delivery-payload').textContent = JSON.stringify(delivery.payload);
        document.getElementById('delivery-sender').textContent = delivery.sender;
      }), 150);
    </script>
  </body></html>`;
}

async function startIntentServer(): Promise<PointerServer> {
  const browserHost = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  const blobs = new Map<string, Buffer>();
  let config = createPajaRuntimeHostConfig();
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderPajaHtml(config));
      return;
    }
    if (path === '/__kehto/config.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(config));
      return;
    }
    if (path === '/__kehto/browser-host.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(browserHost);
      return;
    }
    const match = /^\/blossom\/([0-9a-f]{64})$/.exec(path);
    const blob = match ? blobs.get(match[1]!) : undefined;
    if (blob) {
      response.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'text/html; charset=utf-8' });
      response.end(blob);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Intent test server did not bind a TCP port.');
  return {
    url: `http://127.0.0.1:${address.port}/`,
    blobs,
    setConfig(next) { config = next; },
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections();
      server.closeAllConnections();
    }),
  };
}

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { expect, test, type Page } from '@playwright/test';
import { NAPPLET_KIND_NAMED } from '../../packages/nip/dist/5d/index.js';
import { finalizeEvent } from 'nostr-tools/pure';
import { naddrEncode } from 'nostr-tools/nip19';
import { installPajaApprovalDriver } from './paja-approval-driver.js';
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

interface DelayedRelay {
  release(): void;
}

test.describe('Paja intent links', () => {
  test('notifies an open source when a handler is installed after a no-handler rejection', async ({ page }) => {
    test.setTimeout(45_000);
    const server = await startIntentServer();
    // NAP-INTENT master e5308ac: pre-acceptance rejection is terminal;
    // catalog changes SHOULD push availability, not replay failed requests.
    const source = createSignedTarget(server.url, 'availability-source', `<!doctype html><html><body>
      <button id="invoke">Invoke</button><output id="result"></output>
      <output id="changed-count">0</output><output id="availability"></output>
      <script>
        let changes = 0;
        window.napplet.intent.onChanged((availability) => {
          if (availability.archetype !== 'profile') return;
          document.getElementById('changed-count').textContent = String(++changes);
          document.getElementById('availability').textContent = JSON.stringify(availability);
        });
        document.getElementById('invoke').onclick = async () => {
          const result = await window.napplet.intent.invoke('napplet:profile/open');
          document.getElementById('result').textContent = JSON.stringify(result);
        };
        window.parent.postMessage({ type: 'shell.ready' }, '*');
      </script></body></html>`, undefined, []);
    const handler = createSignedTarget(server.url, 'new-profile-handler', delayedTargetHtml(), 'napplet:profile/open', []);
    server.blobs.set(source.hash, source.bytes);
    server.blobs.set(handler.hash, handler.bytes);
    await configureRuntime(page, server, [source.event, handler.event], source.pointer);

    try {
      await page.goto(server.url);
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs[0]?.status)).toBe('ready');
      const sourceFrame = page.frameLocator('iframe.tab-panel').first();
      await sourceFrame.locator('#invoke').click();
      await expect(sourceFrame.locator('#result')).toContainText('no handler');
      await expect(sourceFrame.locator('#changed-count')).toHaveText('0');

      await page.locator('#runtime-pointer-input').fill(handler.pointer);
      await page.locator('#runtime-pointer-load').click();
      await expect(sourceFrame.locator('#changed-count')).toHaveText('1');
      await expect(sourceFrame.locator('#availability')).toContainText('"available":true');
      await expect(sourceFrame.locator('#availability')).toContainText(`nip5d:35129:${handler.event.pubkey}:new-profile-handler`);
      await expect(sourceFrame.locator('#result')).toContainText('no handler');
      const handlerFrame = page.frameLocator('iframe.tab-panel').nth(1);
      await expect(handlerFrame.locator('#delivery-count')).toHaveText('0');

      await sourceFrame.locator('#invoke').evaluate((button: HTMLButtonElement) => button.click());
      await expect(sourceFrame.locator('#result')).toContainText('"ok":true');
      await expect(handlerFrame.locator('#delivery-count')).toHaveText('1');
      await expect(sourceFrame.locator('#changed-count')).toHaveText('1');
    } finally {
      await server.close();
    }
  });

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
      const share = builderPage.getByRole('button', { name: 'Share builder-target' });
      await expect(share).toBeVisible();
      await openIntentBuilder(builderPage, 'builder-target');
      const builder = builderPage.getByRole('dialog', { name: 'Create intent link' });
      await expect(builder).toBeVisible();
      await expect(builder.locator('select[id$="-convention"]')).toHaveValue('napplet:profile/open');
      await builder.locator('select[id$="-routing"]').selectOption('exact');
      await builder.locator('select[id$="-payload-mode"]').selectOption('json');
      await builder.getByRole('textbox', { name: 'JSON payload' }).fill('{"value":null,"items":[1,"two"]}');
      await expect(builder.locator('output')).toContainText('Convention: napplet:profile/open');
      await builder.getByRole('button', { name: 'Copy link' }).click();
      await expect(builder.locator('[role="status"]')).toContainText(/Link copied|Copy the selected link/);
      const copied = await builder.getByLabel('Copyable URL').inputValue();
      expect(copied).toContain('intent=napplet%3Aprofile%2Fopen');
      expect(copied).toContain('naddr=');
      expect(copied).toContain('payload=');

      await builderPage.keyboard.press('Escape');
      await expect(builder).toBeHidden();
      await expect(share).toBeFocused();

      // A recipient opens the copied link directly into the verified app.
      const incomingPage = await context.newPage();
      await configureRuntime(incomingPage, server, [target.event]);
      await incomingPage.goto(copied);
      await expect(incomingPage.locator('#paja-intent-link-dialog')).not.toBeVisible();
      await expect(incomingPage.frameLocator('iframe.tab-panel').locator('#delivery-count')).toHaveText('1', { timeout: 15_000 });
      await expect(incomingPage.frameLocator('iframe.tab-panel').locator('#delivery-payload')).toHaveText('{"value":null,"items":[1,"two"]}');
    } finally {
      await context.close();
      await server.close();
    }
  });

  test('omits untouched advertised text parameters and preserves an explicitly included empty value', async ({ page }) => {
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'text-parameters', delayedTargetHtml(), 'napplet:profile/open', ['subject', 'note']);
    server.blobs.set(target.hash, target.bytes);
    await configureRuntime(page, server, [target.event], target.pointer);

    try {
      await page.goto(server.url);
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs[0]?.status)).toBe('ready');
      await openIntentBuilder(page, 'text-parameters', 'keyboard');
      const builder = page.getByRole('dialog', { name: 'Create intent link' });
      const url = builder.getByLabel('Copyable URL');
      await expect(url).not.toHaveValue(/subject=|note=/);
      await builder.locator('input[type="checkbox"]').first().check();
      await expect(url).toHaveValue(/subject%3D|subject%3D/);
      const href = await url.inputValue();
      expect(decodeURIComponent(href)).toContain('intent=napplet:profile/open?subject=');
      expect(decodeURIComponent(href)).not.toContain('note=');
    } finally {
      await server.close();
    }
  });

  test('reuses a warm verified handler without replaying or opening a second target tab', async ({ page }) => {
    test.setTimeout(45_000);
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'warm-target', delayedTargetHtml(), 'napplet:profile/open', []);
    server.blobs.set(target.hash, target.bytes);
    await configureRuntime(page, server, [target.event], target.pointer);
    const handler = page.frameLocator('iframe.tab-panel[title="Napplet runtime target: warm-target"]');

    try {
      await page.goto(server.url);
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs[0]?.status)).toBe('ready');
      for (const [value, count] of [[1, 1], [2, 2]] as const) {
        await openIntentBuilder(page, 'warm-target');
        const builder = page.getByRole('dialog', { name: 'Create intent link' });
        await builder.locator('select[id$="-routing"]').selectOption('exact');
        await builder.locator('select[id$="-payload-mode"]').selectOption('json');
        await builder.getByRole('textbox', { name: 'JSON payload' }).fill(JSON.stringify({ value }));
        await builder.getByRole('button', { name: 'Test intent' }).click();
        await expect(page.locator('#paja-intent-link-dialog')).not.toBeVisible();
        await expect(handler.locator('#delivery-count')).toHaveText(String(count), { timeout: 15_000 });
        await expect(handler.locator('#delivery-payload')).toHaveText(JSON.stringify({ value }));
        await expect(page.locator('iframe')).toHaveCount(1);
        await expect(page.locator('#paja-intent-link-notice')).toBeHidden();
      }
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
        .filter((entry) => entry.type === 'intent.deliver').length)).toBe(2);
    } finally {
      await server.close();
    }
  });

  test('shows named app choices only for a conflicting saved preference and never changes it implicitly', async ({ browser }) => {
    test.setTimeout(60_000);
    const server = await startIntentServer();
    const saved = createSignedTarget(server.url, 'My Reader', delayedTargetHtml('saved'), 'napplet:profile/open', []);
    const shared = createSignedTarget(server.url, 'Shared Reader', delayedTargetHtml('shared'), 'napplet:profile/open', []);
    server.blobs.set(saved.hash, saved.bytes);
    server.blobs.set(shared.hash, shared.bytes);
    const context = await browser.newContext({ viewport: { width: 375, height: 720 } });
    const setup = await context.newPage();
    await configureRuntime(setup, server, [saved.event, shared.event]);
    const incoming = async (pointer: string) => {
      const page = await context.newPage();
      await configureRuntime(page, server, [saved.event, shared.event]);
      await page.goto(recommendationHref(server.url, pointer));
      return page;
    };
    try {
      await setup.goto(server.url);
      await expect.poll(() => setup.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
      await setup.evaluate(async ([first, second]) => {
        await window.__KEHTO_PAJA__!.loadPointer(first);
        await window.__KEHTO_PAJA__!.loadPointer(second);
      }, [saved.pointer, shared.pointer]);
      await openIntentBuilder(setup, 'My Reader');
      const builder = setup.getByRole('dialog', { name: 'Create intent link' });
      await builder.locator('select[id$="-routing"]').selectOption('default');
      await builder.getByRole('button', { name: 'Test intent' }).click();
      const chooser = setup.getByRole('dialog', { name: 'Choose an app' });
      await expect(chooser).toBeVisible();
      await chooser.getByLabel('Always use this app').check();
      await chooser.getByRole('button', { name: 'Open with My Reader', exact: true }).click();
      const savedFrame = setup.frameLocator('iframe[title="Napplet runtime target: My Reader"]');
      await expect(savedFrame.locator('#delivery-target')).toHaveText('saved', { timeout: 15_000 });
      await expect(savedFrame.locator('#last-availability')).toContainText('"hasDefault":true');
      await expect(savedFrame.locator('#last-availability')).toContainText(`nip5d:35129:${saved.event.pubkey}:My Reader`);
      await expect(savedFrame.locator('#last-availability')).toContainText('"isDefault":true');

      const matching = await incoming(saved.pointer);
      await expect(matching.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('saved', { timeout: 15_000 });
      await expect(matching.locator('#paja-intent-link-dialog')).toBeHidden();

      // Exact pointer links explicitly name their target, ahead of saved routing.
      const exact = await context.newPage();
      await configureRuntime(exact, server, [saved.event, shared.event]);
      await exact.goto(intentHref(server.url, shared.pointer, { subject: 'shared' }));
      await expect(exact.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('shared', { timeout: 15_000 });
      await expect(exact.locator('#paja-intent-link-dialog')).toBeHidden();

      const keepSaved = await incoming(shared.pointer);
      const conflict = keepSaved.getByRole('dialog', { name: 'Which app would you like to use?' });
      await expect(conflict).toBeVisible();
      await expect(conflict).toContainText('This link uses Shared Reader. Your saved preference is My Reader.');
      await expect(conflict.locator('input:not([type="checkbox"]), textarea, select')).toHaveCount(0);
      await expect(keepSaved.locator('iframe')).toHaveCount(0);
      await conflict.getByRole('button', { name: 'Open with My Reader', exact: true }).click();
      await expect(keepSaved.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('saved', { timeout: 15_000 });
      await expect(conflict).toBeHidden();
      await expect(keepSaved.locator('#paja-intent-link-notice')).toBeHidden();

      const useShared = await incoming(shared.pointer);
      const sharedChoice = useShared.getByRole('dialog', { name: 'Which app would you like to use?' });
      await sharedChoice.getByRole('button', { name: 'Open with Shared Reader', exact: true }).click();
      await expect(useShared.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('shared', { timeout: 15_000 });
      // Ordinary pointer navigation also must not discard other installed apps.
      const ordinary = await context.newPage();
      await configureRuntime(ordinary, server, [saved.event, shared.event]);
      await ordinary.goto(`${server.url}?naddr=${shared.pointer}`);
      await expect(ordinary.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('shared', { timeout: 15_000 });
      // Selecting the shared app once must leave My Reader as the saved preference.
      const unchanged = await incoming(shared.pointer);
      await expect(unchanged.getByRole('dialog', { name: 'Which app would you like to use?' })).toContainText('saved preference is My Reader');
      await unchanged.keyboard.press('Escape');
      await expect(unchanged.locator('#paja-intent-link-dialog')).toBeHidden();
      await expect(unchanged.locator('iframe')).toHaveCount(0);
      await expect.poll(() => unchanged.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog.filter((entry) => entry.type === 'intent.deliver').length)).toBe(0);

      const rememberShared = await incoming(shared.pointer);
      const rememberChoice = rememberShared.getByRole('dialog', { name: 'Which app would you like to use?' });
      await rememberChoice.getByLabel('Always use this app').check();
      await rememberChoice.getByRole('button', { name: 'Open with Shared Reader', exact: true }).click();
      await expect(rememberShared.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('shared', { timeout: 15_000 });
      const newDefault = await incoming(shared.pointer);
      await expect(newDefault.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('shared', { timeout: 15_000 });
      await expect(newDefault.locator('#paja-intent-link-dialog')).toBeHidden();
      // Unsupported or unverifiable hints do not displace the valid saved app.
      const unsupported = createSignedTarget(server.url, 'Wrong Contract', delayedTargetHtml('wrong'), 'napplet:profile/view', []);
      const unsigned = createSignedTarget(server.url, 'Bad Signature', delayedTargetHtml('bad'), 'napplet:profile/open', []);
      for (const hinted of [unsupported, { ...unsigned, event: { ...unsigned.event, sig: '0'.repeat(128) } }]) {
        const fallback = await context.newPage();
        await configureRuntime(fallback, server, [saved.event, shared.event, hinted.event]);
        await fallback.goto(recommendationHref(server.url, hinted.pointer));
        await expect(fallback.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('shared', { timeout: 15_000 });
        await expect(fallback.locator('#paja-intent-link-dialog')).toBeHidden();
      }
    } finally {
      await context.close();
      await server.close();
    }
  });

  test('opens a signed shared link directly, retains delivery after launcher teardown, and does not replay on reload', async ({ page }) => {
    test.setTimeout(60_000);
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'profile-target', delayedTargetHtml(), 'napplet:profile/open', ['subject', 'note']);
    server.blobs.set(target.hash, target.bytes);
    await configureRuntime(page, server, [target.event]);
    try {
      await page.goto(intentHref(server.url, target.pointer, { answer: null, list: [1, true], text: 'kept' }));
      await expect(page.locator('#paja-intent-link-dialog')).toBeHidden();
      const handler = page.frameLocator('iframe.tab-panel');
      await expect(handler.locator('#delivery-count')).toHaveText('1', { timeout: 15_000 });
      await expect(handler.locator('#delivery-payload')).toHaveText('{"answer":null,"list":[1,true],"text":"kept"}');
      await expect(handler.locator('#delivery-sender')).toHaveText(LAUNCHER_CATALOG_ID);
      await expect(page.locator('iframe')).toHaveCount(1);
      await expect(page.locator('#paja-intent-link-notice')).toBeHidden();
      await expect(page).not.toHaveURL(/intent=/);
      await page.evaluate(() => window.postMessage({
        type: 'intent.invoke', id: 'forged-outer-window',
        request: { archetype: 'profile', action: 'open', convention: 'napplet:profile/open' },
      }, '*'));
      await expect(handler.locator('#delivery-count')).toHaveText('1');
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog.filter((entry) => entry.type === 'intent.deliver').length)).toBe(1);
      await page.reload();
      await expect(handler.locator('#delivery-count')).toHaveText('0', { timeout: 15_000 });
      await expect(page.locator('#paja-intent-link-dialog')).toBeHidden();
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog.filter((entry) => entry.type === 'intent.deliver').length)).toBe(0);
    } finally { await server.close(); }
  });

  test('closing a pending shared link prevents launch when delayed verification completes', async ({ page }) => {
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'delayed-target', delayedTargetHtml(), 'napplet:profile/open', []);
    server.blobs.set(target.hash, target.bytes);
    const delayed = await configureDelayedRuntime(page, server, [target.event]);
    try {
      await page.goto(intentHref(server.url, target.pointer, { value: 'cancel' }));
      await expect(page.locator('#paja-intent-link-notice')).toBeVisible();
      await page.locator('#paja-intent-link-dismiss').click();
      delayed.release();
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().iframeCount)).toBe(0);
      await expect(page.locator('#paja-intent-link-notice')).toBeHidden();
    } finally { await server.close(); }
  });

  test('rejects conflicting target instructions without showing protocol fields or running an app', async ({ page }) => {
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'fragment-conflict', delayedTargetHtml(), 'napplet:profile/open', []);
    await configureRuntime(page, server, [target.event]);
    try {
      const invalid = `${server.url}?intent=${encodeURIComponent(`napplet:profile/open#${target.pointer}`)}&naddr=${target.pointer}`;
      await page.goto(invalid);
      await expect(page.locator('#paja-intent-link-status')).toContainText('Couldn’t open this shared content');
      await expect(page.locator('#paja-intent-link-dialog')).toBeHidden();
      await expect(page.locator('iframe')).toHaveCount(0);
    } finally { await server.close(); }
  });

  test('opens a verified app hint in a fresh session without an installation or review prompt', async ({ page }) => {
    const server = await startIntentServer();
    const target = createSignedTarget(server.url, 'relayed-recommendation', delayedTargetHtml('recommended'), 'napplet:profile/open', []);
    server.blobs.set(target.hash, target.bytes);
    await configureRuntime(page, server, [target.event]);
    const prompts: string[] = [];
    page.on('dialog', (dialog) => { prompts.push(dialog.message()); void dialog.dismiss(); });
    try {
      await page.goto(recommendationHref(server.url, target.pointer));
      await expect(page.frameLocator('iframe.tab-panel').locator('#delivery-target')).toHaveText('recommended', { timeout: 15_000 });
      await expect(page.locator('#paja-intent-link-dialog')).toBeHidden();
      await expect(page.locator('#paja-intent-link-notice')).toBeHidden();
      expect(prompts).toEqual([]);
    } finally { await server.close(); }
  });

  test('an incompatible named app fails with simple recovery and never silently changes routing', async ({ page }) => {
    const server = await startIntentServer();
    const incompatible = createSignedTarget(server.url, 'incompatible-profile', delayedTargetHtml(), 'napplet:profile/view', []);
    server.blobs.set(incompatible.hash, incompatible.bytes);
    await configureRuntime(page, server, [incompatible.event]);
    try {
      await page.goto(intentHref(server.url, incompatible.pointer, { subject: 'mismatch' }));
      await expect(page.locator('#paja-intent-link-status')).toContainText('Couldn’t open this shared content');
      await expect(page.locator('#paja-intent-link-dialog')).toBeHidden();
      await expect(page.locator('iframe')).toHaveCount(0);
      await page.locator('#paja-intent-link-retry').click();
      await expect(page.locator('#paja-intent-link-retry')).toBeVisible();
      await expect(page.locator('iframe')).toHaveCount(0);
    } finally { await server.close(); }
  });

  for (const [label, payload] of [
    ['primitive', false],
    ['null', null],
    ['array', ['one', 2, null]],
  ] as const) {
    test(`preserves a ${label} JSON payload across direct opening and delivery`, async ({ page }) => {
      test.setTimeout(45_000);
      const server = await startIntentServer();
      const target = createSignedTarget(server.url, `payload-${label}`, delayedTargetHtml(), 'napplet:profile/open', []);
      server.blobs.set(target.hash, target.bytes);
      await configureRuntime(page, server, [target.event]);

      try {
        await page.goto(intentHref(server.url, target.pointer, payload));
        await expect(page.frameLocator('iframe.tab-panel').locator('#delivery-count')).toHaveText('1', { timeout: 15_000 });
        await expect(page.frameLocator('iframe.tab-panel').locator('#delivery-payload')).toHaveText(JSON.stringify(payload));
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
  await installPajaApprovalDriver(page);
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

async function openIntentBuilder(page: Page, title: string, activation: 'click' | 'keyboard' = 'click'): Promise<void> {
  await page.getByRole('button', { name: `Share ${title}` }).click();
  const share = page.getByRole('dialog', { name: 'Share' });
  await expect(share).toBeVisible();
  await expect.poll(() => share.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  const create = share.getByRole('button', { name: 'Create intent link' });
  await create.focus();
  await expect(create).toBeFocused();
  if (activation === 'keyboard') {
    await page.keyboard.press('Enter');
  } else await create.click();
  await expect(page.getByRole('dialog', { name: 'Create intent link' })).toBeVisible();
}

async function configureDelayedRuntime(
  page: Page,
  server: PointerServer,
  events: readonly ReturnType<typeof finalizeEvent>[],
): Promise<DelayedRelay> {
  await installPajaApprovalDriver(page);
  server.setConfig({
    ...createPajaRuntimeHostConfig({ maxWaitMs: 2_000 }),
    simulation: normalizePajaSimulation({ relay: { mode: 'live', urls: [RELAY] } }),
  });
  let released = false;
  const pending: Array<() => void> = [];
  await page.routeWebSocket(`${RELAY}/`, (socket) => {
    socket.onMessage((message) => {
      const request = JSON.parse(String(message)) as unknown[];
      if (request[0] !== 'REQ' || typeof request[1] !== 'string') return;
      const respond = () => {
        for (const event of events) socket.send(JSON.stringify(['EVENT', request[1], event]));
        socket.send(JSON.stringify(['EOSE', request[1]]));
      };
      if (released) respond();
      else pending.push(respond);
    });
  });
  return {
    release() {
      released = true;
      for (const respond of pending.splice(0)) respond();
    },
  };
}

function intentHref(base: string, pointer: string, payload: unknown): string {
  return `${base}?intent=${encodeURIComponent('napplet:profile/open')}`
    + `&naddr=${encodeURIComponent(pointer)}&payload=${encodeURIComponent(JSON.stringify(payload))}`;
}

function recommendationHref(base: string, pointer: string): string {
  return `${base}?intent=${encodeURIComponent(`napplet:profile/open#${pointer}`)}`;
}

function createSignedTarget(
  serverUrl: string,
  dTag: string,
  html: string,
  convention: string | undefined,
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
      ...(convention === undefined ? [] : [['z', 'profile'], ['i', convention, ...parameters]]),
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
    <output id="last-availability"></output>
    <script>
      let count = 0;
      window.napplet.intent.onChanged((availability) => {
        document.getElementById('last-availability').textContent = JSON.stringify(availability);
      });
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

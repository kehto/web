import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

const expectedNapplets = [
  'bot',
  'chat',
  'composer',
  'cvm-relatr',
  'feed',
  'preferences',
  'profile-viewer',
  'resource-demo',
  'toaster',
] as const;

const disabledDemoNapplets = [
  'ble-demo',
  'common-demo',
  'link-demo',
  'lists-demo',
  'serial-demo',
  'webrtc-demo',
] as const;

const expectedRequires: Record<(typeof expectedNapplets)[number], readonly string[]> = {
  bot: ['inc', 'storage', 'theme'],
  chat: ['inc', 'storage', 'relay', 'theme'],
  composer: ['relay', 'theme'],
  'cvm-relatr': ['cvm', 'theme'],
  feed: ['identity', 'relay', 'inc', 'theme'],
  preferences: ['storage', 'theme'],
  'profile-viewer': ['inc', 'relay', 'theme'],
  'resource-demo': ['resource', 'theme'],
  toaster: ['notify', 'theme'],
};

test('playground loads all napplets via verified srcdoc with opaque origins', async ({ page }) => {
  const relayEventHits = new Set<string>();
  const blossomHits: string[] = [];

  page.on('response', (response) => {
    const parts = new URL(response.url()).pathname.split('/').filter(Boolean);
    const relayIdx = parts.indexOf('napplet-relay');
    if (relayIdx >= 0 && parts[relayIdx + 1] === 'event' && parts[relayIdx + 2]) {
      relayEventHits.add(parts[relayIdx + 2]);
    }
    if (parts.includes('napplet-blossom')) blossomHits.push(response.url());
    // The gateway must not be in the trust path: its HTML route is never fetched.
    if (parts[0] === 'napplet-gateway' && parts.at(-1) === 'index.html') {
      throw new Error(`gateway HTML must not load under srcdoc: ${response.url()}`);
    }
  });

  await demoBeforeEach(page);

  await expect(page.locator('iframe')).toHaveCount(expectedNapplets.length, { timeout: 15_000 });
  // Every napplet was resolved from the relay sim, and Blossom served blobs.
  await expect.poll(() => relayEventHits.size, { timeout: 10_000 }).toBe(expectedNapplets.length);
  expect(blossomHits.length).toBeGreaterThan(0);

  const frames = await page.$$eval('iframe', (iframes) =>
    iframes.map((iframe) => ({
      id: iframe.id,
      src: iframe.getAttribute('src') ?? '',
      srcdoc: iframe.getAttribute('srcdoc') ?? '',
      sandbox: iframe.getAttribute('sandbox') ?? '',
    })),
  );

  const loadedNames = frames
    .map((frame) => frame.id.match(/^demo-(.+)-\d+$/)?.[1])
    .filter((name): name is string => typeof name === 'string')
    .sort();
  expect(loadedNames).toEqual([...expectedNapplets].sort());
  for (const name of disabledDemoNapplets) {
    expect(loadedNames, `${name} must not be hosted in the playground`).not.toContain(name);
    await expect(page.locator(`#${name}-frame-container iframe`)).toHaveCount(0);
  }

  for (const frame of frames) {
    // srcdoc carries the verified bytes; no network src navigation.
    expect(frame.src, `${frame.id} has no src`).toBe('');
    expect(frame.srcdoc.length, `${frame.id} srcdoc`).toBeGreaterThan(0);
    expect(frame.srcdoc, `${frame.id} CSP meta`).toContain(
      '<meta http-equiv="Content-Security-Policy"',
    );
    expect(frame.srcdoc, `${frame.id} NIP-5D injection`).toContain(
      'data-kehto-nip5d-injection',
    );
    expect(frame.srcdoc.indexOf('Content-Security-Policy')).toBeLessThan(
      frame.srcdoc.indexOf('data-kehto-nip5d-injection'),
    );
    expect(frame.sandbox, `${frame.id} sandbox`).toContain('allow-scripts');
    expect(frame.sandbox, `${frame.id} sandbox`).not.toContain('allow-same-origin');
  }

  // The resource-demo static allowlist flows into the srcdoc CSP <meta> connect-src.
  const resourceFrame = frames.find((frame) => frame.id.startsWith('demo-resource-demo-'));
  expect(resourceFrame?.srcdoc).toContain('https://raw.githubusercontent.com');
});

test('resolved manifests and hosted supports match napplet contracts', async ({ page }) => {
  await demoBeforeEach(page);

  const manifests = await page.evaluate(async (names) => {
    const entries = await Promise.all(names.map(async (name) => {
      const response = await fetch(`/napplet-relay/event/${encodeURIComponent(name)}`, {
        cache: 'no-store',
      });
      const event = await response.json() as { tags?: string[][] };
      const requires = (event.tags ?? [])
        .filter((tag) => tag[0] === 'requires' && typeof tag[1] === 'string')
        .map((tag) => tag[1]);
      return [name, requires] as const;
    }));
    return Object.fromEntries(entries);
  }, expectedNapplets);

  for (const name of expectedNapplets) {
    expect([...manifests[name]].sort(), `${name} manifest requires`).toEqual(
      [...expectedRequires[name]].sort(),
    );
  }

  for (const name of expectedNapplets) {
    const handle = await page.locator(`#${name}-frame-container iframe`).elementHandle();
    expect(handle, `${name} iframe handle`).not.toBeNull();
    const frame = await handle!.contentFrame();
    expect(frame, `${name} content frame`).not.toBeNull();

    await expect.poll(async () => frame!.evaluate(async (requires) => {
      const maybeWindow = window as Window & {
        napplet?: {
          identity?: object;
          relay?: object;
          theme?: object;
          upload?: object;
          shell?: {
            ready: () => Promise<unknown>;
            supports: (domain: string, protocol?: string) => boolean;
            services: readonly string[];
            onReady: (handler: (environment: unknown) => void) => { close(): void };
          };
        };
        nostr?: unknown;
      };
      const namespaceKeys = Object.keys(maybeWindow.napplet ?? {});
      const shell = maybeWindow.napplet?.shell;
      await shell?.ready();
      return requires.every((capability) => namespaceKeys.includes(capability)) &&
        requires.every((capability) => shell?.supports(capability) === true) &&
        namespaceKeys.includes('shell') &&
        typeof shell?.ready === 'function' &&
        typeof shell?.supports === 'function' &&
        typeof shell?.onReady === 'function' &&
        Array.isArray(shell?.services) &&
        !namespaceKeys.includes('nostrdb') &&
        !namespaceKeys.some((key) => key.startsWith('perm:')) &&
        !namespaceKeys.includes('__kehtoInjectedDomains') &&
        typeof maybeWindow.napplet?.upload === 'undefined' &&
        typeof maybeWindow.nostr === 'undefined';
    }, expectedRequires[name]), { timeout: 10_000 }).toBe(true);
  }
});

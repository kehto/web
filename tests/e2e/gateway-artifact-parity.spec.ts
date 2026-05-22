import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

const expectedNapplets = [
  'bot',
  'chat',
  'composer',
  'config-demo',
  'decrypt-demo',
  'feed',
  'hotkey-chord',
  'media-controller',
  'preferences',
  'profile-viewer',
  'resource-demo',
  'theme-switcher',
  'toaster',
] as const;

test('playground loads all napplets through opaque-origin gateway artifacts', async ({ page }) => {
  const gatewayResponses = new Map<string, { url: string; status: number; csp: string }>();
  const legacyNappletResponses: string[] = [];

  page.on('response', (response) => {
    const url = new URL(response.url());
    const parts = url.pathname.split('/').filter(Boolean);

    if (
      parts[0] === 'napplet-gateway' &&
      parts.length === 4 &&
      parts[3] === 'index.html'
    ) {
      gatewayResponses.set(parts[1], {
        url: response.url(),
        status: response.status(),
        csp: response.headers()['content-security-policy'] ?? '',
      });
    }

    if (parts[0] === 'napplets' && parts.at(-1) === 'index.html') {
      legacyNappletResponses.push(response.url());
    }
  });

  await demoBeforeEach(page);

  await expect(page.locator('iframe')).toHaveCount(expectedNapplets.length);
  await expect.poll(() => gatewayResponses.size, { timeout: 10_000 }).toBe(expectedNapplets.length);

  const frames = await page.$$eval('iframe', (iframes) =>
    iframes.map((iframe) => ({
      id: iframe.id,
      src: iframe.getAttribute('src') ?? '',
      sandbox: iframe.getAttribute('sandbox') ?? '',
    })),
  );

  const loadedNames = frames
    .map((frame) => frame.src.match(/\/napplet-gateway\/([^/]+)\/[a-f0-9]{64}\/index\.html$/)?.[1])
    .filter((name): name is string => typeof name === 'string')
    .sort();

  expect(loadedNames).toEqual([...expectedNapplets].sort());
  expect(legacyNappletResponses).toEqual([]);

  for (const frame of frames) {
    expect(frame.src, `${frame.id} gateway src`).toMatch(
      /\/napplet-gateway\/[^/]+\/[a-f0-9]{64}\/index\.html$/,
    );
    expect(frame.sandbox, `${frame.id} sandbox`).toContain('allow-scripts');
    expect(frame.sandbox, `${frame.id} sandbox`).not.toContain('allow-same-origin');
  }

  for (const name of expectedNapplets) {
    const response = gatewayResponses.get(name);
    expect(response?.status, `${name} gateway status`).toBe(200);
    expect(response?.url, `${name} gateway response URL`).toMatch(
      new RegExp(`/napplet-gateway/${name}/[a-f0-9]{64}/index.html$`),
    );
  }

  expect(gatewayResponses.get('resource-demo')?.csp).toContain('http://localhost:4174');
});


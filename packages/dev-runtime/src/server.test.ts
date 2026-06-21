import { describe, expect, it } from 'vitest';
import { startDevRuntimeServer } from './server.js';

describe('@kehto/dev-runtime server', () => {
  it('serves the host page and config JSON', async () => {
    const server = await startDevRuntimeServer({
      options: {
        targetUrl: 'http://127.0.0.1:5173',
        port: 0,
      },
      now: new Date('2026-06-21T00:00:00.000Z'),
    });

    try {
      const html = await fetchText(server.url);
      expect(html).toContain('Kehto Dev Runtime');
      expect(html).toContain('id="napplet-frame"');

      const config = JSON.parse(await fetchText(`${server.url}__kehto/config.json`)) as {
        target: { url: string; hmrStrategy: string };
        chrome: { topBar: boolean; bottomBar: boolean; sidePanels: boolean };
        simulation: { relay: { mode: string }; theme: { mode: string } };
      };
      expect(config.target).toEqual({
        url: 'http://127.0.0.1:5173/',
        hmrStrategy: 'iframe-target-url',
      });
      expect(config.chrome).toEqual({
        topBar: true,
        bottomBar: true,
        sidePanels: false,
      });
      expect(config.simulation).toMatchObject({
        relay: { mode: 'memory' },
        theme: { mode: 'dark' },
      });
    } finally {
      await server.close();
    }
  });
});

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return response.text();
}

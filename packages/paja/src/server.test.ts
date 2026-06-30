import { describe, expect, it } from 'vitest';
import { startPajaServer } from './server.js';

describe('@kehto/paja server', () => {
  it('serves the host page and config JSON', async () => {
    const server = await startPajaServer({
      options: {
        targetUrl: 'http://127.0.0.1:5173',
        port: 0,
      },
      now: new Date('2026-06-21T00:00:00.000Z'),
    });

    try {
      const html = await fetchText(server.url);
      expect(html).toContain('@kehto/<span class="brand-product">paja</span>');
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

  it('updates served host config when a managed target announces a new URL', async () => {
    const server = await startPajaServer({
      options: {
        targetUrl: 'http://127.0.0.1:5173',
        port: 0,
      },
      now: new Date('2026-06-21T00:00:00.000Z'),
    });

    try {
      server.updateTargetUrl('http://localhost:5174/');

      const html = await fetchText(server.url);
      expect(html).toContain('data-target-url="http://localhost:5174/"');

      const config = JSON.parse(await fetchText(`${server.url}__kehto/config.json`)) as {
        target: { url: string };
      };
      expect(config.target.url).toBe('http://localhost:5174/');
      expect(server.hostConfig.target.url).toBe('http://localhost:5174/');
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

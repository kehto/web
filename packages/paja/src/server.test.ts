import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { startPajaServer } from './server.js';

interface TargetServer {
  readonly url: string;
  close(): Promise<void>;
}

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
        target: { mode: string; url: string; hmrStrategy: string };
        chrome: { topBar: boolean; bottomBar: boolean; sidePanels: boolean };
        simulation: { relay: { mode: string }; theme: { mode: string } };
      };
      expect(config.target).toEqual({
        mode: 'iframe-url',
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

  it('serves current target HTML through the local target endpoint', async () => {
    const firstTarget = await startTargetServer('<!doctype html><html><body>first target</body></html>');
    const secondTarget = await startTargetServer('<!doctype html><html><body>second target</body></html>');
    const server = await startPajaServer({
      options: {
        targetUrl: firstTarget.url,
        port: 0,
      },
      now: new Date('2026-06-21T00:00:00.000Z'),
    });

    try {
      await expect(fetchText(`${server.url}__kehto/target.html`)).resolves.toContain('first target');

      server.updateTargetUrl(secondTarget.url);
      await expect(fetchText(`${server.url}__kehto/target.html`)).resolves.toContain('second target');
    } finally {
      await server.close();
      await firstTarget.close();
      await secondTarget.close();
    }
  });
});

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return response.text();
}

async function startTargetServer(html: string): Promise<TargetServer> {
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(html);
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

/**
 * cli/server.ts — Serve the browser bundle and a blank harness page on loopback.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

/** Global the harness page sets once the bundle has loaded. */
export const HARNESS_GLOBAL = '__kehtoConformance';

const HARNESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Kehto conformance harness</title></head>
<body><script type="module">import * as api from './conformance.js'; window.${HARNESS_GLOBAL} = api;</script></body></html>`;

/**
 * The web UI page. `eventsUrl` enables live re-runs; a static copy (GitHub
 * Pages) passes none.
 *
 * @param eventsUrl - Server-sent events URL, or `null` for a static page.
 * @returns The page HTML.
 */
export function renderUiPage(eventsUrl: string | null): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kehto conformance</title></head>
<body><div id="app"></div><script type="module">import * as api from './conformance.js'; window.${HARNESS_GLOBAL} = api; api.mountKehtoConformanceUi(document.getElementById('app')${eventsUrl ? `, ${JSON.stringify(eventsUrl)}` : ''});</script></body></html>`;
}

/** A connected server-sent-events client. */
export interface EventClient {
  write(chunk: string): void;
  end?(): void;
}

/** Extra routes for the live UI. */
export interface HarnessServerExtras {
  /** Serve the UI page at `/` instead of the blank harness page. */
  readonly ui?: boolean;
  /** Accept an `/events` client; returns its disconnect cleanup. */
  events?(client: EventClient): () => void;
}

/** A running harness server. */
export interface HarnessServer {
  readonly url: string;
  close(): Promise<void>;
}

/**
 * Start the harness server.
 *
 * @param bundle - URL of `dist/browser/conformance.js`.
 * @param port - Port to bind on 127.0.0.1; `0` picks a free one.
 * @param extras - UI page and server-sent events, for `--ui`.
 * @returns The server.
 * @example
 * ```ts
 * const server = await startHarnessServer(new URL('./browser/conformance.js', import.meta.url));
 * ```
 */
export async function startHarnessServer(bundle: URL, port = 0, extras: HarnessServerExtras = {}): Promise<HarnessServer> {
  const files: Record<string, () => { type: string; body: string | Uint8Array }> = {
    '/': () => ({ type: 'text/html; charset=utf-8', body: extras.ui ? renderUiPage(extras.events ? './events' : null) : HARNESS_HTML }),
    '/harness': () => ({ type: 'text/html; charset=utf-8', body: HARNESS_HTML }),
    '/conformance.js': () => ({ type: 'text/javascript; charset=utf-8', body: readFileSync(bundle) }),
    '/conformance.js.map': () => ({ type: 'application/json', body: readFileSync(new URL(`${bundle.href}.map`)) }),
  };
  const server = createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0] ?? '/';
    if (path === '/events' && extras.events) {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      response.write?.(': connected\n\n');
      const client: EventClient = { write: (chunk) => response.write?.(chunk), end: () => response.end() };
      const release = extras.events(client);
      request.on?.('close', release);
      return;
    }
    const file = files[path];
    if (request.method !== 'GET' || !file) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
      return;
    }
    try {
      const { type, body } = file();
      response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      response.end(body);
    } catch {
      response.writeHead(500, { 'content-type': 'text/plain' });
      response.end('bundle missing');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  const bound = typeof address === 'object' && address ? address.port : port;
  return {
    url: `http://127.0.0.1:${bound}/`,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  };
}

/**
 * NAP-RESOURCE proxy shared by the Paja server and the standalone proxy.
 *
 * NAP-RESOURCE (napplet/naps#80 @ `ae5b9c6`) makes the runtime an SSRF
 * boundary with mandatory DNS-time private-IP checks. A browser can't make
 * those checks for its own fetches, so Paja reads HTTP(S) and Blossom bytes
 * through this proxy. It pins a public address after DNS, follows no redirect
 * itself (each hop goes back to the browser for approval), and caps time and
 * bytes with the `server.resource*` settings.
 *
 * The static `/web/paja/` build has no server and reads resources directly by
 * default. It can optionally point at a standalone proxy started with
 * {@link startPajaResourceProxy} to get DNS-time checks. That proxy is reachable
 * cross-origin, so it answers only allowlisted browser origins over CORS. An
 * origin allowlist is not authentication, because non-browser clients can send
 * any `Origin`. Operators run an open fetch proxy that is limited to public
 * addresses, size and time caps, and those origins, and should rate-limit it.
 *
 * @module
 */

import { createServer } from 'node:http';

import { concatBytes, fetchPinnedResource } from './server-resource-transport.js';
import { getPajaSetting } from './settings.js';

/** Marks a response that carries upstream bytes and status, not a proxy refusal. */
export const PAJA_RESOURCE_UPSTREAM_HEADER = 'x-kehto-resource-upstream';
/** Marks a redirect hop the browser must approve and follow itself. */
export const PAJA_RESOURCE_REDIRECT_HEADER = 'x-kehto-resource-redirect';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type HttpListener = Parameters<typeof createServer>[0];
/** The Node request shape the proxy reads. */
export type PajaProxyRequest = Parameters<HttpListener>[0];
/** The Node response shape the proxy writes. */
export type PajaProxyResponse = Parameters<HttpListener>[1];
type IncomingMessage = PajaProxyRequest;
type ServerResponse = PajaProxyResponse;

function refuse(response: ServerResponse, status: number, message: string, headers: Record<string, string> = {}): void {
  response.writeHead(status, { ...headers, 'content-type': 'text/plain; charset=utf-8' });
  response.end(message);
}

function readJsonBody(request: IncomingMessage): Promise<{ url?: unknown } | null> {
  return new Promise((resolve) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let settled = false;
    const finish = (value: { url?: unknown } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => { finish(null); request.destroy(); }, getPajaSetting('server.requestBodyTimeoutMs'));
    request.on('data', (chunk: Uint8Array) => {
      if (settled) return;
      size += chunk.byteLength;
      if (size > getPajaSetting('server.requestBodyMaxBytes')) { finish(null); request.destroy(); }
      else chunks.push(chunk);
    });
    request.on('aborted', () => finish(null));
    request.on('error', () => finish(null));
    request.on('end', () => {
      try { finish(JSON.parse(new TextDecoder().decode(concatBytes(chunks))) as { url?: unknown }); }
      catch { finish(null); }
    });
  });
}

/**
 * Read one resource hop for an already-authorized caller.
 *
 * @param request - Authorized POST with a `{ "url": "https://…" }` JSON body.
 * @param response - Response to write.
 * @param headers - Extra headers for every reply, such as CORS headers.
 * @returns Resolves when the reply is written.
 * @example
 * ```ts
 * if (authorized(request)) await servePajaResourceProxy(request, response);
 * ```
 */
export async function servePajaResourceProxy(
  request: IncomingMessage,
  response: ServerResponse,
  headers: Record<string, string> = {},
): Promise<void> {
  const payload = await readJsonBody(request);
  if (!payload || typeof payload.url !== 'string') return refuse(response, 400, 'Invalid resource request', headers);
  let url: URL;
  try {
    url = new URL(payload.url);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) throw new Error();
  } catch {
    return refuse(response, 400, 'Invalid resource URL', headers);
  }
  const controller = new AbortController();
  response.on('close', () => { if (!response.writableEnded) controller.abort(); });
  try {
    const upstream = await fetchPinnedResource(url, controller.signal);
    if (controller.signal.aborted) return;
    if (REDIRECT_STATUSES.has(upstream.status)) {
      response.writeHead(200, {
        ...headers,
        'cache-control': 'no-store', 'content-type': 'application/json', [PAJA_RESOURCE_REDIRECT_HEADER]: '1',
      });
      response.end(JSON.stringify({ status: upstream.status, location: upstream.location ?? '' }));
      return;
    }
    response.writeHead(upstream.status, {
      ...headers,
      'cache-control': 'no-store',
      'content-type': upstream.contentType,
      'content-length': String(upstream.body.byteLength),
      [PAJA_RESOURCE_UPSTREAM_HEADER]: '1',
    });
    response.end(upstream.body);
  } catch (error) {
    if (controller.signal.aborted) return;
    refuse(response, 502, error instanceof Error ? error.message : 'Resource proxy failed', headers);
  }
}

/** Options for {@link startPajaResourceProxy}. */
export interface PajaResourceProxyOptions {
  /** Exact browser origins allowed to use the proxy, such as `https://kehto.github.io`. */
  readonly allowedOrigins: readonly string[];
  readonly host: string;
  readonly port: number;
}

/** A running standalone resource proxy. */
export interface PajaResourceProxy {
  readonly url: string;
  close(): Promise<void>;
}

/**
 * Normalize an allowlisted origin, or throw when it is not a bare origin.
 *
 * @param value - Candidate origin.
 * @returns The canonical origin.
 * @example
 * ```ts
 * normalizePajaProxyOrigin('https://kehto.github.io'); // 'https://kehto.github.io'
 * ```
 */
export function normalizePajaProxyOrigin(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Invalid --allow-origin: ${value}`); }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.origin !== value.replace(/\/$/u, '')) {
    throw new Error(`--allow-origin must be a bare origin such as https://kehto.github.io, got ${value}`);
  }
  return url.origin;
}

/**
 * Start a standalone NAP-RESOURCE proxy for static Paja builds.
 *
 * It answers `POST /` and `POST /__kehto/resource` only for allowlisted
 * origins, with CORS preflight, and refuses to start without an allowlist.
 *
 * @param options - Allowed origins and listen address.
 * @returns The proxy URL and a closer.
 * @example
 * ```ts
 * const proxy = await startPajaResourceProxy({ allowedOrigins: ['https://kehto.github.io'], host: '127.0.0.1', port: 8787 });
 * ```
 */
export async function startPajaResourceProxy(options: PajaResourceProxyOptions): Promise<PajaResourceProxy> {
  const allowed = new Set(options.allowedOrigins.map(normalizePajaProxyOrigin));
  if (allowed.size === 0) throw new Error('The resource proxy needs at least one --allow-origin.');
  const server = createServer((request, response) => {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : '';
    const path = (request.url ?? '/').split(/[?#]/u)[0];
    if (path !== '/' && path !== '/__kehto/resource') return refuse(response, 404, 'Not found');
    if (!allowed.has(origin)) return refuse(response, 403, 'Origin not allowed', { vary: 'Origin' });
    const cors = {
      'access-control-allow-origin': origin,
      vary: 'Origin',
      'access-control-expose-headers': `${PAJA_RESOURCE_REDIRECT_HEADER}, ${PAJA_RESOURCE_UPSTREAM_HEADER}`,
    };
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        ...cors,
        'access-control-allow-methods': 'POST',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': String(getPajaSetting('server.resourceProxyPreflightMaxAgeSeconds')),
      });
      response.end();
      return;
    }
    if (request.method !== 'POST' || request.headers['content-type'] !== 'application/json') {
      return refuse(response, 405, 'POST application/json only', cors);
    }
    void servePajaResourceProxy(request, response, cors).catch(() => {
      if (!response.writableEnded) refuse(response, 502, 'Resource proxy failed', cors);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : options.port;
  return {
    url: `http://${options.host}:${port}/`,
    close: () => new Promise<void>((resolve) => {
      (server as typeof server & { closeAllConnections?(): void }).closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}

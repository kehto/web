import { createServer } from 'node:http';
import { concatBytes, fetchPinnedResource } from './server-resource-transport.js';
export { fetchPinnedResource } from './server-resource-transport.js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  createPajaHostConfig,
  formatPajaUrl,
  normalizePajaOptions,
  type PajaHostConfig,
  type PajaOptions,
  type PajaRawOptions,
} from './options.js';
import { renderPajaHtml } from './host-page.js';
import { resolvePajaRawOptions } from './config-file.js';
import { probeTargetCors } from './target-cors.js';

/** Options for starting the Paja local HTTP server. */
export interface PajaServerOptions {
  /** Raw options accepted by Paja; config-file references are resolved before serving. */
  readonly options: PajaRawOptions;
  /** Clock override used for deterministic host config in tests. */
  readonly now?: Date;
}

/** Running Paja server handle. */
export interface PajaServer {
  /** Runtime URL where the Paja host page is served. */
  readonly url: string;
  /** Current host-page config. */
  readonly hostConfig: PajaHostConfig;
  /** Update the target iframe URL without restarting the server. */
  updateTargetUrl(targetUrl: string): PajaHostConfig;
  /** Stop the HTTP server. */
  close(): Promise<void>;
}

/**
 * Start the local Paja development HTTP server.
 *
 * @param input - Raw options and optional clock override.
 * @returns Running server handle.
 */
export async function startPajaServer(input: PajaServerOptions): Promise<PajaServer> {
  const rawOptions = resolvePajaRawOptions(input.options);
  const options = normalizePajaOptions(rawOptions);
  const createdAt = input.now ?? new Date();
  let hostConfig = createPajaHostConfig(options, createdAt);
  let html = renderPajaHtml(hostConfig);
  let configJson = JSON.stringify(hostConfig, null, 2);
  let currentOptions = options;
  const resourceCapability = randomBytes(32).toString('base64url');
  let expectedOrigin = '';

  const setHostConfig = (nextOptions: PajaOptions): PajaHostConfig => {
    currentOptions = nextOptions;
    hostConfig = createPajaHostConfig(currentOptions, createdAt);
    html = renderPajaHtml(hostConfig);
    configJson = JSON.stringify(hostConfig, null, 2);
    return hostConfig;
  };

  const handleRequest = async (request: HttpRequest, response: HttpResponse): Promise<void> => {
    const requestUrl = request.url ?? '/';
    if (requestUrl === '/' || requestUrl.startsWith('/?')) {
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': `kehto-resource-${new URL(expectedOrigin).port}=${resourceCapability}; Path=/__kehto/resource; HttpOnly; SameSite=Strict`,
      });
      response.end(html);
      return;
    }

    if (requestUrl === '/__kehto/config.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(configJson);
      return;
    }

    if (requestUrl === '/__kehto/target.html') {
      const targetHtml = await fetchTargetHtml(hostConfig.target.url);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
      });
      response.end(targetHtml);
      return;
    }

    if (requestUrl === '/__kehto/target-cors.json') {
      const diagnostic = await probeTargetCors(hostConfig.target.url);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(diagnostic));
      return;
    }

    if (requestUrl === '/__kehto/browser-host.js') {
      const browserScript = readBrowserHostScript();
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(browserScript);
      return;
    }

    if (requestUrl === '/__kehto/resource') {
      await handleResourceProxy(request, response, expectedOrigin, resourceCapability);
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(message);
    });
  });

  await listen(server, options.host, options.port);
  const servedOptions = withBoundPort(options, getBoundPort(server, options.port));
  setHostConfig(servedOptions);
  expectedOrigin = formatPajaUrl(servedOptions).replace(/\/$/u, '');

  return {
    url: formatPajaUrl(servedOptions),
    get hostConfig() {
      return hostConfig;
    },
    updateTargetUrl(targetUrl) {
      return setHostConfig(withTargetUrl(currentOptions, targetUrl));
    },
    close: () => close(server),
  };
}

function readBrowserHostScript(): string {
  return readFileSync(new URL('./browser-host.js', import.meta.url), 'utf8');
}

async function fetchTargetHtml(targetUrl: string): Promise<string> {
  const response = await fetch(targetUrl, {
    headers: {
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`Target ${targetUrl} returned ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function listen(server: HttpServer, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    const forceClose = setTimeout(() => {
      server.closeAllConnections?.();
    }, 500);
    server.close((error?: Error) => {
      clearTimeout(forceClose);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    server.closeIdleConnections?.();
  });
}

interface HttpServer {
  listen(port: number, host: string, callback: () => void): void;
  once(event: 'error', callback: (error: Error) => void): void;
  off(event: 'error', callback: (error: Error) => void): void;
  close(callback: (error?: Error) => void): void;
  closeAllConnections?(): void;
  closeIdleConnections?(): void;
  address(): string | { port: number } | null;
}

interface HttpRequest {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', callback: (chunk: Uint8Array) => void): void;
  on(event: 'end', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: 'aborted', callback: () => void): void;
  destroy(): void;
}

interface HttpResponse {
  readonly writableEnded: boolean;
  on(event: 'close', callback: () => void): void;
  writeHead(statusCode: number, headers: Record<string, string>): void;
  end(chunk?: string | Uint8Array): void;
}

function getBoundPort(server: HttpServer, fallback: number): number {
  const address = server.address();
  return typeof address === 'object' && address !== null ? address.port : fallback;
}

function withBoundPort(options: PajaOptions, port: number): PajaOptions {
  return port === options.port ? options : { ...options, port };
}

function withTargetUrl(options: PajaOptions, targetUrl: string): PajaOptions {
  const url = normalizeServerTargetUrl(targetUrl);
  return url === options.targetUrl ? options : { ...options, targetUrl: url };
}

function normalizeServerTargetUrl(value: string): string {
  const raw = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid managed target URL "${raw}". Expected an absolute http(s) URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid managed target URL "${raw}". Only http: and https: URLs are supported.`);
  }
  return parsed.href;
}

async function handleResourceProxy(
  request: HttpRequest,
  response: HttpResponse,
  expectedOrigin: string,
  capability: string,
): Promise<void> {
  // Validate the caller before parsing an attacker-controlled destination or DNS lookup.
  if (request.method !== 'POST'
    || request.headers.origin !== expectedOrigin
    || request.headers.host !== new URL(expectedOrigin).host
    || request.headers['content-type'] !== 'application/json'
    || !hasCapability(request.headers.cookie, capability, new URL(expectedOrigin).port)) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  const payload = await readJsonBody(request);
  if (!payload || typeof payload.url !== 'string') {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Invalid resource request');
    return;
  }
  let url: URL;
  try {
    url = new URL(payload.url);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) throw new Error();
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Invalid resource URL');
    return;
  }
  const controller = new AbortController();
  response.on('close', () => { if (!response.writableEnded) controller.abort(); });
  try {
    const upstream = await fetchPinnedResource(url, controller.signal);
    if (controller.signal.aborted) return;
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      response.writeHead(200, {
        'cache-control': 'no-store', 'content-type': 'application/json', 'x-kehto-resource-redirect': '1',
      });
      response.end(JSON.stringify({ status: upstream.status, location: upstream.location ?? '' }));
      return;
    }
    response.writeHead(upstream.status, {
      'cache-control': 'no-store',
      'content-type': upstream.contentType,
      'content-length': String(upstream.body.byteLength),
    });
    response.end(upstream.body);
  } catch (error) {
    if (controller.signal.aborted) return;
    const message = error instanceof Error ? error.message : 'Resource proxy failed';
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(message);
  }
}

function hasCapability(header: string | string[] | undefined, capability: string, port: string): boolean {
  if (typeof header !== 'string') return false;
  return header.split(';').some((part) => part.trim() === `kehto-resource-${port}=${capability}`);
}

function readJsonBody(request: HttpRequest): Promise<{ url?: unknown } | null> {
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
    const timer = setTimeout(() => { finish(null); request.destroy(); }, 10_000);
    request.on('data', (chunk) => {
      if (settled) return;
      size += chunk.byteLength;
      if (size > 4096) { finish(null); request.destroy(); }
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

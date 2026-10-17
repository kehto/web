import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
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
        'set-cookie': `__Host-kehto-resource=${resourceCapability}; Path=/; HttpOnly; SameSite=Strict`,
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
  destroy(): void;
}

interface HttpResponse {
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

const RESOURCE_MAX_BYTES = 10 * 1024 * 1024;

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
    || !hasCapability(request.headers.cookie, capability)) {
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
  try {
    const upstream = await fetchPinnedResource(url);
    response.writeHead(upstream.status, {
      'cache-control': 'no-store',
      'content-type': upstream.contentType,
      'content-length': String(upstream.body.byteLength),
      ...(upstream.location ? { location: upstream.location } : {}),
    });
    response.end(upstream.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resource proxy failed';
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(message);
  }
}

function hasCapability(header: string | string[] | undefined, capability: string): boolean {
  if (typeof header !== 'string') return false;
  return header.split(';').some((part) => part.trim() === `__Host-kehto-resource=${capability}`);
}

function readJsonBody(request: HttpRequest): Promise<{ url?: unknown } | null> {
  return new Promise((resolve) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.byteLength;
      if (size > 4096) request.destroy();
      else chunks.push(chunk);
    });
    request.on('error', () => resolve(null));
    request.on('end', () => {
      try { resolve(JSON.parse(new TextDecoder().decode(concatBytes(chunks))) as { url?: unknown }); }
      catch { resolve(null); }
    });
  });
}

interface PinnedResourceResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
  location?: string;
}

/** Resolve immediately before the socket opens and pin that public address for the connection. */
export async function fetchPinnedResource(url: URL): Promise<PinnedResourceResponse> {
  const answers = await dnsLookup(url.hostname, { all: true, verbatim: true });
  const answer = answers.find((candidate) => isPublicAddress(candidate.address));
  if (!answer) throw new Error('Resource destination resolved to a blocked address');
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const upstream = transport(url, {
      method: 'GET', headers: { accept: '*/*', host: url.host },
      servername: url.hostname,
      lookup(_hostname: string, _options: unknown, callback: (error: Error | null, address?: string, family?: number) => void) {
        callback(null, answer.address, answer.family);
      },
    }, (incoming) => {
      const chunks: Uint8Array[] = [];
      let size = 0;
      incoming.on('data', (chunk: Uint8Array) => {
        size += chunk.byteLength;
        if (size > RESOURCE_MAX_BYTES) upstream.destroy(new Error('Resource exceeds byte limit'));
        else chunks.push(chunk);
      });
      incoming.on('error', reject);
      incoming.on('end', () => resolve({
        status: incoming.statusCode ?? 502,
        contentType: typeof incoming.headers['content-type'] === 'string'
          ? incoming.headers['content-type'] : 'application/octet-stream',
        body: concatBytes(chunks),
        ...(typeof incoming.headers.location === 'string' ? { location: incoming.headers.location } : {}),
      }));
    });
    upstream.once('error', reject);
    upstream.end();
  });
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number) as [number, number, number, number];
    return a !== 0 && a !== 10 && a !== 127 && a < 224 && !(a === 100 && b >= 64 && b <= 127)
      && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31)
      && !(a === 192 && b === 168) && !(a === 198 && (b === 18 || b === 19));
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    return normalized !== '::' && normalized !== '::1' && !normalized.startsWith('::ffff:')
      && !/^(?:fc|fd|fe[89ab]|ff)/u.test(normalized);
  }
  return false;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

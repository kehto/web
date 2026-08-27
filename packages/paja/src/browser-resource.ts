import { verifyBlobHash } from '@kehto/nip/5d';
import {
  ResourceServiceError,
  type ResourceInfo,
  type ResourceServiceOptions,
} from '@kehto/services';

import { normalizeUploadServers } from './simulation.js';

/** Maximum decoded payload exposed by Paja's local data-resource backend. */
export const PAJA_RESOURCE_MAX_BYTES = 10 * 1024 * 1024;
/** Maximum URLs accepted by one Paja resource bulk request. */
export const PAJA_RESOURCE_MAX_URLS = 100;
/** Maximum combined request-hint and host-default Blossom servers per resource. */
export const PAJA_RESOURCE_MAX_SERVERS = 8;

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const BLOSSOM_RESOURCE_PATTERN = /^blossom:sha256:([0-9a-f]{64})$/i;

/** Host-owned inputs for Paja's NAP-RESOURCE fetch boundary. */
export interface PajaResourceFetchOptions {
  /** Return ordered runtime candidates for this source-scoped Blossom URL. */
  readonly getBlossomServers?: (context: {
    readonly url: string;
    readonly windowId?: string;
  }) => readonly string[] | Promise<readonly string[]>;
  /** Fetch implementation used for configured Blossom server requests. */
  readonly fetch?: typeof fetch;
}

/**
 * Create Paja's developer-oriented NAP-RESOURCE fetch boundary.
 *
 * `data:` bytes are decoded locally. Canonical `blossom:sha256:<hex>` URLs are
 * resolved through accepted request hints followed by host-configured Blossom
 * servers, with redirects disabled and SHA-256 verified before delivery.
 * Direct HTTP(S) URLs are resolved from any origin through the browser,
 * subject to its CORS rules. All bytes are capped and classified locally;
 * upstream media types are ignored.
 *
 * @param options - Host-owned Blossom server and transport hooks.
 * @returns A sanitized resource fetch implementation.
 */
export function createPajaResourceFetch(
  options: PajaResourceFetchOptions = {},
): ResourceServiceOptions['fetch'] {
  return async (value, init) => {
    if (init.signal.aborted) throw new DOMException('Resource request cancelled', 'AbortError');
    const url = new URL(value);
    if (init.method && init.method.toUpperCase() !== 'GET') {
      throw new ResourceServiceError('invalid-request', 'NAP-RESOURCE is read-only');
    }
    if (url.protocol === 'blossom:') {
      return fetchBlossomResource(
        value,
        init.signal,
        init.servers ?? [],
        init.windowId,
        options,
      );
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return fetchNetworkResource(value, init.signal, options.fetch ?? globalThis.fetch);
    }
    if (url.protocol !== 'data:') {
      throw new ResourceServiceError('unsupported-scheme', `Paja does not enable ${url.protocol}`);
    }
    if (value.length > encodedDataUrlLimit(PAJA_RESOURCE_MAX_BYTES)) {
      throw new ResourceServiceError('too-large', `resource exceeds ${PAJA_RESOURCE_MAX_BYTES} bytes`);
    }

    const decoded = await fetch(value, { signal: init.signal });
    const bytes = new Uint8Array(await decoded.arrayBuffer());
    if (bytes.byteLength > PAJA_RESOURCE_MAX_BYTES) {
      throw new ResourceServiceError('too-large', `resource exceeds ${PAJA_RESOURCE_MAX_BYTES} bytes`);
    }
    const mime = sniffSafeResourceMime(bytes);
    if (!mime) {
      throw new ResourceServiceError('decode-failed', 'resource bytes are not an enabled safe media type');
    }
    return new Response(arrayBufferFor(bytes), { headers: { 'content-type': mime } });
  };
}

/**
 * Return Paja's truthful NAP-RESOURCE policy disclosure.
 *
 * @returns Current resource schemes and enforced limits.
 */
export function pajaResourceInfo(): ResourceInfo {
  const schemes = [
    { scheme: 'data', enabled: true },
    { scheme: 'https', enabled: true },
    { scheme: 'http', enabled: true },
    { scheme: 'blossom', enabled: true },
  ];
  return {
    schemes,
    maxBytes: PAJA_RESOURCE_MAX_BYTES,
    maxUrls: PAJA_RESOURCE_MAX_URLS,
    maxServers: PAJA_RESOURCE_MAX_SERVERS,
  };
}

async function fetchNetworkResource(
  value: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(value, {
      method: 'GET',
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch (error: unknown) {
    if (signal.aborted || isAbortError(error)) throw error;
    throw new ResourceServiceError(
      'network-error',
      error instanceof Error ? error.message : String(error),
    );
  }
  if (response.status === 404 || response.status === 410) {
    throw new ResourceServiceError('not-found', 'HTTP resource was not found');
  }
  if (!response.ok) {
    throw new ResourceServiceError('network-error', `HTTP resource returned ${response.status}`);
  }

  const bytes = await readCappedResponse(response, signal);
  const mime = sniffSafeResourceMime(bytes);
  if (!mime) {
    throw new ResourceServiceError('decode-failed', 'resource bytes are not an enabled safe media type');
  }
  return new Response(arrayBufferFor(bytes), { headers: { 'content-type': mime } });
}

async function fetchBlossomResource(
  value: string,
  signal: AbortSignal,
  requestServers: readonly string[],
  windowId: string | undefined,
  options: PajaResourceFetchOptions,
): Promise<Response> {
  const match = BLOSSOM_RESOURCE_PATTERN.exec(value);
  if (!match?.[1]) {
    throw new ResourceServiceError('invalid-request', 'expected blossom:sha256:<64 hex characters>');
  }
  const expectedHash = match[1].toLowerCase();
  const configuredServers = await options.getBlossomServers?.({ url: value, windowId }) ?? [];
  if (signal.aborted) throw new DOMException('Resource request cancelled', 'AbortError');
  const servers = resolveBlossomServers(requestServers, configuredServers);
  if (servers.length === 0) {
    throw new ResourceServiceError('blocked-by-policy', 'Paja has no accepted Blossom server');
  }

  const fetcher = options.fetch ?? globalThis.fetch;
  let foundHashMismatch = false;
  let foundNotFound = false;
  let foundInconclusive = false;
  let lastNetworkMessage = 'all accepted Blossom servers failed';
  for (const server of servers) {
    if (signal.aborted) throw new DOMException('Resource request cancelled', 'AbortError');
    const resourceUrl = `${server}/${expectedHash}`;
    let response: Response;
    try {
      response = await fetcher(resourceUrl, {
        method: 'GET',
        signal,
        redirect: 'error',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch (error: unknown) {
      if (signal.aborted || isAbortError(error)) throw error;
      foundInconclusive = true;
      lastNetworkMessage = error instanceof Error ? error.message : String(error);
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      foundNotFound = true;
      continue;
    }
    if (!response.ok) {
      foundInconclusive = true;
      lastNetworkMessage = `Blossom server returned HTTP ${response.status}`;
      continue;
    }

    const bytes = await readCappedResponse(response, signal);
    if (!verifyBlobHash(bytes, expectedHash)) {
      foundHashMismatch = true;
      continue;
    }
    const mime = sniffSafeResourceMime(bytes);
    if (!mime) {
      throw new ResourceServiceError('decode-failed', 'resource bytes are not an enabled safe media type');
    }
    return new Response(arrayBufferFor(bytes), { headers: { 'content-type': mime } });
  }

  if (foundHashMismatch) {
    throw new ResourceServiceError('decode-failed', 'Blossom response did not match the requested SHA-256');
  }
  if (foundInconclusive) {
    throw new ResourceServiceError('network-error', lastNetworkMessage);
  }
  if (foundNotFound) {
    throw new ResourceServiceError('not-found', 'Blossom resource was not found');
  }
  throw new ResourceServiceError('network-error', lastNetworkMessage);
}

function resolveBlossomServers(
  requestServers: readonly string[],
  configuredServers: readonly string[],
): string[] {
  const servers: string[] = [];
  for (const value of requestServers) {
    const server = normalizePublicBlossomServer(value);
    if (server && !servers.includes(server)) servers.push(server);
    if (servers.length === PAJA_RESOURCE_MAX_SERVERS) return servers;
  }
  for (const server of usableBlossomServers(configuredServers)) {
    if (!servers.includes(server)) servers.push(server);
    if (servers.length === PAJA_RESOURCE_MAX_SERVERS) break;
  }
  return servers;
}

/** Normalize an untrusted Blossom hint to one public HTTPS origin. */
export function normalizePublicBlossomServer(value: string): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname !== '/'
      || !isPublicHostname(url.hostname)
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Paja is a browser-only developer runtime: reject obvious local/private
// literals here, while production resolvers must additionally enforce the
// NAP-RESOURCE DNS-time address check before connecting and after redirects.
function isPublicHostname(value: string): boolean {
  const hostname = value.replace(/^\[|\]$/gu, '').toLowerCase();
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || !hostname.includes('.')
  ) return false;
  if (hostname.includes(':')) {
    return hostname !== '::'
      && hostname !== '::1'
      && !hostname.startsWith('::ffff:')
      && !/^(?:fc|fd|fe[89ab]|ff)/iu.test(hostname)
      && !hostname.startsWith('2001:db8:');
  }
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  const [first, second] = octets as [number, number, number, number];
  return first !== 0
    && first !== 10
    && first !== 127
    && first < 224
    && !(first === 100 && second >= 64 && second <= 127)
    && !(first === 169 && second === 254)
    && !(first === 172 && second >= 16 && second <= 31)
    && !(first === 192 && second === 168)
    && !(first === 198 && (second === 18 || second === 19));
}

function usableBlossomServers(values: readonly string[]): string[] {
  const servers: string[] = [];
  for (const value of values) {
    try {
      const [server] = normalizeUploadServers([value]);
      if (server && !servers.includes(server)) servers.push(server);
    } catch {
      // Host config can contain stale or untrusted discovery hints. Ignore them.
    }
  }
  return servers;
}

async function readCappedResponse(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > PAJA_RESOURCE_MAX_BYTES) {
    throw resourceTooLarge();
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > PAJA_RESOURCE_MAX_BYTES) throw resourceTooLarge();
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw new DOMException('Resource request cancelled', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > PAJA_RESOURCE_MAX_BYTES) {
        await reader.cancel();
        throw resourceTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function resourceTooLarge(): ResourceServiceError {
  return new ResourceServiceError('too-large', `resource exceeds ${PAJA_RESOURCE_MAX_BYTES} bytes`);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'DOMException');
}

function arrayBufferFor(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodedDataUrlLimit(maxBytes: number): number {
  return Math.ceil(maxBytes * 4 / 3) + 1024;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function sniffSafeResourceMime(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE') return 'audio/wav';
  if (ascii(bytes, 0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(bytes, 0, 3) === 'ID3' || startsWith(bytes, [0xff, 0xfb])) return 'audio/mpeg';
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  if (ascii(bytes, 4, 8) === 'ftyp') return 'video/mp4';
  if (ascii(bytes, 0, 4) === 'wOFF') return 'font/woff';
  if (ascii(bytes, 0, 4) === 'wOF2') return 'font/woff2';
  return sniffSafeTextMime(bytes);
}

function sniffSafeTextMime(bytes: Uint8Array): string | null {
  let text: string;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    return null;
  }
  if (/\u0000/u.test(text)) return null;
  const normalized = text.trimStart().toLowerCase();
  if (
    normalized.startsWith('<svg')
    || normalized.startsWith('<?xml')
    || normalized.startsWith('<!doctype html')
    || normalized.startsWith('<html')
    || normalized.startsWith('<script')
  ) return null;
  if (normalized.startsWith('{') || normalized.startsWith('[')) {
    try {
      JSON.parse(text);
      return 'application/json';
    } catch {
      return 'text/plain';
    }
  }
  return 'text/plain';
}

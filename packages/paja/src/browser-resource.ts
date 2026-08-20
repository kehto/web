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

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const BLOSSOM_RESOURCE_PATTERN = /^blossom:sha256:([0-9a-f]{64})$/i;

/** Host-owned inputs for Paja's NAP-RESOURCE fetch boundary. */
export interface PajaResourceFetchOptions {
  /** Return the current ordered Blossom server candidates. */
  readonly getBlossomServers?: () => readonly string[];
  /** Fetch implementation used for configured Blossom server requests. */
  readonly fetch?: typeof fetch;
}

/**
 * Create Paja's policy-bound NAP-RESOURCE fetch boundary.
 *
 * `data:` bytes are decoded locally. Canonical `blossom:sha256:<hex>` URLs are
 * resolved only through host-configured Blossom servers, with redirects
 * disabled and SHA-256 verified before delivery. Arbitrary network URLs remain
 * disabled. All bytes are capped and classified locally; upstream media types
 * are ignored.
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
      return fetchBlossomResource(value, init.signal, options);
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
 * @param blossomServers - Current host-owned Blossom server candidates.
 * @returns Current resource schemes and enforced limits.
 */
export function pajaResourceInfo(blossomServers: readonly string[] = []): ResourceInfo {
  const schemes = [{ scheme: 'data', enabled: true }];
  if (usableBlossomServers(blossomServers).length > 0) {
    schemes.push({ scheme: 'blossom', enabled: true });
  }
  return {
    schemes,
    maxBytes: PAJA_RESOURCE_MAX_BYTES,
    maxUrls: PAJA_RESOURCE_MAX_URLS,
  };
}

async function fetchBlossomResource(
  value: string,
  signal: AbortSignal,
  options: PajaResourceFetchOptions,
): Promise<Response> {
  const match = BLOSSOM_RESOURCE_PATTERN.exec(value);
  if (!match?.[1]) {
    throw new ResourceServiceError('invalid-request', 'expected blossom:sha256:<64 hex characters>');
  }
  const expectedHash = match[1].toLowerCase();
  const servers = usableBlossomServers(options.getBlossomServers?.() ?? []);
  if (servers.length === 0) {
    throw new ResourceServiceError('blocked-by-policy', 'Paja has no configured Blossom server');
  }

  const fetcher = options.fetch ?? globalThis.fetch;
  let foundHashMismatch = false;
  let foundNotFound = false;
  let lastNetworkMessage = 'all configured Blossom servers failed';
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
      });
    } catch (error: unknown) {
      if (signal.aborted || isAbortError(error)) throw error;
      lastNetworkMessage = error instanceof Error ? error.message : String(error);
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      foundNotFound = true;
      continue;
    }
    if (!response.ok) {
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
  if (foundNotFound) {
    throw new ResourceServiceError('not-found', 'Blossom resource was not found');
  }
  throw new ResourceServiceError('network-error', lastNetworkMessage);
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

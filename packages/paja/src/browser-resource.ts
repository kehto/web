import {
  ResourceServiceError,
  type ResourceInfo,
  type ResourceServiceOptions,
} from '@kehto/services';

/** Maximum decoded payload exposed by Paja's local data-resource backend. */
export const PAJA_RESOURCE_MAX_BYTES = 10 * 1024 * 1024;
/** Maximum URLs accepted by one Paja resource bulk request. */
export const PAJA_RESOURCE_MAX_URLS = 100;

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

/**
 * Create Paja's no-network NAP-RESOURCE fetch boundary.
 *
 * Paja deliberately enables only `data:` until its Node host has a complete
 * redirect-by-redirect DNS/SSRF proxy. Decoded bytes are capped and classified
 * locally; the media type declared in the data URL is ignored.
 *
 * @returns A sanitized resource fetch implementation.
 */
export function createPajaDataResourceFetch(): ResourceServiceOptions['fetch'] {
  return async (value, init) => {
    if (init.signal.aborted) throw new DOMException('Resource request cancelled', 'AbortError');
    const url = new URL(value);
    if (url.protocol !== 'data:') {
      throw new ResourceServiceError('unsupported-scheme', `Paja does not enable ${url.protocol}`);
    }
    if (init.method && init.method.toUpperCase() !== 'GET') {
      throw new ResourceServiceError('invalid-request', 'NAP-RESOURCE is read-only');
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
    return new Response(bytes, { headers: { 'content-type': mime } });
  };
}

/**
 * Return Paja's truthful NAP-RESOURCE policy disclosure.
 *
 * @returns Static data-only resource limits.
 */
export function pajaResourceInfo(): ResourceInfo {
  return {
    schemes: [{ scheme: 'data', enabled: true }],
    maxBytes: PAJA_RESOURCE_MAX_BYTES,
    maxUrls: PAJA_RESOURCE_MAX_URLS,
  };
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

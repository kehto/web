import { ResourceServiceError } from './resource-service.js';
import type { ResourceServiceOptions } from './resource-service.js';

function publicStreamUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || /\.(localhost|local|internal)$/.test(host) || !host.includes('.') || host.includes(':');
  const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host.split('.').map(Number) : null;
  if (url.protocol !== 'https:' || url.username || url.password || local || (ip && (
    ip[0] === 0 || ip[0] === 10 || ip[0] === 127 || ip[0]! >= 224
    || (ip[0] === 100 && ip[1]! >= 64 && ip[1]! <= 127)
    || (ip[0] === 169 && ip[1] === 254) || (ip[0] === 172 && ip[1]! >= 16 && ip[1]! <= 31)
    || (ip[0] === 192 && ip[1] === 168) || (ip[0] === 198 && (ip[1] === 18 || ip[1] === 19))
  ))) throw new ResourceServiceError('blocked-by-policy', 'live media requires a public HTTPS URL without credentials');
  return url;
}

function audioMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'audio/mpeg';
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0 && (bytes[1]! & 0x18) !== 0x08) {
    if ((bytes[1]! & 0x06) !== 0 && (bytes[2]! & 0xf0) !== 0xf0 && (bytes[2]! & 0x0c) !== 0x0c) return 'audio/mpeg';
    if ((bytes[1]! & 0xf6) === 0xf0) return 'audio/aac';
  }
  throw new ResourceServiceError('decode-failed', 'unsupported live audio bytes');
}

/**
 * Fetch live MP3/ADTS audio for a host resource resolver without awaiting EOF.
 * Browser CORS and private-network protections apply; production proxies must also enforce DNS-time address policy.
 * Redirects and credentials are disabled, and upstream MIME hints never authorize bytes.
 * @param fetcher - Host-owned browser transport, injectable for tests.
 * @returns A streaming resolver for ResourceServiceOptions.stream, after endpoint grants are checked.
 * @example
 * ```ts
 * const resource = createResourceService({ fetch: resolveBytes, stream: createBrowserMediaStreamFetch() });
 * ```
 */
export function createBrowserMediaStreamFetch(fetcher: typeof fetch = globalThis.fetch): NonNullable<ResourceServiceOptions['stream']> {
  return async (value, init) => {
    const url = publicStreamUrl(value);
    const response = await fetcher(url.href, {
      method: 'GET', signal: init.signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new ResourceServiceError('network-error', 'live audio unavailable');
    }
    const reader = response.body.getReader();
    try {
      const prefix = new Uint8Array(4);
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (length < prefix.length) {
        const { value: chunk, done } = await reader.read();
        if (done) throw new ResourceServiceError('decode-failed', 'empty live audio');
        if (!chunk.byteLength) continue;
        if (chunk.byteLength > 1024 * 1024) throw new ResourceServiceError('too-large', 'live audio chunk too large');
        prefix.set(chunk.subarray(0, prefix.length - length), length);
        length += Math.min(chunk.byteLength, prefix.length - length);
        chunks.push(chunk);
      }
      const mime = audioMime(prefix);
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { for (const chunk of chunks) controller.enqueue(chunk); },
        async pull(controller) {
          try {
            const item = await reader.read();
            if (item.done) { reader.releaseLock(); controller.close(); }
            else controller.enqueue(item.value);
          } catch (error) { controller.error(error); }
        },
        async cancel() { await reader.cancel(); reader.releaseLock(); },
      }), { headers: { 'content-type': mime } });
    } catch (error) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
      throw error;
    }
  };
}

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPajaPublicResourceAddress } from './resource-address.js';
import { getPajaSetting } from './settings.js';


/** One upstream response, without following redirects or trusting its MIME. */
export interface PinnedResourceResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
  location?: string;
}

/**
 * Read one HTTP(S) hop using a public address pinned immediately after DNS.
 * @param input - Host-authorized destination; no credentials are forwarded.
 * @param signal - Aborts DNS waiting, connection, and body consumption.
 * @returns Bounded bytes or redirect metadata; MIME remains untrusted.
 * @example
 * const response = await fetchPinnedResource(new URL('https://example.com/image'), signal);
 */
export async function fetchPinnedResource(input: URL, signal?: AbortSignal): Promise<PinnedResourceResponse> {
  const url = new URL(input.href);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid resource URL');
  }
  const hostname = url.hostname.replace(/^\[|\]$/gu, '');
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', forwardAbort, { once: true });
  if (signal?.aborted) forwardAbort();
  const timer = setTimeout(() => controller.abort(new Error('Resource request timed out')), getPajaSetting('server.resourceTimeoutMs'));
  try {
    controller.signal.throwIfAborted();
    const family = isIP(hostname);
    const answers = family ? [{ address: hostname, family }]
      : await abortable(dnsLookup(hostname, { all: true, verbatim: true }), controller.signal);
    controller.signal.throwIfAborted();
    const answer = answers.find((candidate) => isPajaPublicResourceAddress(candidate.address));
    if (!answer) throw new Error('Resource destination resolved to a blocked address');
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown, value?: PinnedResourceResponse) => {
        if (settled) return;
        settled = true;
        controller.signal.removeEventListener('abort', onAbort);
        if (error) reject(error);
        else resolve(value!);
      };
      const upstream = transport(url, {
        method: 'GET', agent: false, headers: { accept: '*/*', host: url.host },
        ...(family ? {} : { servername: hostname }),
        lookup(_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) {
          if (options.all) callback(null, [{ address: answer.address, family: answer.family }]);
          else callback(null, answer.address, answer.family);
        },
      }, (incoming) => {
        const chunks: Uint8Array[] = [];
        let size = 0;
        incoming.on('data', (chunk: Uint8Array) => {
          if (settled) return;
          size += chunk.byteLength;
          if (size > getPajaSetting('server.resourceMaxBytes')) {
            const error = new Error('Resource exceeds byte limit');
            finish(error);
            upstream.destroy(error);
          } else chunks.push(chunk);
        });
        incoming.on('error', (error: Error) => finish(error));
        incoming.on('end', () => finish(undefined, {
          status: incoming.statusCode ?? 502,
          contentType: typeof incoming.headers['content-type'] === 'string'
            ? incoming.headers['content-type'] : 'application/octet-stream',
          body: concatBytes(chunks),
          ...(typeof incoming.headers.location === 'string' ? { location: incoming.headers.location } : {}),
        }));
      });
      function onAbort() {
        const error = controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Resource request aborted');
        finish(error);
        upstream.destroy(error);
      }
      upstream.once('error', (error: Error) => finish(error));
      controller.signal.addEventListener('abort', onAbort, { once: true });
      if (controller.signal.aborted) onAbort();
      else upstream.end();
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason ?? new Error('Resource request aborted'));
    };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Join bounded response chunks without exposing Buffer through browser-facing types. */
export function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

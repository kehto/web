/**
 * http-uploader.ts — NAP-UPLOAD concrete HTTP-backed {@link Uploader}.
 *
 * The reference upload backend for {@link createUploadService}. Implements two
 * storage rails over HTTP:
 *
 * - **NIP-96** — signs a NIP-98 (kind 27235) HTTP-auth event, POSTs the file as
 *   `multipart/form-data`, and maps the returned NIP-94 event tags into an
 *   {@link UploadResult}.
 * - **Blossom** — signs a kind 24242 authorization event, PUTs the raw bytes to
 *   `<server>/upload`, and maps the returned blob descriptor.
 *
 * Signing (`signEvent`) and transport (`fetch`) are injected so the uploader
 * carries no Nostr or network dependency and is fully unit-testable. The shell
 * holds the signing key and never exposes it to napplets — the uploader only
 * receives a signing callback. Server URLs are shell configuration, not napplet
 * input: a napplet may *hint* a rail, but never a server.
 *
 * The configured server URL is used directly as the upload endpoint (the
 * NIP-96 `api_url` / Blossom base). Hosts that need `.well-known` discovery can
 * resolve it before constructing the uploader.
 *
 * @example
 * ```ts
 * const uploader = createHttpUploader({
 *   rails: { nip96: { servers: ['https://nostr.build/api/v2/nip96/upload'] } },
 *   signEvent: (tmpl) => signer.signEvent(tmpl),
 * });
 * runtime.registerService('upload', createUploadService({ uploader }));
 * ```
 *
 * @packageDocumentation
 */

import type { EventTemplate, NostrEvent } from '@napplet/core';
import type {
  NostrTag,
  UploadDimensions,
  UploadRail,
  UploadRequest,
  UploadResult,
  Uploader,
  UploaderContext,
} from './upload-service.js';

/** NIP-98 HTTP-auth event kind. */
const KIND_NIP98 = 27235;
/** Blossom authorization event kind. */
const KIND_BLOSSOM_AUTH = 24242;
/** Blossom auth-event lifetime, in seconds. */
const BLOSSOM_AUTH_TTL_S = 3600;

/** Per-rail server configuration. The first server is the primary endpoint. */
export interface RailServerConfig {
  /** Ordered server endpoint URLs; index 0 is primary. */
  servers: string[];
}

/** Storage rails this uploader can serve. */
export interface HttpUploaderRails {
  /** NIP-96 HTTP file storage. */
  nip96?: RailServerConfig;
  /** Blossom blob storage. */
  blossom?: RailServerConfig;
}

/** Signs an event template on the user's behalf (shell holds the key). */
export type SignEvent = (template: EventTemplate) => Promise<NostrEvent>;

/** Options for {@link createHttpUploader}. */
export interface HttpUploaderOptions {
  /** Configured rails + their servers. */
  rails: HttpUploaderRails;
  /** Rail to use when a request omits one; defaults to the first configured rail. */
  defaultRail?: UploadRail;
  /** Signs NIP-98 / Blossom auth events. Required. */
  signEvent: SignEvent;
  /** Fetch implementation; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Hex SHA-256 of the payload bytes; defaults to Web Crypto. */
  digestSha256?: (bytes: Uint8Array) => Promise<string>;
  /** Unix *seconds* clock for event timestamps; defaults to `Date.now()/1000`. */
  now?: () => number;
}

declare const btoa: (data: string) => string;
declare const crypto: { subtle: { digest(alg: string, data: ArrayBuffer): Promise<ArrayBuffer> } };

/**
 * Create the reference HTTP {@link Uploader} (NIP-96 + Blossom rails).
 *
 * @param options - Rails, server config, and the injected `signEvent`.
 * @returns An {@link Uploader} for `createUploadService({ uploader })`.
 * @throws If `options.signEvent` is missing.
 */
export function createHttpUploader(options: HttpUploaderOptions): Uploader {
  if (!options || typeof options.signEvent !== 'function') {
    throw new Error('createHttpUploader: options.signEvent is required');
  }
  const rails = options.rails ?? {};
  const signEvent = options.signEvent;
  const fetchFn = options.fetch ?? fetch;
  const digest = options.digestSha256 ?? defaultDigestSha256;
  const nowS = options.now ?? (() => Math.floor(Date.now() / 1000));
  const defaultRail = options.defaultRail ?? firstConfiguredRail(rails);

  async function upload(request: UploadRequest, ctx: UploaderContext): Promise<UploadResult> {
    const rail = request.rail ?? defaultRail;
    const config = rail === 'nip96' ? rails.nip96 : rail === 'blossom' ? rails.blossom : undefined;
    if (rail !== 'nip96' && rail !== 'blossom') {
      return failed(ctx.uploadId, rail ?? 'unknown', 'unsupported rail');
    }

    const server = config?.servers?.[0];
    if (!server) {
      return failed(ctx.uploadId, rail, 'no server configured');
    }

    const bytes = await toBytes(request.data);
    const sha256 = await digest(bytes);

    try {
      return rail === 'nip96'
        ? await uploadNip96({ request, ctx, server, bytes, sha256, signEvent, fetchFn, nowS })
        : await uploadBlossom({ request, ctx, server, bytes, sha256, signEvent, fetchFn, nowS });
    } catch (err) {
      return failed(ctx.uploadId, rail, toErrorMessage(err), sha256);
    }
  }

  return { upload };
}

// ─── NIP-96 ───────────────────────────────────────────────────────────────

interface RailUploadArgs {
  request: UploadRequest;
  ctx: UploaderContext;
  server: string;
  bytes: Uint8Array;
  sha256: string;
  signEvent: SignEvent;
  fetchFn: typeof fetch;
  nowS: () => number;
}

async function uploadNip96(args: RailUploadArgs): Promise<UploadResult> {
  const { request, ctx, server, bytes, sha256, signEvent, fetchFn, nowS } = args;

  const auth = await signEvent({
    kind: KIND_NIP98,
    created_at: nowS(),
    content: '',
    tags: [
      ['u', server],
      ['method', 'POST'],
      ['payload', sha256],
    ],
  });

  const form = new FormData();
  form.append('file', new Blob([bytesToArrayBuffer(bytes)], { type: request.mimeType }), request.filename ?? 'file');
  if (request.caption !== undefined) form.append('caption', request.caption);
  if (request.mimeType !== undefined) form.append('content_type', request.mimeType);
  if (request.noTransform) form.append('no_transform', 'true');

  const res = await fetchFn(server, {
    method: 'POST',
    headers: { Authorization: nostrAuthHeader(auth) },
    body: form,
  });

  if (!res.ok) {
    return failed(ctx.uploadId, 'nip96', `server rejected (HTTP ${res.status})`, sha256);
  }

  const body = (await res.json()) as Nip96Response;
  if (body.status === 'error') {
    return failed(ctx.uploadId, 'nip96', body.message ?? 'upload failed', sha256);
  }

  const tags = body.nip94_event?.tags ?? [];
  return fromNip94Tags(ctx.uploadId, 'nip96', tags, bytes.byteLength, sha256);
}

interface Nip96Response {
  status?: 'success' | 'error' | string;
  message?: string;
  nip94_event?: { tags?: string[][] };
}

/** Map NIP-94 / imeta tags into an {@link UploadResult}. */
function fromNip94Tags(
  uploadId: string,
  rail: UploadRail,
  tags: string[][],
  fallbackSize: number,
  fallbackSha: string,
): UploadResult {
  const get = (name: string): string | undefined => tags.find((t) => t[0] === name)?.[1];
  const url = get('url');
  const result: UploadResult = {
    ok: Boolean(url),
    uploadId,
    status: url ? 'complete' : 'failed',
    rail,
    sha256: get('x') ?? fallbackSha,
    nip94: tags as NostrTag[],
  };
  if (url) result.url = url;
  const ox = get('ox');
  if (ox) result.originalSha256 = ox;
  const size = get('size');
  result.size = size ? Number(size) : fallbackSize;
  const m = get('m');
  if (m) result.mimeType = m;
  const dim = parseDimensions(get('dim'));
  if (dim) result.dimensions = dim;
  const blurhash = get('blurhash');
  if (blurhash) result.blurhash = blurhash;
  if (!url) result.error = 'server returned no url';
  return result;
}

// ─── Blossom ────────────────────────────────────────────────────────────────

async function uploadBlossom(args: RailUploadArgs): Promise<UploadResult> {
  const { request, ctx, server, bytes, sha256, signEvent, fetchFn, nowS } = args;

  const auth = await signEvent({
    kind: KIND_BLOSSOM_AUTH,
    created_at: nowS(),
    content: `Upload ${request.filename ?? 'file'}`,
    tags: [
      ['t', 'upload'],
      ['x', sha256],
      ['expiration', String(nowS() + BLOSSOM_AUTH_TTL_S)],
    ],
  });

  const endpoint = `${trimTrailingSlash(server)}/upload`;
  const headers: Record<string, string> = { Authorization: nostrAuthHeader(auth) };
  if (request.mimeType) headers['Content-Type'] = request.mimeType;

  const res = await fetchFn(endpoint, {
    method: 'PUT',
    headers,
    body: bytesToArrayBuffer(bytes),
  });

  if (!res.ok) {
    return failed(ctx.uploadId, 'blossom', `server rejected (HTTP ${res.status})`, sha256);
  }

  const blob = (await res.json()) as BlossomDescriptor;
  if (!blob.url) {
    return failed(ctx.uploadId, 'blossom', 'server returned no url', sha256);
  }

  const result: UploadResult = {
    ok: true,
    uploadId: ctx.uploadId,
    status: 'complete',
    rail: 'blossom',
    url: blob.url,
    sha256: blob.sha256 ?? sha256,
    size: blob.size ?? bytes.byteLength,
  };
  if (blob.type) result.mimeType = blob.type;
  return result;
}

interface BlossomDescriptor {
  url?: string;
  sha256?: string;
  size?: number;
  type?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function failed(uploadId: string, rail: UploadRail, error: string, sha256?: string): UploadResult {
  return { ok: false, uploadId, status: 'failed', rail, error, ...(sha256 ? { sha256 } : {}) };
}

function firstConfiguredRail(rails: HttpUploaderRails): UploadRail | undefined {
  if (rails.nip96?.servers?.length) return 'nip96';
  if (rails.blossom?.servers?.length) return 'blossom';
  return undefined;
}

function nostrAuthHeader(event: NostrEvent): string {
  return `Nostr ${base64Utf8(JSON.stringify(event))}`;
}

function base64Utf8(s: string): string {
  // UTF-8 safe base64 (event content/tags may contain non-ASCII).
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

function parseDimensions(dim: string | undefined): UploadDimensions | undefined {
  if (!dim) return undefined;
  const m = /^(\d+)x(\d+)$/.exec(dim);
  if (!m) return undefined;
  return { width: Number(m[1]), height: Number(m[2]) };
}

async function toBytes(data: ArrayBuffer | Blob): Promise<Uint8Array> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await data.arrayBuffer());
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function defaultDigestSha256(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytesToArrayBuffer(bytes));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'upload failed';
}

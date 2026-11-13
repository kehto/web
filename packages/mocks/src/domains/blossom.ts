/**
 * domains/blossom.ts — Mock NAP-BLOSSOM service.
 *
 * Spec: naps/NAP-BLOSSOM.md @ napplet/naps PR #71 head 5e74daa4 (draft)
 * Routes: blossom.check, blossom.get, blossom.checkUpload, blossom.upload,
 *         blossom.mirror, blossom.checkMedia, blossom.media, blossom.list,
 *         blossom.delete, blossom.servers, blossom.addServer,
 *         blossom.removeServer, blossom.reorderServers
 * Spec gaps / decisions:
 * - One in-memory blob store keyed by sha256; each blob records the servers
 *   that hold it. Any syntactically valid http(s) server is "reachable"; a blob
 *   absent from that server is a 404 `not-found`.
 * - Hashes are `placeholderSha256` values, so `hash-mismatch` fires when a
 *   caller-supplied `sha256` differs from the placeholder digest of `data`.
 * - `media` stands in for BUD-05 optimization: image uploads come back as
 *   `image/webp` with a different placeholder hash and a smaller size.
 * - Authenticated endpoints (`upload`, `mirror`, `media`, `delete`) and every
 *   server-list mutation return `not-signed-in` when `signedIn: false`.
 * - `blob` bytes cross the wire as an `ArrayBuffer`, the draft's projection-native
 *   byte object. `@napplet/nap` 0.32.0 ships no blossom types; shapes follow the draft.
 */
import type { NostrEvent, NostrTag } from '@napplet/core';
import { defineMockService } from '../core/handler.js';
import type { MockRouteContext } from '../core/handler.js';
import { mockHex, mockPubkey } from '../core/rng.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_EPOCH_SECONDS, buildMockEvent } from '../fixtures/nostr.js';
import { extensionForMime, linuxDistroBytes, mimeForFileName, placeholderBytes, placeholderSha256, toBytes } from './file-bytes.js';

/** Spec document the mock was written against. */
export const BLOSSOM_SPEC_REF: NapSpecRef = {
  nap: 'NAP-BLOSSOM',
  status: 'draft',
  source: 'pr',
  pr: 71,
  sha: '5e74daa4',
  path: 'naps/NAP-BLOSSOM.md',
};

/** Default seeded BUD-03 server list. */
export const DEFAULT_BLOSSOM_SERVERS: readonly string[] = Object.freeze(['https://blossom.example.org', 'https://cdn.example.net']);

/** `BlossomAuthMode` enumeration. */
export type BlossomAuthMode = 'auto' | 'required' | 'none';

/**
 * `BlossomHeaders` record.
 *
 * @example
 * ```ts
 * const headers: BlossomHeaders = { contentType: 'application/pdf', contentLength: 184292 };
 * ```
 */
export interface BlossomHeaders {
  contentType?: string;
  contentLength?: number;
  acceptRanges?: string;
  sunset?: string;
  reason?: string;
}

/**
 * `BlossomDescriptor` record.
 *
 * @example
 * ```ts
 * const descriptor: BlossomDescriptor = { url: 'https://cdn.example.net/ab….iso', sha256: 'ab…', size: 1024, type: 'application/x-iso9660-image', uploaded: 1767225600 };
 * ```
 */
export interface BlossomDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
  nip94?: NostrTag[];
}

/**
 * One stored blob.
 *
 * @example
 * ```ts
 * const blob = service.mock.state().blobs.get(LINUX_DISTROS[0].sha256);
 * blob?.servers.has('https://blossom.example.org');
 * ```
 */
export interface MockBlossomBlob {
  /** Placeholder 64-hex hash. */
  sha256: string;
  /** Stored bytes. */
  bytes: Uint8Array;
  /** MIME type. */
  type: string;
  /** Byte size. */
  size: number;
  /** Unix seconds when stored. */
  uploaded: number;
  /** Hex pubkey that uploaded the blob (for `list`). */
  uploader: string;
  /** Server origins holding the blob. */
  servers: Set<string>;
}

/**
 * In-memory state of the blossom mock.
 *
 * @example
 * ```ts
 * createMockBlossomService().mock.state().serverList.length === 2;
 * ```
 */
export interface MockBlossomState {
  /** Blobs keyed by sha256. */
  blobs: Map<string, MockBlossomBlob>;
  /** Ordered BUD-03 server list of the shell user. */
  serverList: string[];
  /** Latest published kind `10063` event, when any. */
  serverListEvent?: NostrEvent;
  /** Publication counter used to label server-list events. */
  serial: number;
}

/**
 * Options for `createMockBlossomService`.
 *
 * @example
 * ```ts
 * const service = createMockBlossomService({ signedIn: false });
 * ```
 */
export interface MockBlossomOptions extends MockServiceOptions {
  /** Seeded BUD-03 list. Default `DEFAULT_BLOSSOM_SERVERS`. Pass `[]` for no list. */
  servers?: readonly string[];
  /** Whether a shell-user signer is connected. Default `true`. */
  signedIn?: boolean;
  /** Upload size cap. Default 100 MiB. */
  maxBytes?: number;
  /** Shell-user pubkey that owns the seeded blobs and server list. Default `alice`. */
  userPubkey?: string;
}

/**
 * The blossom mock.
 *
 * @example
 * ```ts
 * const service = createMockBlossomService();
 * service.handleMessage('w1', { type: 'blossom.servers', id: 's1' }, send);
 * ```
 */
export type MockBlossomService = MockService<MockBlossomState>;

type BlossomResult = Record<string, unknown> & { ok: boolean; status?: number; error?: string };
type Context = MockRouteContext<MockBlossomState>;

const AUTHENTICATED = new Set(['blossom.upload', 'blossom.mirror', 'blossom.media', 'blossom.delete']);
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

function serverOrigin(server: unknown): string | null {
  if (typeof server !== 'string') return null;
  try {
    const url = new URL(server);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function describe(blob: MockBlossomBlob, origin: string): BlossomDescriptor {
  const url = `${origin}/${blob.sha256}${extensionForMime(blob.type)}`;
  return { url, sha256: blob.sha256, size: blob.size, type: blob.type, uploaded: blob.uploaded, nip94: [['url', url], ['m', blob.type], ['x', blob.sha256], ['size', String(blob.size)]] };
}

function seedBlobs(userPubkey: string, servers: readonly string[]): Map<string, MockBlossomBlob> {
  const blobs = new Map<string, MockBlossomBlob>();
  LINUX_DISTROS.forEach((image, index) => {
    const bytes = linuxDistroBytes(image);
    blobs.set(image.sha256, {
      sha256: image.sha256,
      bytes,
      type: mimeForFileName(image.fileName),
      size: bytes.length,
      uploaded: MOCK_EPOCH_SECONDS + index,
      uploader: userPubkey,
      servers: new Set(servers.map((server) => serverOrigin(server) ?? server)),
    });
  });
  return blobs;
}

function publishServerList(state: MockBlossomState, userPubkey: string, createdAt: number): Pick<BlossomResult, 'eventId' | 'result'> {
  state.serial += 1;
  const event = buildMockEvent(`blossom:servers:${userPubkey}:${state.serial}`, {
    kind: 10063,
    pubkey: userPubkey,
    tags: state.serverList.map((server) => ['server', server]),
    created_at: createdAt,
  });
  state.serverListEvent = event;
  return { eventId: event.id, result: { event } };
}

function serverListResult(state: MockBlossomState): BlossomResult {
  return state.serverListEvent
    ? { ok: true, servers: [...state.serverList], eventId: state.serverListEvent.id, result: { event: state.serverListEvent } }
    : { ok: true, servers: [...state.serverList] };
}

function parseRange(range: unknown, size: number): [number, number] | null | undefined {
  if (range === undefined) return undefined;
  const match = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (!match || (match[1] === '' && match[2] === '')) return null;
  const start = match[1] === '' ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[1] === '' ? size - 1 : match[2] === '' ? size - 1 : Math.min(size - 1, Number(match[2]));
  return start > end || start >= size ? null : [start, end];
}

/**
 * Create the NAP-BLOSSOM mock.
 *
 * @param options - Servers, signer state, size cap, and shared mock options.
 * @returns An `extension`-kind mock for the `blossom` domain.
 * @example
 * ```ts
 * const blossom = createMockBlossomService({ seed: 3 });
 * blossom.handleMessage('w1', { type: 'blossom.check', id: 'c1', request: { server: 'https://blossom.example.org', sha256: LINUX_DISTROS[0].sha256 } }, send);
 * ```
 */
export function createMockBlossomService(options: MockBlossomOptions = {}): MockBlossomService {
  const userPubkey = options.userPubkey ?? mockPubkey('alice');
  const signedIn = options.signedIn ?? true;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const seededServers = options.servers ?? DEFAULT_BLOSSOM_SERVERS;

  const withRequest = (handler: (context: Context, request: Record<string, unknown>, origin: string) => BlossomResult): (context: Context) => void =>
    (context) => {
      const request = context.message.request;
      if (typeof request !== 'object' || request === null) { context.fail('invalid-request'); return; }
      const fields = request as Record<string, unknown>;
      const origin = serverOrigin(fields.server);
      if (!origin) { context.reply({ result: { ok: false, status: 0, error: 'invalid-server' } }); return; }
      if (fields.auth === 'required' && !signedIn) { context.reply({ result: { ok: false, status: 0, error: 'not-signed-in' } }); return; }
      if (AUTHENTICATED.has(context.message.type) && !signedIn) { context.reply({ result: { ok: false, status: 0, error: 'not-signed-in' } }); return; }
      context.reply({ result: handler(context, fields, origin) });
    };

  const mutation = (handler: (context: Context) => BlossomResult): (context: Context) => void =>
    (context) => {
      if (!signedIn) { context.reply({ result: { ok: false, servers: [...context.state.serverList], error: 'not-signed-in' } }); return; }
      context.reply({ result: handler(context) });
    };

  const findBlob = (state: MockBlossomState, sha256: unknown, origin: string): { blob: MockBlossomBlob } | { failure: BlossomResult } => {
    if (!isHash(sha256)) return { failure: { ok: false, status: 0, error: 'invalid-hash' } };
    const blob = state.blobs.get(sha256);
    return blob && blob.servers.has(origin) ? { blob } : { failure: { ok: false, status: 404, headers: {}, error: 'not-found' } };
  };

  const store = (context: Context, request: Record<string, unknown>, origin: string, transform: boolean): BlossomResult => {
    const bytes = toBytes(request.data);
    if (!bytes) return { ok: false, status: 0, error: 'invalid-request' };
    if (request.size !== undefined && request.size !== bytes.length) return { ok: false, status: 0, error: 'invalid-request' };
    const computed = placeholderSha256(bytes);
    if (request.sha256 !== undefined && request.sha256 !== computed) return { ok: false, status: 0, error: 'hash-mismatch' };
    if (bytes.length > maxBytes) return { ok: false, status: 413, error: 'too-large' };
    const type = typeof request.type === 'string' ? request.type : 'application/octet-stream';
    const stored = transform && type.startsWith('image/')
      ? { sha256: mockHex(`media:${computed}`), bytes: placeholderBytes(`media:${computed}`, Math.max(1, Math.floor(bytes.length * 0.6))), type: 'image/webp' }
      : { sha256: computed, bytes, type };
    const existing = context.state.blobs.get(stored.sha256);
    const blob = existing ?? { ...stored, size: stored.bytes.length, uploaded: Math.floor(context.clock.now() / 1000), uploader: userPubkey, servers: new Set<string>() };
    blob.servers.add(origin);
    context.state.blobs.set(blob.sha256, blob);
    return { ok: true, status: existing ? 200 : 201, descriptor: describe(blob, origin) };
  };

  const service = defineMockService<MockBlossomState>({
    domain: 'blossom',
    version: '1.0.0',
    description: 'Mock NAP-BLOSSOM: in-memory blob store over the Linux image catalog',
    kind: 'extension',
    initialState: () => {
      const state: MockBlossomState = { blobs: seedBlobs(userPubkey, seededServers), serverList: [...seededServers], serial: 0 };
      if (state.serverList.length > 0) publishServerList(state, userPubkey, MOCK_EPOCH_SECONDS);
      return state;
    },
    routes: {
      'blossom.check': withRequest(({ state }, request, origin) => {
        const found = findBlob(state, request.sha256, origin);
        if ('failure' in found) return found.failure;
        const { blob } = found;
        return { ok: true, status: 200, headers: { contentType: blob.type, contentLength: blob.size, acceptRanges: 'bytes' } };
      }),
      'blossom.get': withRequest(({ state }, request, origin) => {
        const found = findBlob(state, request.sha256, origin);
        if ('failure' in found) return found.failure;
        const { blob } = found;
        const range = parseRange(request.range, blob.size);
        if (range === null) return { ok: false, status: 416, headers: { contentType: blob.type }, error: 'invalid-request' };
        const slice = range ? blob.bytes.slice(range[0], range[1] + 1) : blob.bytes.slice();
        return { ok: true, status: range ? 206 : 200, blob: slice.buffer, headers: { contentType: blob.type, contentLength: slice.length, acceptRanges: 'bytes' } };
      }),
      'blossom.checkUpload': withRequest((_context, request) => {
        if (!isHash(request.sha256)) return { ok: false, status: 0, error: 'invalid-hash' };
        if (typeof request.size !== 'number' || typeof request.type !== 'string') return { ok: false, status: 0, error: 'invalid-request' };
        if (request.size > maxBytes) return { ok: false, status: 413, headers: { reason: `max ${maxBytes} bytes` }, error: 'too-large' };
        return { ok: true, status: 200, headers: {} };
      }),
      'blossom.upload': withRequest((context, request, origin) => store(context, request, origin, false)),
      'blossom.mirror': withRequest(({ state }, request, origin) => {
        const match = typeof request.url === 'string' ? /\/([0-9a-f]{64})(?:\.[A-Za-z0-9]+)?$/.exec(request.url) : null;
        if (!match) return { ok: false, status: 0, error: 'invalid-request' };
        if (request.sha256 !== undefined && request.sha256 !== match[1]) return { ok: false, status: 0, error: 'hash-mismatch' };
        const blob = state.blobs.get(match[1]!);
        if (!blob) return { ok: false, status: 404, error: 'not-found' };
        const existed = blob.servers.has(origin);
        blob.servers.add(origin);
        return { ok: true, status: existed ? 200 : 201, descriptor: describe(blob, origin) };
      }),
      'blossom.checkMedia': withRequest((_context, request) => {
        if (!isHash(request.sha256)) return { ok: false, status: 0, error: 'invalid-hash' };
        if (typeof request.size !== 'number' || typeof request.type !== 'string') return { ok: false, status: 0, error: 'invalid-request' };
        if (!request.type.startsWith('image/') && !request.type.startsWith('video/')) return { ok: false, status: 415, error: 'unsupported-media-type' };
        return { ok: true, status: 200, headers: {} };
      }),
      'blossom.media': withRequest((context, request, origin) => store(context, request, origin, true)),
      'blossom.list': withRequest(({ state }, request, origin) => {
        if (!isHash(request.pubkey)) return { ok: false, status: 0, blobs: [], error: 'invalid-request' };
        const limit = typeof request.limit === 'number' && request.limit > 0 ? request.limit : 100;
        const all = [...state.blobs.values()].filter((blob) => blob.uploader === request.pubkey && blob.servers.has(origin)).sort((left, right) => left.sha256.localeCompare(right.sha256));
        const start = typeof request.cursor === 'string' ? all.findIndex((blob) => blob.sha256 === request.cursor) + 1 : 0;
        const page = all.slice(start, start + limit);
        const more = start + limit < all.length;
        return { ok: true, status: 200, blobs: page.map((blob) => describe(blob, origin)), ...(more ? { cursor: page.at(-1)!.sha256 } : {}) };
      }),
      'blossom.delete': withRequest(({ state }, request, origin) => {
        const found = findBlob(state, request.sha256, origin);
        if ('failure' in found) return { ok: false, status: found.failure.status, error: found.failure.error };
        const { blob } = found;
        blob.servers.delete(origin);
        if (blob.servers.size === 0) state.blobs.delete(blob.sha256);
        return { ok: true, status: 200 };
      }),
      'blossom.servers': ({ state, reply }) => reply({ result: serverListResult(state) }),
      'blossom.addServer': mutation(({ state, message, clock }) => {
        const request = message.request as { server?: unknown; position?: unknown } | undefined;
        const origin = typeof request?.server === 'string' && /^https?:\/\//.test(request.server) ? request.server : null;
        if (!origin) return { ok: false, servers: [...state.serverList], error: 'invalid-server' };
        const current = state.serverList.indexOf(origin);
        if (current !== -1) state.serverList.splice(current, 1);
        const position = typeof request?.position === 'number' ? Math.min(request.position, state.serverList.length) : state.serverList.length;
        state.serverList.splice(position, 0, origin);
        return { ok: true, servers: [...state.serverList], ...publishServerList(state, userPubkey, Math.floor(clock.now() / 1000)) };
      }),
      'blossom.removeServer': mutation(({ state, message, clock }) => {
        const server = message.server;
        if (typeof server !== 'string') return { ok: false, servers: [...state.serverList], error: 'invalid-server' };
        const index = state.serverList.indexOf(server);
        if (index === -1) return serverListResult(state);
        if (state.serverList.length === 1) return { ok: false, servers: [...state.serverList], error: 'empty-server-list' };
        state.serverList.splice(index, 1);
        return { ok: true, servers: [...state.serverList], ...publishServerList(state, userPubkey, Math.floor(clock.now() / 1000)) };
      }),
      'blossom.reorderServers': mutation(({ state, message, clock }) => {
        const servers = message.servers;
        if (!Array.isArray(servers) || !servers.every((item) => typeof item === 'string')) return { ok: false, servers: [...state.serverList], error: 'invalid-request' };
        if (servers.length === 0) return { ok: false, servers: [...state.serverList], error: 'empty-server-list' };
        const sameSet = servers.length === state.serverList.length && new Set(servers).size === servers.length && servers.every((item) => state.serverList.includes(item));
        if (!sameSet) return { ok: false, servers: [...state.serverList], error: 'invalid-server-list' };
        state.serverList = [...servers];
        return { ok: true, servers: [...state.serverList], ...publishServerList(state, userPubkey, Math.floor(clock.now() / 1000)) };
      }),
    },
  }, options);
  return service;
}

/** Registry row for the `blossom` domain. */
export const BLOSSOM_MOCK_ENTRY: MockDomainEntry = {
  domain: 'blossom',
  kind: 'extension',
  spec: BLOSSOM_SPEC_REF,
  create: (options) => createMockBlossomService(options),
};

/**
 * domains/resource.ts — Mock NAP-RESOURCE service.
 *
 * Spec: naps/NAP-RESOURCE.md @ napplet/naps PR #80 head ae5b9c64 (draft)
 * Routes: resource.info, resource.bytes, resource.bytesMany, resource.cancel
 * Spec gaps / decisions:
 * - The draft carries `blob` as canonical padded base64 text. `@napplet/nap`
 *   0.32.0 (and its shim) still expects a `Blob`; `wireBytes: 'blob'` opts into
 *   that older shape. Default follows the draft (`'base64'`).
 * - The draft names the bulk field `urls`; nap 0.32.0 sends
 *   `requests: [{ url, servers? }]`. Both are accepted; `urls` wins when present.
 * - `https:` resolves only the catalog mirrors, `https://avatars.example.org/<name>.png`
 *   profile pictures, and `resources` supplied via options. Private hosts are
 *   `blocked-by-policy`; every other https URL is `not-found`.
 * - `htree://` resolves only the seeded `distros` root of `alice`; `#private`
 *   is `blocked-by-policy` (no authorization in a mock), `#link-visible` is
 *   `invalid-request` as the draft requires for the read API.
 * - `nostr:` returns the referenced event (or kind-0 profile) as JSON bytes.
 * - SVG bytes are "rasterized" to a placeholder PNG so raw SVG is never delivered.
 * - Cancellation only has an effect when `latencyMs > 0`; synchronous results
 *   are already delivered when `resource.cancel` arrives.
 */
import type { NappletMessage } from '@kehto/runtime';
import type { ResourceErrorCode, ResourceInfo, ResourceSchemeInfo } from '@napplet/nap/resource/types';
import { DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { LINUX_DISTROS, findLinuxDistro } from '../fixtures/linux-distros.js';
import { MOCK_ACCOUNTS, MOCK_EVENTS } from '../fixtures/nostr.js';
import {
  bytesToHex,
  decodeBase64,
  encodeBase64,
  linuxDistroBytes,
  mimeForFileName,
  placeholderPng,
  sniffMime,
  toBlob,
  utf8Bytes,
} from './file-bytes.js';
import {
  MOCK_HASHTREE_AUTHOR,
  MOCK_HASHTREE_NODES,
  MOCK_HASHTREE_ROOT_HASH,
  MOCK_HASHTREE_TREE_NAME,
  decodeBech32,
  decodeNhash,
  identifierToPubkey,
  parseHtreeUrl,
  parseTlv,
  walkHashtree,
} from './hashtree-fixtures.js';

export type { ResourceErrorCode, ResourceInfo, ResourceSchemeInfo } from '@napplet/nap/resource/types';

/** Spec document the mock was written against. */
export const RESOURCE_SPEC_REF: NapSpecRef = {
  nap: 'NAP-RESOURCE',
  status: 'draft',
  source: 'pr',
  pr: 80,
  sha: 'ae5b9c64',
  path: 'naps/NAP-RESOURCE.md',
};

/** Default advisory scheme list: every draft scheme enabled. */
export const DEFAULT_RESOURCE_SCHEMES: readonly ResourceSchemeInfo[] = Object.freeze([
  { scheme: 'data', enabled: true },
  { scheme: 'https', enabled: true },
  { scheme: 'blossom', enabled: true },
  { scheme: 'htree', enabled: true },
  { scheme: 'hashtree', enabled: true },
  { scheme: 'nostr', enabled: true },
]);

/**
 * A resolved resource: bytes plus sniffed MIME, or a typed failure.
 *
 * @example
 * ```ts
 * const resolved: ResolvedResource = { ok: true, bytes: new Uint8Array(0), mime: 'application/octet-stream' };
 * ```
 */
export type ResolvedResource =
  | { ok: true; bytes: Uint8Array; mime: string }
  | { ok: false; error: ResourceErrorCode; message: string };

/**
 * Extra https resource served by the mock.
 *
 * @example
 * ```ts
 * const extra: MockResourceEntry = { bytes: new Uint8Array([1, 2, 3]), mime: 'application/octet-stream' };
 * ```
 */
export interface MockResourceEntry {
  /** Bytes to deliver. */
  bytes: Uint8Array;
  /** MIME override; sniffed from `bytes` when omitted. */
  mime?: string;
}

/**
 * In-memory state of the resource mock.
 *
 * @example
 * ```ts
 * createMockResourceService().mock.state().inFlight.size === 0;
 * ```
 */
export interface MockResourceState {
  /** Deferred deliveries keyed by `windowId\0id` (only when `latencyMs > 0`). */
  inFlight: Map<string, { windowId: string; id: string; cancel: () => void }>;
  /** Every resolved URL in order, with its outcome. */
  log: Array<{ windowId: string; url: string; ok: boolean; error?: ResourceErrorCode }>;
}

/**
 * Options for `createMockResourceService`.
 *
 * @example
 * ```ts
 * const service = createMockResourceService({ wireBytes: 'blob', maxBytes: 1024 });
 * ```
 */
export interface MockResourceOptions extends MockServiceOptions {
  /** Advisory `resource.info.schemes`. Default `DEFAULT_RESOURCE_SCHEMES`. */
  schemes?: readonly ResourceSchemeInfo[];
  /** Advisory and enforced decoded byte cap. Default 10 MiB. */
  maxBytes?: number;
  /** Bulk URL cap. Default 100. */
  maxUrls?: number;
  /** Wire shape of `blob`: draft base64 text (default) or a `Blob` for nap 0.32.0 shims. */
  wireBytes?: 'base64' | 'blob';
  /** Additional https URLs the mock serves. */
  resources?: Readonly<Record<string, MockResourceEntry>>;
}

/**
 * The resource mock: a `MockService` plus a direct resolver for tests.
 *
 * @example
 * ```ts
 * const service = createMockResourceService();
 * service.resolve(LINUX_DISTROS[0].mirrors[0]).ok === true;
 * ```
 */
export type MockResourceService = MockService<MockResourceState> & {
  /**
   * Resolve a URL exactly as `resource.bytes` would, without the wire.
   *
   * @param url - Resource URL.
   * @returns Bytes and MIME, or a typed failure.
   */
  resolve(url: string): ResolvedResource;
};

const PRIVATE_HOSTS = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\]|0\.0\.0\.0)/;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function failure(error: ResourceErrorCode, message: string): ResolvedResource {
  return { ok: false, error, message };
}

function success(bytes: Uint8Array, mime: string): ResolvedResource {
  return mime === 'image/svg+xml'
    ? { ok: true, bytes: placeholderPng(`raster:${bytesToHex(bytes.subarray(0, 16))}`), mime: 'image/png' }
    : { ok: true, bytes, mime };
}

function resolveHttps(url: string, options: MockResourceOptions): ResolvedResource {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return failure('invalid-request', `invalid URL: ${url}`); }
  if (PRIVATE_HOSTS.test(parsed.hostname)) return failure('blocked-by-policy', `private host ${parsed.hostname} is blocked`);
  const extra = options.resources?.[url];
  if (extra) return success(extra.bytes, extra.mime ?? sniffMime(extra.bytes));
  const image = LINUX_DISTROS.find((item) => item.mirrors.includes(url));
  if (image) return success(linuxDistroBytes(image), mimeForFileName(image.fileName));
  const avatar = /^https:\/\/avatars\.example\.org\/([a-z]+)\.png$/.exec(url);
  const account = avatar ? MOCK_ACCOUNTS.find((item) => item.name === avatar[1]) : undefined;
  if (account) return success(placeholderPng(`avatar:${account.name}`), 'image/png');
  return failure('not-found', `no mock resource at ${url}`);
}

function resolveData(url: string, maxBytes: number): ResolvedResource {
  const comma = url.indexOf(',');
  if (comma === -1) return failure('invalid-request', 'data URL has no payload');
  const header = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  const isBase64 = header.endsWith(';base64');
  const declared = (isBase64 ? header.slice(0, -7) : header).split(';')[0] || 'text/plain';
  let bytes: Uint8Array | null;
  if (isBase64) {
    bytes = decodeBase64(payload);
  } else {
    try { bytes = utf8Bytes(decodeURIComponent(payload)); } catch { bytes = null; }
  }
  if (!bytes) return failure('decode-failed', 'data URL payload is not canonical');
  if (bytes.length > maxBytes) return failure('too-large', `data URL exceeds ${maxBytes} bytes`);
  return success(bytes, sniffMime(bytes, declared));
}

function resolveBlossom(url: string): ResolvedResource {
  const match = /^blossom:([0-9a-f]{64})(?:\.([A-Za-z0-9]+))?(?:\?.*)?$/.exec(url);
  if (!match) return failure('invalid-request', 'blossom URI must be blossom:<sha256>.<ext>');
  const image = findLinuxDistro(match[1]!);
  if (!image) return failure('not-found', `no blob with hash ${match[1]}`);
  return success(linuxDistroBytes(image), mimeForFileName(image.fileName));
}

function resolveImmutable(nhash: string): ResolvedResource {
  const decoded = decodeNhash(nhash);
  if (!decoded) return failure('invalid-request', 'nhash failed bech32 or TLV validation');
  const node = MOCK_HASHTREE_NODES.get(decoded.hash);
  if (!node) return failure('not-found', `no hashtree object ${decoded.hash}`);
  if (node.type === 'dir') return failure('invalid-request', 'directories do not yield file bytes');
  return success(node.bytes!, node.mime!);
}

function resolveHtree(url: string): ResolvedResource {
  const parts = parseHtreeUrl(url);
  if (!parts) return failure('invalid-request', 'malformed htree URL');
  if (parts.fragment === 'link-visible') return failure('invalid-request', '#link-visible is creation-only');
  if (parts.fragment === 'private') return failure('blocked-by-policy', 'private roots need authorization');
  if (parts.fragment !== '' && !/^k=[0-9a-f]{64}$/.test(parts.fragment)) return failure('invalid-request', 'unknown fragment');
  const pubkey = identifierToPubkey(parts.identifier);
  if (!pubkey) return failure('invalid-request', 'identifier must be an npub or 64-hex pubkey');
  if (pubkey !== MOCK_HASHTREE_AUTHOR || parts.treeName !== MOCK_HASHTREE_TREE_NAME) {
    return failure('not-found', `no root ${parts.treeName} for ${pubkey}`);
  }
  const segments = parts.entryPath === '' ? [] : parts.entryPath.split('/');
  const node = walkHashtree(MOCK_HASHTREE_NODES, MOCK_HASHTREE_ROOT_HASH, segments);
  if (!node) return failure('not-found', `no entry ${parts.entryPath}`);
  if (node.type === 'dir') return failure('invalid-request', 'directories do not yield file bytes');
  return success(node.bytes!, node.mime!);
}

function resolveNostr(url: string): ResolvedResource {
  const decoded = decodeBech32(url.slice(6));
  if (!decoded) return failure('invalid-request', 'nostr URI is not valid bech32');
  let eventId: string | undefined;
  let pubkey: string | undefined;
  if (decoded.prefix === 'note' && decoded.bytes.length === 32) eventId = bytesToHex(decoded.bytes);
  else if (decoded.prefix === 'npub' && decoded.bytes.length === 32) pubkey = bytesToHex(decoded.bytes);
  else if (decoded.prefix === 'nevent' || decoded.prefix === 'nprofile') {
    const special = parseTlv(decoded.bytes).get(0)?.[0];
    if (!special || special.length !== 32) return failure('invalid-request', 'TLV special field missing');
    if (decoded.prefix === 'nevent') eventId = bytesToHex(special);
    else pubkey = bytesToHex(special);
  } else {
    return failure('not-found', `unsupported NIP-19 prefix ${decoded.prefix}`);
  }
  const event = eventId
    ? MOCK_EVENTS.find((item) => item.id === eventId)
    : MOCK_EVENTS.find((item) => item.kind === 0 && item.pubkey === pubkey);
  if (!event) return failure('not-found', 'no fixture event for reference');
  return success(utf8Bytes(JSON.stringify(event)), 'application/json');
}

function resolveUrl(url: string, options: MockResourceOptions, enabled: ReadonlySet<string>): ResolvedResource {
  if (typeof url !== 'string' || url === '') return failure('invalid-request', 'url must be a non-empty string');
  if (url.startsWith('nhash1')) return enabled.has('hashtree') ? resolveImmutable(url) : failure('unsupported-scheme', 'hashtree disabled');
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!match) return failure('invalid-request', `no scheme in ${url}`);
  const scheme = match[1]!.toLowerCase();
  if (!enabled.has(scheme)) return failure('unsupported-scheme', `scheme ${scheme} is not supported`);
  switch (scheme) {
    case 'https': return resolveHttps(url, options);
    case 'data': return resolveData(url, options.maxBytes ?? DEFAULT_MAX_BYTES);
    case 'blossom': return resolveBlossom(url);
    case 'hashtree': return resolveImmutable(url.slice(9));
    case 'htree': return resolveHtree(url);
    case 'nostr': return resolveNostr(url);
    default: return failure('unsupported-scheme', `scheme ${scheme} is not supported`);
  }
}

function urlsFromMessage(message: Record<string, unknown>): string[] | null {
  if (Array.isArray(message.urls)) return message.urls.every((url) => typeof url === 'string') ? message.urls as string[] : null;
  if (Array.isArray(message.requests)) {
    const urls = message.requests.map((request) => (request as { url?: unknown })?.url);
    return urls.every((url) => typeof url === 'string') ? urls as string[] : null;
  }
  return null;
}

/**
 * Create the NAP-RESOURCE mock.
 *
 * @param options - Schemes, caps, wire shape, extra resources, and shared mock options.
 * @returns A `service`-kind mock for the `resource` domain.
 * @example
 * ```ts
 * const resource = createMockResourceService({ seed: 2 });
 * resource.handleMessage('w1', { type: 'resource.bytes', id: 'r1', url: LINUX_DISTROS[0].mirrors[0] }, send);
 * ```
 */
export function createMockResourceService(options: MockResourceOptions = {}): MockResourceService {
  const schemes = options.schemes ?? DEFAULT_RESOURCE_SCHEMES;
  const enabled = new Set(schemes.filter((scheme) => scheme.enabled).map((scheme) => scheme.scheme));
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxUrls = options.maxUrls ?? 100;
  const latencyMs = options.latencyMs ?? 0;
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const info: ResourceInfo = { schemes: [...schemes], maxBytes, maxUrls };
  const encode = (resolved: { bytes: Uint8Array; mime: string }): unknown =>
    options.wireBytes === 'blob' ? toBlob(resolved.bytes, resolved.mime) : encodeBase64(resolved.bytes);
  const resolve = (url: string): ResolvedResource => resolveUrl(url, options, enabled);

  const service = defineMockService<MockResourceState>({
    domain: 'resource',
    version: '1.0.0',
    description: 'Mock NAP-RESOURCE: catalog mirrors, data URLs, blossom, hashtree, nostr references',
    kind: 'service',
    initialState: () => ({ inFlight: new Map(), log: [] }),
    routes: {
      'resource.info': ({ reply }) => reply({ info }),
      'resource.bytes': ({ windowId, message, state }) => {
        if (typeof message.id !== 'string') return;
        const id = message.id;
        const resolved = resolve(message.url as string);
        state.log.push({ windowId, url: String(message.url), ok: resolved.ok, ...(resolved.ok ? {} : { error: resolved.error }) });
        deliver(windowId, id, state, () => resolved.ok
          ? { type: 'resource.bytes.result', id, blob: encode(resolved), mime: resolved.mime } as NappletMessage
          : { type: 'resource.bytes.error', id, error: resolved.error, message: resolved.message } as NappletMessage);
      },
      'resource.bytesMany': ({ windowId, message, state }) => {
        if (typeof message.id !== 'string') return;
        const id = message.id;
        const urls = urlsFromMessage(message);
        const topLevel = (error: ResourceErrorCode, text: string): NappletMessage =>
          ({ type: 'resource.bytesMany.error', id, error, message: text }) as NappletMessage;
        if (!urls || urls.length === 0) { deliver(windowId, id, state, () => topLevel('invalid-request', 'urls must be a non-empty list')); return; }
        if (urls.length > maxUrls) { deliver(windowId, id, state, () => topLevel('too-large', `bulk cap is ${maxUrls} URLs`)); return; }
        const items = urls.map((url) => {
          const resolved = resolve(url);
          state.log.push({ windowId, url, ok: resolved.ok, ...(resolved.ok ? {} : { error: resolved.error }) });
          return resolved.ok
            ? { url, ok: true, blob: encode(resolved), mime: resolved.mime }
            : { url, ok: false, error: resolved.error, message: resolved.message };
        });
        deliver(windowId, id, state, () => ({ type: 'resource.bytesMany.result', id, items }) as NappletMessage);
      },
      'resource.cancel': ({ windowId, message, state }) => {
        const key = `${windowId}\0${String(message.id)}`;
        state.inFlight.get(key)?.cancel();
        state.inFlight.delete(key);
      },
    },
    onWindowDestroyed: (windowId, state) => {
      for (const [key, entry] of state.inFlight) {
        if (entry.windowId !== windowId) continue;
        entry.cancel();
        state.inFlight.delete(key);
      }
    },
  }, options) as MockResourceService;

  function deliver(windowId: string, id: string, state: MockResourceState, build: () => NappletMessage): void {
    const key = `${windowId}\0${id}`;
    const fire = (): void => {
      state.inFlight.delete(key);
      pushToWindow(service, windowId, build());
    };
    if (latencyMs <= 0) { fire(); return; }
    state.inFlight.get(key)?.cancel();
    state.inFlight.set(key, { windowId, id, cancel: scheduler.schedule(latencyMs, fire) });
  }

  const baseReset = service.mock.reset;
  Object.defineProperty(service.mock, 'reset', {
    value: () => {
      for (const entry of service.mock.state().inFlight.values()) entry.cancel();
      baseReset();
    },
  });
  Object.defineProperty(service, 'resolve', { value: resolve, enumerable: false });
  return service;
}

/** Registry row for the `resource` domain. */
export const RESOURCE_MOCK_ENTRY: MockDomainEntry = {
  domain: 'resource',
  kind: 'service',
  spec: RESOURCE_SPEC_REF,
  create: (options) => createMockResourceService(options),
};

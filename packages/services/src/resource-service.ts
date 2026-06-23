/**
 * resource-service.ts — NAP-RESOURCE reference service (10th NAP domain, v1.7 Phase 40).
 *
 * Shell-side reference implementation for the canonical NAP-RESOURCE wire
 * protocol (`internal-resource.ts` in @kehto/shell/src/types; kehto-internal
 * model per PROJECT.md Decision #31. Kehto keeps legacy single-fetch fields
 * for existing callers and also emits the current NAP-RESOURCE fields.
 * Handles:
 *   Inbound:  resource.bytes, resource.bytesMany, resource.cancel
 *   Outbound: resource.bytes.result, resource.bytes.error,
 *             resource.bytesMany.result, resource.bytesMany.error
 *
 * ──────────────────────── SCOPE BOUNDARY (RESOURCE-01) ────────────────────────
 * NAP-RESOURCE is an **authenticated fetch proxy** — read-only, atomic.
 *
 * This service is NOT responsible for:
 *   - Streaming / chunked responses (host-app concern)
 *   - Response caching / conditional requests (host-app concern)
 *   - Upload / POST body construction (NAP-RESOURCE v1.7 is read-only)
 *   - Redirect limits, MIME sniffing, SVG rasterization (host-fetch concern)
 *   - Private-IP blocking, SSRF mitigation (host-provided-fetch responsibility)
 *
 * These belong to the host-app's `fetch` implementation per D7 and
 * SHELL-RESOURCE-POLICY.md (Phase 40 Plan 40-03). Kehto ships a reference
 * service; production hardening is the host app's concern.
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Host integration: provide `fetch`, `isOriginGranted`, `getConnectGrants`,
 * and `resolveIdentity`. ALL FOUR are required from day one (H-03 prevention).
 *
 * @example
 * ```ts
 * import { createResourceService } from '@kehto/services';
 *
 * const resourceSvc = createResourceService({
 *   fetch: (url, init) => globalThis.fetch(url, init),
 *   isOriginGranted: (origin, grants) => grants.includes(origin),
 *   getConnectGrants: (dTag, hash) => myOriginGrantStore.getOrigins(dTag, hash),
 *   resolveIdentity: (windowId) => sessionRegistry.getEntryByWindowId(windowId) ?? null,
 * });
 * runtime.registerService('resource', resourceSvc);
 * ```
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

/** Resource service version — follows semver. */
const RESOURCE_SERVICE_VERSION = '1.0.0';

/**
 * Options for `createResourceService` (options-as-bridge per v1.6 Decision 18).
 *
 * ALL FOUR fields are required. The factory throws at construction if any is
 * missing — H-03 prevention: the grants source (`getConnectGrants`) MUST be
 * wired from day one so there is no window where resource requests bypass the
 * grant check.
 *
 * @see PITFALLS.md:228 (H-03) — grants-source coupling must be present at construction
 */
export interface ResourceServiceOptions {
  /**
   * Host-supplied fetch implementation. Receives the URL, a partial init
   * (method, headers, signal), and must return a `Response`-compatible promise.
   *
   * The host's `fetch` is the ONLY place to implement redirect limits, MIME
   * sniffing, SVG rasterization, private-IP / SSRF blocking, etc.
   * This service does NOT filter: it proxies transparently.
   *
   * @param url - The URL from the resource.bytes request
   * @param init - Method, headers (from napplet), and an AbortSignal
   */
  fetch(
    url: string,
    init: { method?: string; headers?: Record<string, string>; signal: AbortSignal }
  ): Promise<Response>;

  /**
   * Returns true if `origin` is present in `grants` (the list returned by
   * `getConnectGrants` for the napplet's dTag + aggregateHash).
   *
   * The reference implementation is simply `grants.includes(origin)`. Host apps
   * may provide normalized-origin comparison if needed.
   *
   * @param origin - Parsed origin of the requested URL (scheme + host + port)
   * @param grants - Readonly list from getConnectGrants for this napplet identity
   */
  isOriginGranted(origin: string, grants: readonly string[]): boolean;

  /**
   * Returns the list of allowed fetch origins for the given napplet identity.
   * Called on every `resource.bytes` request — must be synchronous and fast.
   *
   * Host-supplied grant source (e.g. a static per-dTag allowlist map, or any
   * other host-controlled policy). Returns an empty array to deny all origins.
   *
   * H-03 prevention: REQUIRED from day one — factory throws on construction
   * if omitted.
   *
   * @param dTag - The napplet's d-tag (from session registry)
   * @param aggregateHash - The napplet's aggregate hash (from session registry)
   */
  getConnectGrants(dTag: string, aggregateHash: string): readonly string[];

  /**
   * Resolve a windowId to the napplet's identity (dTag + aggregateHash).
   * Returns null if the window is not in the session registry.
   *
   * Typically wraps `sessionRegistry.getEntryByWindowId(windowId)`.
   *
   * @param windowId - The iframe window identifier
   */
  resolveIdentity(windowId: string): { dTag: string; aggregateHash: string } | null;
}

/**
 * Type alias for the ServiceHandler returned by `createResourceService`.
 * Exported for host apps that need to type-annotate the handler reference.
 */
export type ResourceService = ServiceHandler;

/**
 * Convert an ArrayBuffer to base64 string, safe for both browser and Node.
 * Chunked in 0x8000-byte slices to avoid `String.fromCharCode(...largeArray)`
 * stack overflow on large responses.
 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000; // 32 KB
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

interface ResourceRequestState {
  inFlight: Map<string, { controller: AbortController; windowId: string }>;
  perWindow: Map<string, Set<string>>;
}

type LegacyResourceErrorCode = 'denied' | 'invalid-url' | 'canceled' | 'network-error';

type ResourceErrorCode =
  | 'invalid-request'
  | 'not-found'
  | 'blocked-by-policy'
  | 'timeout'
  | 'too-large'
  | 'unsupported-scheme'
  | 'decode-failed'
  | 'network-error'
  | 'quota-exceeded';

type ResourceFetchSuccess = {
  ok: true;
  url: string;
  blob: Blob;
  mime: string;
  status: number;
  headers: Record<string, string>;
  bodyBase64: string;
};

type ResourceFetchFailure = {
  ok: false;
  url: string;
  error: ResourceErrorCode;
  code: LegacyResourceErrorCode;
  message: string;
};

type ResourceFetchItem = ResourceFetchSuccess | ResourceFetchFailure;

function assertResourceOptions(options: ResourceServiceOptions): void {
  if (
    typeof options?.fetch !== 'function' ||
    typeof options?.isOriginGranted !== 'function' ||
    typeof options?.getConnectGrants !== 'function' ||
    typeof options?.resolveIdentity !== 'function'
  ) {
    throw new Error(
      '[RESOURCE-01 / H-03] createResourceService requires {fetch, isOriginGranted, getConnectGrants, resolveIdentity} ' +
      '— all four options are required from day one. ' +
      'The grants source (getConnectGrants) MUST be wired at construction time to prevent unguarded fetch proxying.',
    );
  }
}

function trackRequest(
  state: ResourceRequestState,
  requestId: string,
  windowId: string,
  controller: AbortController,
): void {
  state.inFlight.set(requestId, { controller, windowId });
  if (!state.perWindow.has(windowId)) {
    state.perWindow.set(windowId, new Set());
  }
  state.perWindow.get(windowId)!.add(requestId);
}

function untrackRequest(state: ResourceRequestState, requestId: string): void {
  const entry = state.inFlight.get(requestId);
  if (entry) {
    state.inFlight.delete(requestId);
    state.perWindow.get(entry.windowId)?.delete(requestId);
  }
}

function sendResourceError(
  send: (m: NappletMessage) => void,
  requestId: string,
  code: LegacyResourceErrorCode,
  message: string,
  error: ResourceErrorCode = toResourceError(code),
  type: 'resource.bytes.error' | 'resource.bytesMany.error' = 'resource.bytes.error',
): void {
  send({
    type,
    id: requestId,
    requestId,
    error,
    code,
    message,
  } as NappletMessage);
}

function sendBytesManyError(
  send: (m: NappletMessage) => void,
  requestId: string,
  code: LegacyResourceErrorCode,
  message: string,
  error: ResourceErrorCode,
): void {
  sendResourceError(send, requestId, code, message, error, 'resource.bytesMany.error');
}

function toResourceError(code: LegacyResourceErrorCode): ResourceErrorCode {
  switch (code) {
    case 'denied':
      return 'blocked-by-policy';
    case 'invalid-url':
      return 'invalid-request';
    case 'canceled':
      return 'timeout';
    case 'network-error':
      return 'network-error';
  }
}

function parseResourceUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function collectResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function responseMime(response: Response): string {
  return response.headers.get('content-type') || 'application/octet-stream';
}

function responseBlob(buffer: ArrayBuffer, mime: string): Blob {
  return new Blob([buffer], { type: mime });
}

function requestIdFromMessage(message: NappletMessage & { id?: unknown; requestId?: unknown }): string | null {
  if (typeof message.id === 'string' && message.id.length > 0) return message.id;
  if (typeof message.requestId === 'string' && message.requestId.length > 0) return message.requestId;
  return null;
}

function resourceInvalidRequest(url: string, message: string): ResourceFetchFailure {
  return {
    ok: false,
    url,
    error: 'invalid-request',
    code: 'invalid-url',
    message,
  };
}

async function fetchResourceItem(
  options: ResourceServiceOptions,
  identity: { dTag: string; aggregateHash: string },
  url: string,
  init: { method?: string; headers?: Readonly<Record<string, string>> } | undefined,
  signal: AbortSignal,
): Promise<ResourceFetchItem> {
  const parsedUrl = parseResourceUrl(url);
  if (!parsedUrl) return resourceInvalidRequest(url, `invalid URL: ${url}`);
  const origin = parsedUrl.origin;
  const grants = options.getConnectGrants(identity.dTag, identity.aggregateHash);
  if (!options.isOriginGranted(origin, grants)) {
    return {
      ok: false,
      url,
      error: 'blocked-by-policy',
      code: 'denied',
      message: `origin ${origin} not granted`,
    };
  }

  try {
    const response = await options.fetch(url, {
      method: init?.method,
      headers: init?.headers ? { ...init.headers } : undefined,
      signal,
    });
    const buffer = await response.arrayBuffer();
    const headers = collectResponseHeaders(response);
    const mime = responseMime(response);
    return {
      ok: true,
      url,
      blob: responseBlob(buffer, mime),
      mime,
      status: response.status,
      headers,
      bodyBase64: arrayBufferToBase64(buffer),
    };
  } catch (err: unknown) {
    const isAbort =
      signal.aborted ||
      (err instanceof Error && (err.name === 'AbortError' || err.name === 'DOMException'));
    return {
      ok: false,
      url,
      error: isAbort ? 'timeout' : 'network-error',
      code: isAbort ? 'canceled' : 'network-error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleBytes(
  options: ResourceServiceOptions,
  state: ResourceRequestState,
  windowId: string,
  msg: { requestId: string; url: string; init?: { method?: string; headers?: Readonly<Record<string, string>> } },
  send: (m: NappletMessage) => void,
): Promise<void> {
  const { requestId, url, init } = msg;
  const identity = options.resolveIdentity(windowId);
  if (!identity) {
    sendResourceError(send, requestId, 'denied', 'napplet identity not resolvable', 'blocked-by-policy');
    return;
  }

  const controller = new AbortController();
  trackRequest(state, requestId, windowId, controller);

  try {
    const item = await fetchResourceItem(options, identity, url, init, controller.signal);
    if (!item.ok) {
      sendResourceError(send, requestId, item.code, item.message, item.error);
      return;
    }
    send({
      type: 'resource.bytes.result',
      id: requestId,
      requestId,
      blob: item.blob,
      mime: item.mime,
      status: item.status,
      headers: item.headers,
      bodyBase64: item.bodyBase64,
    } as NappletMessage);
  } finally {
    untrackRequest(state, requestId);
  }
}

async function handleBytesMany(
  options: ResourceServiceOptions,
  state: ResourceRequestState,
  windowId: string,
  msg: { requestId: string; urls: readonly string[]; init?: { method?: string; headers?: Readonly<Record<string, string>> } },
  send: (m: NappletMessage) => void,
): Promise<void> {
  const { requestId, urls, init } = msg;
  if (!Array.isArray(urls) || urls.length === 0 || urls.some((url) => typeof url !== 'string')) {
    sendBytesManyError(send, requestId, 'invalid-url', 'resource.bytesMany requires a non-empty urls array', 'invalid-request');
    return;
  }

  const identity = options.resolveIdentity(windowId);
  if (!identity) {
    sendBytesManyError(send, requestId, 'denied', 'napplet identity not resolvable', 'blocked-by-policy');
    return;
  }

  const controller = new AbortController();
  trackRequest(state, requestId, windowId, controller);
  try {
    const items: Array<Record<string, unknown>> = [];
    for (const url of urls) {
      const item = await fetchResourceItem(options, identity, url, init, controller.signal);
      if (item.ok) {
        items.push({
          url: item.url,
          ok: true,
          blob: item.blob,
          mime: item.mime,
        });
      } else {
        items.push({
          url: item.url,
          ok: false,
          error: item.error,
          code: item.code,
          message: item.message,
        });
      }
    }
    send({
      type: 'resource.bytesMany.result',
      id: requestId,
      requestId,
      items,
    } as NappletMessage);
  } finally {
    untrackRequest(state, requestId);
  }
}

function handleCancel(state: ResourceRequestState, requestId: string): void {
  const entry = state.inFlight.get(requestId);
  if (entry) {
    entry.controller.abort();
  }
}

function destroyWindowRequests(state: ResourceRequestState, windowId: string): void {
  const requestIds = state.perWindow.get(windowId);
  if (!requestIds) return;
  for (const requestId of requestIds) {
    const entry = state.inFlight.get(requestId);
    if (entry) {
      entry.controller.abort();
      state.inFlight.delete(requestId);
    }
  }
  state.perWindow.delete(windowId);
}

/**
 * Create a NAP-RESOURCE reference service.
 *
 * Implements the NAP-RESOURCE request/response protocol: `resource.bytes`,
 * `resource.bytesMany`, `resource.cancel`, and their result/error envelopes.
 *
 * On-construction guard (H-03 prevention): all four options are validated at
 * factory call time. If any is missing, the factory throws immediately with a
 * message containing `[RESOURCE-01 / H-03]` so misconfigured shell apps fail
 * loudly at startup rather than silently at first dispatch.
 *
 * Returns a `ServiceHandler` (no `publishValues`-style surface — resource has
 * no shell-initiated push beyond the response/error path).
 *
 * @param options - REQUIRED: fetch, isOriginGranted, getConnectGrants, resolveIdentity
 * @returns ServiceHandler to register via `runtime.registerService('resource', handler)`
 *
 * @example
 * ```ts
 * import { createResourceService } from '@kehto/services';
 *
 * const svc = createResourceService({
 *   fetch: (url, init) => globalThis.fetch(url, init),
 *   isOriginGranted: (origin, grants) => grants.includes(origin),
 *   getConnectGrants: (dTag, hash) => myOriginGrantStore.getOrigins(dTag, hash),
 *   resolveIdentity: (windowId) => sessionRegistry.getEntryByWindowId(windowId) ?? null,
 * });
 * runtime.registerService('resource', svc);
 * ```
 */
export function createResourceService(options: ResourceServiceOptions): ResourceService {
  assertResourceOptions(options);
  const state: ResourceRequestState = {
    inFlight: new Map<string, { controller: AbortController; windowId: string }>(),
    perWindow: new Map<string, Set<string>>(),
  };

  const descriptor: ServiceDescriptor = {
    name: 'resource',
    version: RESOURCE_SERVICE_VERSION,
    description:
      'NAP-RESOURCE reference service — shell-proxied authenticated fetch (RESOURCE-01..06)',
  };

  const handler: ServiceHandler = {
    descriptor,

    handleMessage(
      windowId: string,
      message: NappletMessage,
      send: (msg: NappletMessage) => void,
    ): void {
      switch (message.type) {
        case 'resource.bytes': {
          const m = message as NappletMessage & {
            id?: string;
            requestId?: string;
            url: string;
            init?: { method?: string; headers?: Readonly<Record<string, string>> };
          };
          const requestId = requestIdFromMessage(m);
          if (!requestId || typeof m.url !== 'string') return;
          handleBytes(options, state, windowId, { requestId, url: m.url, init: m.init }, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.bytesMany': {
          const m = message as NappletMessage & {
            id?: string;
            requestId?: string;
            urls?: readonly string[];
            init?: { method?: string; headers?: Readonly<Record<string, string>> };
          };
          const requestId = requestIdFromMessage(m);
          if (!requestId) return;
          handleBytesMany(options, state, windowId, { requestId, urls: m.urls ?? [], init: m.init }, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.cancel': {
          const m = message as NappletMessage & { id?: string; requestId?: string };
          const requestId = requestIdFromMessage(m);
          if (requestId) handleCancel(state, requestId);
          return;
        }

        default:
          // Unknown resource.* message — silently ignored per NIP-5D.
          return;
      }
    },

    onWindowDestroyed(windowId: string): void {
      destroyWindowRequests(state, windowId);
    },
  };

  return handler;
}

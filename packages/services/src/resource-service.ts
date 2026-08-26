/**
 * resource-service.ts — NAP-RESOURCE reference service (10th NAP domain, v1.7 Phase 40).
 *
 * Shell-side reference implementation for the canonical NAP-RESOURCE wire
 * protocol (`internal-resource.ts` in @kehto/shell/src/types; kehto-internal
 * model per PROJECT.md Decision #31.
 * Handles:
 *   Inbound:  resource.info, resource.bytes, resource.bytesMany, resource.cancel
 *   Outbound: resource.info.result, resource.info.error,
 *             resource.bytes.result, resource.bytes.error,
 *             resource.bytesMany.result, resource.bytesMany.error
 *
 * ──────────────────────── SCOPE BOUNDARY (RESOURCE-01) ────────────────────────
 * NAP-RESOURCE is a runtime-mediated byte resolver — read-only, atomic.
 *
 * Kehto owns neutral wire lifecycle, cancellation, result projection, and
 * policy tooling. The runtime supplies the resolver and decides whether to use
 * the origin-grant hooks, which schemes to resolve, and which limits to expose.
 * Advisory `resource.info` scheme disclosure never authorizes or blocks a byte
 * request.
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Runtime integration requires only `fetch`. A runtime MAY also install the
 * optional origin-policy adapter (`isOriginGranted`, `getConnectGrants`, and
 * `resolveIdentity` together).
 *
 * @example
 * ```ts
 * import { createResourceService } from '@kehto/services';
 *
 * const resourceSvc = createResourceService({
 *   fetch: (url, init) => globalThis.fetch(url, init),
 * });
 * runtime.registerService('resource', resourceSvc);
 * ```
 *
 * @example
 * ```ts
 * const resourceSvc = createResourceService({
 *   fetch: (url, init) => runtimeResources.resolve(url, init),
 *   isOriginGranted: (origin, grants) => grants.includes(origin),
 *   getConnectGrants: (dTag, hash) => myOriginGrantStore.getOrigins(dTag, hash),
 *   resolveIdentity: (windowId) => sessionRegistry.getEntryByWindowId(windowId) ?? null,
 * });
 * ```
 */

import type { NappletMessage } from '@napplet/core';
import type {
  ResourceBytesRequest,
  ResourceInfo,
} from '@napplet/nap/resource/types';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

export type {
  ResourceBytesRequest,
  ResourceInfo,
  ResourceSchemeInfo,
} from '@napplet/nap/resource/types';

/** Resource service version — follows semver. */
const RESOURCE_SERVICE_VERSION = '1.0.0';

/** Read-only metadata passed from the resource service to a runtime resolver. */
export interface ResourceFetchInit {
  /** Read-only HTTP method selected by the service. */
  method?: string;
  /** Optional runtime-owned request headers. */
  headers?: Record<string, string>;
  /** Request-scoped cancellation signal. */
  signal: AbortSignal;
  /** Advisory Blossom server origins for this resource only. */
  servers?: readonly string[];
}

/** Context passed to a host-provided resource info resolver. */
export interface ResourceInfoContext {
  windowId: string;
  identity: { dTag: string; aggregateHash: string } | null;
}

/** Static or dynamic advisory resource info exposed through `resource.info`. */
export type ResourceInfoProvider =
  | ResourceInfo
  | ((context: ResourceInfoContext) => ResourceInfo | Promise<ResourceInfo>);

/**
 * Options for `createResourceService` (options-as-bridge per v1.6 Decision 18).
 *
 * `fetch` is the only required field. Kehto does not select a runtime's scheme
 * or origin policy. The optional origin-policy fields form one adapter and must
 * therefore be supplied together when a runtime chooses to use it.
 */
export interface ResourceServiceOptions {
  /**
   * Runtime-supplied resource resolver. Receives the requested URL and returns
   * a byte-classified `Response`.
   *
   * The runtime owns scheme dispatch and every NAP-RESOURCE policy decision.
   * The returned `content-type` must describe the runtime-classified bytes, not
   * an untrusted upstream header. Throw `ResourceServiceError` to preserve a
   * canonical protocol error classification.
   *
   * @param url - The URL from the resource.bytes request
   * @param init - Read-only method, request-scoped AbortSignal, and optional advisory Blossom servers
   */
  fetch(
    url: string,
    init: ResourceFetchInit,
  ): Promise<Response>;

  /**
   * Returns true if `origin` is present in `grants` (the list returned by
   * `getConnectGrants` for the napplet's dTag + aggregateHash).
   * Optional: when omitted with `getConnectGrants`, Kehto delegates directly
   * to the runtime resolver without an origin-grant decision.
   *
   * The reference implementation is simply `grants.includes(origin)`. Host apps
   * may provide normalized-origin comparison if needed.
   *
   * @param origin - Parsed origin of the requested URL (scheme + host + port)
   * @param grants - Readonly list from getConnectGrants for this napplet identity
   */
  isOriginGranted?(origin: string, grants: readonly string[]): boolean;

  /**
   * Returns the list of allowed fetch origins for the given napplet identity.
   * Called on every `resource.bytes` request — must be synchronous and fast.
   * Optional and paired with `isOriginGranted` plus `resolveIdentity`.
   *
   * Host-supplied grant source (e.g. a static per-dTag allowlist map, or any
   * other host-controlled policy). Returns an empty array to deny all origins.
   *
   * @param dTag - The napplet's d-tag (from session registry)
   * @param aggregateHash - The napplet's aggregate hash (from session registry)
   */
  getConnectGrants?(dTag: string, aggregateHash: string): readonly string[];

  /**
   * Resolve a windowId to the napplet's identity (dTag + aggregateHash).
   * Returns null if the window is not in the session registry.
   *
   * Typically wraps `sessionRegistry.getEntryByWindowId(windowId)`.
   *
   * @param windowId - The iframe window identifier
   */
  resolveIdentity?(windowId: string): { dTag: string; aggregateHash: string } | null;

  /**
   * Advisory NAP-RESOURCE introspection exposed through `resource.info`.
   *
   * Provide a static snapshot or a resolver when the shell wants to disclose
   * configured schemes and coarse limits. Scheme disclosure is advisory and is
   * never used as fetch authorization. Omit to disclose no schemes or limits.
   */
  resourceInfo?: ResourceInfoProvider;
}

/**
 * Type alias for the ServiceHandler returned by `createResourceService`.
 * Exported for host apps that need to type-annotate the handler reference.
 */
export type ResourceService = ServiceHandler;

interface ResourceRequestState {
  inFlight: Map<string, { controller: AbortController; windowId: string; requestId: string }>;
  perWindow: Map<string, Set<string>>;
}

export type ResourceErrorCode =
  | 'invalid-request'
  | 'not-found'
  | 'blocked-by-policy'
  | 'timeout'
  | 'too-large'
  | 'unsupported-scheme'
  | 'decode-failed'
  | 'network-error'
  | 'quota-exceeded';

/** A runtime resolver failure with a stable NAP-RESOURCE error classification. */
export class ResourceServiceError extends Error {
  /**
   * @param code - Canonical NAP-RESOURCE error code.
   * @param message - Diagnostic detail safe to return to the napplet.
   */
  constructor(readonly code: ResourceErrorCode, message: string) {
    super(message);
    this.name = 'ResourceServiceError';
  }
}

type ResourceFetchSuccess = {
  ok: true;
  url: string;
  blob: Blob;
  mime: string;
};

type ResourceFetchFailure = {
  ok: false;
  url: string;
  error: ResourceErrorCode;
  message: string;
};

type ResourceFetchItem = ResourceFetchSuccess | ResourceFetchFailure;

const DEFAULT_RESOURCE_INFO: ResourceInfo = {
  schemes: [],
};

function requestKey(windowId: string, requestId: string): string {
  return `${windowId}\u0000${requestId}`;
}

function assertResourceOptions(options: ResourceServiceOptions): void {
  if (typeof options?.fetch !== 'function') {
    throw new Error(
      '[RESOURCE-01] createResourceService requires a runtime-provided fetch resolver.',
    );
  }
  const hasOriginPolicy =
    options.isOriginGranted !== undefined || options.getConnectGrants !== undefined;
  if (
    hasOriginPolicy && (
      typeof options.isOriginGranted !== 'function'
      || typeof options.getConnectGrants !== 'function'
      || typeof options.resolveIdentity !== 'function'
    )
  ) {
    throw new Error(
      '[RESOURCE-01] optional origin policy requires {isOriginGranted, getConnectGrants, resolveIdentity} together.',
    );
  }
  if (options.resolveIdentity !== undefined && typeof options.resolveIdentity !== 'function') {
    throw new Error('[RESOURCE-01] resolveIdentity must be a function when provided.');
  }
}

function trackRequest(
  state: ResourceRequestState,
  requestId: string,
  windowId: string,
  controller: AbortController,
): void {
  const key = requestKey(windowId, requestId);
  state.inFlight.set(key, { controller, windowId, requestId });
  if (!state.perWindow.has(windowId)) {
    state.perWindow.set(windowId, new Set());
  }
  state.perWindow.get(windowId)!.add(key);
}

function untrackRequest(state: ResourceRequestState, windowId: string, requestId: string): void {
  const key = requestKey(windowId, requestId);
  const entry = state.inFlight.get(key);
  if (entry) {
    state.inFlight.delete(key);
    state.perWindow.get(entry.windowId)?.delete(key);
  }
}

function sendResourceError(
  send: (m: NappletMessage) => void,
  requestId: string,
  message: string,
  error: ResourceErrorCode,
  type: 'resource.bytes.error' | 'resource.bytesMany.error' = 'resource.bytes.error',
): void {
  send({
    type,
    id: requestId,
    error,
    message,
  } as NappletMessage);
}

function sendBytesManyError(
  send: (m: NappletMessage) => void,
  requestId: string,
  message: string,
  error: ResourceErrorCode,
): void {
  sendResourceError(send, requestId, message, error, 'resource.bytesMany.error');
}

function parseResourceUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function responseMime(response: Response): string {
  return response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    || 'application/octet-stream';
}

function responseBlob(buffer: ArrayBuffer, mime: string): Blob {
  return new Blob([buffer], { type: mime });
}

function requestIdFromMessage(message: NappletMessage & { id?: unknown; requestId?: unknown }): string | null {
  if (typeof message.id === 'string' && message.id.length > 0) return message.id;
  if (typeof message.requestId === 'string' && message.requestId.length > 0) return message.requestId;
  return null;
}

function normalizeResourceInfo(info: ResourceInfo): ResourceInfo {
  return {
    schemes: Array.isArray(info.schemes)
      ? info.schemes
          .filter((scheme) => typeof scheme?.scheme === 'string')
          .map((scheme) => ({ scheme: scheme.scheme, enabled: scheme.enabled !== false }))
      : [],
    ...(typeof info.maxBytes === 'number' ? { maxBytes: info.maxBytes } : {}),
    ...(typeof info.maxUrls === 'number' ? { maxUrls: info.maxUrls } : {}),
    ...(typeof info.maxServers === 'number' ? { maxServers: info.maxServers } : {}),
  };
}

async function resolveResourceInfo(
  options: ResourceServiceOptions,
  windowId: string,
): Promise<ResourceInfo> {
  const configured = options.resourceInfo ?? DEFAULT_RESOURCE_INFO;
  const info = typeof configured === 'function'
    ? await configured({ windowId, identity: options.resolveIdentity?.(windowId) ?? null })
    : configured;
  return normalizeResourceInfo(info);
}

async function handleInfo(
  options: ResourceServiceOptions,
  windowId: string,
  requestId: string,
  send: (m: NappletMessage) => void,
): Promise<void> {
  try {
    const info = await resolveResourceInfo(options, windowId);
    send({
      type: 'resource.info.result',
      id: requestId,
      info,
    } as NappletMessage);
  } catch (err: unknown) {
    send({
      type: 'resource.info.error',
      id: requestId,
      error: 'unavailable',
      message: err instanceof Error ? err.message : String(err),
    } as NappletMessage);
  }
}

function resourceInvalidRequest(url: string, message: string): ResourceFetchFailure {
  return {
    ok: false,
    url,
    error: 'invalid-request',
    message,
  };
}

function classifyResourceFailure(error: unknown): { error: ResourceErrorCode; message: string } {
  return {
    error: error instanceof ResourceServiceError ? error.code : 'network-error',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function fetchResourceItem(
  options: ResourceServiceOptions,
  windowId: string,
  info: ResourceInfo,
  request: ResourceBytesRequest,
  signal: AbortSignal,
): Promise<ResourceFetchItem> {
  const { url } = request;
  const parsedUrl = parseResourceUrl(url);
  if (!parsedUrl) return resourceInvalidRequest(url, `invalid URL: ${url}`);
  if (parsedUrl.origin !== 'null' && options.isOriginGranted && options.getConnectGrants) {
    const identity = options.resolveIdentity?.(windowId) ?? null;
    if (!identity) {
      return {
        ok: false,
        url,
        error: 'blocked-by-policy',
        message: 'napplet identity not resolvable for runtime origin policy',
      };
    }
    const origin = parsedUrl.origin;
    const grants = options.getConnectGrants(identity.dTag, identity.aggregateHash);
    if (!options.isOriginGranted(origin, grants)) {
      return {
        ok: false,
        url,
        error: 'blocked-by-policy',
        message: `origin ${origin} not granted by runtime policy`,
      };
    }
  }

  try {
    const response = await options.fetch(url, {
      method: 'GET',
      signal,
      ...(parsedUrl.protocol === 'blossom:' && request.servers !== undefined
        ? { servers: [...request.servers] }
        : {}),
    });
    const buffer = await response.arrayBuffer();
    if (info.maxBytes !== undefined && buffer.byteLength > info.maxBytes) {
      return { ok: false, url, error: 'too-large', message: `resource exceeds ${info.maxBytes} bytes` };
    }
    const mime = responseMime(response);
    return {
      ok: true,
      url,
      blob: responseBlob(buffer, mime),
      mime,
    };
  } catch (err: unknown) {
    const isAbort =
      signal.aborted ||
      (err instanceof Error && (err.name === 'AbortError' || err.name === 'DOMException'));
    return {
      ok: false,
      url,
      error: isAbort ? 'timeout' : err instanceof ResourceServiceError ? err.code : 'network-error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleBytes(
  options: ResourceServiceOptions,
  state: ResourceRequestState,
  windowId: string,
  msg: { requestId: string } & ResourceBytesRequest,
  send: (m: NappletMessage) => void,
): Promise<void> {
  const { requestId, ...request } = msg;
  const controller = new AbortController();
  trackRequest(state, requestId, windowId, controller);

  try {
    const info = await resolveResourceInfo(options, windowId);
    const item = await fetchResourceItem(options, windowId, info, request, controller.signal);
    if (controller.signal.aborted) return;
    if (!item.ok) {
      sendResourceError(send, requestId, item.message, item.error);
      return;
    }
    send({
      type: 'resource.bytes.result',
      id: requestId,
      blob: item.blob,
      mime: item.mime,
    } as NappletMessage);
  } catch (error: unknown) {
    if (!controller.signal.aborted) {
      const failure = classifyResourceFailure(error);
      sendResourceError(send, requestId, failure.message, failure.error);
    }
  } finally {
    untrackRequest(state, windowId, requestId);
  }
}

async function handleBytesMany(
  options: ResourceServiceOptions,
  state: ResourceRequestState,
  windowId: string,
  msg: { requestId: string; requests: readonly ResourceBytesRequest[] },
  send: (m: NappletMessage) => void,
): Promise<void> {
  const { requestId, requests } = msg;
  if (!isResourceRequestList(requests)) {
    sendBytesManyError(send, requestId, 'resource.bytesMany requires a non-empty requests array', 'invalid-request');
    return;
  }

  let info: ResourceInfo;
  try {
    info = await resolveResourceInfo(options, windowId);
  } catch (error: unknown) {
    const failure = classifyResourceFailure(error);
    sendBytesManyError(send, requestId, failure.message, failure.error);
    return;
  }
  if (info.maxUrls !== undefined && requests.length > info.maxUrls) {
    sendBytesManyError(send, requestId, `resource.bytesMany exceeds ${info.maxUrls} URLs`, 'too-large');
    return;
  }

  const controller = new AbortController();
  trackRequest(state, requestId, windowId, controller);
  try {
    const items: Array<Record<string, unknown>> = [];
    for (const request of requests) {
      const item = await fetchResourceItem(options, windowId, info, request, controller.signal);
      if (controller.signal.aborted) return;
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
          message: item.message,
        });
      }
    }
    send({
      type: 'resource.bytesMany.result',
      id: requestId,
      items,
    } as NappletMessage);
  } catch (error: unknown) {
    if (!controller.signal.aborted) {
      const failure = classifyResourceFailure(error);
      sendBytesManyError(send, requestId, failure.message, failure.error);
    }
  } finally {
    untrackRequest(state, windowId, requestId);
  }
}

function hasValidServerHints(request: { servers?: readonly unknown[] }): boolean {
  return request.servers === undefined
    || (Array.isArray(request.servers) && request.servers.every((server) => typeof server === 'string'));
}

function isResourceRequestList(value: unknown): value is readonly ResourceBytesRequest[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((request) => (
      typeof request === 'object'
      && request !== null
      && typeof (request as ResourceBytesRequest).url === 'string'
      && hasValidServerHints(request as ResourceBytesRequest)
    ));
}

function handleCancel(state: ResourceRequestState, windowId: string, requestId: string): void {
  const entry = state.inFlight.get(requestKey(windowId, requestId));
  if (entry) {
    entry.controller.abort();
  }
}

function destroyWindowRequests(state: ResourceRequestState, windowId: string): void {
  const requestIds = state.perWindow.get(windowId);
  if (!requestIds) return;
  for (const key of requestIds) {
    const entry = state.inFlight.get(key);
    if (entry) {
      entry.controller.abort();
      state.inFlight.delete(key);
    }
  }
  state.perWindow.delete(windowId);
}

/**
 * Create a NAP-RESOURCE reference service.
 *
 * Implements the NAP-RESOURCE request/response protocol: `resource.info`,
 * `resource.bytes`, `resource.bytesMany`, `resource.cancel`, and their
 * result/error envelopes.
 *
 * The runtime resolver is validated at construction. Runtime implementers may
 * additionally install the origin-grant adapter; Kehto provides and enforces
 * the hook contract without selecting the grants or requiring that policy.
 *
 * Returns a `ServiceHandler` (no `publishValues`-style surface — resource has
 * no shell-initiated push beyond the response/error path).
 *
 * @param options - Runtime resolver plus optional runtime-owned policy helpers
 * @returns ServiceHandler to register via `runtime.registerService('resource', handler)`
 *
 * @example
 * ```ts
 * import { createResourceService } from '@kehto/services';
 *
 * const svc = createResourceService({
 *   fetch: (url, init) => runtimeResources.resolve(url, init),
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
    inFlight: new Map(),
    perWindow: new Map<string, Set<string>>(),
  };

  const descriptor: ServiceDescriptor = {
    name: 'resource',
    version: RESOURCE_SERVICE_VERSION,
    description:
      'NAP-RESOURCE service — runtime-resolved byte transport (RESOURCE-01..06)',
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
            servers?: readonly string[];
          };
          const requestId = requestIdFromMessage(m);
          if (!requestId) return;
          if (typeof m.url !== 'string' || !hasValidServerHints(m)) {
            sendResourceError(send, requestId, 'resource.bytes requires a URL and optional string servers', 'invalid-request');
            return;
          }
          handleBytes(options, state, windowId, {
            requestId,
            url: m.url,
            ...(m.servers !== undefined ? { servers: [...m.servers] } : {}),
          }, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.info': {
          const m = message as NappletMessage & { id?: string; requestId?: string };
          const requestId = requestIdFromMessage(m);
          if (!requestId) return;
          handleInfo(options, windowId, requestId, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.bytesMany': {
          const m = message as NappletMessage & {
            id?: string;
            requestId?: string;
            requests?: readonly ResourceBytesRequest[];
          };
          const requestId = requestIdFromMessage(m);
          if (!requestId) return;
          handleBytesMany(options, state, windowId, { requestId, requests: m.requests ?? [] }, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.cancel': {
          const m = message as NappletMessage & { id?: string; requestId?: string };
          const requestId = requestIdFromMessage(m);
          if (requestId) handleCancel(state, windowId, requestId);
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

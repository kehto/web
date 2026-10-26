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
 * policy tooling. The runtime supplies the resolver, which must call
 * `init.authorizeNetwork` before each actual network destination, including
 * redirects. The host decides which schemes to resolve and limits to expose.
 * Advisory `resource.info` scheme disclosure never authorizes or blocks a byte
 * request.
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Runtime integration requires a resolver. With runtime approval support,
 * the service authorizes each resource URL, and the resolver must authorize
 * every actual HTTP(S) or WebSocket destination independently.
 *
 * @example
 * ```ts
 * import { createResourceService } from '@kehto/services';
 *
 * const resourceSvc = createResourceService({
 *   fetch: (url, init) => runtimeResources.resolve(url, init),
 * });
 * runtime.registerService('resource', resourceSvc);
 * ```
 */

import type { NappletMessage } from '@napplet/core';
import type { ResourceInfo } from '@napplet/nap/resource/types';
import type { ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
import {
  authorizeResource,
  ResourceAuthorizationError,
  type AuthorizeNetwork,
} from './resource-authorization.js';

export type {
  ResourceInfo,
  ResourceSchemeInfo,
} from '@napplet/nap/resource/types';

/** Canonical inbound NAP-RESOURCE bytes request. */
export interface ResourceBytesRequest { readonly url: string; }

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
  /** Authenticated source window, for runtime-private scoped policy state. */
  windowId?: string;
  /** Authorize every actual HTTP(S) or WebSocket destination before the resolver contacts it. */
  authorizeNetwork?: AuthorizeNetwork;
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
 * or origin policy.
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
   * @param init - Read-only method, request-scoped AbortSignal, and actual-destination approval callback
   */
  fetch(
    url: string,
    init: ResourceFetchInit,
  ): Promise<Response>;

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
  runtime?: ServiceRuntimeContext;
  warnLegacy: () => void;
  inFlight: Map<string, {
    controller: AbortController;
    windowId: string;
    requestId: string;
    operation: 'resource.info' | 'resource.bytes' | 'resource.bytesMany';
    send: (m: NappletMessage) => void;
    terminal: boolean;
  }>;
  perWindow: Map<string, Set<string>>;
  completed: Map<string, Set<string>>;
}

// Kehto replay policy, additional to NAP-RESOURCE ae5b9c64 cancellation rules.
// Keep recent terminal IDs bounded independently from still-active requests.
const MAX_COMPLETED_RESOURCE_IDS = 1024;

function rememberCompleted(state: ResourceRequestState, windowId: string, requestId: string): void {
  let completed = state.completed.get(windowId);
  if (!completed) {
    completed = new Set();
    state.completed.set(windowId, completed);
  }
  completed.add(requestId);
  if (completed.size > MAX_COMPLETED_RESOURCE_IDS) completed.delete(completed.values().next().value!);
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
  blob: string;
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
}

function trackRequest(
  state: ResourceRequestState,
  requestId: string,
  windowId: string,
  controller: AbortController,
  operation: 'resource.info' | 'resource.bytes' | 'resource.bytesMany',
  send: (m: NappletMessage) => void,
): boolean {
  const key = requestKey(windowId, requestId);
  if (state.inFlight.has(key)) return false;
  state.inFlight.set(key, { controller, windowId, requestId, operation, send, terminal: false });
  if (!state.perWindow.has(windowId)) {
    state.perWindow.set(windowId, new Set());
  }
  state.perWindow.get(windowId)!.add(key);
  return true;
}

function untrackRequest(state: ResourceRequestState, windowId: string, requestId: string, controller: AbortController): void {
  const key = requestKey(windowId, requestId);
  const entry = state.inFlight.get(key);
  if (entry?.controller === controller) {
    state.inFlight.delete(key);
    state.perWindow.get(entry.windowId)?.delete(key);
    rememberCompleted(state, windowId, requestId);
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

function encodeCanonicalBase64(buffer: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function requestIdFromMessage(message: NappletMessage & { id?: unknown }): string | null {
  if (typeof message.id === 'string' && message.id.length > 0) return message.id;
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
  };
}

async function resolveResourceInfo(
  options: ResourceServiceOptions,
  windowId: string,
): Promise<ResourceInfo> {
  const configured = options.resourceInfo ?? DEFAULT_RESOURCE_INFO;
  const info = typeof configured === 'function'
    ? await configured({ windowId, identity: null })
    : configured;
  return normalizeResourceInfo(info);
}

async function handleInfo(
  options: ResourceServiceOptions,
  state: ResourceRequestState,
  windowId: string,
  requestId: string,
  send: (m: NappletMessage) => void,
): Promise<void> {
  const controller = new AbortController();
  if (!trackRequest(state, requestId, windowId, controller, 'resource.info', send)) return;
  try {
    const info = await resolveResourceInfo(options, windowId);
    if (controller.signal.aborted) return;
    send({
      type: 'resource.info.result',
      id: requestId,
      info,
    } as NappletMessage);
  } catch (err: unknown) {
    if (controller.signal.aborted) return;
    send({
      type: 'resource.info.error',
      id: requestId,
      error: 'unavailable',
      message: err instanceof Error ? err.message : String(err),
    } as NappletMessage);
  } finally {
    untrackRequest(state, windowId, requestId, controller);
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
    error: error instanceof ResourceServiceError ? error.code
      : error instanceof ResourceAuthorizationError ? 'blocked-by-policy' : 'network-error',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function fetchResourceItem(
  options: ResourceServiceOptions,
  state: ResourceRequestState,
  windowId: string,
  info: ResourceInfo,
  request: ResourceBytesRequest,
  signal: AbortSignal,
): Promise<ResourceFetchItem> {
  const { url } = request;
  const parsedUrl = parseResourceUrl(url);
  if (!parsedUrl) return resourceInvalidRequest(url, `invalid URL: ${url}`);
  const result = await authorizeResource(state.runtime, windowId, url, signal, async (requestSignal, authorizeNetwork): Promise<ResourceFetchItem> => {
    try {
      const response = await options.fetch(url, {
        method: 'GET',
        signal: requestSignal,
        windowId,
        authorizeNetwork,
      });
      const buffer = await response.arrayBuffer();
      if (info.maxBytes !== undefined && buffer.byteLength > info.maxBytes) {
        return { ok: false, url, error: 'too-large', message: `resource exceeds ${info.maxBytes} bytes` };
      }
      const mime = responseMime(response);
      return {
        ok: true,
        url,
        blob: encodeCanonicalBase64(buffer),
        mime,
      };
    } catch (err: unknown) {
      const isAbort =
        requestSignal.aborted ||
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'DOMException'));
      return {
        ok: false,
        url,
        error: isAbort ? 'timeout' : (err instanceof ResourceServiceError ? err.code
          : err instanceof ResourceAuthorizationError ? 'blocked-by-policy' : 'network-error'),
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }, state.warnLegacy);
  return result.status === 'executed' ? result.value : {
    ok: false, url, error: 'blocked-by-policy', message: 'resource permission unavailable or denied',
  };
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
  if (!trackRequest(state, requestId, windowId, controller, 'resource.bytes', send)) return;

  try {
    const info = await resolveResourceInfo(options, windowId);
    if (controller.signal.aborted) return;
    const item = await fetchResourceItem(options, state, windowId, info, request, controller.signal);
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
    untrackRequest(state, windowId, requestId, controller);
  }
}

async function handleBytesMany(
  options: ResourceServiceOptions,
  state: ResourceRequestState,
  windowId: string,
  msg: { requestId: string; urls: readonly string[] },
  send: (m: NappletMessage) => void,
): Promise<void> {
  const { requestId, urls } = msg;
  if (!isResourceUrlList(urls)) {
    rememberCompleted(state, windowId, requestId);
    sendBytesManyError(send, requestId, 'resource.bytesMany requires a non-empty urls array', 'invalid-request');
    return;
  }

  const controller = new AbortController();
  if (!trackRequest(state, requestId, windowId, controller, 'resource.bytesMany', send)) return;
  try {
    const info = await resolveResourceInfo(options, windowId);
    if (controller.signal.aborted) return;
    if (info.maxUrls !== undefined && urls.length > info.maxUrls) {
      sendBytesManyError(send, requestId, `resource.bytesMany exceeds ${info.maxUrls} URLs`, 'too-large');
      return;
    }
    const items: Array<Record<string, unknown>> = [];
    for (const url of urls) {
      const request = { url };
      const item = await fetchResourceItem(options, state, windowId, info, request, controller.signal);
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
    untrackRequest(state, windowId, requestId, controller);
  }
}

function isResourceUrlList(value: unknown): value is readonly string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((url) => typeof url === 'string');
}

function handleCancel(state: ResourceRequestState, windowId: string, requestId: string): void {
  const entry = state.inFlight.get(requestKey(windowId, requestId));
  if (entry) {
    entry.controller.abort();
  }
}

function destroyWindowRequests(state: ResourceRequestState, windowId: string): void {
  state.completed.delete(windowId);
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
 * The runtime resolver is validated at construction. Runtime-bound approvals
 * cover the exact resource URL and each resolver-reported HTTP(S) or WebSocket hop.
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
 * });
 * runtime.registerService('resource', svc);
 * ```
 */
export function createResourceService(options: ResourceServiceOptions): ResourceService {
  assertResourceOptions(options);
  let warned = false;
  const state: ResourceRequestState = {
    warnLegacy() {
      if (warned) return;
      warned = true;
      console.warn('[FW-RESOURCE-LEGACY-001] Configure RuntimeAdapter.permissions and trusted session permissionPrincipal; resolver-only resource policy is deprecated. Warning once per service instance.');
    },
    inFlight: new Map(),
    perWindow: new Map<string, Set<string>>(),
    completed: new Map(),
  };

  const descriptor: ServiceDescriptor = {
    name: 'resource',
    version: RESOURCE_SERVICE_VERSION,
    description:
      'NAP-RESOURCE service — runtime-resolved byte transport (RESOURCE-01..06)',
  };

  const handler: ServiceHandler = {
    descriptor,
    onRegistered(context) { state.runtime = context; },
    onPermissionRevoked(windowId) {
      for (const key of state.perWindow.get(windowId) ?? []) {
        const entry = state.inFlight.get(key);
        if (!entry || entry.terminal) continue;
        entry.terminal = true;
        entry.controller.abort();
        if (entry.operation === 'resource.bytes' || entry.operation === 'resource.bytesMany') {
          entry.send({
            type: `${entry.operation}.error`, id: entry.requestId,
            error: 'blocked-by-policy', message: 'resource permission revoked',
          } as NappletMessage);
        }
      }
    },

    handleMessage(
      windowId: string,
      message: NappletMessage,
      send: (msg: NappletMessage) => void,
    ): void {
      if (message.type !== 'resource.cancel') {
        const id = requestIdFromMessage(message);
        if (id && (state.inFlight.has(requestKey(windowId, id)) || state.completed.get(windowId)?.has(id))) return;
      }
      switch (message.type) {
        case 'resource.bytes': {
          const m = message as NappletMessage & {
            id?: string;
            url: string;
          };
          const requestId = requestIdFromMessage(m);
          if (!requestId) return;
          if (typeof m.url !== 'string') {
            rememberCompleted(state, windowId, requestId);
            sendResourceError(send, requestId, 'resource.bytes requires a URL', 'invalid-request');
            return;
          }
          handleBytes(options, state, windowId, {
            requestId,
            url: m.url,
          }, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.info': {
          const m = message as NappletMessage & { id?: string };
          const requestId = requestIdFromMessage(m);
          if (!requestId) return;
          handleInfo(options, state, windowId, requestId, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.bytesMany': {
          const m = message as NappletMessage & {
            id?: string;
            urls?: readonly string[];
          };
          const requestId = requestIdFromMessage(m);
          if (!requestId) return;
          const urls = isResourceUrlList(m.urls) ? [...m.urls] : [];
          handleBytesMany(options, state, windowId, { requestId, urls }, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.cancel': {
          const m = message as NappletMessage & { id?: string };
          const requestId = requestIdFromMessage(m);
          if (requestId) handleCancel(state, windowId, requestId);
          return;
        }

        default:
          // Unknown resource.* message — silently ignored per NIP-5D.
          return;
      }
    },

    onUnregistered(): void {
      for (const windowId of state.perWindow.keys()) destroyWindowRequests(state, windowId);
      state.completed.clear();
      state.runtime = undefined;
    },

    onWindowDestroyed(windowId: string): void {
      destroyWindowRequests(state, windowId);
    },
  };

  return handler;
}

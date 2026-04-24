/**
 * resource-service.ts — NUB-RESOURCE reference service (10th NUB domain, v1.7 Phase 40).
 *
 * Shell-side reference implementation for the canonical NUB-RESOURCE wire
 * protocol (`provisional-resource.ts` in @kehto/shell/src/types; will swap to
 * `@napplet/nub/resource` when published at ^0.2.2). Handles the canonical
 * 4-message protocol:
 *   Inbound:  resource.bytes, resource.cancel
 *   Outbound: resource.bytes.result, resource.bytes.error
 *
 * ──────────────────────── SCOPE BOUNDARY (RESOURCE-01) ────────────────────────
 * NUB-RESOURCE is an **authenticated fetch proxy** — read-only, atomic.
 *
 * This service is NOT responsible for:
 *   - Streaming / chunked responses (host-app concern)
 *   - Response caching / conditional requests (host-app concern)
 *   - Upload / POST body construction (NUB-RESOURCE v1.7 is read-only)
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
 *   getConnectGrants: (dTag, hash) => connectStore.getOrigins(dTag, hash),
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
   * Typically wraps `connectStore.getOrigins(dTag, aggregateHash)` from
   * @kehto/shell.
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

// ─── Base64 encode helper (browser-safe, chunked to avoid stack overflow) ─────

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

// ─── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a NUB-RESOURCE reference service.
 *
 * Implements canonical 4-message protocol: `resource.bytes` (napplet → shell
 * fetch request), `resource.cancel` (napplet → shell in-flight cancellation),
 * `resource.bytes.result` (shell → napplet success), `resource.bytes.error`
 * (shell → napplet failure/denial/cancel).
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
 *   getConnectGrants: (dTag, hash) => connectStore.getOrigins(dTag, hash),
 *   resolveIdentity: (windowId) => sessionRegistry.getEntryByWindowId(windowId) ?? null,
 * });
 * runtime.registerService('resource', svc);
 * ```
 */
export function createResourceService(options: ResourceServiceOptions): ResourceService {
  // ─── H-03 prevention: getConnectGrants REQUIRED from day one (see PITFALLS.md:228) ───
  // All four options are required. Validate each individually for clear error messaging.
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

  // ─── In-flight tracking ────────────────────────────────────────────────────
  // Primary map: requestId → { controller, windowId }
  const inFlight = new Map<string, { controller: AbortController; windowId: string }>();
  // Secondary map: windowId → Set<requestId> for onWindowDestroyed cleanup
  const perWindow = new Map<string, Set<string>>();

  function trackRequest(requestId: string, windowId: string, controller: AbortController): void {
    inFlight.set(requestId, { controller, windowId });
    if (!perWindow.has(windowId)) {
      perWindow.set(windowId, new Set());
    }
    perWindow.get(windowId)!.add(requestId);
  }

  function untrackRequest(requestId: string): void {
    const entry = inFlight.get(requestId);
    if (entry) {
      inFlight.delete(requestId);
      perWindow.get(entry.windowId)?.delete(requestId);
    }
  }

  // ─── Async bytes handler ──────────────────────────────────────────────────
  async function handleBytes(
    windowId: string,
    msg: { requestId: string; url: string; init?: { method?: string; headers?: Readonly<Record<string, string>> } },
    send: (m: NappletMessage) => void,
  ): Promise<void> {
    const { requestId, url, init } = msg;

    // (1) Resolve napplet identity
    const identity = options.resolveIdentity(windowId);
    if (!identity) {
      send({
        type: 'resource.bytes.error',
        requestId,
        code: 'denied',
        message: 'napplet identity not resolvable',
      } as NappletMessage);
      return;
    }

    // (2) Parse URL and extract origin
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      send({
        type: 'resource.bytes.error',
        requestId,
        code: 'invalid-url',
        message: `invalid URL: ${url}`,
      } as NappletMessage);
      return;
    }
    const origin = parsedUrl.origin;

    // (3) Fetch grants + check origin
    const grants = options.getConnectGrants(identity.dTag, identity.aggregateHash);
    if (!options.isOriginGranted(origin, grants)) {
      send({
        type: 'resource.bytes.error',
        requestId,
        code: 'denied',
        message: `origin ${origin} not granted`,
      } as NappletMessage);
      return;
    }

    // (4) Create AbortController, track in-flight
    const controller = new AbortController();
    trackRequest(requestId, windowId, controller);

    try {
      const response = await options.fetch(url, {
        method: init?.method,
        headers: init?.headers ? { ...init.headers } : undefined,
        signal: controller.signal,
      });

      // Encode body
      const buffer = await response.arrayBuffer();
      const bodyBase64 = arrayBufferToBase64(buffer);

      // Collect response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      send({
        type: 'resource.bytes.result',
        requestId,
        status: response.status,
        headers,
        bodyBase64,
      } as NappletMessage);
    } catch (err: unknown) {
      // Determine if this was an abort triggered by resource.cancel
      const isAbort =
        controller.signal.aborted ||
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'DOMException'));

      send({
        type: 'resource.bytes.error',
        requestId,
        code: isAbort ? 'canceled' : 'network-error',
        message: err instanceof Error ? err.message : String(err),
      } as NappletMessage);
    } finally {
      untrackRequest(requestId);
    }
  }

  // ─── Descriptor ────────────────────────────────────────────────────────────

  const descriptor: ServiceDescriptor = {
    name: 'resource',
    version: RESOURCE_SERVICE_VERSION,
    description:
      'NUB-RESOURCE reference service — shell-proxied authenticated fetch (RESOURCE-01..06)',
  };

  // ─── ServiceHandler ────────────────────────────────────────────────────────

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
            requestId: string;
            url: string;
            init?: { method?: string; headers?: Readonly<Record<string, string>> };
          };
          // Fire-and-forget async — catch so unhandled rejections don't propagate
          handleBytes(windowId, m, send).catch(() => { /* errors surface via send() */ });
          return;
        }

        case 'resource.cancel': {
          const m = message as NappletMessage & { requestId: string };
          const entry = inFlight.get(m.requestId);
          if (entry) {
            entry.controller.abort();
            // Note: do NOT delete from inFlight here — the bytes reject path in
            // handleBytes will call untrackRequest() in its finally block.
            // Deleting here would cause untrackRequest to find no entry and leave
            // perWindow in an inconsistent state.
          }
          // Silent no-op if requestId not in flight (spec-consistent)
          return;
        }

        default:
          // Unknown resource.* message — silently ignored per NIP-5D.
          return;
      }
    },

    onWindowDestroyed(windowId: string): void {
      const requestIds = perWindow.get(windowId);
      if (!requestIds) return;
      // Abort all in-flight requests for this window
      for (const requestId of [...requestIds]) {
        const entry = inFlight.get(requestId);
        if (entry) {
          entry.controller.abort();
          inFlight.delete(requestId);
        }
      }
      perWindow.delete(windowId);
    },
  };

  return handler;
}

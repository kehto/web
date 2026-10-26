/**
 * cvm-service.ts — NAP-CVM (ContextVM bridge) reference service.
 *
 * Shell-side handler for the NAP-CVM wire protocol. It is a pure envelope
 * router: it validates `cvm.*` envelopes, delegates the actual ContextVM /
 * MCP-over-Nostr work to an injected {@link CvmTransport}, and posts the
 * correlated `*.result` (echoing the request `id`) back to the napplet.
 *
 * The transport is injected (options-as-bridge) so this service has no Nostr
 * dependency and is fully unit-testable. A concrete ContextVM transport ships
 * separately at `@kehto/services/cvm-nostr-transport`.
 *
 * ──────────────────────────── Responsibilities ────────────────────────────
 *   Inbound:  cvm.discover, cvm.request, cvm.close
 *   Outbound: cvm.discover.result, cvm.request.result, cvm.close.result,
 *             cvm.event (server-pushed MCP notifications)
 *
 * MCP-level errors are returned inside `request.result.message.error`;
 * transport/shell-policy failures are returned in the envelope `error` field.
 *
 * `cvm.event` is fanned out to every window that holds an active session with
 * the originating server (a window opens a session by issuing a `cvm.request`
 * and closes it via `cvm.close` or window teardown).
 *
 * @example
 * ```ts
 * import { createCvmService } from '@kehto/services';
 * import { createNostrCvmTransport } from '@kehto/services/cvm-nostr-transport';
 *
 * const transport = createNostrCvmTransport({ defaultRelays: ['wss://relay.contextvm.org'] });
 * runtime.registerService('cvm', createCvmService({ transport }));
 * ```
 */

import type { ApprovalSignal, ServiceHandler } from '@kehto/runtime';
import type { CvmDiscoverQuery, CvmRequestOptions, CvmServer, CvmServerRef, McpMessage } from './cvm-types.js';

/**
 * Abstract ContextVM transport. Implementors own Nostr relay access, signing,
 * encryption (CEP-4 gift wrap), JSON-RPC correlation, and MCP initialization.
 */
export interface CvmTransport {
  /** Select discovery relay targets without network contact. */
  planDiscover?(query?: CvmDiscoverQuery): readonly string[];
  /** Select operational relay targets without signing, encryption, or network contact. */
  planRequest?(server: CvmServerRef): readonly string[];
  /** Resolve public ContextVM server announcements matching the query. */
  discover(query?: CvmDiscoverQuery, execution?: { signal: ApprovalSignal }): Promise<CvmServer[]>;
  /** Send a raw MCP message to a server and resolve with the MCP response. */
  request(server: CvmServerRef, message: McpMessage, options?: CvmRequestOptions, execution?: { signal: ApprovalSignal }): Promise<McpMessage>;
  /** Release any session state held for a server (subscriptions, init cache). */
  close(server: CvmServerRef): Promise<void>;
  /**
   * Subscribe to server-pushed MCP messages not correlated to a single
   * request (e.g. notifications). Returns a handle whose `close()` detaches.
   */
  onEvent(handler: (server: CvmServerRef, message: McpMessage) => void): { close(): void };
  /** Release all transport resources when the owning service is disposed. */
  dispose?(): void;
}

/** Options for {@link createCvmService}. */
export interface CvmServiceOptions {
  /** The ContextVM transport the shell uses to reach servers. Required. */
  transport: CvmTransport;
}

/** The created CVM service, exposing the handler plus a disposal hook. */
export interface CvmService extends ServiceHandler {
  /** Detach the transport event subscription. Idempotent. */
  dispose(): void;
}


export { createCvmServiceHandler as createCvmService } from './cvm-service-handler.js';

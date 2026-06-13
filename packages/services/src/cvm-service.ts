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

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  CvmDiscoverQuery,
  CvmRequestOptions,
  CvmServer,
  CvmServerRef,
  McpMessage,
} from './cvm-types.js';

/** CVM service version — follows semver. */
const CVM_SERVICE_VERSION = '1.0.0';

/**
 * Abstract ContextVM transport. Implementors own Nostr relay access, signing,
 * encryption (CEP-4 gift wrap), JSON-RPC correlation, and MCP initialization.
 */
export interface CvmTransport {
  /** Resolve public ContextVM server announcements matching the query. */
  discover(query?: CvmDiscoverQuery): Promise<CvmServer[]>;
  /** Send a raw MCP message to a server and resolve with the MCP response. */
  request(server: CvmServerRef, message: McpMessage, options?: CvmRequestOptions): Promise<McpMessage>;
  /** Release any session state held for a server (subscriptions, init cache). */
  close(server: CvmServerRef): Promise<void>;
  /**
   * Subscribe to server-pushed MCP messages not correlated to a single
   * request (e.g. notifications). Returns a handle whose `close()` detaches.
   */
  onEvent(handler: (server: CvmServerRef, message: McpMessage) => void): { close(): void };
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

type Send = (msg: NappletMessage) => void;

const CVM_DESCRIPTOR: ServiceDescriptor = {
  name: 'cvm',
  version: CVM_SERVICE_VERSION,
  description: 'NAP-CVM ContextVM bridge — MCP over Nostr',
};

/**
 * Create the NAP-CVM service handler.
 *
 * @param options - Must provide a {@link CvmTransport}.
 * @returns A {@link CvmService} (a `ServiceHandler` with a `dispose()` hook).
 * @throws If `options.transport` is missing.
 */
export function createCvmService(options: CvmServiceOptions): CvmService {
  if (!options || typeof options.transport !== 'object' || options.transport === null) {
    throw new Error('createCvmService: options.transport is required');
  }
  const { transport } = options;

  // Per-window send callbacks, captured at request time for cvm.event fan-out.
  const sendByWindow = new Map<string, Send>();
  // serverPubkey -> set of windowIds with an active session.
  const windowsByServer = new Map<string, Set<string>>();

  function openSession(windowId: string, server: CvmServerRef, send: Send): void {
    sendByWindow.set(windowId, send);
    let windows = windowsByServer.get(server.pubkey);
    if (!windows) {
      windows = new Set<string>();
      windowsByServer.set(server.pubkey, windows);
    }
    windows.add(windowId);
  }

  function closeSession(windowId: string, serverPubkey: string): void {
    const windows = windowsByServer.get(serverPubkey);
    if (windows) {
      windows.delete(windowId);
      if (windows.size === 0) windowsByServer.delete(serverPubkey);
    }
  }

  const eventSub = transport.onEvent((server, message) => {
    const windows = windowsByServer.get(server.pubkey);
    if (!windows) return;
    for (const windowId of windows) {
      const send = sendByWindow.get(windowId);
      send?.({ type: 'cvm.event', server, message } as NappletMessage);
    }
  });

  function handleDiscover(msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; query?: CvmDiscoverQuery };
    const id = m.id ?? '';
    void transport
      .discover(m.query)
      .then((servers) => send({ type: 'cvm.discover.result', id, servers } as NappletMessage))
      .catch((err) =>
        send({ type: 'cvm.discover.result', id, servers: [], error: toErrorMessage(err) } as NappletMessage),
      );
  }

  function handleRequest(windowId: string, msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & {
      id?: string;
      server?: CvmServerRef;
      message?: McpMessage;
      options?: CvmRequestOptions;
    };
    const id = m.id ?? '';
    if (!m.server || typeof m.server.pubkey !== 'string' || m.server.pubkey.length === 0) {
      send({ type: 'cvm.request.result', id, error: 'server not found' } as NappletMessage);
      return;
    }
    if (!m.message || typeof m.message !== 'object') {
      send({ type: 'cvm.request.result', id, error: 'unsupported method' } as NappletMessage);
      return;
    }
    openSession(windowId, m.server, send);
    void transport
      .request(m.server, m.message, m.options)
      .then((message) => send({ type: 'cvm.request.result', id, message } as NappletMessage))
      .catch((err) =>
        send({ type: 'cvm.request.result', id, error: toErrorMessage(err) } as NappletMessage),
      );
  }

  function handleClose(windowId: string, msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; server?: CvmServerRef };
    const id = m.id ?? '';
    if (!m.server || typeof m.server.pubkey !== 'string') {
      send({ type: 'cvm.close.result', id, error: 'server not found' } as NappletMessage);
      return;
    }
    closeSession(windowId, m.server.pubkey);
    void transport
      .close(m.server)
      .then(() => send({ type: 'cvm.close.result', id } as NappletMessage))
      .catch((err) => send({ type: 'cvm.close.result', id, error: toErrorMessage(err) } as NappletMessage));
  }

  return {
    descriptor: CVM_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      switch (message.type) {
        case 'cvm.discover':
          handleDiscover(message, send);
          return;
        case 'cvm.request':
          handleRequest(windowId, message, send);
          return;
        case 'cvm.close':
          handleClose(windowId, message, send);
          return;
        default:
          // Unknown cvm.* action — silently ignored (forward-compatible).
          return;
      }
    },
    onWindowDestroyed(windowId: string): void {
      sendByWindow.delete(windowId);
      for (const [pubkey, windows] of windowsByServer) {
        windows.delete(windowId);
        if (windows.size === 0) windowsByServer.delete(pubkey);
      }
    },
    dispose(): void {
      eventSub.close();
    },
  };
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'cvm request failed';
}

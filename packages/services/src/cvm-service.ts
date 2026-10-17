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
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
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

type Send = (msg: NappletMessage) => void;

interface CvmSession {
  readonly server: CvmServerRef;
  readonly generation: symbol;
}

const CVM_DESCRIPTOR: ServiceDescriptor = {
  name: 'cvm',
  version: CVM_SERVICE_VERSION,
  description: 'NAP-CVM ContextVM bridge — MCP over Nostr',
};

function relayOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== 'wss:' && url.protocol !== 'ws:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

function relayPlan(relays: readonly string[]): readonly string[] {
  const origins = relays.map(relayOrigin);
  if (origins.some((origin) => origin === null)) throw new Error('invalid relay');
  return Object.freeze([...new Set(origins as string[])]);
}

function validQuery(query: unknown): query is CvmDiscoverQuery | undefined {
  if (query === undefined) return true;
  if (!query || typeof query !== 'object') return false;
  const value = query as CvmDiscoverQuery;
  return (value.search === undefined || (typeof value.search === 'string' && value.search.length <= 256))
    && (value.limit === undefined || (Number.isSafeInteger(value.limit) && value.limit > 0 && value.limit <= 100))
    && (value.kinds === undefined || (Array.isArray(value.kinds) && value.kinds.every((kind) => Number.isSafeInteger(kind))))
    && (value.relays === undefined || (Array.isArray(value.relays) && value.relays.length <= 32));
}

function validServer(server: unknown): server is CvmServerRef {
  if (!server || typeof server !== 'object') return false;
  const value = server as CvmServerRef;
  return typeof value.pubkey === 'string' && /^[0-9a-f]{64}$/u.test(value.pubkey)
    && (value.relays === undefined || (Array.isArray(value.relays) && value.relays.length <= 32));
}

function validMessage(message: unknown): message is McpMessage {
  return !!message && typeof message === 'object' && (message as McpMessage).jsonrpc === '2.0';
}

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

  const sends = new Map<string, Send>();
  const generations = new Map<string, symbol>();
  const sessions = new Map<string, Map<string, CvmSession>>();
  let runtime: ServiceRuntimeContext | undefined;

  function generationFor(windowId: string): symbol {
    let generation = generations.get(windowId);
    if (!generation) { generation = Symbol(windowId); generations.set(windowId, generation); }
    return generation;
  }
  function current(windowId: string, generation: symbol): boolean { return generations.get(windowId) === generation; }
  function currentSend(windowId: string, generation: symbol, message: NappletMessage): void {
    if (current(windowId, generation)) sends.get(windowId)?.(message);
  }
  function hasSession(serverPubkey: string): boolean {
    return [...sessions.values()].some((windowSessions) => windowSessions.has(serverPubkey));
  }
  function remember(windowId: string, generation: symbol, server: CvmServerRef): void {
    let windowSessions = sessions.get(windowId);
    if (!windowSessions) { windowSessions = new Map(); sessions.set(windowId, windowSessions); }
    windowSessions.set(server.pubkey, { server, generation });
  }
  async function release(windowId: string, serverPubkey: string): Promise<void> {
    const windowSessions = sessions.get(windowId);
    const session = windowSessions?.get(serverPubkey);
    if (!session) return;
    windowSessions!.delete(serverPubkey);
    if (windowSessions!.size === 0) sessions.delete(windowId);
    if (!hasSession(serverPubkey)) await transport.close(session.server);
  }
  function requirements(operation: 'cvm.discover' | 'cvm.request', relays: readonly string[], server?: CvmServerRef) {
    return [
      { category: 'interface' as const, domain: 'cvm', operation: 'access', scope: { kind: 'exact' as const, value: 'cvm' } },
      ...(server ? [{ category: 'resource' as const, domain: 'cvm', operation, scope: { kind: 'exact' as const, value: `cvm:server:${server.pubkey}` } }] : []),
      ...relays.map((relay) => ({ category: 'network' as const, domain: 'cvm', operation, scope: { kind: 'exact' as const, value: relay } })),
    ];
  }
  async function authorize<T>(windowId: string, generation: symbol, operation: 'cvm.discover' | 'cvm.request', relays: readonly string[], server: CvmServerRef | undefined, execute: (signal?: ApprovalSignal) => Promise<T>): Promise<T> {
    if (!runtime?.authorizeOperation) return execute();
    const outcome = await runtime.authorizeOperation(windowId, operation, requirements(operation, relays, server), async (signal) => {
      if (!current(windowId, generation) || signal.aborted) throw new Error('policy denied');
      const value = await execute(signal);
      if (!current(windowId, generation) || signal.aborted) throw new Error('policy denied');
      return value;
    });
    if (outcome.status !== 'executed') throw new Error('policy denied');
    return outcome.value;
  }

  const eventSub = transport.onEvent((server, message) => {
    for (const [windowId, windowSessions] of sessions) {
      const session = windowSessions.get(server.pubkey);
      if (session && current(windowId, session.generation)) {
        currentSend(windowId, session.generation, { type: 'cvm.event', server, message } as NappletMessage);
      }
    }
  });

  function handleDiscover(windowId: string, generation: symbol, msg: NappletMessage): void {
    const m = msg as NappletMessage & { id?: string; query?: CvmDiscoverQuery };
    const id = m.id ?? '';
    if (!validQuery(m.query)) {
      currentSend(windowId, generation, { type: 'cvm.discover.result', id, servers: [], error: 'invalid request' } as NappletMessage);
      return;
    }
    let relays: readonly string[];
    try { relays = relayPlan(transport.planDiscover?.(m.query) ?? m.query?.relays ?? []); }
    catch (error) {
      currentSend(windowId, generation, { type: 'cvm.discover.result', id, servers: [], error: toErrorMessage(error) } as NappletMessage);
      return;
    }
    void authorize(windowId, generation, 'cvm.discover', relays, undefined, (signal) => signal
      ? transport.discover(m.query, { signal })
      : transport.discover(m.query))
      .then((servers) => currentSend(windowId, generation, { type: 'cvm.discover.result', id, servers } as NappletMessage))
      .catch((err) =>
        currentSend(windowId, generation, { type: 'cvm.discover.result', id, servers: [], error: toErrorMessage(err) } as NappletMessage),
      );
  }

  function handleRequest(windowId: string, generation: symbol, msg: NappletMessage): void {
    const m = msg as NappletMessage & {
      id?: string;
      server?: CvmServerRef;
      message?: McpMessage;
      options?: CvmRequestOptions;
    };
    const id = m.id ?? '';
    if (!validServer(m.server)) {
      currentSend(windowId, generation, { type: 'cvm.request.result', id, error: 'server not found' } as NappletMessage);
      return;
    }
    if (!validMessage(m.message)) {
      currentSend(windowId, generation, { type: 'cvm.request.result', id, error: 'unsupported method' } as NappletMessage);
      return;
    }
    let relays: readonly string[];
    try { relays = relayPlan(transport.planRequest?.(m.server) ?? m.server.relays ?? []); }
    catch (error) {
      currentSend(windowId, generation, { type: 'cvm.request.result', id, error: toErrorMessage(error) } as NappletMessage);
      return;
    }
    const server = Object.freeze({ ...m.server, relays: [...relays] });
    void authorize(windowId, generation, 'cvm.request', relays, server, (signal) => signal
      ? transport.request(server, m.message!, m.options, { signal })
      : transport.request(server, m.message!, m.options))
      .then((message) => {
        if (!current(windowId, generation)) return;
        remember(windowId, generation, server);
        currentSend(windowId, generation, { type: 'cvm.request.result', id, message } as NappletMessage);
      })
      .catch((err) =>
        currentSend(windowId, generation, { type: 'cvm.request.result', id, error: toErrorMessage(err) } as NappletMessage),
      );
  }

  function handleClose(windowId: string, generation: symbol, msg: NappletMessage): void {
    const m = msg as NappletMessage & { id?: string; server?: CvmServerRef };
    const id = m.id ?? '';
    if (!validServer(m.server) || !sessions.get(windowId)?.has(m.server.pubkey)) {
      currentSend(windowId, generation, { type: 'cvm.close.result', id, error: 'session closed' } as NappletMessage);
      return;
    }
    void release(windowId, m.server.pubkey)
      .then(() => currentSend(windowId, generation, { type: 'cvm.close.result', id } as NappletMessage))
      .catch((err) => currentSend(windowId, generation, { type: 'cvm.close.result', id, error: toErrorMessage(err) } as NappletMessage));
  }

  return {
    descriptor: CVM_DESCRIPTOR,
    onRegistered(context) { runtime = context; },
    onUnregistered() { runtime = undefined; generations.clear(); sends.clear(); sessions.clear(); },
    onPermissionRevoked(windowId) {
      const owned = [...(sessions.get(windowId)?.keys() ?? [])];
      generations.delete(windowId);
      sends.delete(windowId);
      void Promise.all(owned.map((pubkey) => release(windowId, pubkey))).catch(() => undefined);
    },
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const generation = generationFor(windowId);
      sends.set(windowId, send);
      switch (message.type) {
        case 'cvm.discover':
          handleDiscover(windowId, generation, message);
          return;
        case 'cvm.request':
          handleRequest(windowId, generation, message);
          return;
        case 'cvm.close':
          handleClose(windowId, generation, message);
          return;
        default:
          // Unknown cvm.* action — silently ignored (forward-compatible).
          return;
      }
    },
    onWindowDestroyed(windowId: string): void {
      const owned = [...(sessions.get(windowId)?.keys() ?? [])];
      generations.delete(windowId);
      sends.delete(windowId);
      void Promise.all(owned.map((pubkey) => release(windowId, pubkey))).catch(() => undefined);
    },
    dispose(): void {
      eventSub.close();
      transport.dispose?.();
      sends.clear();
      generations.clear();
      sessions.clear();
    },
  };
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'cvm request failed';
}

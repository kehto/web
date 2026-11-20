import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceRuntimeContext } from '@kehto/runtime';
import type { CvmDiscoverQuery, CvmRequestOptions, CvmServerRef, McpMessage } from './cvm-types.js';
import type { CvmService, CvmServiceOptions } from './cvm-service.js';
import { handleCvmRegistry, isCvmRegistryMethod } from './cvm-registry.js';
import { createCvmOperations, type CvmOperation, type CvmOperations } from './cvm-operations.js';
import { randomUUID } from './random-uuid.js';

const CVM_SERVICE_VERSION = '1.0.0';
/** NAP-CVM #31 @ 28cf1bdb, Timeouts: default and maximum accepted duration. */
const DEFAULT_DURATION_MS = 30_000;
const MAX_DURATION_MS = 300_000;

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

/** Accepted duration for an envelope, or `undefined` for `invalid timeout`. */
function acceptedDuration(options: unknown): number | undefined {
  const supplied = (options as { timeoutMs?: unknown } | undefined)?.timeoutMs;
  if (supplied === undefined) return DEFAULT_DURATION_MS;
  return typeof supplied === 'number' && Number.isInteger(supplied) && supplied >= 1 && supplied <= MAX_DURATION_MS
    ? supplied : undefined;
}

type Authorize = <T>(windowId: string, generation: symbol, operation: 'cvm.discover' | 'cvm.request',
  relays: readonly string[], server: CvmServerRef | undefined, work: CvmOperation, execute: () => Promise<T>) => Promise<T>;

interface CvmActions {
  readonly transport: CvmServiceOptions['transport'];
  readonly registry: NonNullable<CvmServiceOptions['registry']>;
  readonly operations: CvmOperations;
  readonly currentSend: (windowId: string, generation: symbol, message: NappletMessage) => void;
  readonly current: (windowId: string, generation: symbol) => boolean;
  readonly remember: (windowId: string, generation: symbol, server: CvmServerRef) => void;
  readonly release: (windowId: string, serverPubkey: string) => Promise<void>;
  readonly authorize: Authorize;
}

function handleDiscover(actions: CvmActions, windowId: string, generation: symbol, msg: NappletMessage): void {
  const { transport, currentSend, authorize, operations } = actions;
  const m = msg as NappletMessage & { id?: string; query?: CvmDiscoverQuery };
  const id = m.id ?? '';
  const fail = (error: unknown) => currentSend(windowId, generation, { type: 'cvm.discover.result', id, error: toErrorMessage(error) } as NappletMessage);
  if (!validQuery(m.query)) { fail('invalid request'); return; }
  let relays: readonly string[];
  try { relays = relayPlan(transport.planDiscover?.(m.query) ?? m.query?.relays ?? []); }
  catch (error) { fail(error); return; }
  operations.run(windowId, DEFAULT_DURATION_MS, [],
    (work) => authorize(windowId, generation, 'cvm.discover', relays, undefined, work,
      () => transport.discover(m.query, { signal: work.signal })),
    (servers) => currentSend(windowId, generation, { type: 'cvm.discover.result', id, servers } as NappletMessage), fail);
}

function handleRequest(actions: CvmActions, windowId: string, generation: symbol, msg: NappletMessage): void {
  const { transport, currentSend, authorize, remember, operations } = actions;
  const m = msg as NappletMessage & {
    id?: string;
    server?: CvmServerRef;
    message?: McpMessage;
    options?: CvmRequestOptions;
  };
  const id = m.id ?? '';
  const fail = (error: unknown) => currentSend(windowId, generation, { type: 'cvm.request.result', id, error: toErrorMessage(error) } as NappletMessage);
  if (!validServer(m.server)) { fail('server not found'); return; }
  if (!validMessage(m.message)) { fail('unsupported method'); return; }
  const duration = acceptedDuration(m.options);
  if (duration === undefined) { fail('invalid timeout'); return; }
  let relays: readonly string[];
  try { relays = relayPlan(transport.planRequest?.(m.server) ?? m.server.relays ?? []); }
  catch (error) { fail(error); return; }
  const server = Object.freeze({ ...m.server, relays: [...relays] });
  const message = m.message;
  const requestOptions = m.options && typeof m.options === 'object' ? m.options : {};
  operations.run(windowId, duration, [server.pubkey],
    (work) => authorize(windowId, generation, 'cvm.request', relays, server, work, () => {
      const timeoutMs = work.remaining();
      // NAP-CVM: an accepted outbound message establishes participation. Record
      // it before the transport acquires its session so a failed or timed-out
      // request cannot strand a transport session and relay hold.
      remember(windowId, generation, server);
      return transport.request(server, message, { ...requestOptions, timeoutMs }, { signal: work.signal });
    }),
    (response) => currentSend(windowId, generation, { type: 'cvm.request.result', id, message: response } as NappletMessage), fail);
}

function handleRegistry(actions: CvmActions, windowId: string, generation: symbol, message: NappletMessage): void {
  const { transport, registry, currentSend, authorize, current, remember, operations } = actions;
  const envelope: Record<string, unknown> = { ...message };
  const reply = (payload: Record<string, unknown>) => currentSend(windowId, generation, { type: `${message.type}.result`, id: envelope.id, ...payload } as NappletMessage);
  const duration = acceptedDuration(envelope.options);
  if (duration === undefined) { reply({ error: 'invalid timeout' }); return; }
  operations.run(windowId, duration, [], (work) => handleCvmRegistry(envelope, registry, async (server, method, params, requestOptions) => {
    if (work.signal.aborted || !current(windowId, generation)) throw new Error('session closed');
    work.servers.add(server.pubkey);
    const relays = relayPlan(transport.planRequest?.(server) ?? server.relays ?? []);
    const target = { ...server, relays: [...relays] };
    return authorize(windowId, generation, 'cvm.request', relays, server, work, () => {
      const timeoutMs = work.remaining();
      remember(windowId, generation, target);
      return transport.request(target, {
        jsonrpc: '2.0', id: randomUUID(), method, ...(params ? { params } : {}),
      }, { ...requestOptions, timeoutMs }, { signal: work.signal });
    });
  }), reply, (error) => reply({ error: toErrorMessage(error) }));
}

function handleClose(actions: CvmActions, windowId: string, generation: symbol, msg: NappletMessage): void {
  const { currentSend, release, operations } = actions;
  const m = msg as NappletMessage & { id?: string; server?: CvmServerRef };
  const id = m.id ?? '';
  if (!validServer(m.server)) {
    currentSend(windowId, generation, { type: 'cvm.close.result', id, error: 'session closed' } as NappletMessage);
    return;
  }
  const pubkey = m.server.pubkey;
  // NAP-CVM: pending operations complete with `session closed` before the
  // acknowledgement. Queued ones give their position back the same way.
  void operations.cancel(windowId, 'session closed', (work) => work.servers.has(pubkey))
    .then(() => release(windowId, pubkey))
    .then(() => currentSend(windowId, generation, { type: 'cvm.close.result', id } as NappletMessage))
    .catch((err) => currentSend(windowId, generation, { type: 'cvm.close.result', id, error: toErrorMessage(err) } as NappletMessage));
}


/**
 * Create the NAP-CVM service handler.
 *
 * @param options - Must provide a {@link CvmTransport}.
 * @returns A {@link CvmService} (a `ServiceHandler` with a `dispose()` hook).
 * @throws If `options.transport` is missing or a concurrency limit is out of range.
 */
export function createCvmServiceHandler(options: CvmServiceOptions): CvmService {
  if (!options || typeof options.transport !== 'object' || options.transport === null) {
    throw new Error('createCvmService: options.transport is required');
  }
  const { transport } = options;

  const sends = new Map<string, Send>();
  const generations = new Map<string, symbol>();
  const sessions = new Map<string, Map<string, CvmSession>>();
  const operations = createCvmOperations(options.concurrency);
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
      ...relays.map((relay) => ({ category: 'network' as const, domain: 'cvm', operation, scope: { kind: 'origin' as const, value: relay } })),
    ];
  }
  const authorize: Authorize = async (windowId, generation, operation, relays, server, work, execute) => {
    const live = () => current(windowId, generation) && !work.signal.aborted;
    if (!live()) throw new Error('session closed');
    if (!runtime?.authorizeOperation) return execute();
    const outcome = await runtime.authorizeOperation(windowId, operation, requirements(operation, relays, server), async (signal) => {
      // Approval cancellation ends this operation and returns its slot at once.
      const abort = () => work.abort('policy denied');
      signal.addEventListener('abort', abort, { once: true });
      try {
        if (!live() || signal.aborted) throw new Error('policy denied');
        const value = await execute();
        if (!live() || signal.aborted) throw new Error('policy denied');
        return value;
      } finally { signal.removeEventListener('abort', abort); }
    }, work.signal);
    if (outcome.status !== 'executed') throw new Error('policy denied');
    return outcome.value;
  };

  const eventSub = transport.onEvent((server, message) => {
    for (const [windowId, windowSessions] of sessions) {
      const session = windowSessions.get(server.pubkey);
      if (session && current(windowId, session.generation)) {
        currentSend(windowId, session.generation, { type: 'cvm.event', server, message } as NappletMessage);
      }
    }
  });

  const actions: CvmActions = { transport, registry: options.registry ?? [], operations, currentSend, current, remember, release, authorize };

  /** Retire an endpoint: no further replies, every slot and session returned. */
  function retire(windowId: string): void {
    const owned = [...(sessions.get(windowId)?.keys() ?? [])];
    generations.delete(windowId);
    sends.delete(windowId);
    void operations.cancel(windowId, 'session closed');
    void Promise.all(owned.map((pubkey) => release(windowId, pubkey))).catch(() => undefined);
  }
  function retireAll(): void {
    sends.clear();
    generations.clear();
    sessions.clear();
    void operations.cancel(undefined, 'session closed');
  }

  return {
    descriptor: CVM_DESCRIPTOR,
    onRegistered(context) { runtime = context; },
    onUnregistered() { runtime = undefined; retireAll(); },
    onPermissionRevoked(windowId) { retire(windowId); },
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const generation = generationFor(windowId);
      sends.set(windowId, send);
      if (isCvmRegistryMethod(message.type)) { handleRegistry(actions, windowId, generation, message); return; }
      switch (message.type) {
        case 'cvm.discover':
          handleDiscover(actions, windowId, generation, message);
          return;
        case 'cvm.request':
          handleRequest(actions, windowId, generation, message);
          return;
        case 'cvm.close':
          handleClose(actions, windowId, generation, message);
          return;
        default:
          // Unknown cvm.* action — silently ignored (forward-compatible).
          return;
      }
    },
    onWindowDestroyed(windowId: string): void { retire(windowId); },
    dispose(): void {
      retireAll();
      eventSub.close();
      transport.dispose?.();
    },
  };
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'cvm request failed';
}

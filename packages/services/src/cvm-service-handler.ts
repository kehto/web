import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceDescriptor, ServiceRuntimeContext } from '@kehto/runtime';
import type { CvmDiscoverQuery, CvmRequestOptions, CvmServerRef, McpMessage } from './cvm-types.js';
import type { CvmService, CvmServiceOptions } from './cvm-service.js';
import { handleCvmRegistry, isCvmRegistryMethod } from './cvm-registry.js';
import { randomUUID } from './random-uuid.js';

const CVM_SERVICE_VERSION = '1.0.0';

type Send = (msg: NappletMessage) => void;

interface CvmSession {
  readonly server: CvmServerRef;
  readonly generation: symbol;
}

interface RegistryOperation {
  controller: AbortController;
  servers: Set<string>;
  settled: Promise<void>;
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

interface CvmActions {
  readonly transport: CvmServiceOptions['transport'];
  readonly sessions: Map<string, Map<string, CvmSession>>;
  readonly currentSend: (windowId: string, generation: symbol, message: NappletMessage) => void;
  readonly current: (windowId: string, generation: symbol) => boolean;
  readonly remember: (windowId: string, generation: symbol, server: CvmServerRef) => void;
  readonly release: (windowId: string, serverPubkey: string) => Promise<void>;
  readonly authorize: <T>(windowId: string, generation: symbol, operation: 'cvm.discover' | 'cvm.request', relays: readonly string[], server: CvmServerRef | undefined, execute: (signal?: ApprovalSignal) => Promise<T>) => Promise<T>;
}

function handleDiscover(actions: CvmActions, windowId: string, generation: symbol, msg: NappletMessage): void {
  const { transport, currentSend, authorize } = actions;
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

function handleRequest(actions: CvmActions, windowId: string, generation: symbol, msg: NappletMessage): void {
  const { transport, currentSend, authorize, current, remember } = actions;
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

function handleClose(actions: CvmActions, windowId: string, generation: symbol, msg: NappletMessage): void {
  const { currentSend, release } = actions;
  const m = msg as NappletMessage & { id?: string; server?: CvmServerRef };
  const id = m.id ?? '';
  if (!validServer(m.server)) {
    currentSend(windowId, generation, { type: 'cvm.close.result', id, error: 'session closed' } as NappletMessage);
    return;
  }
  void release(windowId, m.server.pubkey)
    .then(() => currentSend(windowId, generation, { type: 'cvm.close.result', id } as NappletMessage))
    .catch((err) => currentSend(windowId, generation, { type: 'cvm.close.result', id, error: toErrorMessage(err) } as NappletMessage));
}


/**
 * Create the NAP-CVM service handler.
 *
 * @param options - Must provide a {@link CvmTransport}.
 * @returns A {@link CvmService} (a `ServiceHandler` with a `dispose()` hook).
 * @throws If `options.transport` is missing.
 */
export function createCvmServiceHandler(options: CvmServiceOptions): CvmService {
  if (!options || typeof options.transport !== 'object' || options.transport === null) {
    throw new Error('createCvmService: options.transport is required');
  }
  const { transport } = options;

  const sends = new Map<string, Send>();
  const generations = new Map<string, symbol>();
  const sessions = new Map<string, Map<string, CvmSession>>();
  const registryOperations = new Map<string, Set<RegistryOperation>>();
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
  async function authorize<T>(windowId: string, generation: symbol, operation: 'cvm.discover' | 'cvm.request', relays: readonly string[], server: CvmServerRef | undefined, execute: (signal?: ApprovalSignal) => Promise<T>, requestSignal?: ApprovalSignal): Promise<T> {
    if (requestSignal?.aborted) throw new Error('session closed');
    if (!runtime?.authorizeOperation) return execute();
    const outcome = await runtime.authorizeOperation(windowId, operation, requirements(operation, relays, server), async (signal) => {
      if (!current(windowId, generation) || signal.aborted) throw new Error('policy denied');
      const value = await execute(signal);
      if (!current(windowId, generation) || signal.aborted) throw new Error('policy denied');
      return value;
    }, requestSignal);
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

  const actions: CvmActions = { transport, sessions, currentSend, current, remember, release, authorize };

  function registry(windowId: string, generation: symbol, message: NappletMessage): void {
    const envelope: Record<string, unknown> = { ...message };
    const supplied = (envelope.options as { timeoutMs?: unknown } | undefined)?.timeoutMs;
    const duration = supplied === undefined ? 30_000 : Number(supplied);
    const validDuration = typeof (supplied ?? duration) === 'number' && Number.isInteger(duration) && duration >= 1 && duration <= 300_000;
    const id = envelope.id;
    const reply = (payload: Record<string, unknown>) => currentSend(windowId, generation, { type: `${message.type}.result`, id, ...payload } as NappletMessage);
    if (!validDuration) { reply({ error: 'invalid timeout' }); return; }
    const deadline = Date.now() + duration;
    const controller = new AbortController();
    let operations = registryOperations.get(windowId);
    if (!operations) { operations = new Set(); registryOperations.set(windowId, operations); }
    const pending: RegistryOperation = { controller, servers: new Set(), settled: Promise.resolve() };
    operations.add(pending);
    const timer = setTimeout(() => controller.abort(new Error('relay timeout')), duration);
    const expired = new Promise<never>((_resolve, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }));
    const work = handleCvmRegistry(envelope, options.registry ?? [], async (server, method, params, requestOptions) => {
      if (controller.signal.aborted || !current(windowId, generation)) throw new Error('session closed');
      pending.servers.add(server.pubkey);
      const relays = relayPlan(transport.planRequest?.(server) ?? server.relays ?? []);
      return authorize(windowId, generation, 'cvm.request', relays, server, async (signal) => {
        if (controller.signal.aborted || !current(windowId, generation)) throw new Error('session closed');
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        try {
          if (signal?.aborted) throw new Error('policy denied');
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw new Error('relay timeout');
          const value = await transport.request({ ...server, relays: [...relays] }, {
            jsonrpc: '2.0', id: randomUUID(), method, ...(params ? { params } : {}),
          }, { ...requestOptions, timeoutMs: remaining }, { signal: controller.signal });
          if (current(windowId, generation) && !controller.signal.aborted) remember(windowId, generation, server);
          return value;
        } finally { signal?.removeEventListener('abort', abort); }
      }, controller.signal);
    });
    pending.settled = Promise.race([work, expired]).then(reply, error => reply({ error: toErrorMessage(error) })).finally(() => {
      clearTimeout(timer);
      operations.delete(pending);
      if (!operations.size && registryOperations.get(windowId) === operations) registryOperations.delete(windowId);
    });
  }

  function cancelRegistry(windowId?: string): void {
    for (const [owner, operations] of registryOperations) {
      if (windowId !== undefined && owner !== windowId) continue;
      for (const pending of operations) pending.controller.abort(new Error('session closed'));
      registryOperations.delete(owner);
    }
  }

  return {
    descriptor: CVM_DESCRIPTOR,
    onRegistered(context) { runtime = context; },
    onUnregistered() { runtime = undefined; generations.clear(); sends.clear(); sessions.clear(); cancelRegistry(); },
    onPermissionRevoked(windowId) {
      const owned = [...(sessions.get(windowId)?.keys() ?? [])];
      generations.delete(windowId);
      sends.delete(windowId);
      cancelRegistry(windowId);
      void Promise.all(owned.map((pubkey) => release(windowId, pubkey))).catch(() => undefined);
    },
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const generation = generationFor(windowId);
      sends.set(windowId, send);
      if (isCvmRegistryMethod(message.type)) { registry(windowId, generation, message); return; }
      switch (message.type) {
        case 'cvm.discover':
          handleDiscover(actions, windowId, generation, message);
          return;
        case 'cvm.request':
          handleRequest(actions, windowId, generation, message);
          return;
        case 'cvm.close':
          {
            const server = (message as NappletMessage & { server?: CvmServerRef }).server;
            const closing = [...(registryOperations.get(windowId) ?? [])].filter(pending => validServer(server) && pending.servers.has(server.pubkey));
            for (const pending of closing) pending.controller.abort(new Error('session closed'));
            void Promise.all(closing.map(pending => pending.settled)).then(() => handleClose(actions, windowId, generation, message));
          }
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
      cancelRegistry(windowId);
      void Promise.all(owned.map((pubkey) => release(windowId, pubkey))).catch(() => undefined);
    },
    dispose(): void {
      cancelRegistry();
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

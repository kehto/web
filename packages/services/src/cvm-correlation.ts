/**
 * cvm-correlation.ts — NAP-CVM per-session MCP id bookkeeping.
 *
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb, Message handling): "Correlations MUST
 * include the authenticated napplet endpoint, server, session, and direction.
 * Identical IDs from different napplets MUST NOT collide. An ID already used
 * for a client request in the same MCP session returns `"invalid message"`; a
 * response must match an outstanding server request delivered to that
 * napplet. An unmatched response returns `"invalid message"`.
 * `notifications/cancelled` may refer only to this napplet's requests."
 *
 * Sessions and events: "Server requests still require a response or expire
 * under session policy." A delivered server request is outstanding until it
 * is answered or its deadline passes, using the Timeouts bounds (default
 * 30000 ms, at most 300000 ms). Expired entries are pruned whenever the
 * session's books are touched, so a napplet that never answers cannot grow
 * them without bound.
 *
 * State is keyed by endpoint (window + generation) and server pubkey, with
 * one book per direction, plus the client requests still in flight (for
 * cancellation). Shell-owned registry and initialization requests never enter
 * it ("Shell-owned initialization, payment messages, and internal retries
 * MUST use isolated correlation state"). `@kehto/mocks` keeps the same books;
 * `tests/unit/cvm-request-lifecycle-parity.test.ts` holds them together.
 */

/** Client and server ids of one endpoint's session with one server. */
interface SessionIds {
  readonly generation: symbol;
  /** Ids the napplet already used for its own requests (`typeof:value`). */
  readonly clientIds: Set<string>;
  /** Client requests not settled yet, with the handle the transport knows them by. */
  readonly inFlight: Map<string, CvmRequestHandle>;
  /** Server-initiated request ids delivered to the napplet and not yet answered, with their deadlines. */
  readonly serverRequests: Map<string, number>;
}

/**
 * Opaque token for one napplet request, passed to the transport so a later
 * `notifications/cancelled` can name the request the transport actually sent.
 */
export type CvmRequestHandle = object;

/** What a napplet's `notifications/cancelled` refers to. */
export type CvmCancelTarget =
  /** A request still in flight, by the handle the transport knows it by. */
  | { readonly state: 'in-flight'; readonly handle: CvmRequestHandle }
  /** This napplet's request, already settled: nothing left to cancel. */
  | { readonly state: 'settled' }
  /** Not a request of this napplet in this session. */
  | { readonly state: 'foreign' };

/** Per-endpoint, per-server MCP id books. */
export interface CvmCorrelations {
  /** Record a client request id; `false` when this session already used it. */
  claimRequest(windowId: string, generation: symbol, pubkey: string, id: string | number): boolean;
  /** Mark a claimed request in flight and return its handle. */
  startRequest(windowId: string, generation: symbol, pubkey: string, id: string | number): CvmRequestHandle;
  /** The request settled (any outcome). */
  finishRequest(windowId: string, generation: symbol, pubkey: string, id: string | number, handle: CvmRequestHandle): void;
  /** Resolve the request a cancellation's `requestId` names. */
  cancelTarget(windowId: string, generation: symbol, pubkey: string, requestId: unknown): CvmCancelTarget;
  /** Consume an outstanding server request id; `false` when the response matches none or it expired. */
  takeResponse(windowId: string, generation: symbol, pubkey: string, id: string | number): boolean;
  /** Record a server request delivered to this endpoint. */
  noteServerRequest(windowId: string, generation: symbol, pubkey: string, id: string | number): void;
  /** Forget one server session's ids, or every session of the endpoint. */
  release(windowId: string, pubkey?: string): void;
  /** Forget everything. */
  clear(): void;
}

/** Options for {@link createCvmCorrelations}. */
export interface CvmCorrelationOptions {
  /** Monotonic clock in milliseconds. Default `performance.now()`. */
  readonly now?: () => number;
  /** How long a delivered server request stays answerable. Default 30000. */
  readonly serverRequestTimeoutMs?: number;
}

/** JSON-RPC ids are typed: `1` and `"1"` are different ids. */
export function mcpIdKey(id: string | number): string {
  return `${typeof id}:${String(id)}`;
}

/**
 * Create empty correlation books.
 *
 * @param options - Clock and server-request lifetime.
 * @returns A {@link CvmCorrelations}.
 * @example
 * ```ts
 * const books = createCvmCorrelations();
 * books.claimRequest('win-1', generation, pubkey, 7); // true
 * books.claimRequest('win-1', generation, pubkey, 7); // false: duplicate
 * ```
 */
export function createCvmCorrelations(options: CvmCorrelationOptions = {}): CvmCorrelations {
  const now = options.now ?? (() => performance.now());
  const serverRequestTimeoutMs = options.serverRequestTimeoutMs ?? 30_000;
  const windows = new Map<string, Map<string, SessionIds>>();

  function session(windowId: string, generation: symbol, pubkey: string): SessionIds {
    let servers = windows.get(windowId);
    if (!servers) { servers = new Map(); windows.set(windowId, servers); }
    let ids = servers.get(pubkey);
    if (!ids || ids.generation !== generation) {
      ids = { generation, clientIds: new Set(), inFlight: new Map(), serverRequests: new Map() };
      servers.set(pubkey, ids);
    }
    const time = now();
    for (const [key, deadline] of ids.serverRequests) if (deadline <= time) ids.serverRequests.delete(key);
    return ids;
  }

  return {
    claimRequest(windowId, generation, pubkey, id) {
      const { clientIds } = session(windowId, generation, pubkey);
      const key = mcpIdKey(id);
      if (clientIds.has(key)) return false;
      clientIds.add(key);
      return true;
    },
    startRequest(windowId, generation, pubkey, id) {
      const handle: CvmRequestHandle = Object.freeze({});
      session(windowId, generation, pubkey).inFlight.set(mcpIdKey(id), handle);
      return handle;
    },
    finishRequest(windowId, generation, pubkey, id, handle) {
      const ids = windows.get(windowId)?.get(pubkey);
      const key = mcpIdKey(id);
      if (ids?.generation === generation && ids.inFlight.get(key) === handle) ids.inFlight.delete(key);
    },
    cancelTarget(windowId, generation, pubkey, requestId) {
      if (typeof requestId !== 'string' && typeof requestId !== 'number') return { state: 'foreign' };
      const ids = session(windowId, generation, pubkey);
      const key = mcpIdKey(requestId);
      const handle = ids.inFlight.get(key);
      if (handle) return { state: 'in-flight', handle };
      return ids.clientIds.has(key) ? { state: 'settled' } : { state: 'foreign' };
    },
    takeResponse(windowId, generation, pubkey, id) {
      return session(windowId, generation, pubkey).serverRequests.delete(mcpIdKey(id));
    },
    noteServerRequest(windowId, generation, pubkey, id) {
      session(windowId, generation, pubkey).serverRequests.set(mcpIdKey(id), now() + serverRequestTimeoutMs);
    },
    release(windowId, pubkey) {
      if (pubkey === undefined) { windows.delete(windowId); return; }
      const servers = windows.get(windowId);
      servers?.delete(pubkey);
      if (servers?.size === 0) windows.delete(windowId);
    },
    clear() { windows.clear(); },
  };
}

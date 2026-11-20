/**
 * cvm-correlation.ts — NAP-CVM per-session MCP id bookkeeping.
 *
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb, Message handling): "Correlations MUST
 * include the authenticated napplet endpoint, server, session, and direction.
 * Identical IDs from different napplets MUST NOT collide. An ID already used
 * for a client request in the same MCP session returns `"invalid message"`; a
 * response must match an outstanding server request delivered to that
 * napplet. An unmatched response returns `"invalid message"`."
 *
 * State is keyed by endpoint (window + generation) and server pubkey, with
 * one set per direction. Shell-owned registry and initialization requests
 * never enter it ("Shell-owned initialization, payment messages, and internal
 * retries MUST use isolated correlation state"). `@kehto/mocks` keeps the same
 * books; `tests/unit/cvm-message-form-parity.test.ts` holds them together.
 */

/** Client and server ids of one endpoint's session with one server. */
interface SessionIds {
  readonly generation: symbol;
  /** Ids the napplet already used for its own requests (`typeof:value`). */
  readonly clientIds: Set<string>;
  /** Server-initiated request ids delivered to the napplet and not yet answered. */
  readonly serverRequests: Set<string>;
}

/** Per-endpoint, per-server MCP id books. */
export interface CvmCorrelations {
  /** Record a client request id; `false` when this session already used it. */
  claimRequest(windowId: string, generation: symbol, pubkey: string, id: string | number): boolean;
  /** Consume an outstanding server request id; `false` when the response matches none. */
  takeResponse(windowId: string, generation: symbol, pubkey: string, id: string | number): boolean;
  /** Record a server request delivered to this endpoint. */
  noteServerRequest(windowId: string, generation: symbol, pubkey: string, id: string | number): void;
  /** Forget one server session's ids, or every session of the endpoint. */
  release(windowId: string, pubkey?: string): void;
  /** Forget everything. */
  clear(): void;
}

/** JSON-RPC ids are typed: `1` and `"1"` are different ids. */
export function mcpIdKey(id: string | number): string {
  return `${typeof id}:${String(id)}`;
}

/**
 * Create empty correlation books.
 *
 * @returns A {@link CvmCorrelations}.
 * @example
 * ```ts
 * const books = createCvmCorrelations();
 * books.claimRequest('win-1', generation, pubkey, 7); // true
 * books.claimRequest('win-1', generation, pubkey, 7); // false: duplicate
 * ```
 */
export function createCvmCorrelations(): CvmCorrelations {
  const windows = new Map<string, Map<string, SessionIds>>();

  function session(windowId: string, generation: symbol, pubkey: string): SessionIds {
    let servers = windows.get(windowId);
    if (!servers) { servers = new Map(); windows.set(windowId, servers); }
    let ids = servers.get(pubkey);
    if (!ids || ids.generation !== generation) {
      ids = { generation, clientIds: new Set(), serverRequests: new Set() };
      servers.set(pubkey, ids);
    }
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
    takeResponse(windowId, generation, pubkey, id) {
      return session(windowId, generation, pubkey).serverRequests.delete(mcpIdKey(id));
    },
    noteServerRequest(windowId, generation, pubkey, id) {
      session(windowId, generation, pubkey).serverRequests.add(mcpIdKey(id));
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

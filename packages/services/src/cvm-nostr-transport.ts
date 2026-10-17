/**
 * cvm-nostr-transport.ts — concrete ContextVM transport for NAP-CVM.
 *
 * Implements {@link CvmTransport} over Nostr, exactly as validated against live
 * ContextVM servers (e.g. Relatr):
 *
 *  - MCP JSON-RPC messages ride in kind-25910 event `content`.
 *  - Requests are CEP-4 gift-wrapped: the inner kind-25910 event is signed with
 *    the shell's ephemeral client key, NIP-44-encrypted to the server, and
 *    placed in a kind-21059 (ephemeral) / 1059 (regular) wrap signed by a fresh
 *    random key, `p`-tagged to the server. Responses arrive the same way,
 *    `p`-tagged to the client, and are correlated by the inner JSON-RPC `id`.
 *  - Discovery reads kind-11316 (server) + kind-11317 (tools) announcements.
 *  - CEP-22 oversized transfers and CEP-41 open streams ride
 *    `notifications/progress` frames addressed by the request progressToken.
 *
 * Shipped on a separate entry (`@kehto/services/cvm-nostr-transport`) so the
 * `nostr-tools` dependency stays out of the core `@kehto/services` bundle.
 *
 * The client key is ephemeral and shell-owned: napplets never see keys, relay
 * sockets, or NIP-44 material (NAP-CVM §Security).
 *
 * @example
 * ```ts
 * import { createNostrCvmTransport } from '@kehto/services/cvm-nostr-transport';
 * const transport = createNostrCvmTransport({
 *   defaultRelays: ['wss://relay.contextvm.org', 'wss://relay2.contextvm.org'],
 * });
 * ```
 *
 * @module
 */

import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
import type { Event as NostrToolsEvent, Filter as NostrToolsFilter } from 'nostr-tools';

import {
  createCvmProgressController,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_STREAM_PROBE_TIMEOUT_MS,
  progressTokenKey,
} from './cvm-progress-controller.js';
import type { CvmProgressEntry } from './cvm-progress-controller.js';
import type { CvmTransport } from './cvm-service.js';
import type { ApprovalSignal } from '@kehto/runtime';
import type {
  CvmDiscoverQuery,
  CvmRequestOptions,
  CvmServer,
  CvmServerRef,
  McpMessage,
} from './cvm-types.js';

/** ContextVM unified transport event kind. */
const KIND_CVM = 25910;
/** CEP-4 gift-wrap kinds: ephemeral (CEP-19) and regular. */
const KIND_GIFT_WRAP_EPHEMERAL = 21059;
const KIND_GIFT_WRAP_REGULAR = 1059;
/** CEP-6 announcement kinds. */
const KIND_ANNOUNCE_SERVER = 11316;
const KIND_ANNOUNCE_TOOLS = 11317;

/** ContextVM capability discovery tags (single-element tags per CEP). */
const SUPPORT_ENCRYPTION = 'support_encryption';
const SUPPORT_ENCRYPTION_EPHEMERAL = 'support_encryption_ephemeral';
const SUPPORT_OVERSIZED_TRANSFER = 'support_oversized_transfer';
const SUPPORT_OPEN_STREAM = 'support_open_stream';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DISCOVER_TIMEOUT_MS = 6_000;
const MCP_PROTOCOL_VERSION = '2025-11-25';
const SEEN_WRAP_LIMIT = 512;

/** Minimal signed Nostr event. */
export interface NostrEventLike {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** A Nostr REQ filter (subset). */
export interface NostrFilterLike {
  kinds?: number[];
  authors?: string[];
  limit?: number;
  ['#p']?: string[];
  [key: string]: unknown;
}

/** Subscription handle returned by the relay pool. */
export interface CvmSubCloser {
  close(): void;
}

/**
 * Minimal relay-pool surface used by this transport — structurally satisfied
 * by `nostr-tools` `SimplePool`. Injectable for testing.
 */
export interface CvmRelayPool {
  subscribe(
    relays: string[],
    filter: NostrFilterLike,
    params: { onevent?: (event: NostrEventLike) => void; oneose?: () => void; signal?: ApprovalSignal },
  ): CvmSubCloser;
  publish(relays: string[], event: NostrEventLike, options?: { signal?: ApprovalSignal }): void | Promise<unknown>;
}

/** Options for {@link createNostrCvmTransport}. */
export interface NostrCvmTransportOptions {
  /** Relays used when a server reference carries no relay hints. */
  defaultRelays?: string[];
  /** Default per-request timeout in milliseconds. */
  timeoutMs?: number;
  /** Whether to CEP-4 gift-wrap requests. Default true (most servers require it). */
  encrypt?: boolean;
  /** Use ephemeral (kind 21059) gift wraps when encrypting. Default true. */
  ephemeralWrap?: boolean;
  /** Relay pool to use. Defaults to a fresh `nostr-tools` `SimplePool`. */
  pool?: CvmRelayPool;
  /** Client secret key (32 bytes). Defaults to a generated ephemeral key. */
  clientSecretKey?: Uint8Array;
  /** Client info advertised during MCP `initialize`. */
  clientInfo?: { name: string; version: string };
  /** CEP-41: per-stream idle timeout before a keepalive ping is sent. */
  streamIdleTimeoutMs?: number;
  /** CEP-41: probe deadline waiting for a pong after a keepalive ping. */
  streamProbeTimeoutMs?: number;
}

type EventHandler = (server: CvmServerRef, message: McpMessage) => void;

interface PendingRequest extends CvmProgressEntry {
  resolve(message: McpMessage): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
  timeoutMs: number;
  /** The caller's original JSON-RPC id, restored on the response. */
  originalId: string | number | undefined;
  /** Server identity that must sign the correlated inner response. */
  serverPubkey: string;
  /** Wire correlation id this entry is keyed by. */
  correlationId: string;
}

interface ServerSession {
  relays: string[];
  initialized: boolean;
  initializing: Promise<void> | null;
}

let correlationCounter = 0;
function nextCorrelationId(): string {
  correlationCounter += 1;
  return `cvm-${correlationCounter}-${getPublicKey(generateSecretKey()).slice(0, 8)}`;
}

let streamNonceCounter = 0;
/** Unique ping nonce within a stream, well under the 64-byte maximum. */
function nextStreamNonce(): string {
  streamNonceCounter += 1;
  return `cvm-ping-${streamNonceCounter}-${getPublicKey(generateSecretKey()).slice(0, 8)}`;
}

function randomizedPastTimestamp(): number {
  // NIP-59: randomize within the past two days to reduce timing metadata.
  const jitter = Math.floor(Math.random() * 172_800);
  return Math.floor(Date.now() / 1000) - jitter;
}

function tagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

function canonicalRelay(value: string): string {
  const url = new URL(value);
  if ((url.protocol !== 'wss:' && url.protocol !== 'ws:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid relay');
  return url.origin;
}

/** Adapt a `nostr-tools` SimplePool to the {@link CvmRelayPool} surface. */
function simplePoolAdapter(sp: SimplePool): CvmRelayPool {
  return {
    subscribe(relays, filter, params) {
      const sub = sp.subscribe(relays, filter as NostrToolsFilter, {
        onevent: params.onevent,
        oneose: params.oneose,
      });
      params.signal?.addEventListener('abort', () => sub.close(), { once: true });
      return sub;
    },
    async publish(relays, event, execution) {
      if (execution?.signal?.aborted) throw new Error('policy denied');
      const attempts = sp.publish(relays, event as NostrToolsEvent);
      if (attempts.length === 0) throw new Error('server not found');
      await Promise.any(attempts);
    },
  };
}

/**
 * Create a Nostr-backed ContextVM transport.
 *
 * @param options - Relay set, timeouts, encryption mode, and optional injected
 *   pool/keys (the injected pool + key make the transport deterministic in tests).
 * @returns A {@link CvmTransport} plus a `dispose()` to tear down subscriptions.
 */
export function createNostrCvmTransport(
  options: NostrCvmTransportOptions = {},
): CvmTransport & { dispose(): void } {
  const defaultRelays = options.defaultRelays ?? [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const encrypt = options.encrypt ?? true;
  const wrapKind = options.ephemeralWrap === false ? KIND_GIFT_WRAP_REGULAR : KIND_GIFT_WRAP_EPHEMERAL;
  const pool: CvmRelayPool = options.pool ?? simplePoolAdapter(new SimplePool());
  const clientSecretKey = options.clientSecretKey ?? generateSecretKey();
  const clientPubkey = getPublicKey(clientSecretKey);
  const clientInfo = options.clientInfo ?? { name: 'kehto-cvm', version: '1.0.0' };
  const streamIdleTimeoutMs = options.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
  const streamProbeTimeoutMs = options.streamProbeTimeoutMs ?? DEFAULT_STREAM_PROBE_TIMEOUT_MS;

  const sessions = new Map<string, ServerSession>();
  const pending = new Map<string, PendingRequest>();
  const eventHandlers = new Set<EventHandler>();
  const relayRefcount = new Map<string, number>();
  const seenWraps = new Set<string>();
  /**
   * Issued progress tokens, `<serverPubkey>:<typed token>` → correlation id.
   * CEP-22/CEP-41 frames are admitted only for tokens this client issued to
   * the signing server, binding reassembly state to the expected server.
   */
  const issuedTokens = new Map<string, string>();
  const progressController = createCvmProgressController<PendingRequest>({
    pending,
    issuedTokens,
    streamIdleTimeoutMs,
    streamProbeTimeoutMs,
    nextNonce: nextStreamNonce,
    canPublish: (entry) => sessions.has(entry.serverPubkey),
    async publishControlFrame(entry, stream, frame) {
      const session = sessions.get(entry.serverPubkey);
      if (!session) return;
      stream.localProgress += 1;
      await publishMcp(
        { pubkey: entry.serverPubkey },
        session.relays,
        {
          jsonrpc: '2.0',
          method: 'notifications/progress',
          params: {
            progressToken: stream.token,
            progress: stream.localProgress,
            cvm: { type: 'open-stream', ...frame },
          },
        },
      );
    },
    routeMessage,
    routeEvent,
    refreshPendingTimeout,
  });
  let inbound: CvmSubCloser | null = null;
  let subscribedRelays = '';

  function resolveRelays(server: CvmServerRef): string[] {
    const relays = server.relays && server.relays.length > 0 ? server.relays : defaultRelays;
    if (relays.length === 0) throw new Error('server not found');
    return [...new Set(relays.map(canonicalRelay))];
  }

  function holdRelays(relays: string[]): void {
    for (const url of relays) relayRefcount.set(url, (relayRefcount.get(url) ?? 0) + 1);
    refreshSubscription();
  }

  function releaseRelays(relays: string[]): void {
    for (const url of relays) {
      const count = (relayRefcount.get(url) ?? 0) - 1;
      if (count <= 0) relayRefcount.delete(url);
      else relayRefcount.set(url, count);
    }
    refreshSubscription();
  }

  function refreshSubscription(): void {
    const relays = [...relayRefcount.keys()].sort();
    const key = relays.join(',');
    if (key === subscribedRelays) return;
    inbound?.close();
    subscribedRelays = key;
    inbound = relays.length === 0
      ? null
      : pool.subscribe(
          relays,
          { kinds: encrypt ? [KIND_GIFT_WRAP_REGULAR, KIND_GIFT_WRAP_EPHEMERAL] : [KIND_CVM], ['#p']: [clientPubkey] },
          { onevent: handleInbound },
        );
  }

  function rememberWrap(id: string): boolean {
    if (seenWraps.has(id)) return false;
    seenWraps.add(id);
    if (seenWraps.size > SEEN_WRAP_LIMIT) {
      const oldest = seenWraps.values().next().value;
      if (oldest !== undefined) seenWraps.delete(oldest);
    }
    return true;
  }

  function handleInbound(event: NostrEventLike): void {
    if (!verifyEvent(event as NostrToolsEvent)) return;
    if (!event.tags.some((tag) => tag[0] === 'p' && tag[1] === clientPubkey)) return;
    if (!rememberWrap(event.id)) return;
    let serverPubkey: string;
    let mcp: McpMessage;
    try {
      if (encrypt) {
        const conversationKey = nip44.getConversationKey(clientSecretKey, event.pubkey);
        const inner = JSON.parse(nip44.decrypt(event.content, conversationKey)) as NostrEventLike;
        if (!verifyEvent(inner as NostrToolsEvent)) return;
        if (!inner.tags.some((tag) => tag[0] === 'p' && tag[1] === clientPubkey)) return;
        serverPubkey = inner.pubkey;
        mcp = JSON.parse(inner.content) as McpMessage;
      } else {
        serverPubkey = event.pubkey;
        mcp = JSON.parse(event.content) as McpMessage;
      }
    } catch {
      return; // not addressed to us / undecryptable / malformed — ignore.
    }

    if (progressController.handle(serverPubkey, mcp)) return;

    // Correlated responses settle their pending request; uncorrelated server
    // messages fan out as CVM events.
    routeMessage(serverPubkey, mcp);
  }

  /** Settle a pending request and release its frame state. */
  function settlePending(correlationId: string): PendingRequest | null {
    const entry = pending.get(correlationId);
    if (!entry) return null;
    clearTimeout(entry.timer);
    pending.delete(correlationId);
    progressController.release(entry);
    return entry;
  }

  /** Extend a request's deadline while its admitted frames keep arriving. */
  function refreshPendingTimeout(entry: PendingRequest): void {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      const settled = settlePending(entry.correlationId);
      settled?.reject(new Error('relay timeout'));
    }, entry.timeoutMs);
  }

  /** Route a decrypted MCP message to a pending request or event handlers. */
  function routeMessage(serverPubkey: string, mcp: McpMessage): void {
    const id = mcp.id;
    if (id != null && pending.has(String(id))) {
      const entry = pending.get(String(id))!;
      if (entry.serverPubkey !== serverPubkey) return;
      const settled = settlePending(String(id));
      settled?.resolve({ ...mcp, id: entry.originalId });
      return;
    }
    routeEvent(serverPubkey, mcp);
  }

  /** Fan a server-initiated message out to CVM event handlers. */
  function routeEvent(serverPubkey: string, mcp: McpMessage): void {
    if (mcp.method !== undefined && sessions.has(serverPubkey)) {
      const server: CvmServerRef = { pubkey: serverPubkey };
      for (const handler of eventHandlers) handler(server, mcp);
    }
  }

  async function publishMcp(server: CvmServerRef, relays: string[], message: McpMessage, signal?: ApprovalSignal): Promise<void> {
    if (signal?.aborted) throw new Error('policy denied');
    // Capability discovery lives on the INNER signed kind-25910 event. Without
    // these single-element tags, muxll correctly assumes a legacy client and
    // sends large results as one giant NIP-44 payload (which exceeds the NIP-44
    // standard limit) instead of CEP-22 frames, and withholds CEP-41 streaming.
    const capabilityTags: string[][] = [
      ...(encrypt ? [[SUPPORT_ENCRYPTION]] : []),
      ...(encrypt && wrapKind === KIND_GIFT_WRAP_EPHEMERAL ? [[SUPPORT_ENCRYPTION_EPHEMERAL]] : []),
      [SUPPORT_OVERSIZED_TRANSFER],
      [SUPPORT_OPEN_STREAM],
    ];
    const inner = finalizeEvent(
      {
        kind: KIND_CVM,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', server.pubkey], ...capabilityTags],
        content: JSON.stringify(message),
      },
      clientSecretKey,
    ) as NostrEventLike;
    if (!encrypt) {
      await pool.publish(relays, inner, { signal });
      return;
    }
    const wrapSecretKey = generateSecretKey();
    const conversationKey = nip44.getConversationKey(wrapSecretKey, server.pubkey);
    // Ephemeral wraps (kind 21059) are not stored; relays reject backdated
    // ephemeral events as "expired", so they MUST carry a current timestamp.
    // Regular wraps (kind 1059) are backdated per NIP-59 to blur timing metadata.
    const createdAt =
      wrapKind === KIND_GIFT_WRAP_EPHEMERAL ? Math.floor(Date.now() / 1000) : randomizedPastTimestamp();
    const wrap = finalizeEvent(
      {
        kind: wrapKind,
        created_at: createdAt,
        tags: [['p', server.pubkey]],
        content: nip44.encrypt(JSON.stringify(inner), conversationKey),
      },
      wrapSecretKey,
    ) as NostrEventLike;
    await pool.publish(relays, wrap, { signal });
  }

  function sendCorrelated(
    server: CvmServerRef,
    relays: string[],
    message: McpMessage,
    timeout: number,
    signal?: ApprovalSignal,
  ): Promise<McpMessage> {
    if (signal?.aborted) return Promise.reject(new Error('policy denied'));
    const correlationId = nextCorrelationId();
    const originalId = message.id;
    let outgoing: McpMessage = { ...message, id: correlationId };
    let issuedToken: string | number | undefined;

    // CEP-22 and CEP-41 address progress frames by params._meta.progressToken.
    // Official ContextVM clients add one automatically to every tools/call;
    // Paja's hand-rolled transport must do the same. Preserve an explicit token
    // supplied by a streaming caller; otherwise use the unique correlation id.
    const params = message.params && typeof message.params === 'object'
      ? message.params as Record<string, unknown>
      : undefined;
    const meta = params?._meta && typeof params._meta === 'object'
      ? params._meta as Record<string, unknown>
      : undefined;
    const explicit = meta?.progressToken;
    if (message.method === 'tools/call') {
      issuedToken = typeof explicit === 'string' || typeof explicit === 'number'
        ? explicit
        : correlationId;
      outgoing = {
        ...outgoing,
        params: {
          ...params,
          _meta: {
            ...meta,
            progressToken: issuedToken,
          },
        },
      };
    } else if (typeof explicit === 'string' || typeof explicit === 'number') {
      // An explicit token on any other method is bound for frame admission
      // exactly as sent; automatic injection stays tools/call-only.
      issuedToken = explicit;
    }

    // The token binds inbound frames to this request and its expected server.
    // Reject a duplicate explicit token to the same server while the previous
    // request is still in flight: CEP-41 requires distinct tokens per stream,
    // and a shared one would make frame admission ambiguous.
    const tokenKey = progressTokenKey(issuedToken);
    const issuedKey = tokenKey ? `${server.pubkey}:${tokenKey}` : null;
    if (issuedKey && issuedTokens.has(issuedKey)) {
      return Promise.reject(new Error('duplicate progress token'));
    }

    return new Promise<McpMessage>((resolve, reject) => {
      const entry: PendingRequest = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const settled = settlePending(correlationId);
          settled?.reject(new Error('relay timeout'));
        }, timeout),
        timeoutMs: timeout,
        originalId,
        serverPubkey: server.pubkey,
        correlationId,
      };
      if (issuedKey) {
        entry.tokenKey = issuedKey;
        issuedTokens.set(issuedKey, correlationId);
      }
      pending.set(correlationId, entry);
      signal?.addEventListener('abort', () => {
        const settled = settlePending(correlationId);
        settled?.reject(new Error('policy denied'));
      }, { once: true });
      void publishMcp(server, relays, outgoing, signal).catch((err: unknown) => {
        const settled = settlePending(correlationId);
        settled?.reject(err instanceof Error ? err : new Error('publish failed'));
      });
    });
  }

  function getSession(server: CvmServerRef): ServerSession {
    let session = sessions.get(server.pubkey);
    if (!session) {
      const relays = resolveRelays(server);
      session = { relays, initialized: false, initializing: null };
      sessions.set(server.pubkey, session);
      holdRelays(relays);
    }
    return session;
  }

  async function ensureInitialized(server: CvmServerRef, session: ServerSession, timeout: number, signal?: ApprovalSignal): Promise<void> {
    if (session.initialized) return;
    if (session.initializing) return session.initializing;
    session.initializing = (async () => {
      try {
        await sendCorrelated(
          server,
          session.relays,
          {
            jsonrpc: '2.0',
            id: 'init',
            method: 'initialize',
            params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo },
          },
          timeout,
          signal,
        );
        // notifications/initialized completes the handshake; no response expected.
        await publishMcp(server, session.relays, { jsonrpc: '2.0', method: 'notifications/initialized' }, signal);
        session.initialized = true;
      } catch {
        throw new Error('initialization failed');
      } finally {
        session.initializing = null;
      }
    })();
    return session.initializing;
  }

  return {
    planDiscover(query?: CvmDiscoverQuery): readonly string[] {
      const relays = query?.relays && query.relays.length > 0 ? query.relays : defaultRelays;
      return Object.freeze([...new Set(relays.map(canonicalRelay))]);
    },

    planRequest(server: CvmServerRef): readonly string[] {
      return Object.freeze(resolveRelays(server));
    },

    async discover(query?: CvmDiscoverQuery, execution?: { signal: ApprovalSignal }): Promise<CvmServer[]> {
      const configured = query?.relays && query.relays.length > 0 ? query.relays : defaultRelays;
      const relays = [...new Set(configured.map(canonicalRelay))];
      if (relays.length === 0) return [];
      if (execution?.signal.aborted) throw new Error('policy denied');
      const announces = new Map<string, NostrEventLike>();
      const toolLists = new Map<string, NostrEventLike>();
      await new Promise<void>((resolve, reject) => {
        const sub = pool.subscribe(
          relays,
          { kinds: [KIND_ANNOUNCE_SERVER, KIND_ANNOUNCE_TOOLS], limit: query?.limit ? query.limit * 4 : 100 },
          {
            onevent(event) {
              if (event.kind === KIND_ANNOUNCE_SERVER) announces.set(event.pubkey, event);
              else if (event.kind === KIND_ANNOUNCE_TOOLS) toolLists.set(event.pubkey, event);
            },
            oneose() { resolve(); },
            signal: execution?.signal,
          },
        );
        setTimeout(() => { sub.close(); resolve(); }, DEFAULT_DISCOVER_TIMEOUT_MS);
        execution?.signal.addEventListener('abort', () => { sub.close(); reject(new Error('policy denied')); }, { once: true });
      });

      const servers: CvmServer[] = [];
      for (const [pubkey, event] of announces) {
        const name = tagValue(event.tags, 'name');
        const description = tagValue(event.tags, 'about');
        const server: CvmServer = {
          pubkey,
          relays: [...relays],
          ...(name ? { name } : {}),
          ...(description ? { description } : {}),
          paymentRequired: false,
        };
        const tools = toolLists.get(pubkey);
        if (tools) {
          const names = tools.tags.filter((tag) => tag[0] === 'i' && typeof tag[2] === 'string').map((tag) => tag[2]);
          if (names.length > 0) server.capabilities = names;
        }
        servers.push(server);
      }

      const search = query?.search?.toLowerCase();
      const filtered = search
        ? servers.filter((s) => `${s.name ?? ''} ${s.description ?? ''}`.toLowerCase().includes(search))
        : servers;
      return query?.limit ? filtered.slice(0, query.limit) : filtered;
    },

    async request(server: CvmServerRef, message: McpMessage, requestOptions?: CvmRequestOptions, execution?: { signal: ApprovalSignal }): Promise<McpMessage> {
      if (execution?.signal.aborted) throw new Error('policy denied');
      const session = getSession(server);
      const timeout = requestOptions?.timeoutMs ?? timeoutMs;
      if (requestOptions?.initialize) await ensureInitialized(server, session, timeout, execution?.signal);
      return sendCorrelated(server, session.relays, message, timeout, execution?.signal);
    },

    async close(server: CvmServerRef): Promise<void> {
      const session = sessions.get(server.pubkey);
      if (!session) return;
      sessions.delete(server.pubkey);
      releaseRelays(session.relays);
      // Settle this server's in-flight requests and release their frame
      // state: a closed server's tokens must stop admitting frames on a
      // shared relay (NAP-CVM: close releases pending correlation records).
      for (const [correlationId, entry] of pending) {
        if (entry.serverPubkey !== server.pubkey) continue;
        settlePending(correlationId)?.reject(new Error('server closed'));
      }
    },

    onEvent(handler: EventHandler): { close(): void } {
      eventHandlers.add(handler);
      return {
        close() {
          eventHandlers.delete(handler);
        },
      };
    },

    dispose(): void {
      inbound?.close();
      inbound = null;
      for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        progressController.release(entry);
        entry.reject(new Error('transport disposed'));
      }
      pending.clear();
      issuedTokens.clear();
      sessions.clear();
      relayRefcount.clear();
      eventHandlers.clear();
      subscribedRelays = '';
    },
  };
}

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

import type { CvmTransport } from './cvm-service.js';
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
/** CEP-22 oversized-transfer: digest is `sha256:<hex>` prefixed. */
const DIGEST_PREFIX = 'sha256:';
/** Safety caps for CEP-22 reassembly. */
const MAX_TRANSFER_CHUNKS = 10_000;
const MAX_TRANSFER_BYTES = 100 * 1024 * 1024;

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
    params: { onevent?: (event: NostrEventLike) => void; oneose?: () => void },
  ): CvmSubCloser;
  publish(relays: string[], event: NostrEventLike): void | Promise<unknown>;
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
}

type EventHandler = (server: CvmServerRef, message: McpMessage) => void;

interface PendingRequest {
  resolve(message: McpMessage): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
  timeoutMs: number;
  /** The caller's original JSON-RPC id, restored on the response. */
  originalId: string | number | undefined;
  /** Server identity that must sign the correlated inner response. */
  serverPubkey: string;
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

function randomizedPastTimestamp(): number {
  // NIP-59: randomize within the past two days to reduce timing metadata.
  const jitter = Math.floor(Math.random() * 172_800);
  return Math.floor(Date.now() / 1000) - jitter;
}

function tagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

/* ------------------------- CEP-22 / CEP-41 framing ------------------------ */

/**
 * A CEP-22 oversized-transfer / CEP-41 open-stream frame. Both ride
 * `notifications/progress` with `params.progressToken` set to the originating
 * request's token and `params.cvm` describing the frame. Demux on `cvm.type`.
 */
interface CvmProgressFrame {
  type?: string;
  frameType?: string;
  /** CEP-22: reassembly metadata. */
  digest?: string;
  totalBytes?: number;
  totalChunks?: number;
  /** CEP-22 chunk / CEP-41 chunk payload (JSON-serialized). */
  data?: string;
  /** CEP-41: streaming metadata. */
  chunkIndex?: number;
  lastChunkIndex?: number;
  nonce?: string;
  reason?: string;
}

interface CvmProgressParams {
  progressToken?: string | number;
  progress?: number;
  cvm?: CvmProgressFrame;
}

/** In-flight CEP-22 oversized transfer being reassembled. */
interface OversizedTransfer {
  digest?: string;
  totalBytes?: number;
  totalChunks?: number;
  startProgress: number;
  acceptProgress: number | null;
  /** Chunk slices keyed by the canonical outer `params.progress` value. */
  chunks: Map<number, string>;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Adapt a `nostr-tools` SimplePool to the {@link CvmRelayPool} surface. */
function simplePoolAdapter(sp: SimplePool): CvmRelayPool {
  return {
    subscribe(relays, filter, params) {
      return sp.subscribe(relays, filter as NostrToolsFilter, {
        onevent: params.onevent,
        oneose: params.oneose,
      });
    },
    async publish(relays, event) {
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

  const sessions = new Map<string, ServerSession>();
  const pending = new Map<string, PendingRequest>();
  const eventHandlers = new Set<EventHandler>();
  const relayRefcount = new Map<string, number>();
  const seenWraps = new Set<string>();
  /** CEP-22 oversized transfers in reassembly, keyed by progressToken. */
  const oversizedTransfers = new Map<string, OversizedTransfer>();
  /** Locally emitted CEP-41 control-frame progress per stream token. */
  const openStreamControlProgress = new Map<string, number>();
  let inbound: CvmSubCloser | null = null;
  let subscribedRelays = '';

  function resolveRelays(server: CvmServerRef): string[] {
    const relays = server.relays && server.relays.length > 0 ? server.relays : defaultRelays;
    if (relays.length === 0) throw new Error('server not found');
    return [...new Set(relays)];
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

    const id = mcp.id;
    if (id != null && pending.has(String(id))) {
      const entry = pending.get(String(id))!;
      if (entry.serverPubkey !== serverPubkey) return;
      pending.delete(String(id));
      clearTimeout(entry.timer);
      entry.resolve({ ...mcp, id: entry.originalId });
      return;
    }

    // CEP-22 oversized-transfer / CEP-41 open-stream frames ride
    // notifications/progress. Demux on cvm.type; neither resolves a pending
    // request directly (CEP-22 reassembles into a fresh JSON-RPC message that
    // re-enters {@link routeMessage}; CEP-41 streams + a separate normal
    // response resolves the request).
    if (mcp.method === 'notifications/progress') {
      const params = (mcp.params ?? {}) as CvmProgressParams;
      const cvm = params.cvm;
      if (cvm && typeof cvm.type === 'string') {
        if (cvm.type === 'oversized-transfer') {
          void handleOversizedFrame(serverPubkey, params, cvm);
          return;
        }
        if (cvm.type === 'open-stream') {
          routeEvent(serverPubkey, mcp);
          const token = String(params.progressToken ?? '');
          if (cvm.frameType === 'ping' && token && typeof cvm.nonce === 'string') {
            void sendOpenStreamPong(serverPubkey, token, cvm.nonce);
          }
          if ((cvm.frameType === 'close' || cvm.frameType === 'abort') && token) {
            openStreamControlProgress.delete(token);
          }
          return;
        }
      }
    }

    // Uncorrelated server message (notification) → fan out as a CVM event.
    routeEvent(serverPubkey, mcp);
  }

  /** Reply to a CEP-41 keepalive ping on the same progressToken. */
  async function sendOpenStreamPong(serverPubkey: string, progressToken: string, nonce: string): Promise<void> {
    const session = sessions.get(serverPubkey);
    if (!session) return;
    const progress = (openStreamControlProgress.get(progressToken) ?? 0) + 1;
    openStreamControlProgress.set(progressToken, progress);
    await publishMcp(
      { pubkey: serverPubkey },
      session.relays,
      {
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: {
          progressToken,
          progress,
          cvm: { type: 'open-stream', frameType: 'pong', nonce },
        },
      },
    );
  }

  /**
   * Reassemble a CEP-22 oversized-transfer. Frames share the request's
   * progressToken; chunk.data slices are joined in progress order, verified
   * against the start frame's sha256 digest, then parsed as the real JSON-RPC
   * message and re-entered into {@link routeMessage} (which resolves the
   * correlated pending request).
   */
  async function handleOversizedFrame(
    serverPubkey: string,
    params: CvmProgressParams,
    cvm: CvmProgressFrame,
  ): Promise<void> {
    const token = String(params.progressToken ?? '');
    if (!token) return;
    refreshPendingTimeout(token);
    const progress = Number(params.progress ?? 0);

    if (cvm.frameType === 'start') {
      if ((cvm.totalChunks ?? 0) > MAX_TRANSFER_CHUNKS || (cvm.totalBytes ?? 0) > MAX_TRANSFER_BYTES) return;
      oversizedTransfers.set(token, {
        digest: cvm.digest,
        totalBytes: cvm.totalBytes,
        totalChunks: cvm.totalChunks,
        startProgress: progress,
        acceptProgress: null,
        chunks: new Map(),
      });
      return;
    }

    const transfer = oversizedTransfers.get(token);
    if (!transfer) return;

    if (cvm.frameType === 'accept') {
      transfer.acceptProgress = progress;
      return;
    }

    if (cvm.frameType === 'chunk') {
      if (progress <= transfer.startProgress || typeof cvm.data !== 'string') return;
      transfer.chunks.set(progress, cvm.data);
      return;
    }

    if (cvm.frameType === 'abort') {
      oversizedTransfers.delete(token);
      return;
    }

    if (cvm.frameType === 'end') {
      oversizedTransfers.delete(token);
      const totalChunks = transfer.totalChunks ?? transfer.chunks.size;
      const directStart = transfer.startProgress + 1;
      const acceptGatedStart = transfer.startProgress + 2;
      const hasCompleteRange = (first: number) => {
        for (let p = first; p < first + totalChunks; p++) {
          if (!transfer.chunks.has(p)) return false;
        }
        return true;
      };
      const firstProgress = hasCompleteRange(directStart)
        ? directStart
        : hasCompleteRange(acceptGatedStart)
          ? acceptGatedStart
          : null;
      if (firstProgress === null) return;
      const parts: string[] = [];
      for (let progressValue = firstProgress; progressValue < firstProgress + totalChunks; progressValue++) {
        parts.push(transfer.chunks.get(progressValue)!);
      }
      const payload = parts.join('');
      const payloadBytes = new TextEncoder().encode(payload).byteLength;
      if (transfer.totalBytes !== undefined && payloadBytes !== transfer.totalBytes) return;
      if (transfer.digest) {
        const expected = transfer.digest.startsWith(DIGEST_PREFIX)
          ? transfer.digest.slice(DIGEST_PREFIX.length)
          : transfer.digest;
        if ((await sha256Hex(payload)) !== expected) return;
      }
      let message: McpMessage;
      try {
        message = JSON.parse(payload) as McpMessage;
      } catch {
        return;
      }
      routeMessage(serverPubkey, message);
    }
  }

  /** Extend a correlated request while its CEP-22 progress frames arrive. */
  function refreshPendingTimeout(correlationId: string): void {
    const entry = pending.get(correlationId);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      pending.delete(correlationId);
      oversizedTransfers.delete(correlationId);
      entry.reject(new Error('relay timeout'));
    }, entry.timeoutMs);
  }

  /** Route a decrypted MCP message to a pending request or event handlers. */
  function routeMessage(serverPubkey: string, mcp: McpMessage): void {
    const id = mcp.id;
    if (id != null && pending.has(String(id))) {
      const entry = pending.get(String(id))!;
      if (entry.serverPubkey !== serverPubkey) return;
      pending.delete(String(id));
      clearTimeout(entry.timer);
      entry.resolve({ ...mcp, id: entry.originalId });
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

  async function publishMcp(server: CvmServerRef, relays: string[], message: McpMessage): Promise<void> {
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
      await pool.publish(relays, inner);
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
    await pool.publish(relays, wrap);
  }

  function sendCorrelated(
    server: CvmServerRef,
    relays: string[],
    message: McpMessage,
    timeout: number,
  ): Promise<McpMessage> {
    const correlationId = nextCorrelationId();
    const originalId = message.id;
    let outgoing: McpMessage = { ...message, id: correlationId };

    // CEP-22 and CEP-41 address progress frames by params._meta.progressToken.
    // Official ContextVM clients add one automatically to every tools/call;
    // Paja's hand-rolled transport must do the same. Preserve an explicit token
    // supplied by a streaming caller; otherwise use the unique correlation id.
    if (message.method === 'tools/call') {
      const params = message.params && typeof message.params === 'object'
        ? message.params as Record<string, unknown>
        : {};
      const meta = params._meta && typeof params._meta === 'object'
        ? params._meta as Record<string, unknown>
        : {};
      outgoing = {
        ...outgoing,
        params: {
          ...params,
          _meta: {
            ...meta,
            progressToken: meta.progressToken ?? correlationId,
          },
        },
      };
    }

    return new Promise<McpMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(correlationId);
        oversizedTransfers.delete(correlationId);
        reject(new Error('relay timeout'));
      }, timeout);
      pending.set(correlationId, {
        resolve,
        reject,
        timer,
        timeoutMs: timeout,
        originalId,
        serverPubkey: server.pubkey,
      });
      void publishMcp(server, relays, outgoing).catch((err: unknown) => {
        pending.delete(correlationId);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error('publish failed'));
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

  async function ensureInitialized(server: CvmServerRef, session: ServerSession, timeout: number): Promise<void> {
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
        );
        // notifications/initialized completes the handshake; no response expected.
        await publishMcp(server, session.relays, { jsonrpc: '2.0', method: 'notifications/initialized' });
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
    async discover(query?: CvmDiscoverQuery): Promise<CvmServer[]> {
      const relays = query?.relays && query.relays.length > 0 ? query.relays : defaultRelays;
      if (relays.length === 0) return [];
      const announces = new Map<string, NostrEventLike>();
      const toolLists = new Map<string, NostrEventLike>();
      await new Promise<void>((resolve) => {
        const sub = pool.subscribe(
          relays,
          { kinds: [KIND_ANNOUNCE_SERVER, KIND_ANNOUNCE_TOOLS], limit: query?.limit ? query.limit * 4 : 100 },
          {
            onevent(event) {
              if (event.kind === KIND_ANNOUNCE_SERVER) announces.set(event.pubkey, event);
              else if (event.kind === KIND_ANNOUNCE_TOOLS) toolLists.set(event.pubkey, event);
            },
            oneose() { resolve(); },
          },
        );
        setTimeout(() => { sub.close(); resolve(); }, DEFAULT_DISCOVER_TIMEOUT_MS);
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

    async request(server: CvmServerRef, message: McpMessage, requestOptions?: CvmRequestOptions): Promise<McpMessage> {
      const session = getSession(server);
      const timeout = requestOptions?.timeoutMs ?? timeoutMs;
      if (requestOptions?.initialize) await ensureInitialized(server, session, timeout);
      return sendCorrelated(server, session.relays, message, timeout);
    },

    async close(server: CvmServerRef): Promise<void> {
      const session = sessions.get(server.pubkey);
      if (!session) return;
      sessions.delete(server.pubkey);
      releaseRelays(session.relays);
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
        entry.reject(new Error('transport disposed'));
      }
      pending.clear();
      oversizedTransfers.clear();
      openStreamControlProgress.clear();
      sessions.clear();
      relayRefcount.clear();
      eventHandlers.clear();
      subscribedRelays = '';
    },
  };
}

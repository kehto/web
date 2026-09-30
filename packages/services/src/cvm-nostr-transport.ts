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
/** Concurrent CEP-22 reassemblies admitted across all servers. */
const MAX_ACTIVE_TRANSFERS = 8;
/** Hard ceiling on how long one reassembly may hold buffered chunks. */
const MAX_TRANSFER_LIFETIME_MS = 120_000;
/** The only CEP-22 completion mode; receivers must reject all others. */
const COMPLETION_MODE_RENDER = 'render';
/** CEP-41: default idle interval before a keepalive ping is sent. */
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 30_000;
/** CEP-41: default probe deadline waiting for a pong after our ping. */
const DEFAULT_STREAM_PROBE_TIMEOUT_MS = 10_000;
/** CEP-41: bounded out-of-order chunk gap buffer (local resource policy). */
const MAX_STREAM_BUFFERED_CHUNKS = 256;
const MAX_STREAM_BUFFERED_CODE_UNITS = 8 * 1024 * 1024;
/** CEP-41: local maximum ping nonce size receivers SHOULD enforce. */
const MAX_PING_NONCE_BYTES = 64;

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
  /** CEP-41: per-stream idle timeout before a keepalive ping is sent. */
  streamIdleTimeoutMs?: number;
  /** CEP-41: probe deadline waiting for a pong after a keepalive ping. */
  streamProbeTimeoutMs?: number;
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
  /** Wire correlation id this entry is keyed by. */
  correlationId: string;
  /** `<serverPubkey>:<typed token>` key of the issued progress token, if any. */
  tokenKey?: string;
  /** CEP-22 reassembly bound to this request; never shared across requests. */
  oversized?: OversizedTransfer;
  /** CEP-41 open-stream state; undefined once the stream terminates. */
  stream?: OpenStreamState;
  /**
   * Terminal marker: open-stream frames are ignored, but request admission
   * (the token binding and any CEP-22 reassembly) survives until the request
   * settles, so the final JSON-RPC response remains admissible.
   */
  streamEnded?: boolean;
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

/**
 * Type-preserving key for a `string | number` MCP progress token, so numeric
 * and string tokens never collide in internal state.
 */
function progressTokenKey(token: string | number | undefined): string | null {
  if (typeof token === 'string') return token.length > 0 ? `s:${token}` : null;
  if (typeof token === 'number' && Number.isFinite(token)) return `n:${token}`;
  return null;
}

/** True when value is a finite integer within [min, max]. */
function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
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
  /** CEP-22: required completion mode ("render"). */
  completionMode?: string;
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
  /** sha256 of the exact serialized payload; required, always verified. */
  digest: string;
  /** Declared exact byte length; required, always verified. */
  totalBytes: number;
  /** Declared chunk count; required, never inferred from arrivals. */
  totalChunks: number;
  startProgress: number;
  acceptProgress: number | null;
  /** Chunk slices keyed by the canonical outer `params.progress` value. */
  chunks: Map<number, string>;
  /**
   * Buffered UTF-16 code units across stored chunks — an independent memory
   * cap, not a byte check: a surrogate pair split across a chunk boundary
   * encodes each half as U+FFFD (3 bytes) in isolation, so per-chunk UTF-8
   * accounting rejects payloads whose joined length and digest are correct.
   * The exact UTF-8 byte length is verified on the joined payload at end.
   */
  codeUnitsReceived: number;
  /** Hard expiry; progress frames never extend it. */
  expiryTimer: ReturnType<typeof setTimeout>;
}

/** In-flight CEP-41 open stream bound to a pending request. */
interface OpenStreamState {
  /** Typed stream token (the request's progressToken) for frames we send. */
  token: string | number;
  /** Last admitted frame progress; every frame must increase it (CEP-41). */
  lastProgress: number;
  /** Our own outgoing frame progress (ping/pong/abort), monotonic per stream. */
  localProgress: number;
  /** Next contiguous chunkIndex expected; chunks fan out strictly in order. */
  nextChunkIndex: number;
  /** Bounded relay-reordered chunk gap buffer keyed by chunkIndex (CEP-41 MAY). */
  outOfOrder: Map<number, { message: McpMessage; progress: number; codeUnits: number }>;
  /** UTF-16 code units held in the gap buffer (local memory policy). */
  outOfOrderCodeUnits: number;
  /** Nonce of our outstanding keepalive ping; a pong must match it. */
  pendingNonce: string | null;
  /** Idle watchdog: fires a keepalive ping when no valid frame arrives. */
  idleTimer: ReturnType<typeof setTimeout>;
  /** Probe deadline for the outstanding ping's pong. */
  probeTimer: ReturnType<typeof setTimeout> | null;
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

    // CEP-22 oversized-transfer / CEP-41 open-stream frames ride
    // notifications/progress. Demux on cvm.type; neither resolves a pending
    // request directly (CEP-22 reassembles into a fresh JSON-RPC message that
    // re-enters {@link routeMessage}; CEP-41 streams + a separate normal
    // response resolves the request). Frames are admitted only for progress
    // tokens this client issued to the signing server — anything else is
    // dropped before it can touch state, timers, or event handlers.
    if (mcp.method === 'notifications/progress') {
      const params = (mcp.params ?? {}) as CvmProgressParams;
      const cvm = params.cvm;
      if (cvm && typeof cvm.type === 'string') {
        if (cvm.type === 'oversized-transfer') {
          void handleOversizedFrame(serverPubkey, params, cvm);
          return;
        }
        if (cvm.type === 'open-stream') {
          const entry = admitFrame(serverPubkey, params.progressToken);
          if (!entry) return;
          handleOpenStreamFrame(serverPubkey, entry, params, cvm, mcp);
          return;
        }
      }
    }

    // Correlated responses settle their pending request; uncorrelated server
    // messages fan out as CVM events.
    routeMessage(serverPubkey, mcp);
  }

  /**
   * Publish one local CEP-41 control frame (ping/pong/abort) on a stream.
   * The wire progressToken preserves the peer's `string | number` type: a
   * peer matching on its original token discards a stringified frame.
   */
  async function publishStreamFrame(
    entry: PendingRequest,
    stream: OpenStreamState,
    frame: { frameType: 'ping' | 'pong' | 'abort'; nonce?: string; reason?: string },
  ): Promise<void> {
    const session = sessions.get(entry.serverPubkey);
    if (!session) return;
    // CEP-41 progress is monotonic per direction: this counter numbers only
    // our outbound control frames. The peer's frames are tracked by the
    // inbound watermark (stream.lastProgress), which local frames must never
    // touch — the reference SDK matches pongs by nonce, not sequence position.
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
  }

  /**
   * Admit a CEP-22/CEP-41 progress frame: the token must be one this client
   * issued to the signing server, and the request it belongs to must still
   * be in flight. Frames from any other signer are dropped before they can
   * touch state or timers (NAP-CVM: responses must be validated against the
   * expected server pubkey — a relay delivering a frame is not proof of
   * origin).
   */
  function admitFrame(serverPubkey: string, token: string | number | undefined): PendingRequest | null {
    const tokenKey = progressTokenKey(token);
    if (!tokenKey) return null;
    const correlationId = issuedTokens.get(`${serverPubkey}:${tokenKey}`);
    if (!correlationId) return null;
    const entry = pending.get(correlationId);
    if (!entry || entry.serverPubkey !== serverPubkey) return null;
    return entry;
  }

  /** Drop a request's CEP-22 reassembly buffers; the token binding survives. */
  function releaseTransfer(entry: PendingRequest): void {
    if (!entry.oversized) return;
    clearTimeout(entry.oversized.expiryTimer);
    entry.oversized = undefined;
  }

  /** Clear a stream's timers and gap buffer without touching admission. */
  function releaseStream(entry: PendingRequest): void {
    if (!entry.stream) return;
    clearTimeout(entry.stream.idleTimer);
    if (entry.stream.probeTimer) clearTimeout(entry.stream.probeTimer);
    entry.stream = undefined;
  }

  /**
   * Terminate a stream while preserving request admission: the token binding
   * and any CEP-22 reassembly survive until the request settles, so the
   * final JSON-RPC response (possibly oversized) remains admissible. CEP-41
   * close ends the stream, not the originating JSON-RPC request.
   */
  function endStream(entry: PendingRequest): void {
    releaseStream(entry);
    entry.streamEnded = true;
  }

  /**
   * Fail a stream (CEP-41): terminate it without treating it as successfully
   * completed, and send a best-effort abort with an advisory reason. The
   * originating request is NOT settled — its own deadline is the backstop.
   */
  function failStream(entry: PendingRequest, reason: string): void {
    const stream = entry.stream;
    if (!stream || entry.streamEnded) return;
    endStream(entry);
    void publishStreamFrame(entry, stream, { frameType: 'abort', reason }).catch(() => {
      // Best-effort: an abort we cannot publish changes nothing locally.
    });
  }

  /** Restart a stream's idle watchdog after valid frame activity. */
  function resetStreamIdleTimer(entry: PendingRequest, stream: OpenStreamState): void {
    clearTimeout(stream.idleTimer);
    stream.idleTimer = setTimeout(() => onStreamIdle(entry), streamIdleTimeoutMs);
  }

  /**
   * Idle watchdog: no valid frame arrived within the idle timeout, so probe
   * the peer with a keepalive ping (CEP-41 MUST). If no matching pong
   * arrives before the probe deadline, the stream fails.
   */
  function onStreamIdle(entry: PendingRequest): void {
    const stream = entry.stream;
    if (!stream || entry.streamEnded) return;
    if (stream.pendingNonce !== null) return; // a probe is already outstanding
    const session = sessions.get(entry.serverPubkey);
    if (!session) {
      failStream(entry, 'session closed');
      return;
    }
    stream.pendingNonce = nextStreamNonce();
    stream.probeTimer = setTimeout(() => failStream(entry, 'probe timeout'), streamProbeTimeoutMs);
    void publishStreamFrame(entry, stream, { frameType: 'ping', nonce: stream.pendingNonce })
      .catch(() => failStream(entry, 'ping publication failed'));
  }

  /** Drop all frame state a request owns: buffers, stream, and token binding. */
  function releaseFrameState(entry: PendingRequest): void {
    releaseTransfer(entry);
    releaseStream(entry);
    if (entry.tokenKey && issuedTokens.get(entry.tokenKey) === entry.correlationId) {
      issuedTokens.delete(entry.tokenKey);
    }
    entry.tokenKey = undefined;
  }

  /** Settle a pending request and release every timer and binding it owns. */
  function settlePending(correlationId: string): PendingRequest | null {
    const entry = pending.get(correlationId);
    if (!entry) return null;
    clearTimeout(entry.timer);
    pending.delete(correlationId);
    releaseFrameState(entry);
    return entry;
  }

  /** Number of in-flight CEP-22 reassemblies across all servers. */
  function countActiveTransfers(): number {
    let active = 0;
    for (const entry of pending.values()) {
      if (entry.oversized) active += 1;
    }
    return active;
  }

  /**
   * Reassemble a CEP-22 oversized-transfer. Frames are admitted only for the
   * server the token was issued to; chunk.data slices are joined in progress
   * order, verified against the start frame's sha256 digest, then parsed as
   * the real JSON-RPC message and re-entered into {@link routeMessage}
   * (which resolves the correlated pending request).
   */
  async function handleOversizedFrame(
    serverPubkey: string,
    params: CvmProgressParams,
    cvm: CvmProgressFrame,
  ): Promise<void> {
    const entry = admitFrame(serverPubkey, params.progressToken);
    if (!entry) return;
    const progress = Number(params.progress ?? NaN);
    // Every frame's progress must be a safe integer: past 2**53 the double
    // `p + 1 === p`, so range arithmetic on such values can never terminate.
    if (!Number.isSafeInteger(progress) || progress < 0) return;

    if (cvm.frameType === 'start') {
      // CEP-22 requires the full start shape before anything is buffered:
      // the render completion mode, the sha256 digest, and both totals within
      // local caps. Unsupported or incomplete starts fail without state.
      const digest = typeof cvm.digest === 'string' ? cvm.digest : '';
      const { totalBytes, totalChunks } = cvm;
      if (cvm.completionMode !== COMPLETION_MODE_RENDER) return;
      if (digest === '') return;
      if (!isBoundedInteger(totalChunks, 1, MAX_TRANSFER_CHUNKS)) return;
      if (!isBoundedInteger(totalBytes, 1, MAX_TRANSFER_BYTES)) return;
      // The whole transfer range (chunks + end) must stay within safe
      // integers, or reassembly arithmetic on it can never terminate.
      if (progress > Number.MAX_SAFE_INTEGER - totalChunks - 1) return;
      if (!entry.oversized && countActiveTransfers() >= MAX_ACTIVE_TRANSFERS) return;
      // A repeated start fails the previous transfer for the same token.
      releaseTransfer(entry);
      entry.oversized = {
        digest,
        totalBytes,
        totalChunks,
        startProgress: progress,
        acceptProgress: null,
        chunks: new Map(),
        codeUnitsReceived: 0,
        // Hard expiry: progress frames extend the request deadline but never
        // how long buffers may be held.
        expiryTimer: setTimeout(() => releaseTransfer(entry), MAX_TRANSFER_LIFETIME_MS),
      };
      refreshPendingTimeout(entry);
      return;
    }

    const transfer = entry.oversized;
    if (!transfer) return;

    if (cvm.frameType === 'accept') {
      // The optional accept immediately follows start in the canonical
      // transfer sequence. Any other value makes later ordering ambiguous.
      if (progress !== transfer.startProgress + 1) {
        releaseTransfer(entry);
        return;
      }
      transfer.acceptProgress = progress;
      refreshPendingTimeout(entry);
      return;
    }

    if (cvm.frameType === 'chunk') {
      if (typeof cvm.data !== 'string' || progress <= transfer.startProgress) return;
      // Duplicate progress values are malformed (CEP-22 progress strictly
      // increases); drop instead of double-counting buffered content.
      if (transfer.chunks.has(progress)) return;
      // The declared chunk count is exact (CEP-22); a sender exceeding it
      // fails the whole transfer.
      if (transfer.chunks.size >= transfer.totalChunks) {
        releaseTransfer(entry);
        return;
      }
      // Independent memory cap in UTF-16 code units. The declared totalBytes
      // is deliberately NOT compared during streaming: a surrogate pair split
      // across a chunk boundary makes per-chunk UTF-8 accounting unsound.
      // Exact byte length and digest are verified on the joined payload.
      transfer.codeUnitsReceived += cvm.data.length;
      if (transfer.codeUnitsReceived > MAX_TRANSFER_BYTES) {
        releaseTransfer(entry);
        return;
      }
      transfer.chunks.set(progress, cvm.data);
      refreshPendingTimeout(entry);
      return;
    }

    if (cvm.frameType === 'abort') {
      releaseTransfer(entry);
      return;
    }

    if (cvm.frameType === 'end') {
      const message = await assembleTransfer(transfer, progress);
      releaseTransfer(entry);
      if (message) routeMessage(serverPubkey, message);
      return;
    }
  }

  /** Validate a completed transfer and assemble its payload; null fails it. */
  async function assembleTransfer(transfer: OversizedTransfer, endProgress: number): Promise<McpMessage | null> {
    const { startProgress, acceptProgress, totalChunks } = transfer;
    // Iterate with a bounded chunk counter, never `progress++`: start
    // validation keeps `first + totalChunks` within safe integers, and the
    // counter terminates even if state were somehow corrupted.
    const hasCompleteRange = (first: number): boolean => {
      for (let i = 0; i < totalChunks; i++) {
        if (!transfer.chunks.has(first + i)) return false;
      }
      return true;
    };
    // Chunks follow start, one progress later when the sender waited for
    // our accept before transmitting.
    const directStart = startProgress + 1;
    const acceptGatedStart = startProgress + 2;
    const firstProgress = hasCompleteRange(directStart)
      && endProgress === directStart + totalChunks
      ? directStart
      : acceptProgress === startProgress + 1
        && hasCompleteRange(acceptGatedStart)
        && endProgress === acceptGatedStart + totalChunks
        ? acceptGatedStart
        : null;
    if (firstProgress === null) return null;
    let payload = '';
    for (let i = 0; i < totalChunks; i++) {
      payload += transfer.chunks.get(firstProgress + i)!;
    }
    // Both checks are mandatory (CEP-22): exact byte length and digest match
    // before the payload is materialized into a JSON-RPC message.
    if (new TextEncoder().encode(payload).byteLength !== transfer.totalBytes) return null;
    const expected = transfer.digest.startsWith(DIGEST_PREFIX)
      ? transfer.digest.slice(DIGEST_PREFIX.length)
      : transfer.digest;
    if ((await sha256Hex(payload)) !== expected) return null;
    try {
      return JSON.parse(payload) as McpMessage;
    } catch {
      return null;
    }
  }

  /**
   * Run the CEP-41 receiver state machine for one admitted open-stream
   * frame. A stream MUST begin with `start`; every frame MUST carry a
   * monotonically increasing safe-integer `progress`; chunks fan out in
   * contiguous `chunkIndex` order with a bounded out-of-order gap buffer;
   * `close`/`abort` are terminal. `start`/`accept`/`chunk`/`close`/`abort`
   * fan out through onEvent; `ping`/`pong` are transport keepalive and stay
   * internal. Terminal frames end the stream but never the originating
   * JSON-RPC request: the token binding survives until the request settles,
   * so an oversized (CEP-22) final response remains admissible.
   */
  function handleOpenStreamFrame(
    serverPubkey: string,
    entry: PendingRequest,
    params: CvmProgressParams,
    cvm: CvmProgressFrame,
    mcp: McpMessage,
  ): void {
    const progress = Number(params.progress ?? NaN);
    if (!Number.isSafeInteger(progress) || progress < 0) return;
    // Terminal streams ignore every later frame (CEP-41 post-close).
    if (entry.streamEnded) return;
    const stream = entry.stream;
    if (!stream) {
      // A stream MUST begin with start; anything else is dropped.
      if (cvm.frameType !== 'start') return;
      entry.stream = {
        token: params.progressToken as string | number,
        lastProgress: progress,
        localProgress: 0,
        nextChunkIndex: 0,
        outOfOrder: new Map(),
        outOfOrderCodeUnits: 0,
        pendingNonce: null,
        idleTimer: setTimeout(() => onStreamIdle(entry), streamIdleTimeoutMs),
        probeTimer: null,
      };
      refreshPendingTimeout(entry);
      routeEvent(serverPubkey, mcp);
      return;
    }
    /** Admit one fully validated frame into the shared progress sequence. */
    const admitOrderedActivity = (): boolean => {
      if (progress <= stream.lastProgress) {
        failStream(entry, 'non-monotonic progress');
        return false;
      }
      stream.lastProgress = progress;
      resetStreamIdleTimer(entry, stream);
      refreshPendingTimeout(entry);
      return true;
    };

    switch (cvm.frameType) {
      case 'start':
        // A second start on an already active stream MUST fail it (CEP-41).
        failStream(entry, 'duplicate start');
        return;
      case 'accept':
        if (!admitOrderedActivity()) return;
        routeEvent(serverPubkey, mcp);
        return;
      case 'chunk': {
        if (typeof cvm.data !== 'string' || !isBoundedInteger(cvm.chunkIndex, 0, Number.MAX_SAFE_INTEGER)) {
          failStream(entry, 'malformed chunk');
          return;
        }
        const index = cvm.chunkIndex;
        if (index < stream.nextChunkIndex) return; // duplicate: already delivered
        if (index > stream.nextChunkIndex) {
          // A higher chunkIndex may arrive first through a relay. Keep its
          // original progress so the sequence can be validated when the gap
          // closes; arrival order is not logical stream order.
          const existing = stream.outOfOrder.get(index);
          if (existing) {
            if (existing.progress !== progress || JSON.stringify(existing.message) !== JSON.stringify(mcp)) {
              failStream(entry, 'conflicting duplicate chunk');
            }
            return;
          }
          if (
            progress <= stream.lastProgress
            || stream.outOfOrder.size >= MAX_STREAM_BUFFERED_CHUNKS
            || stream.outOfOrderCodeUnits + cvm.data.length > MAX_STREAM_BUFFERED_CODE_UNITS
          ) {
            failStream(entry, progress <= stream.lastProgress ? 'non-monotonic progress' : 'gap buffer exhausted');
            return;
          }
          stream.outOfOrder.set(index, { message: mcp, progress, codeUnits: cvm.data.length });
          stream.outOfOrderCodeUnits += cvm.data.length;
          resetStreamIdleTimer(entry, stream);
          refreshPendingTimeout(entry);
          return;
        }

        // Build the newly contiguous run and validate its logical progress
        // before exposing any part of it to application handlers.
        const ready: Array<{ message: McpMessage; progress: number; codeUnits: number }> = [
          { message: mcp, progress, codeUnits: 0 },
        ];
        let nextIndex = index + 1;
        while (stream.outOfOrder.has(nextIndex)) {
          ready.push(stream.outOfOrder.get(nextIndex)!);
          nextIndex += 1;
        }
        let previousProgress = stream.lastProgress;
        for (const item of ready) {
          if (item.progress <= previousProgress) {
            failStream(entry, 'non-monotonic chunk order');
            return;
          }
          previousProgress = item.progress;
        }
        for (let bufferedIndex = index + 1; bufferedIndex < nextIndex; bufferedIndex++) {
          const buffered = stream.outOfOrder.get(bufferedIndex)!;
          stream.outOfOrder.delete(bufferedIndex);
          stream.outOfOrderCodeUnits -= buffered.codeUnits;
        }
        for (const item of ready) {
          routeEvent(serverPubkey, item.message);
          stream.nextChunkIndex += 1;
        }
        stream.lastProgress = previousProgress;
        resetStreamIdleTimer(entry, stream);
        refreshPendingTimeout(entry);
        return;
      }
      case 'ping': {
        // Invalid control frames are not activity and cannot extend deadlines.
        if (typeof cvm.nonce !== 'string') return;
        if (new TextEncoder().encode(cvm.nonce).byteLength > MAX_PING_NONCE_BYTES) return;
        if (!admitOrderedActivity()) return;
        void publishStreamFrame(entry, stream, { frameType: 'pong', nonce: cvm.nonce }).catch(() => {
          // A pong we cannot publish leaves the stream half-dead: fail it.
          failStream(entry, 'pong publication failed');
        });
        return;
      }
      case 'pong': {
        // Only a matching outstanding probe is valid liveness evidence.
        if (stream.pendingNonce === null || cvm.nonce !== stream.pendingNonce) return;
        if (!admitOrderedActivity()) return;
        stream.pendingNonce = null;
        if (stream.probeTimer) clearTimeout(stream.probeTimer);
        stream.probeTimer = null;
        return;
      }
      case 'close': {
        // A declared completeness bound MUST be fully satisfied: every
        // chunkIndex from 0 through lastChunkIndex received (CEP-41).
        if (cvm.lastChunkIndex !== undefined) {
          const bound = cvm.lastChunkIndex;
          const complete = isBoundedInteger(bound, 0, Number.MAX_SAFE_INTEGER)
            && stream.nextChunkIndex === bound + 1
            && stream.outOfOrder.size === 0;
          if (!complete) {
            failStream(entry, 'close with unresolved chunk gaps');
            return;
          }
        }
        if (!admitOrderedActivity()) return;
        routeEvent(serverPubkey, mcp);
        endStream(entry);
        return;
      }
      case 'abort':
        if (!admitOrderedActivity()) return;
        routeEvent(serverPubkey, mcp);
        endStream(entry);
        return;
      default:
        return; // malformed/unknown frames do not refresh liveness
    }
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
      void publishMcp(server, relays, outgoing).catch((err: unknown) => {
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
        releaseTransfer(entry);
        releaseStream(entry);
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

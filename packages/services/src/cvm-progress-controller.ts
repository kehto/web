/**
 * CEP-22 and CEP-41 progress-frame state for the Nostr ContextVM transport.
 *
 * This module is intentionally transport-agnostic: the Nostr transport owns
 * encryption, relay publication, request deadlines, and event delivery, while
 * this controller owns only the bounded progress-frame state machine.
 */

import type { McpMessage } from './cvm-types.js';

const DIGEST_PREFIX = 'sha256:';
const MAX_TRANSFER_CHUNKS = 10_000;
const MAX_TRANSFER_BYTES = 100 * 1024 * 1024;
const MAX_ACTIVE_TRANSFERS = 8;
const MAX_TRANSFER_LIFETIME_MS = 120_000;
const COMPLETION_MODE_RENDER = 'render';
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 30_000;
export const DEFAULT_STREAM_PROBE_TIMEOUT_MS = 10_000;
const MAX_STREAM_BUFFERED_CHUNKS = 256;
const MAX_STREAM_BUFFERED_CODE_UNITS = 8 * 1024 * 1024;
const MAX_PING_NONCE_BYTES = 64;

export interface CvmProgressFrame {
  type?: string;
  frameType?: string;
  completionMode?: string;
  digest?: string;
  totalBytes?: number;
  totalChunks?: number;
  data?: string;
  chunkIndex?: number;
  lastChunkIndex?: number;
  nonce?: string;
  reason?: string;
}

export interface CvmProgressParams {
  progressToken?: string | number;
  progress?: number;
  cvm?: CvmProgressFrame;
}

interface OversizedTransfer {
  digest: string;
  totalBytes: number;
  totalChunks: number;
  startProgress: number;
  acceptProgress: number | null;
  chunks: Map<number, string>;
  codeUnitsReceived: number;
  expiryTimer: ReturnType<typeof setTimeout>;
}

export interface OpenStreamState {
  token: string | number;
  lastProgress: number;
  localProgress: number;
  nextChunkIndex: number;
  outOfOrder: Map<number, { message: McpMessage; progress: number; codeUnits: number }>;
  outOfOrderCodeUnits: number;
  pendingNonce: string | null;
  idleTimer: ReturnType<typeof setTimeout>;
  probeTimer: ReturnType<typeof setTimeout> | null;
}

export interface CvmProgressEntry {
  serverPubkey: string;
  correlationId: string;
  tokenKey?: string;
  oversized?: OversizedTransfer;
  stream?: OpenStreamState;
  streamEnded?: boolean;
}

export interface CvmProgressControllerOptions<Entry extends CvmProgressEntry> {
  pending: Map<string, Entry>;
  issuedTokens: Map<string, string>;
  streamIdleTimeoutMs: number;
  streamProbeTimeoutMs: number;
  nextNonce(): string;
  canPublish(entry: Entry): boolean;
  publishControlFrame(entry: Entry, stream: OpenStreamState, frame: { frameType: 'ping' | 'pong' | 'abort'; nonce?: string; reason?: string }): Promise<void>;
  routeMessage(serverPubkey: string, message: McpMessage): void;
  routeEvent(serverPubkey: string, message: McpMessage): void;
  refreshPendingTimeout(entry: Entry): void;
}

export interface CvmProgressController<Entry extends CvmProgressEntry> {
  handle(serverPubkey: string, message: McpMessage): boolean;
  release(entry: Entry): void;
}

export function progressTokenKey(token: string | number | undefined): string | null {
  if (typeof token === 'string') return token.length > 0 ? `s:${token}` : null;
  if (typeof token === 'number' && Number.isFinite(token)) return `n:${token}`;
  return null;
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Creates the CEP-22 reassembly and CEP-41 streaming controller. */
export function createCvmProgressController<Entry extends CvmProgressEntry>(
  options: CvmProgressControllerOptions<Entry>,
): CvmProgressController<Entry> {
  function admitFrame(serverPubkey: string, token: string | number | undefined): Entry | null {
    const tokenKey = progressTokenKey(token);
    if (!tokenKey) return null;
    const correlationId = options.issuedTokens.get(`${serverPubkey}:${tokenKey}`);
    if (!correlationId) return null;
    const entry = options.pending.get(correlationId);
    return entry && entry.serverPubkey === serverPubkey ? entry : null;
  }

  function releaseTransfer(entry: Entry): void {
    if (!entry.oversized) return;
    clearTimeout(entry.oversized.expiryTimer);
    entry.oversized = undefined;
  }

  function releaseStream(entry: Entry): void {
    if (!entry.stream) return;
    clearTimeout(entry.stream.idleTimer);
    if (entry.stream.probeTimer) clearTimeout(entry.stream.probeTimer);
    entry.stream = undefined;
  }

  function endStream(entry: Entry): void {
    releaseStream(entry);
    entry.streamEnded = true;
  }

  function failStream(entry: Entry, reason: string): void {
    const stream = entry.stream;
    if (!stream || entry.streamEnded) return;
    endStream(entry);
    void options.publishControlFrame(entry, stream, { frameType: 'abort', reason }).catch(() => undefined);
  }

  function resetStreamIdleTimer(entry: Entry, stream: OpenStreamState): void {
    clearTimeout(stream.idleTimer);
    stream.idleTimer = setTimeout(() => onStreamIdle(entry), options.streamIdleTimeoutMs);
  }

  function onStreamIdle(entry: Entry): void {
    const stream = entry.stream;
    if (!stream || entry.streamEnded || stream.pendingNonce !== null) return;
    if (!options.canPublish(entry)) {
      failStream(entry, 'session closed');
      return;
    }
    stream.pendingNonce = options.nextNonce();
    stream.probeTimer = setTimeout(() => failStream(entry, 'probe timeout'), options.streamProbeTimeoutMs);
    void options.publishControlFrame(entry, stream, { frameType: 'ping', nonce: stream.pendingNonce })
      .catch(() => failStream(entry, 'ping publication failed'));
  }

  function countActiveTransfers(): number {
    let active = 0;
    for (const entry of options.pending.values()) if (entry.oversized) active += 1;
    return active;
  }

  async function assembleTransfer(transfer: OversizedTransfer, endProgress: number): Promise<McpMessage | null> {
    const { startProgress, acceptProgress, totalChunks } = transfer;
    const hasCompleteRange = (first: number): boolean => {
      for (let index = 0; index < totalChunks; index += 1) {
        if (!transfer.chunks.has(first + index)) return false;
      }
      return true;
    };
    const directStart = startProgress + 1;
    const acceptGatedStart = startProgress + 2;
    const firstProgress = hasCompleteRange(directStart) && endProgress === directStart + totalChunks
      ? directStart
      : acceptProgress === startProgress + 1
        && hasCompleteRange(acceptGatedStart)
        && endProgress === acceptGatedStart + totalChunks
        ? acceptGatedStart
        : null;
    if (firstProgress === null) return null;
    let payload = '';
    for (let index = 0; index < totalChunks; index += 1) payload += transfer.chunks.get(firstProgress + index)!;
    if (new TextEncoder().encode(payload).byteLength !== transfer.totalBytes) return null;
    const expected = transfer.digest.startsWith(DIGEST_PREFIX) ? transfer.digest.slice(DIGEST_PREFIX.length) : transfer.digest;
    if ((await sha256Hex(payload)) !== expected) return null;
    try {
      return JSON.parse(payload) as McpMessage;
    } catch {
      return null;
    }
  }

  async function handleOversizedFrame(serverPubkey: string, params: CvmProgressParams, cvm: CvmProgressFrame): Promise<void> {
    const entry = admitFrame(serverPubkey, params.progressToken);
    if (!entry) return;
    const progress = Number(params.progress ?? NaN);
    if (!Number.isSafeInteger(progress) || progress < 0) return;
    if (cvm.frameType === 'start') {
      const digest = typeof cvm.digest === 'string' ? cvm.digest : '';
      const { totalBytes, totalChunks } = cvm;
      if (cvm.completionMode !== COMPLETION_MODE_RENDER || digest === '') return;
      if (!isBoundedInteger(totalChunks, 1, MAX_TRANSFER_CHUNKS) || !isBoundedInteger(totalBytes, 1, MAX_TRANSFER_BYTES)) return;
      if (progress > Number.MAX_SAFE_INTEGER - totalChunks - 1) return;
      if (!entry.oversized && countActiveTransfers() >= MAX_ACTIVE_TRANSFERS) return;
      releaseTransfer(entry);
      entry.oversized = {
        digest, totalBytes, totalChunks, startProgress: progress, acceptProgress: null,
        chunks: new Map(), codeUnitsReceived: 0,
        expiryTimer: setTimeout(() => releaseTransfer(entry), MAX_TRANSFER_LIFETIME_MS),
      };
      options.refreshPendingTimeout(entry);
      return;
    }
    const transfer = entry.oversized;
    if (!transfer) return;
    if (cvm.frameType === 'accept') {
      if (progress !== transfer.startProgress + 1) {
        releaseTransfer(entry);
        return;
      }
      transfer.acceptProgress = progress;
      options.refreshPendingTimeout(entry);
      return;
    }
    if (cvm.frameType === 'chunk') {
      if (typeof cvm.data !== 'string' || progress <= transfer.startProgress || transfer.chunks.has(progress)) return;
      if (transfer.chunks.size >= transfer.totalChunks) {
        releaseTransfer(entry);
        return;
      }
      transfer.codeUnitsReceived += cvm.data.length;
      if (transfer.codeUnitsReceived > MAX_TRANSFER_BYTES) {
        releaseTransfer(entry);
        return;
      }
      transfer.chunks.set(progress, cvm.data);
      options.refreshPendingTimeout(entry);
      return;
    }
    if (cvm.frameType === 'abort') {
      releaseTransfer(entry);
      return;
    }
    if (cvm.frameType === 'end') {
      const message = await assembleTransfer(transfer, progress);
      releaseTransfer(entry);
      if (message) options.routeMessage(serverPubkey, message);
    }
  }

  function handleOpenStreamFrame(serverPubkey: string, entry: Entry, params: CvmProgressParams, cvm: CvmProgressFrame, message: McpMessage): void {
    const progress = Number(params.progress ?? NaN);
    if (!Number.isSafeInteger(progress) || progress < 0 || entry.streamEnded) return;
    const stream = entry.stream;
    if (!stream) {
      if (cvm.frameType !== 'start') return;
      entry.stream = {
        token: params.progressToken as string | number, lastProgress: progress, localProgress: 0, nextChunkIndex: 0,
        outOfOrder: new Map(), outOfOrderCodeUnits: 0, pendingNonce: null,
        idleTimer: setTimeout(() => onStreamIdle(entry), options.streamIdleTimeoutMs), probeTimer: null,
      };
      options.refreshPendingTimeout(entry);
      options.routeEvent(serverPubkey, message);
      return;
    }
    const admitOrderedActivity = (): boolean => {
      if (progress <= stream.lastProgress) {
        failStream(entry, 'non-monotonic progress');
        return false;
      }
      stream.lastProgress = progress;
      resetStreamIdleTimer(entry, stream);
      options.refreshPendingTimeout(entry);
      return true;
    };
    switch (cvm.frameType) {
      case 'start':
        failStream(entry, 'duplicate start');
        return;
      case 'accept':
        if (admitOrderedActivity()) options.routeEvent(serverPubkey, message);
        return;
      case 'chunk': {
        if (typeof cvm.data !== 'string' || !isBoundedInteger(cvm.chunkIndex, 0, Number.MAX_SAFE_INTEGER)) {
          failStream(entry, 'malformed chunk');
          return;
        }
        const index = cvm.chunkIndex;
        if (index < stream.nextChunkIndex) return;
        if (index > stream.nextChunkIndex) {
          const existing = stream.outOfOrder.get(index);
          if (existing) {
            if (existing.progress !== progress || JSON.stringify(existing.message) !== JSON.stringify(message)) failStream(entry, 'conflicting duplicate chunk');
            return;
          }
          if (progress <= stream.lastProgress || stream.outOfOrder.size >= MAX_STREAM_BUFFERED_CHUNKS || stream.outOfOrderCodeUnits + cvm.data.length > MAX_STREAM_BUFFERED_CODE_UNITS) {
            failStream(entry, progress <= stream.lastProgress ? 'non-monotonic progress' : 'gap buffer exhausted');
            return;
          }
          stream.outOfOrder.set(index, { message, progress, codeUnits: cvm.data.length });
          stream.outOfOrderCodeUnits += cvm.data.length;
          resetStreamIdleTimer(entry, stream);
          options.refreshPendingTimeout(entry);
          return;
        }
        const ready: Array<{ message: McpMessage; progress: number; codeUnits: number }> = [{ message, progress, codeUnits: 0 }];
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
        for (let bufferedIndex = index + 1; bufferedIndex < nextIndex; bufferedIndex += 1) {
          const buffered = stream.outOfOrder.get(bufferedIndex)!;
          stream.outOfOrder.delete(bufferedIndex);
          stream.outOfOrderCodeUnits -= buffered.codeUnits;
        }
        for (const item of ready) {
          options.routeEvent(serverPubkey, item.message);
          stream.nextChunkIndex += 1;
        }
        stream.lastProgress = previousProgress;
        resetStreamIdleTimer(entry, stream);
        options.refreshPendingTimeout(entry);
        return;
      }
      case 'ping':
        if (typeof cvm.nonce !== 'string' || new TextEncoder().encode(cvm.nonce).byteLength > MAX_PING_NONCE_BYTES) return;
        if (admitOrderedActivity()) void options.publishControlFrame(entry, stream, { frameType: 'pong', nonce: cvm.nonce }).catch(() => failStream(entry, 'pong publication failed'));
        return;
      case 'pong':
        if (stream.pendingNonce === null || cvm.nonce !== stream.pendingNonce || !admitOrderedActivity()) return;
        stream.pendingNonce = null;
        if (stream.probeTimer) clearTimeout(stream.probeTimer);
        stream.probeTimer = null;
        return;
      case 'close': {
        if (cvm.lastChunkIndex !== undefined) {
          const bound = cvm.lastChunkIndex;
          if (!isBoundedInteger(bound, 0, Number.MAX_SAFE_INTEGER) || stream.nextChunkIndex !== bound + 1 || stream.outOfOrder.size !== 0) {
            failStream(entry, 'close with unresolved chunk gaps');
            return;
          }
        }
        if (admitOrderedActivity()) {
          options.routeEvent(serverPubkey, message);
          endStream(entry);
        }
        return;
      }
      case 'abort':
        if (admitOrderedActivity()) {
          options.routeEvent(serverPubkey, message);
          endStream(entry);
        }
        return;
      default:
        return;
    }
  }

  return {
    handle(serverPubkey, message) {
      if (message.method !== 'notifications/progress') return false;
      const params = (message.params ?? {}) as CvmProgressParams;
      const cvm = params.cvm;
      if (!cvm || typeof cvm.type !== 'string') return false;
      if (cvm.type === 'oversized-transfer') {
        void handleOversizedFrame(serverPubkey, params, cvm);
        return true;
      }
      if (cvm.type === 'open-stream') {
        const entry = admitFrame(serverPubkey, params.progressToken);
        if (entry) handleOpenStreamFrame(serverPubkey, entry, params, cvm, message);
        return true;
      }
      return false;
    },
    release(entry) {
      releaseTransfer(entry);
      releaseStream(entry);
      if (entry.tokenKey && options.issuedTokens.get(entry.tokenKey) === entry.correlationId) options.issuedTokens.delete(entry.tokenKey);
      entry.tokenKey = undefined;
    },
  };
}

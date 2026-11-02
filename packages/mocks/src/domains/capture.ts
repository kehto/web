/**
 * domains/capture.ts — Mock NAP-CAPTURE service.
 *
 * Spec: naps/NAP-CAPTURE.md @ napplet/naps PR #94 head 438b37612cd3 (draft)
 * Routes: capture.info, capture.start, capture.status, capture.stop,
 *         capture.cancel, capture.release
 * Spec gaps / decisions:
 * - No `@napplet/nap/capture/types` in nap 0.32.0; shapes are local.
 * - The "endpoint generation" is the window id: one slot per window; a
 *   capture id from another window is `capture-not-found`.
 * - Consent is immediate and governed by `consent` (`grant` | `deny`) and
 *   `permission` (`granted` | `denied`) options; there is no finalizing state.
 * - `data` is a `Uint8Array` (web projection carrier): a 4-byte EBML magic
 *   followed by seeded bytes at ~6 bytes/ms, capped at `maxBytes` (→
 *   `truncated: true`, `reason: "limit"`).
 * - Retained terminal state expires through the scheduler at `expiresAt` and
 *   is also treated as erased lazily once `clock.now() >= expiresAt`.
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_CLOCK, DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import { createSeededRng, hashLabel } from '../core/rng.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** NAP-CAPTURE document checked for this mock. */
export const CAPTURE_SPEC_REF: NapSpecRef = { nap: 'NAP-CAPTURE', status: 'draft', source: 'pr', pr: 94, sha: '438b37612cd3', path: 'naps/NAP-CAPTURE.md' };

/** `CaptureInfo` from the NAP. */
export interface MockCaptureInfo {
  /** Only `microphone`. */
  sources: string[];
  /** Advertised output types, preference order. */
  mimeTypes: string[];
  /** Max recording interval (ms). */
  maxDurationMs: number;
  /** Hard artifact size cap (bytes). */
  maxBytes: number;
  /** Terminal-status retention (ms). */
  retentionMs: number;
}

/** Stable error codes from the NAP. */
export type MockCaptureErrorCode =
  | 'invalid-request' | 'policy-denied' | 'user-cancelled' | 'permission-denied' | 'device-unavailable'
  | 'unsupported-source' | 'unsupported-format' | 'busy' | 'capture-not-found' | 'invalid-state'
  | 'quota-exceeded' | 'capture-failed';

/** `CaptureError` from the NAP. */
export interface MockCaptureError {
  /** Stable code. */
  code: MockCaptureErrorCode;
  /** Safe diagnostic text. */
  message?: string;
}

/** `CaptureArtifact` from the NAP. */
export interface MockCaptureArtifact {
  /** Completed capture id. */
  captureId: string;
  /** Encoded audio bytes. */
  data: Uint8Array;
  /** Normalized actual MIME type. */
  mimeType: string;
  /** Byte length of `data`. */
  size: number;
  /** Measured active capture interval (ms). */
  durationMs: number;
  /** Whether a limit or interruption ended capture. */
  truncated: boolean;
  /** Terminal cause. */
  reason: 'requested' | 'user' | 'limit' | 'interrupted';
}

/** `CaptureStatus` from the NAP. */
export interface MockCaptureStatus {
  /** Affected capture. */
  captureId: string;
  /** Observable state. */
  state: 'recording' | 'completed' | 'cancelled' | 'failed';
  /** Retained artifact (completed only). */
  artifact?: MockCaptureArtifact;
  /** Cancellation reason (cancelled only). */
  reason?: 'requested' | 'user' | 'revoked';
  /** Retained failure (failed only). */
  error?: MockCaptureError;
  /** Erasure time, ms since epoch (terminal only). */
  expiresAt?: number;
}

/** One capture slot owned by a window. */
export interface MockCaptureRecord {
  /** Owning window (endpoint generation). */
  windowId: string;
  /** Selected output MIME type. */
  mimeType: string;
  /** Activation time (ms). */
  startedAt: number;
  /** Current status (authoritative). */
  status: MockCaptureStatus;
  /** Cancel function of the expiry timer. */
  expiry?: () => void;
}

/** In-memory state of the capture mock. */
export interface MockCaptureState {
  /** Advertised formats and limits. */
  info: MockCaptureInfo;
  /** Captures by id. */
  captures: Map<string, MockCaptureRecord>;
  /** Generated capture ids. */
  counter: number;
}

/**
 * Factory options for the capture mock.
 *
 * @example
 * ```ts
 * const capture = createMockCaptureService({ consent: 'deny' });
 * ```
 */
export interface MockCaptureOptions extends MockServiceOptions {
  /** Override advertised info/limits. */
  info?: Partial<MockCaptureInfo>;
  /** Trusted consent outcome for `capture.start`. Default `grant`. */
  consent?: 'grant' | 'deny';
  /** Platform microphone permission. Default `granted`. */
  permission?: 'granted' | 'denied';
}

/** Capture mock plus trusted-UI and device controls. */
export type MockCaptureService = MockService<MockCaptureState> & {
  /** Trusted **Stop**: complete with `reason: "user"`. */
  userStop(captureId: string): void;
  /** Trusted **Discard**: cancel (`reason: "user"`) or erase a terminal capture. */
  userDiscard(captureId: string): void;
  /** Device loss: fail with `device-unavailable`. */
  loseDevice(captureId: string): void;
  /** Erase a retained terminal capture as if `expiresAt` passed. */
  expire(captureId: string): void;
};

/** Default advertised info. */
export const MOCK_CAPTURE_INFO: MockCaptureInfo = Object.freeze({
  sources: ['microphone'], mimeTypes: ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'],
  maxDurationMs: 600_000, maxBytes: 52_428_800, retentionMs: 300_000,
});

const BYTES_PER_MS = 6;
const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

interface MediaType { essence: string; params: Map<string, string> }

function parseMediaType(value: string): MediaType | undefined {
  const [essence = '', ...rest] = value.split(';');
  const match = /^\s*([!#$%&'*+.^_`|~0-9A-Za-z-]+)\/([!#$%&'*+.^_`|~0-9A-Za-z-]+)\s*$/.exec(essence);
  if (!match) return undefined;
  const params = new Map<string, string>();
  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq < 0) return undefined;
    const name = part.slice(0, eq).trim().toLowerCase();
    let raw = part.slice(eq + 1).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1).replace(/\\(.)/g, '$1');
    if (!name || params.has(name)) return undefined;
    params.set(name, name === 'codecs' ? raw.split(',').map((token) => token.trim()).join(',') : raw);
  }
  return { essence: `${match[1]!.toLowerCase()}/${match[2]!.toLowerCase()}`, params };
}

function compatible(advertised: MediaType, requested: MediaType): boolean {
  if (advertised.essence !== requested.essence) return false;
  for (const [name, value] of requested.params) if (advertised.params.get(name) !== value) return false;
  return true;
}

/**
 * Pick the first advertised MIME type compatible with the request list.
 *
 * @param advertised - Runtime formats in preference order.
 * @param requested - Caller formats in preference order (empty = any).
 * @returns The normalized advertised type, `undefined` when none fits, or `'invalid'` when a request item is malformed.
 * @example
 * ```ts
 * selectCaptureMimeType(['audio/webm;codecs=opus'], ['AUDIO/WEBM']) === 'audio/webm;codecs=opus';
 * ```
 */
export function selectCaptureMimeType(advertised: readonly string[], requested: readonly string[]): string | undefined | 'invalid' {
  const wanted = requested.map(parseMediaType);
  if (wanted.some((item) => item === undefined)) return 'invalid';
  for (const candidate of advertised) {
    const parsed = parseMediaType(candidate);
    if (!parsed) continue;
    if (wanted.length === 0 || wanted.some((item) => compatible(parsed, item!))) return candidate;
  }
  return undefined;
}

function placeholderAudio(captureId: string, durationMs: number, maxBytes: number): { data: Uint8Array; truncated: boolean } {
  const wanted = EBML_MAGIC.length + Math.max(1, Math.round(durationMs * BYTES_PER_MS));
  const truncated = wanted > maxBytes;
  const data = new Uint8Array(truncated ? maxBytes : wanted);
  data.set(EBML_MAGIC);
  const rng = createSeededRng(hashLabel(`capture:${captureId}`));
  for (let index = EBML_MAGIC.length; index < data.length; index += 1) data[index] = rng.int(256);
  return { data, truncated };
}

/**
 * Create the NAP-CAPTURE mock.
 *
 * @param options - Info overrides, consent and permission outcomes.
 * @returns A `capture` extension with trusted-UI and device controls.
 * @example
 * ```ts
 * const capture = createMockCaptureService();
 * capture.handleMessage('w1', { type: 'capture.start', id: 's1', request: { source: 'microphone' } }, send);
 * capture.handleMessage('w1', { type: 'capture.stop', id: 's2', captureId: 'capture-1' }, send); // artifact
 * ```
 */
export function createMockCaptureService(options: MockCaptureOptions = {}): MockCaptureService {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const error = (code: MockCaptureErrorCode, message?: string): { error: MockCaptureError } => ({ error: { code, ...(message ? { message } : {}) } });

  const mock = defineMockService<MockCaptureState>({
    domain: 'capture',
    version: '0.1.0',
    description: 'Mock NAP-CAPTURE microphone recordings',
    kind: 'extension',
    pushes: { 'capture.changed': null },
    initialState: () => ({ info: { ...MOCK_CAPTURE_INFO, ...options.info, sources: ['microphone'] }, captures: new Map(), counter: 0 }),
    routes: {
      'capture.info': ({ state, reply }) => reply({ info: { ...state.info, sources: [...state.info.sources], mimeTypes: [...state.info.mimeTypes] } }),
      'capture.start': ({ message, state, windowId, reply }) => {
        const request = message.request as { source?: unknown; mimeTypes?: unknown } | undefined;
        if (!request || typeof request !== 'object' || (request.mimeTypes !== undefined && !Array.isArray(request.mimeTypes))) return reply(error('invalid-request'));
        if (request.source !== 'microphone') return reply(error(typeof request.source === 'string' ? 'unsupported-source' : 'invalid-request'));
        const requested = (request.mimeTypes as unknown[] | undefined) ?? [];
        if (requested.some((item) => typeof item !== 'string')) return reply(error('invalid-request'));
        const mimeType = selectCaptureMimeType(state.info.mimeTypes, requested as string[]);
        if (mimeType === 'invalid') return reply(error('invalid-request', 'malformed MIME type'));
        if (mimeType === undefined) return reply(error('unsupported-format'));
        if ([...state.captures.values()].some((item) => item.windowId === windowId)) return reply(error('busy'));
        if (options.permission === 'denied') return reply(error('permission-denied'));
        if (options.consent === 'deny') return reply(error('user-cancelled'));
        const captureId = `capture-${++state.counter}`;
        state.captures.set(captureId, { windowId, mimeType, startedAt: clock.now(), status: { captureId, state: 'recording' } });
        const { maxDurationMs, maxBytes, retentionMs } = state.info;
        reply({ session: { captureId, source: 'microphone', mimeType, maxDurationMs, maxBytes, retentionMs } });
      },
      'capture.status': ({ message, state, windowId, reply }) => {
        const record = owned(state, windowId, message.captureId);
        reply(record ? { status: cloneStatus(record.status) } : error('capture-not-found'));
      },
      'capture.stop': ({ message, state, windowId, reply }) => {
        const record = owned(state, windowId, message.captureId);
        if (!record) return reply(error('capture-not-found'));
        if (record.status.state === 'recording') complete(message.captureId as string, record, 'requested');
        const artifact = record.status.artifact;
        reply(artifact ? { artifact: { ...artifact } } : error('invalid-state'));
      },
      'capture.cancel': ({ message, state, windowId, reply }) => {
        const record = owned(state, windowId, message.captureId);
        if (!record) return reply(error('capture-not-found'));
        if (record.status.state === 'recording') cancel(message.captureId as string, record, 'requested');
        reply({ status: cloneStatus(record.status) });
      },
      'capture.release': ({ message, state, windowId, reply }) => {
        const record = owned(state, windowId, message.captureId);
        if (!record) return reply(error('capture-not-found'));
        if (record.status.state === 'recording') return reply(error('invalid-state'));
        erase(message.captureId as string);
        reply({ captureId: message.captureId });
      },
    },
    onWindowDestroyed: (windowId, state) => {
      for (const [captureId, record] of Array.from(state.captures)) if (record.windowId === windowId) { record.expiry?.(); state.captures.delete(captureId); }
    },
    onCapabilityRevoked: (windowId, _capability, state) => {
      for (const [captureId, record] of state.captures) if (record.windowId === windowId && record.status.state === 'recording') cancel(captureId, record, 'revoked');
    },
  }, options);

  function owned(state: MockCaptureState, windowId: string, captureId: unknown): MockCaptureRecord | undefined {
    const record = typeof captureId === 'string' ? state.captures.get(captureId) : undefined;
    if (!record || record.windowId !== windowId) return undefined;
    if (record.status.expiresAt !== undefined && clock.now() >= record.status.expiresAt) { erase(captureId as string); return undefined; }
    return record;
  }
  function cloneStatus(status: MockCaptureStatus): MockCaptureStatus {
    return { ...status, ...(status.artifact ? { artifact: { ...status.artifact } } : {}), ...(status.error ? { error: { ...status.error } } : {}) };
  }
  function erase(captureId: string): void {
    const record = mock.mock.state().captures.get(captureId);
    record?.expiry?.();
    mock.mock.state().captures.delete(captureId);
  }
  function commit(captureId: string, record: MockCaptureRecord, status: MockCaptureStatus): void {
    const { retentionMs } = mock.mock.state().info;
    record.status = { ...status, expiresAt: clock.now() + retentionMs };
    record.expiry = scheduler.schedule(retentionMs, () => { delete record.expiry; erase(captureId); });
    const event: Record<string, unknown> = { captureId, state: status.state };
    if (status.reason) event.reason = status.reason;
    if (status.error) event.error = { ...status.error };
    pushToWindow(mock, record.windowId, { type: 'capture.changed', event } as NappletMessage);
  }
  function complete(captureId: string, record: MockCaptureRecord, reason: MockCaptureArtifact['reason']): void {
    const { maxDurationMs, maxBytes } = mock.mock.state().info;
    const elapsed = Math.max(0, clock.now() - record.startedAt);
    const overDuration = elapsed > maxDurationMs;
    const durationMs = Math.min(elapsed, maxDurationMs);
    const { data, truncated } = placeholderAudio(captureId, durationMs, maxBytes);
    const limited = truncated || overDuration;
    commit(captureId, record, {
      captureId, state: 'completed',
      artifact: { captureId, data, mimeType: record.mimeType, size: data.byteLength, durationMs, truncated: limited, reason: limited ? 'limit' : reason },
    });
  }
  function cancel(captureId: string, record: MockCaptureRecord, reason: 'requested' | 'user' | 'revoked'): void {
    commit(captureId, record, { captureId, state: 'cancelled', reason });
  }
  function recording(captureId: string): MockCaptureRecord | undefined {
    const record = mock.mock.state().captures.get(captureId);
    return record?.status.state === 'recording' ? record : undefined;
  }

  const baseReset = mock.mock.reset;
  mock.mock.reset = () => { for (const record of mock.mock.state().captures.values()) record.expiry?.(); baseReset(); };
  return Object.assign(mock, {
    userStop(captureId: string) { const record = recording(captureId); if (record) complete(captureId, record, 'user'); },
    userDiscard(captureId: string) {
      const record = recording(captureId);
      if (record) cancel(captureId, record, 'user');
      else erase(captureId);
    },
    loseDevice(captureId: string) {
      const record = recording(captureId);
      if (record) commit(captureId, record, { captureId, state: 'failed', error: { code: 'device-unavailable', message: 'microphone lost' } });
    },
    expire(captureId: string) { if (mock.mock.state().captures.get(captureId)?.status.state !== 'recording') erase(captureId); },
  });
}

/** Registry row for the capture mock. */
export const CAPTURE_MOCK_ENTRY: MockDomainEntry = { domain: 'capture', kind: 'extension', spec: CAPTURE_SPEC_REF, create: (o) => createMockCaptureService(o) };

/**
 * domains/upload.ts — Mock NAP-UPLOAD service.
 *
 * Spec: naps/NAP-UPLOAD.md @ napplet/naps PR #33 head f5cc981e (draft)
 * Routes: upload.info, upload.upload, upload.status
 * Pushes: upload.status.changed
 * Spec gaps / decisions:
 * - Uploads complete synchronously unless `staged` (default: `latencyMs > 0`).
 *   Staged uploads answer `status: "uploading"` and progress one step per
 *   `advance()` call (or every `autoAdvanceMs` through the scheduler), pushing
 *   `upload.status.changed` until `complete`.
 * - Hashes are `placeholderSha256` values; `originalSha256` always equals
 *   `sha256` because the mock never transforms bytes. Result URLs point at
 *   `https://blossom.example.org/<sha256><ext>` (blossom rail) or
 *   `https://files.example.org/<sha256><ext>` (nip96 rail).
 * - A `Blob` payload cannot be read synchronously; its size and type are used
 *   and its hash is derived from them.
 * - Top-level `error` is used only when no upload was created (`invalid request`,
 *   `unsupported rail`, `file too large`, `unsupported media type`), matching
 *   the draft's SHOULD. Failures after creation use `result.ok: false`.
 */
import type { NappletMessage } from '@kehto/runtime';
import type {
  UploadInfo,
  UploadRail,
  UploadRailInfo,
  UploadRequest,
  UploadResult,
  UploadState,
  UploadStatus,
} from '@napplet/nap/upload/types';
import type { NostrTag } from '@napplet/core';
import { DEFAULT_CLOCK, DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { blobType, byteLengthOf, extensionForMime, mimeForFileName, placeholderSha256, toBytes } from './file-bytes.js';

export type {
  UploadInfo,
  UploadRail,
  UploadRailInfo,
  UploadRequest,
  UploadResult,
  UploadState,
  UploadStatus,
} from '@napplet/nap/upload/types';

/** Spec document the mock was written against. */
export const UPLOAD_SPEC_REF: NapSpecRef = {
  nap: 'NAP-UPLOAD',
  status: 'draft',
  source: 'pr',
  pr: 33,
  sha: 'f5cc981e',
  path: 'naps/NAP-UPLOAD.md',
};

/** Default advisory rails: Blossom and NIP-96, both enabled. */
export const DEFAULT_UPLOAD_RAILS: readonly UploadRailInfo[] = Object.freeze([
  { rail: 'blossom', enabled: true, returns: ['https', 'blossom'] },
  { rail: 'nip96', enabled: true, returns: ['https'] },
]);

/** Blurhash placeholder attached to image uploads (the draft's example value). */
export const MOCK_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

/**
 * One tracked upload.
 *
 * @example
 * ```ts
 * const record = service.mock.state().uploads.get('upload-1');
 * record?.status.status === 'complete';
 * ```
 */
export interface MockUploadRecord {
  /** Requesting window. */
  windowId: string;
  /** Shell-generated id. */
  uploadId: string;
  /** Latest status snapshot (what `upload.status` returns). */
  status: UploadStatus;
  /** Final status reached when the upload completes. */
  completed: UploadStatus;
  /** Progress steps taken so far. */
  step: number;
  /** Progress steps needed to complete. */
  steps: number;
}

/**
 * In-memory state of the upload mock.
 *
 * @example
 * ```ts
 * createMockUploadService().mock.state().uploads.size === 0;
 * ```
 */
export interface MockUploadState {
  /** Uploads keyed by `uploadId`. */
  uploads: Map<string, MockUploadRecord>;
  /** Next upload sequence number. */
  nextId: number;
  /** Auto-advance timers keyed by `uploadId`. */
  timers: Map<string, () => void>;
}

/**
 * Options for `createMockUploadService`.
 *
 * @example
 * ```ts
 * const service = createMockUploadService({ staged: true, progressSteps: 4 });
 * ```
 */
export interface MockUploadOptions extends MockServiceOptions {
  /** Advisory rails. Default `DEFAULT_UPLOAD_RAILS`. */
  rails?: readonly UploadRailInfo[];
  /** Rail used when a request omits `rail`. Default `blossom`. */
  defaultRail?: UploadRail;
  /** Enforced and advertised size cap. Default 100 MiB. */
  maxBytes?: number;
  /** Accepted MIME types; omit to accept everything. */
  mimeTypes?: readonly string[];
  /** Report `uploading` first and progress through `advance()`. Default `latencyMs > 0`. */
  staged?: boolean;
  /** Progress steps for staged uploads. Default 3. */
  progressSteps?: number;
  /** When set, staged uploads advance automatically every this many ms. */
  autoAdvanceMs?: number;
}

/**
 * The upload mock with progress controls.
 *
 * @example
 * ```ts
 * const service = createMockUploadService({ staged: true });
 * service.advance(); // pushes one upload.status.changed per in-flight upload
 * ```
 */
export type MockUploadService = MockService<MockUploadState> & {
  /**
   * Advance one or every in-flight upload by one step.
   *
   * @param uploadId - Only this upload; omit for all.
   * @returns Whether any upload advanced.
   */
  advance(uploadId?: string): boolean;
  /**
   * Fail an in-flight upload.
   *
   * @param uploadId - Upload to fail.
   * @param reason - `error` text. Default `upload failed`.
   * @returns Whether the upload existed and was in flight.
   */
  failUpload(uploadId: string, reason?: string): boolean;
};

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function buildCompleted(uploadId: string, rail: UploadRail, request: UploadRequest, mime: string, now: number): UploadStatus {
  const bytes = toBytes(request.data) ?? new Uint8Array(0);
  const size = byteLengthOf(request.data) ?? bytes.length;
  const sha256 = placeholderSha256(bytes);
  const extension = request.filename?.includes('.') ? request.filename.slice(request.filename.lastIndexOf('.')) : extensionForMime(mime);
  const host = rail === 'blossom' ? 'blossom.example.org' : rail === 'nip96' ? 'files.example.org' : `${rail}.example.org`;
  const url = `https://${host}/${sha256}${extension}`;
  const dimensions = mime.startsWith('image/') ? { width: 1280, height: 720 } : undefined;
  const nip94: NostrTag[] = [['url', url], ['m', mime], ['x', sha256], ['ox', sha256], ['size', String(size)]];
  if (dimensions) nip94.push(['dim', `${dimensions.width}x${dimensions.height}`]);
  return stripUndefined({
    ok: true,
    uploadId,
    status: 'complete' as UploadState,
    rail,
    url,
    fallbackUrls: rail === 'blossom' ? [`https://cdn.example.net/${sha256}${extension}`] : undefined,
    sha256,
    originalSha256: sha256,
    size,
    mimeType: mime,
    dimensions,
    blurhash: dimensions ? MOCK_BLURHASH : undefined,
    nip94,
    bytesSent: size,
    bytesTotal: size,
    updatedAt: now,
  });
}

/**
 * Create the NAP-UPLOAD mock.
 *
 * @param options - Rails, caps, staging, and shared mock options.
 * @returns A `service`-kind mock for the `upload` domain with `advance`/`failUpload` controls.
 * @example
 * ```ts
 * const upload = createMockUploadService();
 * upload.handleMessage('w1', { type: 'upload.upload', id: 'u1', request: { data: new Uint8Array([1]), filename: 'a.bin' } }, send);
 * ```
 */
export function createMockUploadService(options: MockUploadOptions = {}): MockUploadService {
  const rails = options.rails ?? DEFAULT_UPLOAD_RAILS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const staged = options.staged ?? (options.latencyMs ?? 0) > 0;
  const steps = Math.max(1, options.progressSteps ?? 3);
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const clockNow = (): number => (options.clock ?? DEFAULT_CLOCK).now();
  const info: UploadInfo = stripUndefined({ rails: [...rails], maxBytes, mimeTypes: options.mimeTypes ? [...options.mimeTypes] : undefined });

  const service = defineMockService<MockUploadState>({
    domain: 'upload',
    version: '1.0.0',
    description: 'Mock NAP-UPLOAD: placeholder hashes, example.org URLs, staged progress',
    kind: 'service',
    initialState: () => ({ uploads: new Map(), nextId: 1, timers: new Map() }),
    routes: {
      'upload.info': ({ reply }) => reply({ info }),
      'upload.upload': ({ windowId, message, state, reply, fail, clock }) => {
        const request = message.request as UploadRequest | undefined;
        if (!request || typeof request !== 'object' || request.data == null) { fail('invalid request'); return; }
        const rail = request.rail ?? options.defaultRail ?? 'blossom';
        if (!rails.some((item) => item.rail === rail && item.enabled)) { fail('unsupported rail'); return; }
        const size = byteLengthOf(request.data);
        if (size === null) { fail('invalid request'); return; }
        if (size > maxBytes) { fail('file too large'); return; }
        const mime = request.mimeType ?? blobType(request.data) ?? (request.filename ? mimeForFileName(request.filename) : 'application/octet-stream');
        if (options.mimeTypes && !options.mimeTypes.includes(mime)) { fail('unsupported media type'); return; }
        const uploadId = `upload-${state.nextId}`;
        state.nextId += 1;
        const completed = buildCompleted(uploadId, rail, request, mime, clock.now());
        if (!staged) {
          state.uploads.set(uploadId, { windowId, uploadId, status: completed, completed, step: steps, steps });
          const { bytesSent: _sent, bytesTotal: _total, updatedAt: _at, ...result } = completed;
          reply({ result: result as UploadResult });
          return;
        }
        const status: UploadStatus = { ok: true, uploadId, status: 'uploading', rail, bytesSent: 0, bytesTotal: size, updatedAt: clock.now() };
        state.uploads.set(uploadId, { windowId, uploadId, status, completed, step: 0, steps });
        reply({ result: { ok: true, uploadId, status: 'uploading', rail } });
        if (options.autoAdvanceMs !== undefined) scheduleAdvance(uploadId, options.autoAdvanceMs);
      },
      'upload.status': ({ windowId, message, state, reply, fail }) => {
        const uploadId = message.uploadId;
        if (typeof uploadId !== 'string' || uploadId === '') { fail('invalid uploadId'); return; }
        const record = state.uploads.get(uploadId);
        if (!record || record.windowId !== windowId) { fail('unknown upload'); return; }
        reply({ status: record.status });
      },
    },
    onWindowDestroyed: (windowId, state) => {
      for (const [uploadId, record] of state.uploads) {
        if (record.windowId !== windowId) continue;
        state.timers.get(uploadId)?.();
        state.timers.delete(uploadId);
        state.uploads.delete(uploadId);
      }
    },
  }, options) as MockUploadService;

  function pushStatus(record: MockUploadRecord, status: UploadStatus): void {
    record.status = status;
    pushToWindow(service, record.windowId, { type: 'upload.status.changed', status } as NappletMessage);
  }

  function advanceOne(record: MockUploadRecord, now: number): boolean {
    if (record.step >= record.steps || record.status.status !== 'uploading') return false;
    record.step += 1;
    const state = service.mock.state();
    if (record.step >= record.steps) {
      state.timers.get(record.uploadId)?.();
      state.timers.delete(record.uploadId);
      pushStatus(record, { ...record.completed, updatedAt: now });
      return true;
    }
    const total = record.status.bytesTotal ?? 0;
    pushStatus(record, { ...record.status, bytesSent: Math.min(total, Math.ceil((total * record.step) / record.steps)), updatedAt: now });
    return true;
  }

  function scheduleAdvance(uploadId: string, delayMs: number): void {
    const state = service.mock.state();
    state.timers.set(uploadId, scheduler.schedule(delayMs, () => {
      state.timers.delete(uploadId);
      const record = state.uploads.get(uploadId);
      if (record && advanceOne(record, clockNow()) && record.step < record.steps) {
        scheduleAdvance(uploadId, delayMs);
      }
    }));
  }

  const baseReset = service.mock.reset;
  Object.defineProperty(service.mock, 'reset', {
    value: () => {
      for (const cancel of service.mock.state().timers.values()) cancel();
      baseReset();
    },
  });
  Object.defineProperty(service, 'advance', {
    value: (uploadId?: string): boolean => {
      const records = uploadId ? [service.mock.state().uploads.get(uploadId)] : [...service.mock.state().uploads.values()];
      let advanced = false;
      for (const record of records) if (record && advanceOne(record, clockNow())) advanced = true;
      return advanced;
    },
  });
  Object.defineProperty(service, 'failUpload', {
    value: (uploadId: string, reason = 'upload failed'): boolean => {
      const state = service.mock.state();
      const record = state.uploads.get(uploadId);
      if (!record || record.status.status !== 'uploading') return false;
      state.timers.get(uploadId)?.();
      state.timers.delete(uploadId);
      record.step = record.steps;
      pushStatus(record, { ...record.status, ok: false, status: 'failed', error: reason, updatedAt: clockNow() });
      return true;
    },
  });
  return service;
}

/** Registry row for the `upload` domain. */
export const UPLOAD_MOCK_ENTRY: MockDomainEntry = {
  domain: 'upload',
  kind: 'service',
  spec: UPLOAD_SPEC_REF,
  create: (options) => createMockUploadService(options),
};

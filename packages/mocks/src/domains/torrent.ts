/**
 * domains/torrent.ts — Mock NAP-TORRENT service.
 *
 * Spec: naps/NAP-TORRENT.md @ napplet/naps PR #72 head bc99787e3cf0 (draft)
 * Routes: torrent.capabilities, torrent.pickFiles, torrent.add, torrent.status,
 *         torrent.jobs, torrent.files, torrent.selectFiles, torrent.pause,
 *         torrent.resume, torrent.remove, torrent.metadata, torrent.read,
 *         torrent.exportMetainfo, torrent.saveFile, torrent.openFile,
 *         torrent.cancel, torrent.update
 * Pushes: torrent.state, torrent.progress, torrent.error
 * Spec gaps / decisions:
 * - Sources resolve against `LINUX_DISTROS` by v1 info hash (magnet or
 *   `hashes.v1`), by metainfo `name`, or by a `pickFiles` handle. A
 *   syntactically valid hash that is not in the catalog is accepted and ends
 *   `error` / `no-peers` on the first `advance()`. v2-only hash sets are
 *   `unsupported-format` (the catalog is v1).
 * - `advance()` drives the engine: the first step resolves metadata
 *   (`metadata → downloading`), then each step transfers `progressPerStep`
 *   (default 25 %) and pushes `torrent.progress`; completion pushes
 *   `torrent.state` with `complete` or `seeding` per `seedAfterComplete`.
 * - Peers are the catalog `sharedBy` names (the image's own peer plus two
 *   seeded extras); the wire exposes only `TorrentPeerStats` counts.
 * - The catalog `infoHash` is reported as the identity of exported
 *   metainfo; it is a placeholder, not the SHA-1 of the bencoded info dict.
 * - `read` with `waitMs > 0` on an unavailable range stays pending until the
 *   bytes arrive, the wait budget (consumed `stepMs` per step) expires
 *   (`timeout`), or `torrent.cancel` cancels it (`cancelled`).
 * - Window teardown retires `session` jobs, expires file-set handles, and
 *   cancels pending reads; `persistent` jobs stay discoverable. Capability
 *   revocation also ends pending reads with `permission-revoked`.
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockRoute, MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockScheduler, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { LINUX_DISTROS, type LinuxDistroImage } from '../fixtures/linux-distros.js';
import {
  DEFAULT_TRACKER, TORRENT_CAPABILITIES, binaryLength, mockImageBytesBase64, mockMetainfo,
  parseTorrentSource, torrentStatus, torrentSummary,
  type MockTorrentJob, type TorrentJobState, type TorrentMode, type TorrentSettings,
} from './torrent-fixtures.js';

export type { MockTorrentJob, TorrentJobState, TorrentMode, TorrentSettings } from './torrent-fixtures.js';

/**
 * Spec document the mock was written against.
 *
 * @example
 * ```ts
 * TORRENT_SPEC_REF.pr === 72;
 * ```
 */
export const TORRENT_SPEC_REF: NapSpecRef = {
  nap: 'NAP-TORRENT',
  status: 'draft',
  source: 'pr',
  pr: 72,
  sha: 'bc99787e3cf0',
  path: 'naps/NAP-TORRENT.md',
};

/**
 * A read waiting for bytes (`waitMs > 0`).
 *
 * @example
 * ```ts
 * createMockTorrentService().mock.state().pendingReads.get('read-2')?.waitMs;
 * ```
 */
export interface MockTorrentPendingRead {
  requestId: string;
  windowId: string;
  jobId: string;
  fileIndex: number;
  offset: number;
  length: number;
  /** Remaining wait budget in ms. */
  waitMs: number;
}

/**
 * In-memory state of the torrent mock.
 *
 * @example
 * ```ts
 * const state = createMockTorrentService().mock.state();
 * state.jobs.size === 0;
 * ```
 */
export interface MockTorrentState {
  jobs: Map<string, MockTorrentJob>;
  /** `pickFiles` handles: id → owning window and picked image. */
  fileSets: Map<string, { windowId: string; image: LinuxDistroImage }>;
  pendingReads: Map<string, MockTorrentPendingRead>;
  nextJob: number;
  nextFileSet: number;
  /** Catalog cursor for `pickFiles`. */
  nextPick: number;
  tick?: () => void;
}

/**
 * Factory options for the torrent mock.
 *
 * @example
 * ```ts
 * const service = createMockTorrentService({ progressPerStep: 0.5, autoplay: true, tickMs: 100 });
 * ```
 */
export interface MockTorrentOptions extends MockServiceOptions {
  /** Fraction of the file transferred per `advance()` step. Default `0.25`. */
  progressPerStep?: number;
  /** Simulated ms per step (consumes read wait budgets). Default `1000`. */
  stepMs?: number;
  /** Run `advance()` every `tickMs` while a job is active. Default `false`. */
  autoplay?: boolean;
  /** Autoplay interval in ms. Default `stepMs`. */
  tickMs?: number;
}

/**
 * The torrent mock service type.
 *
 * @example
 * ```ts
 * createMockTorrentService().advance(5);
 * ```
 */
export type MockTorrentService = MockService<MockTorrentState> & {
  /**
   * Advance every active job by `steps` engine steps, pushing progress,
   * state changes, and errors to the owning windows.
   *
   * @param steps - Steps to run. Default `1`.
   */
  advance(steps?: number): void;
};

type Ctx = MockRouteContext<MockTorrentState>;
const ACTIVE: readonly TorrentJobState[] = ['metadata', 'downloading', 'seeding'];
const MUTABLE = new Set(TORRENT_CAPABILITIES.mutableSettings);

function isUint(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Shared engine state the module-level helpers operate on. */
interface TorrentEngine {
  service: MockService<MockTorrentState>;
  options: MockTorrentOptions;
  progressPerStep: number;
  stepMs: number;
  scheduler: MockScheduler;
}

const RESULT_ENVELOPE_ROUTES = new Set(['torrent.read', 'torrent.saveFile', 'torrent.openFile', 'torrent.update', 'torrent.metadata', 'torrent.exportMetainfo', 'torrent.remove']);

/** Resolves the caller's job, replying `job-not-found` in the route's error envelope when absent. */
function owned(ctx: Ctx): MockTorrentJob | undefined {
  const jobId = ctx.message.jobId ?? (ctx.message.request as { jobId?: unknown } | undefined)?.jobId;
  const job = typeof jobId === 'string' ? ctx.state.jobs.get(jobId) : undefined;
  if (job && job.windowId === ctx.windowId) return job;
  if (RESULT_ENVELOPE_ROUTES.has(ctx.message.type)) ctx.reply({ result: { ok: false, error: 'job-not-found' } });
  else ctx.reply({ error: 'job-not-found' });
  return undefined;
}

function status(engine: TorrentEngine, job: MockTorrentJob): Record<string, unknown> {
  return torrentStatus(job, engine.progressPerStep);
}

function push(engine: TorrentEngine, job: MockTorrentJob, message: NappletMessage & Record<string, unknown>): void {
  pushToWindow(engine.service, job.windowId, message);
}

function transition(engine: TorrentEngine, job: MockTorrentJob, next: TorrentJobState, error?: string): void {
  job.state = next;
  if (error) { job.error = error; push(engine, job, { type: 'torrent.error', jobId: job.jobId, error }); }
  push(engine, job, { type: 'torrent.state', jobId: job.jobId, state: next, status: status(engine, job) });
}

function files(job: MockTorrentJob): Record<string, unknown>[] {
  if (!job.metadataKnown || !job.image) return [];
  const size = job.image.sizeBytes;
  return [{ index: 0, path: job.image.fileName, size, selected: job.fileSelected, priority: job.priority, downloadedBytes: job.downloadedBytes, progress: Number((job.downloadedBytes / size).toFixed(4)) }];
}

function peersFor(image: LinuxDistroImage | undefined, rng: Ctx['rng']): string[] {
  const pool = LINUX_DISTROS.map((item) => item.sharedBy).filter((name) => name !== image?.sharedBy);
  const names = image ? [image.sharedBy] : [];
  while (names.length < 3 && pool.length > 0) names.push(pool.splice(rng.int(pool.length), 1)[0]!);
  return names;
}

function add(engine: TorrentEngine, ctx: Ctx): void {
  const request = ctx.message.request as Record<string, unknown> | undefined;
  const ack = (error: string): void => ctx.reply({ ack: { ok: false, error } });
  if (!request || typeof request !== 'object') { ack('invalid-request'); return; }
  const parsed = parseTorrentSource(request.source, LINUX_DISTROS);
  if (!parsed.ok) { ack(parsed.error); return; }
  const opts = (request.options && typeof request.options === 'object' ? request.options : {}) as Record<string, unknown>;
  const mode = (opts.mode ?? 'download') as TorrentMode;
  const transport = (opts.transport ?? 'auto') as string;
  const retention = (opts.retention ?? 'session') as MockTorrentJob['retention'];
  if (!TORRENT_CAPABILITIES.modes.includes(mode)) { ack('unsupported-mode'); return; }
  if (!TORRENT_CAPABILITIES.transports.includes(transport)) { ack('unsupported-transport'); return; }
  if (!TORRENT_CAPABILITIES.retentions.includes(retention)) { ack('invalid-request'); return; }
  const seedDefault = mode !== 'download';
  if (opts.seedAfterComplete !== undefined && opts.seedAfterComplete !== seedDefault) { ack('invalid-request'); return; }
  let image = parsed.image;
  if (parsed.runtimeFileSetId !== undefined) {
    const set = ctx.state.fileSets.get(parsed.runtimeFileSetId);
    if (!set || set.windowId !== ctx.windowId) { ack('source-unavailable'); return; }
    if (mode === 'download') { ack('unsupported-mode'); return; }
    if (opts.createFormat !== undefined && !TORRENT_CAPABILITIES.createFormats.includes(opts.createFormat as string)) { ack('unsupported-format'); return; }
    image = set.image;
  }
  const jobId = typeof request.jobId === 'string' && request.jobId !== '' ? request.jobId : `tor-${ctx.state.nextJob++}`;
  if (ctx.state.jobs.has(jobId)) { ack('job-conflict'); return; }
  const seedOrigin = parsed.sourceType === 'runtime-file-set';
  const job: MockTorrentJob = {
    jobId, windowId: ctx.windowId, ...(image ? { image } : {}), ...(parsed.claimedV1 ? { claimedV1: parsed.claimedV1 } : {}),
    mode, seedOrigin, transport: transport === 'auto' ? 'bittorrent' : transport,
    state: seedOrigin ? 'seeding' : 'metadata', retention, ...(typeof opts.storage === 'string' ? { storage: opts.storage } : {}),
    metadataKnown: seedOrigin, downloadedBytes: seedOrigin && image ? image.sizeBytes : 0, uploadedBytes: 0,
    settings: {
      revision: 0,
      downloadLimitBytesPerSecond: isUint(opts.downloadLimitBytesPerSecond) ? opts.downloadLimitBytesPerSecond : 0,
      uploadLimitBytesPerSecond: isUint(opts.uploadLimitBytesPerSecond) ? opts.uploadLimitBytesPerSecond : 0,
      seedAfterComplete: seedDefault,
      trackers: isStringList(opts.trackers) ? [...opts.trackers] : [DEFAULT_TRACKER],
      webSeeds: isStringList(opts.webSeeds) ? [...opts.webSeeds] : (image ? [...image.mirrors] : []),
      endpointsRedacted: false,
    },
    fileSelected: true, priority: 0, peerNames: peersFor(image, ctx.rng),
  };
  if (opts.startPaused === true) { job.resumeState = job.state; job.state = 'paused'; }
  ctx.state.jobs.set(jobId, job);
  armAutoplay(engine, ctx.state);
  ctx.reply({ ack: { ok: true, jobId, state: job.state } });
}

function available(job: MockTorrentJob): number {
  return job.metadataKnown ? job.downloadedBytes : 0;
}

function serveRead(job: MockTorrentJob, offset: number, length: number): Record<string, unknown> {
  const total = job.image!.sizeBytes;
  const count = Math.min(length, total - offset);
  return { ok: true, offset, dataBase64: mockImageBytesBase64(job.image!, offset, count), byteLength: count, totalBytes: total, eof: offset + count === total };
}

function read(ctx: Ctx): void {
  const job = owned(ctx);
  if (!job) return;
  const fail = (error: string): void => ctx.reply({ result: { ok: false, error } });
  const request = ctx.message.request as Record<string, unknown>;
  const { fileIndex, offset, length } = request;
  const waitMs = request.waitMs ?? 0;
  if (!isUint(fileIndex) || !isUint(offset) || !isUint(length) || length === 0 || !isUint(waitMs)) { fail('invalid-request'); return; }
  if (length > TORRENT_CAPABILITIES.maxReadBytes || waitMs > TORRENT_CAPABILITIES.maxReadWaitMs) { fail('invalid-request'); return; }
  if (!job.metadataKnown || !job.image) { fail('metadata-unavailable'); return; }
  if (fileIndex !== 0) { fail('invalid-request'); return; }
  if (offset > job.image.sizeBytes) { fail('invalid-range'); return; }
  if (!job.fileSelected) { fail('file-not-selected'); return; }
  const end = Math.min(offset + length, job.image.sizeBytes);
  if (end <= available(job)) { ctx.reply({ result: serveRead(job, offset, length) }); return; }
  if (waitMs === 0 || job.state === 'paused') { fail('not-ready'); return; }
  const requestId = ctx.message.id;
  if (typeof requestId !== 'string') { fail('invalid-request'); return; }
  if ([...ctx.state.pendingReads.values()].filter((pending) => pending.windowId === ctx.windowId).length >= TORRENT_CAPABILITIES.maxPendingReads) { fail('quota-exceeded'); return; }
  ctx.state.pendingReads.set(requestId, { requestId, windowId: ctx.windowId, jobId: job.jobId, fileIndex, offset, length, waitMs });
}

function endReads(engine: TorrentEngine, state: MockTorrentState, match: (pending: MockTorrentPendingRead) => boolean, error: string): void {
  for (const pending of Array.from(state.pendingReads.values())) {
    if (!match(pending)) continue;
    state.pendingReads.delete(pending.requestId);
    pushToWindow(engine.service, pending.windowId, { type: 'torrent.read.result', id: pending.requestId, result: { ok: false, error } } as NappletMessage);
  }
}

function settlePendingReads(engine: TorrentEngine, state: MockTorrentState): void {
  for (const pending of Array.from(state.pendingReads.values())) {
    const job = state.jobs.get(pending.jobId);
    if (!job || !job.image) { endReads(engine, state, (item) => item.requestId === pending.requestId, 'job-not-found'); continue; }
    const end = Math.min(pending.offset + pending.length, job.image.sizeBytes);
    if (end <= available(job)) {
      state.pendingReads.delete(pending.requestId);
      pushToWindow(engine.service, pending.windowId, { type: 'torrent.read.result', id: pending.requestId, result: serveRead(job, pending.offset, pending.length) } as NappletMessage);
      continue;
    }
    pending.waitMs -= engine.stepMs;
    if (pending.waitMs <= 0) endReads(engine, state, (item) => item.requestId === pending.requestId, 'timeout');
  }
}

function fileAction(ctx: Ctx, outcome: 'saved' | 'accepted'): void {
  const job = owned(ctx);
  if (!job) return;
  const fileIndex = ctx.message.fileIndex;
  if (!isUint(fileIndex) || fileIndex !== 0 || !job.image) { ctx.reply({ result: { ok: false, error: 'invalid-request' } }); return; }
  if (job.downloadedBytes < job.image.sizeBytes) { ctx.reply({ result: { ok: false, error: 'not-ready' } }); return; }
  ctx.reply({ result: { ok: true, jobId: job.jobId, fileIndex, outcome } });
}

function validPatch(patch: Record<string, unknown>): string | undefined {
  if (Object.keys(patch).length === 0) return 'invalid-request';
  if (Object.keys(patch).some((key) => !MUTABLE.has(key))) return 'unsupported-setting';
  const limits = ['downloadLimitBytesPerSecond', 'uploadLimitBytesPerSecond'] as const;
  if (limits.some((key) => patch[key] !== undefined && !isUint(patch[key]))) return 'invalid-request';
  if (patch.seedAfterComplete !== undefined && typeof patch.seedAfterComplete !== 'boolean') return 'invalid-request';
  if ((patch.trackers !== undefined && !isStringList(patch.trackers)) || (patch.webSeeds !== undefined && !isStringList(patch.webSeeds))) return 'invalid-request';
  return undefined;
}

function update(engine: TorrentEngine, ctx: Ctx): void {
  const job = owned(ctx);
  if (!job) return;
  const request = ctx.message.request as Record<string, unknown>;
  const fail = (error: string, extra: Record<string, unknown> = {}): void => ctx.reply({ result: { ok: false, error, ...extra } });
  const patch = request.patch as Record<string, unknown> | undefined;
  if (!isUint(request.expectedRevision) || !patch || typeof patch !== 'object') { fail('invalid-request'); return; }
  const invalid = validPatch(patch);
  if (invalid) { fail(invalid); return; }
  if (request.expectedRevision !== job.settings.revision) { fail('revision-conflict', { settings: { ...job.settings } }); return; }
  if (patch.seedAfterComplete !== undefined && job.seedOrigin) { fail('unsupported-state'); return; }
  const next: TorrentSettings = { ...job.settings, ...(patch as Partial<TorrentSettings>), revision: job.settings.revision };
  const changed = JSON.stringify({ ...next, revision: 0 }) !== JSON.stringify({ ...job.settings, revision: 0 });
  if (changed) {
    next.revision += 1;
    job.settings = next;
    if (patch.seedAfterComplete !== undefined) applySeedChange(engine, job, patch.seedAfterComplete as boolean);
  }
  ctx.reply({ result: { ok: true, settings: { ...job.settings } } });
}

function applySeedChange(engine: TorrentEngine, job: MockTorrentJob, seed: boolean): void {
  job.mode = seed ? 'download-and-seed' : 'download';
  if (!seed && job.state === 'seeding') transition(engine, job, 'complete');
  else if (seed && job.state === 'complete') transition(engine, job, 'seeding');
}

function stepJob(engine: TorrentEngine, job: MockTorrentJob): void {
  if (!ACTIVE.includes(job.state)) return;
  if (job.state === 'metadata') {
    if (!job.image) { transition(engine, job, 'error', 'no-peers'); return; }
    job.metadataKnown = true;
    transition(engine, job, 'downloading');
    return;
  }
  const size = job.image!.sizeBytes;
  const slice = Math.round(size * engine.progressPerStep);
  if (job.state === 'downloading') {
    job.downloadedBytes = Math.min(size, job.downloadedBytes + slice);
    if (job.mode === 'download-and-seed') job.uploadedBytes += Math.round(slice / 10);
    if (job.downloadedBytes >= size) {
      transition(engine, job, job.settings.seedAfterComplete ? 'seeding' : 'complete');
      return;
    }
  } else {
    job.uploadedBytes += Math.round(slice / 10);
  }
  push(engine, job, { type: 'torrent.progress', jobId: job.jobId, status: status(engine, job) });
}

function hasActiveJobs(state: MockTorrentState): boolean {
  return [...state.jobs.values()].some((job) => job.state === 'metadata' || job.state === 'downloading');
}

function armAutoplay(engine: TorrentEngine, state: MockTorrentState): void {
  if (!engine.options.autoplay || state.tick || !hasActiveJobs(state)) return;
  state.tick = engine.scheduler.schedule(engine.options.tickMs ?? engine.stepMs, () => { state.tick = undefined; advance(engine, 1); });
}

function advance(engine: TorrentEngine, steps: number): void {
  const state = engine.service.mock.state();
  for (let index = 0; index < steps; index += 1) {
    for (const job of Array.from(state.jobs.values())) stepJob(engine, job);
    settlePendingReads(engine, state);
  }
  armAutoplay(engine, state);
}

function selectFilesRoute(engine: TorrentEngine, ctx: Ctx): void {
  const job = owned(ctx);
  if (!job) return;
  if (job.seedOrigin) { ctx.reply({ error: 'unsupported-state' }); return; }
  const selection = ctx.message.selection as Record<string, unknown> | undefined;
  if (!selection || typeof selection !== 'object') { ctx.reply({ error: 'invalid-request' }); return; }
  const indexes = selection.indexes;
  const paths = selection.paths;
  if (indexes !== undefined && !(Array.isArray(indexes) && indexes.every((index) => index === 0))) { ctx.reply({ error: 'invalid-request' }); return; }
  if (paths !== undefined && !(isStringList(paths) && paths.every((path) => path === job.image?.fileName))) { ctx.reply({ error: 'invalid-request' }); return; }
  if (indexes !== undefined || paths !== undefined) job.fileSelected = (indexes?.length ?? 0) > 0 || (paths?.length ?? 0) > 0;
  if (typeof selection.priority === 'number') job.priority = selection.priority;
  ctx.reply({ status: status(engine, job) });
}

function torrentRoutes(engine: TorrentEngine): Record<string, MockRoute<MockTorrentState>> {
  return {
    'torrent.capabilities': ({ reply }) => reply({ capabilities: { ...TORRENT_CAPABILITIES } }),
    'torrent.pickFiles': ({ state, windowId, reply }) => {
      const image = LINUX_DISTROS[state.nextPick % LINUX_DISTROS.length]!;
      state.nextPick += 1;
      const runtimeFileSetId = `fs-${state.nextFileSet++}`;
      state.fileSets.set(runtimeFileSetId, { windowId, image });
      reply({ result: { ok: true, fileSet: { runtimeFileSetId, files: [{ path: image.fileName, size: image.sizeBytes }], totalBytes: image.sizeBytes, displayName: `${image.distro} ${image.version}` } } });
    },
    'torrent.add': (ctx) => add(engine, ctx),
    'torrent.status': (ctx) => { const job = owned(ctx); if (job) ctx.reply({ status: status(engine, job) }); },
    'torrent.jobs': ({ state, windowId, message, reply }) => {
      const filter = (message.filter ?? {}) as Record<string, unknown>;
      const states = isStringList(filter.states) ? filter.states : undefined;
      const modes = isStringList(filter.modes) ? filter.modes : undefined;
      const jobs = [...state.jobs.values()]
        .filter((job) => job.windowId === windowId && (!states || states.includes(job.state)) && (!modes || modes.includes(job.mode)))
        .map((job) => torrentSummary(job, engine.progressPerStep));
      reply({ jobs });
    },
    'torrent.files': (ctx) => { const job = owned(ctx); if (job) ctx.reply({ files: files(job) }); },
    'torrent.selectFiles': (ctx) => selectFilesRoute(engine, ctx),
    'torrent.pause': (ctx) => {
      const job = owned(ctx);
      if (!job) return;
      if (!ACTIVE.includes(job.state) && job.state !== 'queued') { ctx.reply({ error: 'unsupported-state' }); return; }
      job.resumeState = job.state;
      transition(engine, job, 'paused');
      ctx.reply({ status: status(engine, job) });
    },
    'torrent.resume': (ctx) => {
      const job = owned(ctx);
      if (!job) return;
      if (job.state === 'paused') {
        const next = job.resumeState === 'seeding' && !job.settings.seedAfterComplete ? 'complete' : (job.resumeState ?? 'downloading');
        delete job.resumeState;
        transition(engine, job, next);
        armAutoplay(engine, ctx.state);
      }
      ctx.reply({ status: status(engine, job) });
    },
    'torrent.remove': (ctx) => {
      const job = owned(ctx);
      if (!job) return;
      const deleteData = (ctx.message.options as { deleteData?: unknown } | undefined)?.deleteData === true;
      endReads(engine, ctx.state, (pending) => pending.jobId === job.jobId, 'job-not-found');
      ctx.state.jobs.delete(job.jobId);
      ctx.reply({ result: { ok: true, jobId: job.jobId, ...(deleteData ? { deletedData: true } : {}) } });
    },
    'torrent.metadata': (ctx) => {
      const job = owned(ctx);
      if (!job) return;
      if (!job.metadataKnown || !job.image) { ctx.reply({ result: { ok: false, error: 'metadata-unavailable' } }); return; }
      ctx.reply({ result: { ok: true, format: 'v1', hashes: { v1: job.image.infoHash }, name: job.image.fileName, private: false, magnet: `magnet:?xt=urn:btih:${job.image.infoHash}&dn=${encodeURIComponent(job.image.fileName)}`, trackers: [...job.settings.trackers], webSeeds: [...job.settings.webSeeds], endpointsRedacted: false, metainfoReady: true } });
    },
    'torrent.read': read,
    'torrent.exportMetainfo': (ctx) => {
      const job = owned(ctx);
      if (!job) return;
      if (!job.metadataKnown || !job.image) { ctx.reply({ result: { ok: false, error: 'metadata-unavailable' } }); return; }
      const binary = mockMetainfo(job.image, job.settings.trackers);
      ctx.reply({ result: { ok: true, dataBase64: btoa(binary), byteLength: binaryLength(binary), hashes: { v1: job.image.infoHash } } });
    },
    'torrent.saveFile': (ctx) => fileAction(ctx, 'saved'),
    'torrent.openFile': (ctx) => fileAction(ctx, 'accepted'),
    'torrent.cancel': (ctx) => {
      const requestId = ctx.message.requestId;
      const pending = typeof requestId === 'string' ? ctx.state.pendingReads.get(requestId) : undefined;
      if (!pending || pending.windowId !== ctx.windowId) { ctx.reply({ result: { ok: true, cancelled: false } }); return; }
      endReads(engine, ctx.state, (item) => item.requestId === requestId, 'cancelled');
      ctx.reply({ result: { ok: true, cancelled: true } });
    },
    'torrent.update': (ctx) => update(engine, ctx),
  };
}

/**
 * Create the NAP-TORRENT mock.
 *
 * @param options - Engine pacing options.
 * @returns The mock service with an `advance()` control.
 * @example
 * ```ts
 * const torrent = createMockTorrentService();
 * const source = { sourceType: 'magnet', magnet: LINUX_DISTROS[0].magnet };
 * torrent.handleMessage('win', { type: 'torrent.add', id: 'a1', request: { source } }, console.log);
 * torrent.advance(5); // metadata, four progress pushes, then complete
 * ```
 */
export function createMockTorrentService(options: MockTorrentOptions = {}): MockTorrentService {
  const engine: TorrentEngine = {
    // Routes only read `engine.service` after the factory returns.
    get service() { return service; },
    options,
    progressPerStep: options.progressPerStep ?? 0.25,
    stepMs: options.stepMs ?? 1000,
    scheduler: options.scheduler ?? DEFAULT_SCHEDULER,
  };
  const service = defineMockService<MockTorrentState>({
    domain: 'torrent',
    version: '0.1.0',
    description: 'Mock NAP-TORRENT runtime-mediated transfers of Linux images',
    kind: 'extension',
    initialState: () => ({ jobs: new Map(), fileSets: new Map(), pendingReads: new Map(), nextJob: 1, nextFileSet: 1, nextPick: 0 }),
    routes: torrentRoutes(engine),
    onWindowDestroyed: (windowId, state) => {
      endReads(engine, state, (pending) => pending.windowId === windowId, 'cancelled');
      for (const [id, set] of state.fileSets) if (set.windowId === windowId) state.fileSets.delete(id);
      for (const job of state.jobs.values()) if (job.windowId === windowId && job.retention === 'session') state.jobs.delete(job.jobId);
    },
    onCapabilityRevoked: (windowId, _capability, state) => {
      endReads(engine, state, (pending) => pending.windowId === windowId, 'permission-revoked');
      for (const job of state.jobs.values()) if (job.windowId === windowId && ACTIVE.includes(job.state)) { job.resumeState = job.state; job.state = 'paused'; }
    },
  }, options);

  const baseReset = service.mock.reset;
  service.mock.reset = () => { service.mock.state().tick?.(); baseReset(); };

  return Object.assign(service, { advance: (steps = 1) => advance(engine, steps) });
}

/**
 * Registry row for NAP-TORRENT.
 *
 * @example
 * ```ts
 * TORRENT_MOCK_ENTRY.create?.({ seed: 1 });
 * ```
 */
export const TORRENT_MOCK_ENTRY: MockDomainEntry = {
  domain: 'torrent',
  kind: 'extension',
  spec: TORRENT_SPEC_REF,
  create: (options) => createMockTorrentService(options),
};

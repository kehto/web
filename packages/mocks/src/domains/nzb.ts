/**
 * domains/nzb.ts — Mock NAP-NZB service.
 *
 * Spec: naps/NAP-NZB.md @ napplet/naps PR #136 head 3a426fe433d4 (draft)
 * Routes: nzb.downloaders, nzb.add, nzb.jobs, nzb.status, nzb.control,
 *         nzb.files, nzb.read
 * Spec gaps / decisions:
 * - Results carry exactly one of `result` or `error: { code, message,
 *   replayUntil? }`, so routes build envelopes with `push`.
 * - Two downloaders: `native` (file reads, all actions) and `remote`
 *   (control-only: pause/resume/forget, no file access), mirroring the NAP
 *   example. The available NZBs are the catalog images; `mockNzbDocument`
 *   builds an NZB whose segment article id is the image's `nzbId`, and a
 *   URL source is `https://indexer.example.org/nzb/<image id>.nzb`. A valid
 *   NZB that names no catalog article is `backend_rejected`.
 * - The NAP defines no unsolicited messages; jobs move only on `advance()`:
 *   queued → downloading (25 % per step) → processing (repair, extract) →
 *   completed. Paused jobs hold.
 * - Jobs and replay records belong to the runtime, not the endpoint: window
 *   teardown leaves them intact (a reopened window with the same id sees
 *   them); other windows get `not_found`.
 * - `delete` needs a deletion grant: `deleteAuthorized` (default `true`).
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_SCHEDULER, defineMockService, resultType } from '../core/handler.js';
import type { MockRoute, MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockScheduler, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { LINUX_DISTROS, type LinuxDistroImage } from '../fixtures/linux-distros.js';
import { decodeBase64, mockImageBytesBase64 } from './torrent-fixtures.js';

/**
 * Spec document the mock was written against.
 *
 * @example
 * ```ts
 * NZB_SPEC_REF.pr === 136;
 * ```
 */
export const NZB_SPEC_REF: NapSpecRef = {
  nap: 'NAP-NZB',
  status: 'draft',
  source: 'pr',
  pr: 136,
  sha: '3a426fe433d4',
  path: 'naps/NAP-NZB.md',
};

/**
 * `JobState` values.
 *
 * @example
 * ```ts
 * const state: NzbJobState = 'processing';
 * ```
 */
export type NzbJobState = 'queued' | 'downloading' | 'paused' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'skipped' | 'unknown';
/**
 * `JobAction` values.
 *
 * @example
 * ```ts
 * const action: NzbJobAction = 'retry';
 * ```
 */
export type NzbJobAction = 'pause' | 'resume' | 'cancel' | 'retry' | 'forget' | 'delete';

/**
 * `Downloader` discovery row.
 *
 * @example
 * ```ts
 * NZB_DOWNLOADERS[0].downloaderId === 'native';
 * ```
 */
export interface NzbDownloader {
  downloaderId: string;
  label: string;
  canAdd: boolean;
  sourceKinds: Array<'bytes' | 'url'>;
  addOptions: Array<'categoryId' | 'priority' | 'startPaused' | 'password'>;
  categories: Array<{ categoryId: string; label: string; description: string }>;
  actions: NzbJobAction[];
  canReadFiles: boolean;
  maxNZBBytes: number;
  maxPageSize: number;
  maxReadBytes: number;
  replaySeconds: number;
}

/**
 * One tracked job with its mock bookkeeping.
 *
 * @example
 * ```ts
 * const job = createMockNzbService().mock.state().jobs.get('job-1');
 * ```
 */
export interface MockNzbJob {
  jobId: string;
  downloaderId: string;
  windowId: string;
  name: string;
  state: NzbJobState;
  categoryId?: string;
  downloadPaused: boolean;
  /** 0..1 transfer progress. */
  progress: number;
  /** Processing stage index once downloading finished. */
  stage: number;
  image: LinuxDistroImage;
  /** Whether the record was forgotten (hidden from listing and lookup). */
  forgotten: boolean;
}

/**
 * A retained mutation record.
 *
 * @example
 * ```ts
 * createMockNzbService().mock.state().replay.get('win:native:submit-1')?.replayUntil;
 * ```
 */
export interface NzbReplayRecord {
  params: string;
  outcome: Record<string, unknown>;
  replayUntil: number;
}

/**
 * In-memory state of the nzb mock.
 *
 * @example
 * ```ts
 * const state = createMockNzbService().mock.state();
 * state.jobs.size === 0;
 * ```
 */
export interface MockNzbState {
  jobs: Map<string, MockNzbJob>;
  /** Replay records keyed `${windowId}:${downloaderId}:${operationKey}`. */
  replay: Map<string, NzbReplayRecord>;
  nextJob: number;
  tick?: () => void;
}

/**
 * Factory options for the nzb mock.
 *
 * @example
 * ```ts
 * const service = createMockNzbService({ deleteAuthorized: false });
 * ```
 */
export interface MockNzbOptions extends MockServiceOptions {
  /** Whether `delete` is granted. Default `true`. */
  deleteAuthorized?: boolean;
  /** Run `advance()` every `tickMs` while jobs are active. Default `false`. */
  autoplay?: boolean;
  /** Autoplay interval in ms. Default `250`. */
  tickMs?: number;
}

/**
 * The nzb mock service type.
 *
 * @example
 * ```ts
 * createMockNzbService().advance(8);
 * ```
 */
export type MockNzbService = MockService<MockNzbState> & {
  /**
   * Move active jobs forward.
   *
   * @param steps - Steps to run. Default `1`.
   */
  advance(steps?: number): void;
};

const ISO_CATEGORY = { categoryId: 'iso', label: 'ISO images', description: 'Verified and moved to the ISO library' };
const DEFAULT_CATEGORY = { categoryId: 'default', label: 'Default', description: 'Configured default destination' };

/**
 * Downloaders the mock advertises.
 *
 * @example
 * ```ts
 * NZB_DOWNLOADERS.map((row) => row.downloaderId); // ['native', 'remote']
 * ```
 */
export const NZB_DOWNLOADERS: readonly NzbDownloader[] = Object.freeze([
  { downloaderId: 'native', label: 'Local downloads', canAdd: true, sourceKinds: ['bytes', 'url'], addOptions: ['categoryId', 'priority', 'startPaused', 'password'], categories: [DEFAULT_CATEGORY, ISO_CATEGORY], actions: ['pause', 'resume', 'cancel', 'retry', 'forget', 'delete'], canReadFiles: true, maxNZBBytes: 1048576, maxPageSize: 100, maxReadBytes: 65536, replaySeconds: 86400 },
  { downloaderId: 'remote', label: 'Home downloader', canAdd: true, sourceKinds: ['bytes'], addOptions: [], categories: [], actions: ['pause', 'resume', 'forget'], canReadFiles: false, maxNZBBytes: 1048576, maxPageSize: 100, maxReadBytes: 0, replaySeconds: 86400 },
]);

const NZB_NAMESPACE = 'http://www.newzbin.com/DTD/2003/nzb';
const STAGES = ['Repairing', 'Extracting'];
const TERMINAL: readonly NzbJobState[] = ['completed', 'failed', 'cancelled', 'skipped'];

/**
 * NZB XML document for a catalog image; its only segment is the image's `nzbId`.
 *
 * @param image - Catalog image.
 * @returns NZB XML text.
 * @example
 * ```ts
 * mockNzbDocument(LINUX_DISTROS[0]).includes(LINUX_DISTROS[0].nzbId);
 * ```
 */
export function mockNzbDocument(image: LinuxDistroImage): string {
  return `<?xml version="1.0" encoding="UTF-8"?><nzb xmlns="${NZB_NAMESPACE}"><file poster="mirror@example.org" date="1700000000" subject="${image.fileName}"><groups><group>alt.binaries.linux</group></groups><segments><segment bytes="${image.sizeBytes}" number="1">${image.nzbId}</segment></segments></file></nzb>`;
}

/**
 * HTTPS URL source for a catalog image's NZB.
 *
 * @param image - Catalog image.
 * @returns Absolute URL.
 * @example
 * ```ts
 * mockNzbUrl(LINUX_DISTROS[0]) === 'https://indexer.example.org/nzb/debian-12-netinst.nzb';
 * ```
 */
export function mockNzbUrl(image: LinuxDistroImage): string {
  return `https://indexer.example.org/nzb/${image.id}.nzb`;
}

type Ctx = MockRouteContext<MockNzbState>;

function ok(ctx: Ctx, result: unknown): void {
  ctx.push({ type: resultType(ctx.message.type), id: ctx.message.id, result } as NappletMessage);
}

function err(ctx: Ctx, code: string, message: string, replayUntil?: number): void {
  ctx.push({ type: resultType(ctx.message.type), id: ctx.message.id, error: { code, message, ...(replayUntil !== undefined ? { replayUntil } : {}) } } as NappletMessage);
}

function hasUnknownKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(record).some((key) => !allowed.includes(key));
}

function isPosInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function requestOf(ctx: Ctx, allowed: readonly string[]): Record<string, unknown> | undefined {
  const request = ctx.message.request;
  if (!request || typeof request !== 'object' || hasUnknownKeys(request as Record<string, unknown>, allowed)) {
    err(ctx, 'invalid_request', 'request has an invalid shape or unknown fields');
    return undefined;
  }
  return request as Record<string, unknown>;
}

function resolveSource(downloader: NzbDownloader, source: unknown): LinuxDistroImage | 'invalid' | 'unsupported' | 'unknown' {
  if (!source || typeof source !== 'object') return 'invalid';
  const { kind, dataBase64, url, ...rest } = source as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || (kind !== 'bytes' && kind !== 'url')) return 'invalid';
  if (!downloader.sourceKinds.includes(kind)) return 'unsupported';
  if (kind === 'url') {
    if (typeof url !== 'string' || dataBase64 !== undefined || !/^https:\/\/[^@#]+$/.test(url)) return 'invalid';
    return LINUX_DISTROS.find((image) => mockNzbUrl(image) === url) ?? 'unknown';
  }
  if (typeof dataBase64 !== 'string' || url !== undefined) return 'invalid';
  const bytes = decodeBase64(dataBase64);
  if (!bytes) return 'invalid';
  const xml = new TextDecoder().decode(bytes);
  if (!xml.includes(`<nzb xmlns="${NZB_NAMESPACE}"`) || !xml.includes('<segment')) return 'invalid';
  return LINUX_DISTROS.find((image) => xml.includes(image.nzbId)) ?? 'unknown';
}

/** Shared engine state the module-level helpers operate on. */
interface NzbEngine {
  service: MockService<MockNzbState>;
  options: MockNzbOptions;
  scheduler: MockScheduler;
  deleteAuthorized: boolean;
}

/** Resolves the caller's job, replying `not_found` when missing, foreign, or forgotten. */
function owned(ctx: Ctx, jobId: unknown): MockNzbJob | undefined {
  const job = typeof jobId === 'string' ? ctx.state.jobs.get(jobId) : undefined;
  if (job && job.windowId === ctx.windowId && !job.forgotten) return job;
  err(ctx, 'not_found', 'Unknown job');
  return undefined;
}

function downloaderOf(job: MockNzbJob): NzbDownloader {
  return NZB_DOWNLOADERS.find((row) => row.downloaderId === job.downloaderId)!;
}

function readable(ctx: Ctx, job: MockNzbJob): boolean {
  if (!downloaderOf(job).canReadFiles) { err(ctx, 'unsupported', 'Completed output is not exposed by this adapter'); return false; }
  if (job.state === 'completed') return true;
  if (TERMINAL.includes(job.state)) err(ctx, 'not_found', 'Job produced no output');
  else err(ctx, 'not_ready', 'Job output is still being produced');
  return false;
}

function page<T>(ctx: Ctx, ids: string[], request: Record<string, unknown>, maxPageSize: number, load: (id: string) => T, field: 'jobs' | 'files'): void {
  const { after, limit } = request;
  if ((after !== undefined && typeof after !== 'string') || (limit !== undefined && !isPosInt(limit))) { err(ctx, 'invalid_request', 'after must be text and limit positive'); return; }
  if (limit !== undefined && limit > maxPageSize) { err(ctx, 'limit_exceeded', `limit exceeds maxPageSize (${maxPageSize})`); return; }
  const size = limit ?? Math.min(100, maxPageSize);
  const start = after === undefined ? 0 : ids.filter((id) => id <= after).length;
  const slice = ids.slice(start, start + size);
  const next = start + slice.length < ids.length && slice.length > 0 ? slice[slice.length - 1]! : null;
  ok(ctx, { [field]: slice.map(load), next });
}

function replayKey(ctx: Ctx, downloaderId: string, operationKey: string): string {
  return `${ctx.windowId}:${downloaderId}:${operationKey}`;
}

/** Returns `true` when a recorded outcome was replayed (or a conflict reported). */
function replayed(ctx: Ctx, key: string, params: string): boolean {
  const record = ctx.state.replay.get(key);
  if (!record) return false;
  if (record.params !== params) { err(ctx, 'conflict', 'Operation key reused with different parameters', record.replayUntil); return true; }
  ctx.push({ type: resultType(ctx.message.type), id: ctx.message.id, ...record.outcome } as NappletMessage);
  return true;
}

function record(ctx: Ctx, key: string, params: string, outcome: Record<string, unknown>, replaySeconds: number): void {
  ctx.state.replay.set(key, { params, outcome, replayUntil: Math.floor(ctx.clock.now() / 1000) + replaySeconds });
}

function validateAdd(ctx: Ctx, downloader: NzbDownloader, request: Record<string, unknown>): boolean {
  if (typeof request.operationKey !== 'string' || request.operationKey === '') { err(ctx, 'invalid_request', 'operationKey must be nonempty text'); return false; }
  if (!downloader.canAdd) { err(ctx, 'unsupported', 'Downloader cannot submit jobs'); return false; }
  for (const option of ['categoryId', 'priority', 'startPaused', 'password'] as const) {
    if (request[option] !== undefined && !downloader.addOptions.includes(option)) { err(ctx, 'unsupported', `Downloader does not honor ${option}`); return false; }
  }
  if (request.name !== undefined && (typeof request.name !== 'string' || request.name === '')) { err(ctx, 'invalid_request', 'name must be nonempty text'); return false; }
  if (request.priority !== undefined && !['low', 'normal', 'high'].includes(request.priority as string)) { err(ctx, 'invalid_request', 'priority must be low, normal, or high'); return false; }
  if (request.startPaused !== undefined && typeof request.startPaused !== 'boolean') { err(ctx, 'invalid_request', 'startPaused must be boolean'); return false; }
  if (request.categoryId !== undefined && !downloader.categories.some((category) => category.categoryId === request.categoryId)) { err(ctx, 'not_found', 'Unknown category'); return false; }
  return true;
}

function add(engine: NzbEngine, ctx: Ctx): void {
  const request = requestOf(ctx, ['downloaderId', 'operationKey', 'source', 'name', 'categoryId', 'priority', 'startPaused', 'password']);
  if (!request) return;
  const downloader = NZB_DOWNLOADERS.find((row) => row.downloaderId === request.downloaderId);
  if (!downloader) { err(ctx, 'not_found', 'Unknown downloader'); return; }
  if (!validateAdd(ctx, downloader, request)) return;
  const image = resolveSource(downloader, request.source);
  if (image === 'invalid') { err(ctx, 'invalid_request', 'source is not a valid NZB'); return; }
  if (image === 'unsupported') { err(ctx, 'unsupported', 'Downloader does not accept this source kind'); return; }
  const key = replayKey(ctx, downloader.downloaderId, request.operationKey as string);
  const { password: _secret, ...recorded } = request;
  const params = JSON.stringify({ op: 'add', ...recorded, hasPassword: request.password !== undefined });
  if (replayed(ctx, key, params)) return;
  const replayUntil = Math.floor(ctx.clock.now() / 1000) + downloader.replaySeconds;
  if (image === 'unknown') {
    record(ctx, key, params, { error: { code: 'backend_rejected', message: 'No such articles on the news server', replayUntil } }, downloader.replaySeconds);
    err(ctx, 'backend_rejected', 'No such articles on the news server', replayUntil);
    return;
  }
  const jobId = `job-${ctx.state.nextJob++}`;
  const job: MockNzbJob = {
    jobId, downloaderId: downloader.downloaderId, windowId: ctx.windowId,
    name: typeof request.name === 'string' ? request.name : image.fileName,
    state: request.startPaused === true ? 'paused' : 'queued',
    ...(typeof request.categoryId === 'string' ? { categoryId: request.categoryId } : {}),
    downloadPaused: request.startPaused === true, progress: 0, stage: 0, image, forgotten: false,
  };
  ctx.state.jobs.set(jobId, job);
  armAutoplay(engine, ctx.state);
  const result = { job: observe(job, ctx.clock.now()), replayUntil };
  record(ctx, key, params, { result }, downloader.replaySeconds);
  ok(ctx, result);
}

function control(engine: NzbEngine, ctx: Ctx): void {
  const request = requestOf(ctx, ['jobId', 'operationKey', 'action']);
  if (!request) return;
  const action = request.action as NzbJobAction;
  if (!['pause', 'resume', 'cancel', 'retry', 'forget', 'delete'].includes(action)) { err(ctx, 'invalid_request', 'action is not a JobAction'); return; }
  if (typeof request.operationKey !== 'string' || request.operationKey === '') { err(ctx, 'invalid_request', 'operationKey must be nonempty text'); return; }
  const job = owned(ctx, request.jobId);
  if (!job) return;
  const downloader = downloaderOf(job);
  if (!downloader.actions.includes(action)) { err(ctx, 'unsupported', `Downloader does not implement ${action}`); return; }
  if (action === 'delete' && !engine.deleteAuthorized) { err(ctx, 'permission_denied', 'Deleting download data is not authorized'); return; }
  const key = replayKey(ctx, downloader.downloaderId, request.operationKey);
  const params = JSON.stringify({ op: 'control', jobId: job.jobId, action });
  if (replayed(ctx, key, params)) return;
  if (!applicable(job, action)) { err(ctx, 'invalid_state', `${action} is not applicable while ${job.state}`); return; }
  apply(job, action);
  const replayUntil = Math.floor(ctx.clock.now() / 1000) + downloader.replaySeconds;
  const withJob = action === 'pause' || action === 'resume' || action === 'cancel' || action === 'retry';
  const result = { jobId: job.jobId, action, ...(withJob ? { job: observe(job, ctx.clock.now()) } : {}), replayUntil };
  record(ctx, key, params, { result }, downloader.replaySeconds);
  armAutoplay(engine, ctx.state);
  ok(ctx, result);
}

function applicable(job: MockNzbJob, action: NzbJobAction): boolean {
  const terminal = TERMINAL.includes(job.state);
  if (action === 'pause' || action === 'resume') return job.state === 'queued' || job.state === 'downloading' || job.state === 'paused';
  if (action === 'cancel') return !terminal && job.state !== 'unknown';
  if (action === 'retry') return job.state === 'failed' || job.state === 'cancelled';
  return terminal;
}

function apply(job: MockNzbJob, action: NzbJobAction): void {
  switch (action) {
    case 'pause': job.downloadPaused = true; if (job.state === 'queued' || job.state === 'downloading') job.state = 'paused'; break;
    case 'resume': job.downloadPaused = false; if (job.state === 'paused') job.state = job.progress > 0 ? 'downloading' : 'queued'; break;
    case 'cancel': job.state = 'cancelled'; break;
    case 'retry': job.state = 'queued'; job.progress = 0; job.stage = 0; job.downloadPaused = false; break;
    default: job.forgotten = true;
  }
}

function actionsFor(job: MockNzbJob, downloader: NzbDownloader): NzbJobAction[] {
  return downloader.actions.filter((action) => applicable(job, action) && !(action === 'pause' && job.downloadPaused) && !(action === 'resume' && !job.downloadPaused));
}

function observe(job: MockNzbJob, nowMs: number): Record<string, unknown> {
  const downloader = downloaderOf(job);
  const active = job.state === 'downloading';
  const actions = actionsFor(job, downloader);
  return {
    jobId: job.jobId, downloaderId: job.downloaderId, name: job.name, state: job.state,
    observedAt: Math.floor(nowMs / 1000), actions,
    canReadFiles: job.state === 'completed' && downloader.canReadFiles,
    ...(job.categoryId !== undefined ? { categoryId: job.categoryId } : {}),
    ...(actions.includes('pause') || actions.includes('resume') ? { downloadPaused: job.downloadPaused } : {}),
    ...(job.progress > 0 || active ? { downloadProgress: job.progress, downloadedBytes: Math.round(job.image.sizeBytes * job.progress), totalBytes: job.image.sizeBytes } : {}),
    ...(active && !job.downloadPaused ? { downloadRate: Math.round(job.image.sizeBytes / 4) } : {}),
    ...(job.state === 'processing' ? { stage: STAGES[job.stage] } : {}),
  };
}

interface NzbOutputFile { fileId: string; name: string; byteLength: number; mediaType: string; text?: string }

function outputFiles(job: MockNzbJob): NzbOutputFile[] {
  const sums = `${job.image.sha256}  ${job.image.fileName}\n`;
  return [
    { fileId: `${job.jobId}.f1`, name: job.image.fileName, byteLength: job.image.sizeBytes, mediaType: 'application/x-iso9660-image' },
    { fileId: `${job.jobId}.f2`, name: 'SHA256SUMS', byteLength: sums.length, mediaType: 'text/plain', text: sums },
  ];
}

function filesRoute(ctx: Ctx): void {
  const request = requestOf(ctx, ['jobId', 'after', 'limit']);
  if (!request) return;
  const job = owned(ctx, request.jobId);
  if (!job || !readable(ctx, job)) return;
  const files = outputFiles(job);
  page(ctx, files.map((file) => file.fileId), request, downloaderOf(job).maxPageSize, (fileId) => {
    const { text: _text, ...file } = files.find((row) => row.fileId === fileId)!;
    return file;
  }, 'files');
}

function readRoute(ctx: Ctx): void {
  const request = requestOf(ctx, ['jobId', 'fileId', 'offset', 'length']);
  if (!request) return;
  const job = owned(ctx, request.jobId);
  if (!job || !readable(ctx, job)) return;
  const { offset, length } = request;
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 || !isPosInt(length)) { err(ctx, 'invalid_request', 'offset must be a nonnegative integer and length positive'); return; }
  const downloader = downloaderOf(job);
  if (length > downloader.maxReadBytes) { err(ctx, 'limit_exceeded', `length exceeds maxReadBytes (${downloader.maxReadBytes})`); return; }
  const file = outputFiles(job).find((row) => row.fileId === request.fileId);
  if (!file) { err(ctx, 'not_found', 'Unknown file handle'); return; }
  if (offset > file.byteLength) { err(ctx, 'invalid_range', 'offset exceeds the output size'); return; }
  const count = Math.min(length, file.byteLength - offset);
  const dataBase64 = file.text !== undefined ? btoa(file.text.slice(offset, offset + count)) : mockImageBytesBase64(job.image, offset, count);
  ok(ctx, { dataBase64, byteLength: count, eof: offset + count === file.byteLength });
}

function stepJob(job: MockNzbJob): void {
  if (job.downloadPaused && job.state !== 'processing') return;
  if (job.state === 'queued') { job.state = 'downloading'; return; }
  if (job.state === 'downloading') {
    job.progress = Math.min(1, job.progress + 0.25);
    if (job.progress >= 1) job.state = 'processing';
    return;
  }
  if (job.state === 'processing') {
    job.stage += 1;
    if (job.stage >= STAGES.length) job.state = 'completed';
  }
}

function hasActiveJobs(state: MockNzbState): boolean {
  return [...state.jobs.values()].some((job) => !TERMINAL.includes(job.state) && !(job.downloadPaused && job.state !== 'processing'));
}

function armAutoplay(engine: NzbEngine, state: MockNzbState): void {
  if (!engine.options.autoplay || state.tick || !hasActiveJobs(state)) return;
  state.tick = engine.scheduler.schedule(engine.options.tickMs ?? 250, () => { state.tick = undefined; advance(engine, 1); });
}

function advance(engine: NzbEngine, steps: number): void {
  const state = engine.service.mock.state();
  for (let index = 0; index < steps; index += 1) for (const job of state.jobs.values()) stepJob(job);
  armAutoplay(engine, state);
}

function nzbRoutes(engine: NzbEngine): Record<string, MockRoute<MockNzbState>> {
  return {
    'nzb.downloaders': (ctx) => ok(ctx, { downloaders: NZB_DOWNLOADERS.map((row) => ({ ...row })) }),
    'nzb.add': (ctx) => add(engine, ctx),
    'nzb.jobs': (ctx) => {
      const request = requestOf(ctx, ['downloaderId', 'after', 'limit']);
      if (!request) return;
      const downloader = NZB_DOWNLOADERS.find((row) => row.downloaderId === request.downloaderId);
      if (!downloader) { err(ctx, 'not_found', 'Unknown downloader'); return; }
      const visible = [...ctx.state.jobs.values()].filter((job) => job.windowId === ctx.windowId && job.downloaderId === downloader.downloaderId && !job.forgotten).map((job) => job.jobId).sort();
      page(ctx, visible, request, downloader.maxPageSize, (jobId) => observe(ctx.state.jobs.get(jobId)!, ctx.clock.now()), 'jobs');
    },
    'nzb.status': (ctx) => {
      const job = owned(ctx, ctx.message.jobId);
      if (job) ok(ctx, observe(job, ctx.clock.now()));
    },
    'nzb.control': (ctx) => control(engine, ctx),
    'nzb.files': filesRoute,
    'nzb.read': readRoute,
  };
}

/**
 * Create the NAP-NZB mock.
 *
 * @param options - Deletion grant and pacing options.
 * @returns The mock service with an `advance()` control.
 * @example
 * ```ts
 * const nzb = createMockNzbService();
 * const source = { kind: 'url', url: mockNzbUrl(LINUX_DISTROS[0]) };
 * nzb.handleMessage('win', { type: 'nzb.add', id: 'a1', request: { downloaderId: 'native', operationKey: 'k1', source } }, console.log);
 * ```
 */
export function createMockNzbService(options: MockNzbOptions = {}): MockNzbService {
  const engine: NzbEngine = {
    service: undefined as unknown as MockService<MockNzbState>,
    options,
    scheduler: options.scheduler ?? DEFAULT_SCHEDULER,
    deleteAuthorized: options.deleteAuthorized ?? true,
  };
  const service = defineMockService<MockNzbState>({
    domain: 'nzb',
    version: '0.1.0',
    description: 'Mock NAP-NZB downloader jobs over the Linux image catalog',
    kind: 'extension',
    initialState: () => ({ jobs: new Map(), replay: new Map(), nextJob: 1 }),
    routes: nzbRoutes(engine),
  }, options);
  engine.service = service;

  const baseReset = service.mock.reset;
  service.mock.reset = () => { service.mock.state().tick?.(); baseReset(); };

  return Object.assign(service, { advance: (steps = 1) => advance(engine, steps) });
}

/**
 * Registry row for NAP-NZB.
 *
 * @example
 * ```ts
 * NZB_MOCK_ENTRY.create?.({ seed: 1 });
 * ```
 */
export const NZB_MOCK_ENTRY: MockDomainEntry = {
  domain: 'nzb',
  kind: 'extension',
  spec: NZB_SPEC_REF,
  create: (options) => createMockNzbService(options),
};

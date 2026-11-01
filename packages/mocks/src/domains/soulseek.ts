/**
 * domains/soulseek.ts — Mock NAP-SOULSEEK service.
 *
 * Spec: naps/NAP-SOULSEEK.md @ napplet/naps PR #135 head 892ed8d4909c (draft)
 * Routes: soulseek.info, soulseek.search, soulseek.browse, soulseek.results,
 *         soulseek.stop, soulseek.download, soulseek.transfers, soulseek.status,
 *         soulseek.pause, soulseek.resume, soulseek.cancel, soulseek.read,
 *         soulseek.save, soulseek.release
 * Spec gaps / decisions:
 * - Results carry exactly one of `value` or `error: { code, message }`, so
 *   routes build envelopes with `push` instead of `reply`/`fail`.
 * - The NAP defines no unsolicited messages: peers answer and transfers move
 *   only when `advance()` runs (or the `autoplay` timer fires). Each step
 *   appends `batchSize` search/browse entries and transfers a quarter of the
 *   file. Searches end `complete/deadline`, browses `complete/peer_complete`.
 * - Peers and shares come from `LINUX_DISTROS`: every image is shared by
 *   its `sharedBy` peer under `Linux\<Distro>\<fileName>`.
 * - Content disclosure for `read` is a separate grant: the `readsAuthorized`
 *   option / `setReadAuthorization()` control models it (`denied` when off).
 * - Capability revocation and window teardown drop every handle of that
 *   window; later lookups are `not_found` as the NAP requires.
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_SCHEDULER, defineMockService, resultType } from '../core/handler.js';
import type { MockRoute, MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockScheduler, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { LINUX_DISTROS, searchLinuxDistros, type LinuxDistroImage } from '../fixtures/linux-distros.js';
import { mockImageBytesBase64 } from './torrent-fixtures.js';

/**
 * Spec document the mock was written against.
 *
 * @example
 * ```ts
 * SOULSEEK_SPEC_REF.pr === 135;
 * ```
 */
export const SOULSEEK_SPEC_REF: NapSpecRef = {
  nap: 'NAP-SOULSEEK',
  status: 'draft',
  source: 'pr',
  pr: 135,
  sha: '892ed8d4909c',
  path: 'naps/NAP-SOULSEEK.md',
};

/**
 * `Query.state` values.
 *
 * @example
 * ```ts
 * const state: SoulseekQueryState = 'collecting';
 * ```
 */
export type SoulseekQueryState = 'collecting' | 'complete' | 'stopped' | 'failed';
/**
 * `Transfer.state` values.
 *
 * @example
 * ```ts
 * const state: SoulseekTransferState = 'transferring';
 * ```
 */
export type SoulseekTransferState = 'queued' | 'transferring' | 'paused' | 'complete' | 'cancelled' | 'failed';
/**
 * `Failure` record.
 *
 * @example
 * ```ts
 * const failure: SoulseekFailure = { code: 'denied', message: 'Content disclosure is not authorized' };
 * ```
 */
export interface SoulseekFailure { code: string; message: string }

/**
 * `File` record issued to a napplet.
 *
 * @example
 * ```ts
 * const file: SoulseekFile = { fileId: 'f1', username: 'tux-mirror', path: 'Linux\\Debian\\x.iso', size: '661651456', locked: false, extension: 'iso' };
 * ```
 */
export interface SoulseekFile {
  fileId: string;
  username: string;
  path: string;
  size: string;
  locked: boolean;
  extension?: string;
}

/**
 * `Query` snapshot.
 *
 * @example
 * ```ts
 * const query = createMockSoulseekService().mock.state().queries.get('s1');
 * ```
 */
export interface SoulseekQuery {
  queryId: string;
  kind: 'search' | 'browse';
  state: SoulseekQueryState;
  reason?: 'deadline' | 'limit' | 'peer_complete' | 'cancelled';
  count: number;
  maxResults: number;
  maxPageSize: number;
  timeoutMs: number;
  error?: SoulseekFailure;
}

/**
 * A query with its mock bookkeeping.
 *
 * @example
 * ```ts
 * createMockSoulseekService().mock.state().queries.get('s1')?.pending.length;
 * ```
 */
export interface MockSoulseekQuery extends SoulseekQuery {
  windowId: string;
  /** Retained entries in arrival order. */
  files: SoulseekFile[];
  /** Entries still to arrive on later `advance()` steps. */
  pending: SoulseekFile[];
  /** Peer name for browse queries. */
  username?: string;
}

/**
 * `Transfer` snapshot.
 *
 * @example
 * ```ts
 * const transfer = createMockSoulseekService().mock.state().transfers.get('t1');
 * ```
 */
export interface SoulseekTransfer {
  transferId: string;
  file: SoulseekFile;
  state: SoulseekTransferState;
  maxReadBytes: number;
  received: string;
  queuePosition?: number;
  bytesPerSecond?: number;
  error?: SoulseekFailure;
}

/**
 * A transfer with its mock bookkeeping.
 *
 * @example
 * ```ts
 * createMockSoulseekService().mock.state().transfers.get('t1')?.image.fileName;
 * ```
 */
export interface MockSoulseekTransfer extends SoulseekTransfer {
  windowId: string;
  image: LinuxDistroImage;
}

/**
 * In-memory state of the soulseek mock.
 *
 * @example
 * ```ts
 * const state = createMockSoulseekService().mock.state();
 * state.accountState === 'online';
 * ```
 */
export interface MockSoulseekState {
  accountState: 'unconfigured' | 'offline' | 'online';
  readsAuthorized: boolean;
  queries: Map<string, MockSoulseekQuery>;
  transfers: Map<string, MockSoulseekTransfer>;
  /** Live file handles: fileId → owning query and catalog image. */
  handles: Map<string, { windowId: string; queryId: string; image: LinuxDistroImage; file: SoulseekFile }>;
  nextQuery: number;
  nextTransfer: number;
  nextFile: number;
  tick?: () => void;
}

/**
 * Factory options for the soulseek mock.
 *
 * @example
 * ```ts
 * const service = createMockSoulseekService({ accountState: 'offline' });
 * ```
 */
export interface MockSoulseekOptions extends MockServiceOptions {
  /** Shell account availability. Default `online`. */
  accountState?: 'unconfigured' | 'offline' | 'online';
  /** Whether `read` disclosure is granted. Default `true`. */
  readsAuthorized?: boolean;
  /** Whether `save` is implemented. Default `true`. */
  canSave?: boolean;
  /** Results appended per `advance()` step. Default `3`. */
  batchSize?: number;
  /** Run `advance()` every `tickMs` while work is pending. Default `false`. */
  autoplay?: boolean;
  /** Autoplay interval in ms. Default `250`. */
  tickMs?: number;
  /** Override `maxResults` (default `500`). */
  maxResults?: number;
}

/**
 * The soulseek mock service type.
 *
 * @example
 * ```ts
 * const slsk = createMockSoulseekService();
 * slsk.advance(2);
 * slsk.setReadAuthorization(false);
 * ```
 */
export type MockSoulseekService = MockService<MockSoulseekState> & {
  /**
   * Deliver peer responses and move transfers forward.
   *
   * @param steps - Steps to run. Default `1`.
   */
  advance(steps?: number): void;
  /** Grant or deny `read` content disclosure. */
  setReadAuthorization(allowed: boolean): void;
  /** Change the account state (`unavailable` for new network work when not online). */
  setAccountState(state: 'unconfigured' | 'offline' | 'online'): void;
};

const LIMITS = Object.freeze({ maxQueries: 4, maxTransfers: 8, maxPageSize: 100, maxReadBytes: 65536, maxTextBytes: 1024, queryTimeoutMs: 30000, pollIntervalMs: 1000 });
const TERMINAL_TRANSFER: readonly SoulseekTransferState[] = ['complete', 'cancelled', 'failed'];
const CANONICAL_UINT = /^(0|[1-9]\d*)$/;

function sharePath(image: LinuxDistroImage): string {
  return `Linux\\${image.distro}\\${image.fileName}`;
}

function isPosInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

type Ctx = MockRouteContext<MockSoulseekState>;

function ok(ctx: Ctx, value: unknown): void {
  ctx.push({ type: resultType(ctx.message.type), id: ctx.message.id, value } as NappletMessage);
}

function err(ctx: Ctx, code: string, message: string): void {
  ctx.push({ type: resultType(ctx.message.type), id: ctx.message.id, error: { code, message } } as NappletMessage);
}

function publicQuery(query: MockSoulseekQuery): SoulseekQuery {
  const { windowId: _w, files: _f, pending: _p, username: _u, ...snapshot } = query;
  return snapshot;
}

function publicTransfer(transfer: MockSoulseekTransfer): SoulseekTransfer {
  const { windowId: _w, image: _i, ...snapshot } = transfer;
  return snapshot;
}

/** Shared engine state the module-level helpers operate on. */
interface SoulseekEngine {
  service: MockService<MockSoulseekState>;
  options: MockSoulseekOptions;
  batchSize: number;
  maxResults: number;
  canSave: boolean;
  scheduler: MockScheduler;
}

function ownedQuery(ctx: Ctx): MockSoulseekQuery | undefined {
  const query = typeof ctx.message.queryId === 'string' ? ctx.state.queries.get(ctx.message.queryId) : undefined;
  return query && query.windowId === ctx.windowId ? query : undefined;
}

/** Resolves the caller's transfer, replying `not_found` when it is missing or foreign. */
function ownedTransfer(ctx: Ctx): MockSoulseekTransfer | undefined {
  const transfer = typeof ctx.message.transferId === 'string' ? ctx.state.transfers.get(ctx.message.transferId) : undefined;
  if (transfer && transfer.windowId === ctx.windowId) return transfer;
  err(ctx, 'not_found', 'Transfer handle is unavailable');
  return undefined;
}

function admitQuery(engine: SoulseekEngine, ctx: Ctx, kind: 'search' | 'browse', images: readonly LinuxDistroImage[], username: string | undefined): void {
  const { state, windowId } = ctx;
  if (state.accountState !== 'online') { err(ctx, 'unavailable', 'No online Soulseek account'); return; }
  if ([...state.queries.values()].filter((query) => query.windowId === windowId).length >= LIMITS.maxQueries) { err(ctx, 'limit_exceeded', 'Query limit reached'); return; }
  const queryId = `${kind === 'search' ? 's' : 'b'}${state.nextQuery++}`;
  const pending = images.map((image) => {
    const fileId = `f${state.nextFile++}`;
    const file: SoulseekFile = { fileId, username: image.sharedBy, path: sharePath(image), size: String(image.sizeBytes), locked: false, extension: 'iso' };
    state.handles.set(fileId, { windowId, queryId, image, file });
    return file;
  });
  const query: MockSoulseekQuery = { queryId, kind, state: 'collecting', count: 0, maxResults: engine.maxResults, maxPageSize: LIMITS.maxPageSize, timeoutMs: LIMITS.queryTimeoutMs, windowId, files: [], pending, ...(username !== undefined ? { username } : {}) };
  state.queries.set(queryId, query);
  armAutoplay(engine, state);
  ok(ctx, publicQuery(query));
}

function releaseQuery(state: MockSoulseekState, windowId: string, queryId: string): boolean {
  const query = state.queries.get(queryId);
  if (!query || query.windowId !== windowId) return false;
  for (const [fileId, handle] of state.handles) if (handle.queryId === queryId) state.handles.delete(fileId);
  state.queries.delete(queryId);
  return true;
}

function releaseTransfer(state: MockSoulseekState, windowId: string, transferId: string): boolean {
  const transfer = state.transfers.get(transferId);
  if (!transfer || transfer.windowId !== windowId) return false;
  state.transfers.delete(transferId);
  return true;
}

function dropWindow(state: MockSoulseekState, windowId: string): void {
  for (const query of [...state.queries.values()]) if (query.windowId === windowId) releaseQuery(state, windowId, query.queryId);
  for (const transfer of [...state.transfers.values()]) if (transfer.windowId === windowId) state.transfers.delete(transfer.transferId);
}

function stepQuery(engine: SoulseekEngine, query: MockSoulseekQuery): void {
  if (query.state !== 'collecting') return;
  if (query.kind === 'browse' && !LINUX_DISTROS.some((image) => image.sharedBy === query.username)) {
    query.state = 'failed';
    query.error = { code: 'peer_unavailable', message: 'Peer cannot be reached' };
    return;
  }
  const batch = query.pending.splice(0, engine.batchSize);
  for (const file of batch) {
    if (query.files.length >= query.maxResults) { query.state = 'complete'; query.reason = 'limit'; query.pending = []; break; }
    query.files.push(file);
  }
  query.count = query.files.length;
  if (query.state === 'collecting' && query.pending.length === 0) {
    query.state = 'complete';
    query.reason = query.kind === 'search' ? 'deadline' : 'peer_complete';
  }
}

function stepTransfer(transfer: MockSoulseekTransfer): void {
  if (transfer.state === 'queued') {
    transfer.state = 'transferring';
    delete transfer.queuePosition;
  } else if (transfer.state !== 'transferring') return;
  const size = transfer.image.sizeBytes;
  const chunk = Math.ceil(size / 4);
  const received = Math.min(size, Number(transfer.received) + chunk);
  transfer.received = String(received);
  transfer.bytesPerSecond = chunk;
  if (received >= size) { transfer.state = 'complete'; delete transfer.bytesPerSecond; }
}

function hasPendingWork(state: MockSoulseekState): boolean {
  return [...state.queries.values()].some((query) => query.state === 'collecting')
    || [...state.transfers.values()].some((transfer) => transfer.state === 'queued' || transfer.state === 'transferring');
}

function armAutoplay(engine: SoulseekEngine, state: MockSoulseekState): void {
  if (!engine.options.autoplay || state.tick || !hasPendingWork(state)) return;
  state.tick = engine.scheduler.schedule(engine.options.tickMs ?? 250, () => { state.tick = undefined; advance(engine, 1); });
}

function advance(engine: SoulseekEngine, steps: number): void {
  const state = engine.service.mock.state();
  for (let index = 0; index < steps; index += 1) {
    for (const query of state.queries.values()) stepQuery(engine, query);
    for (const transfer of state.transfers.values()) stepTransfer(transfer);
  }
  armAutoplay(engine, state);
}

function readRoute(ctx: Ctx): void {
  const transfer = ownedTransfer(ctx);
  if (!transfer) return;
  const { offset, length } = ctx.message;
  if (typeof offset !== 'string' || !CANONICAL_UINT.test(offset)) { err(ctx, 'invalid_request', 'Offset is not canonical decimal text'); return; }
  if (!isPosInt(length) || length > transfer.maxReadBytes) { err(ctx, 'invalid_request', 'length must be 1..maxReadBytes'); return; }
  const size = Number(transfer.file.size);
  const start = Number(offset);
  if (start > size) { err(ctx, 'invalid_request', 'offset exceeds file size'); return; }
  if (transfer.state !== 'complete') { err(ctx, 'invalid_state', 'Transfer is not complete'); return; }
  if (!ctx.state.readsAuthorized) { err(ctx, 'denied', 'Content disclosure is not authorized'); return; }
  const count = Math.min(length, size - start);
  ok(ctx, { offset, data: mockImageBytesBase64(transfer.image, start, count), length: count, eof: start + count === size });
}

function downloadRoute(engine: SoulseekEngine, ctx: Ctx): void {
  const fileId = ctx.message.fileId;
  const handle = typeof fileId === 'string' ? ctx.state.handles.get(fileId) : undefined;
  if (!handle || handle.windowId !== ctx.windowId) { err(ctx, 'not_found', 'File handle is unavailable'); return; }
  const existing = [...ctx.state.transfers.values()].find((transfer) => transfer.windowId === ctx.windowId && transfer.file.fileId === fileId);
  if (existing) { ok(ctx, publicTransfer(existing)); return; }
  if (ctx.state.accountState !== 'online') { err(ctx, 'unavailable', 'No online Soulseek account'); return; }
  if ([...ctx.state.transfers.values()].filter((transfer) => transfer.windowId === ctx.windowId).length >= LIMITS.maxTransfers) { err(ctx, 'limit_exceeded', 'Transfer limit reached'); return; }
  const transferId = `t${ctx.state.nextTransfer++}`;
  const transfer: MockSoulseekTransfer = { transferId, file: { ...handle.file }, state: 'queued', maxReadBytes: LIMITS.maxReadBytes, received: '0', windowId: ctx.windowId, image: handle.image };
  ctx.state.transfers.set(transferId, transfer);
  armAutoplay(engine, ctx.state);
  ok(ctx, publicTransfer(transfer));
}

function soulseekRoutes(engine: SoulseekEngine): Record<string, MockRoute<MockSoulseekState>> {
  return {
    'soulseek.info': (ctx) => ok(ctx, { state: ctx.state.accountState, canSave: engine.canSave, maxQueries: LIMITS.maxQueries, maxTransfers: LIMITS.maxTransfers, maxResults: engine.maxResults, maxPageSize: LIMITS.maxPageSize, maxReadBytes: LIMITS.maxReadBytes, maxTextBytes: LIMITS.maxTextBytes, queryTimeoutMs: LIMITS.queryTimeoutMs, pollIntervalMs: LIMITS.pollIntervalMs }),
    'soulseek.search': (ctx) => {
      const request = ctx.message.request as Record<string, unknown> | undefined;
      if (!request || typeof request !== 'object' || typeof request.text !== 'string' || request.text.trim() === '') { err(ctx, 'invalid_request', 'request.text must be a nonempty string'); return; }
      if (request.username !== undefined && (typeof request.username !== 'string' || request.username === '')) { err(ctx, 'invalid_request', 'request.username must be a nonempty string'); return; }
      if (Object.keys(request).some((key) => key !== 'text' && key !== 'username')) { err(ctx, 'invalid_request', 'unknown request field'); return; }
      const matches = searchLinuxDistros(request.text).filter((image) => request.username === undefined || image.sharedBy === request.username);
      admitQuery(engine, ctx, 'search', matches, undefined);
    },
    'soulseek.browse': (ctx) => {
      const username = ctx.message.username;
      if (typeof username !== 'string' || username === '') { err(ctx, 'invalid_request', 'username must be a nonempty string'); return; }
      admitQuery(engine, ctx, 'browse', LINUX_DISTROS.filter((image) => image.sharedBy === username), username);
    },
    'soulseek.results': (ctx) => {
      const query = ownedQuery(ctx);
      if (!query) { err(ctx, 'not_found', 'Query handle is unavailable'); return; }
      const after = ctx.message.after ?? 0;
      const limit = ctx.message.limit ?? query.maxPageSize;
      if (typeof after !== 'number' || !Number.isInteger(after) || after < 0 || after > query.count) { err(ctx, 'invalid_request', 'after is out of range'); return; }
      if (!isPosInt(limit) || limit > query.maxPageSize) { err(ctx, 'invalid_request', 'limit must be 1..maxPageSize'); return; }
      const files = query.files.slice(after, after + limit);
      ok(ctx, { query: publicQuery(query), files, next: after + files.length });
    },
    'soulseek.stop': (ctx) => {
      const query = ownedQuery(ctx);
      if (!query) { err(ctx, 'not_found', 'Query handle is unavailable'); return; }
      if (query.state === 'collecting') { query.state = 'stopped'; query.reason = 'cancelled'; query.pending = []; }
      ok(ctx, publicQuery(query));
    },
    'soulseek.download': (ctx) => downloadRoute(engine, ctx),
    'soulseek.transfers': (ctx) => ok(ctx, [...ctx.state.transfers.values()].filter((transfer) => transfer.windowId === ctx.windowId).map(publicTransfer)),
    'soulseek.status': (ctx) => { const transfer = ownedTransfer(ctx); if (transfer) ok(ctx, publicTransfer(transfer)); },
    'soulseek.pause': (ctx) => {
      const transfer = ownedTransfer(ctx);
      if (!transfer) return;
      if (TERMINAL_TRANSFER.includes(transfer.state)) { err(ctx, 'invalid_state', 'Transfer is terminal'); return; }
      transfer.state = 'paused';
      delete transfer.bytesPerSecond;
      ok(ctx, publicTransfer(transfer));
    },
    'soulseek.resume': (ctx) => {
      const transfer = ownedTransfer(ctx);
      if (!transfer) return;
      if (TERMINAL_TRANSFER.includes(transfer.state)) { err(ctx, 'invalid_state', 'Transfer is terminal'); return; }
      if (transfer.state === 'paused') {
        if (ctx.state.accountState !== 'online') { err(ctx, 'unavailable', 'No online Soulseek account'); return; }
        transfer.state = 'queued';
        armAutoplay(engine, ctx.state);
      }
      ok(ctx, publicTransfer(transfer));
    },
    'soulseek.cancel': (ctx) => {
      const transfer = ownedTransfer(ctx);
      if (!transfer) return;
      if (!TERMINAL_TRANSFER.includes(transfer.state)) { transfer.state = 'cancelled'; transfer.received = '0'; delete transfer.bytesPerSecond; }
      ok(ctx, publicTransfer(transfer));
    },
    'soulseek.read': readRoute,
    'soulseek.save': (ctx) => {
      const transfer = ownedTransfer(ctx);
      if (!transfer) return;
      if (!engine.canSave) { err(ctx, 'unsupported', 'save is not implemented'); return; }
      if (transfer.state !== 'complete') { err(ctx, 'invalid_state', 'Transfer is not complete'); return; }
      ok(ctx, { saved: true });
    },
    'soulseek.release': (ctx) => {
      const { kind, handle } = ctx.message;
      if ((kind !== 'query' && kind !== 'transfer') || typeof handle !== 'string') { err(ctx, 'invalid_request', 'kind must be query or transfer with a text handle'); return; }
      ok(ctx, { released: kind === 'query' ? releaseQuery(ctx.state, ctx.windowId, handle) : releaseTransfer(ctx.state, ctx.windowId, handle) });
    },
  };
}

/**
 * Create the NAP-SOULSEEK mock.
 *
 * @param options - Account, disclosure, and pacing options.
 * @returns The mock service with `advance()` and authorization controls.
 * @example
 * ```ts
 * const slsk = createMockSoulseekService();
 * slsk.handleMessage('win', { type: 'soulseek.search', id: 'q1', request: { text: 'debian' } }, console.log);
 * slsk.advance(); // the tux-mirror peer answers
 * ```
 */
export function createMockSoulseekService(options: MockSoulseekOptions = {}): MockSoulseekService {
  const engine: SoulseekEngine = {
    service: undefined as unknown as MockService<MockSoulseekState>,
    options,
    batchSize: options.batchSize ?? 3,
    maxResults: options.maxResults ?? 500,
    canSave: options.canSave ?? true,
    scheduler: options.scheduler ?? DEFAULT_SCHEDULER,
  };
  const service = defineMockService<MockSoulseekState>({
    domain: 'soulseek',
    version: '0.1.0',
    description: 'Mock NAP-SOULSEEK discovery and downloads over the Linux image catalog',
    kind: 'extension',
    initialState: () => ({
      accountState: options.accountState ?? 'online',
      readsAuthorized: options.readsAuthorized ?? true,
      queries: new Map(), transfers: new Map(), handles: new Map(),
      nextQuery: 1, nextTransfer: 1, nextFile: 1,
    }),
    routes: soulseekRoutes(engine),
    onWindowDestroyed: (windowId, state) => dropWindow(state, windowId),
    onCapabilityRevoked: (windowId, _capability, state) => dropWindow(state, windowId),
  }, options);
  engine.service = service;

  const baseReset = service.mock.reset;
  service.mock.reset = () => { service.mock.state().tick?.(); baseReset(); };

  return Object.assign(service, {
    advance: (steps = 1) => advance(engine, steps),
    setReadAuthorization(allowed: boolean) { service.mock.state().readsAuthorized = allowed; },
    setAccountState(state: 'unconfigured' | 'offline' | 'online') { service.mock.state().accountState = state; },
  });
}

/**
 * Registry row for NAP-SOULSEEK.
 *
 * @example
 * ```ts
 * SOULSEEK_MOCK_ENTRY.create?.({ seed: 1 });
 * ```
 */
export const SOULSEEK_MOCK_ENTRY: MockDomainEntry = {
  domain: 'soulseek',
  kind: 'extension',
  spec: SOULSEEK_SPEC_REF,
  create: (options) => createMockSoulseekService(options),
};

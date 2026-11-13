/**
 * domains/pow.ts — Mock NAP-POW service.
 *
 * Spec: naps/NAP-POW.md @ napplet/naps PR #39 head d85b4252f26f (draft)
 * Routes: pow.mine, pow.mineAndPublish, pow.queue, pow.job, pow.hashrate,
 *         pow.cancel, pow.pause, pow.resume
 * Pushes: pow.state, pow.progress, pow.done, pow.error
 * Spec gaps / decisions:
 * - Mining is simulated: each `advance()` step adds `hashesPerWorker` hashes
 *   per worker, `stepMs` of elapsed time, and `bitsPerStep` leading-zero bits
 *   to `bestPow`. The mined event id is a deterministic hex whose first
 *   `target` bits are zero, so `leadingZeroBits(event.id) >= target` holds.
 * - `pow.hashrate` is scoped to the requesting window (the NAP allows
 *   coarsening telemetry for untrusted napplets) rather than miner-wide.
 * - The initial state is reported only in the `.result` ack; `pow.state` is
 *   pushed for every later transition, including `queued → mining`.
 * - Per-window jobs are cancelled on window destroy and capability revocation.
 */
import type { NostrEvent } from '@napplet/core';
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_CLOCK, DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockRoute } from '../core/handler.js';
import { createSeededRng, mockEventId, mockSignature, type SeededRng } from '../core/rng.js';
import type { MockClock, MockDomainEntry, MockScheduler, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_ACCOUNTS } from '../fixtures/nostr.js';

/**
 * Spec document the mock was written against.
 *
 * @example
 * ```ts
 * POW_SPEC_REF.pr === 39;
 * ```
 */
export const POW_SPEC_REF: NapSpecRef = {
  nap: 'NAP-POW',
  status: 'draft',
  source: 'pr',
  pr: 39,
  sha: 'd85b4252f26f',
  path: 'naps/NAP-POW.md',
};

/**
 * `PowState` enumeration.
 *
 * @example
 * ```ts
 * const state: PowState = 'mining';
 * ```
 */
export type PowState = 'queued' | 'mining' | 'paused' | 'done' | 'cancelled' | 'error';

/**
 * `EventTemplate` supplied by the napplet.
 *
 * @example
 * ```ts
 * const template: PowEventTemplate = { kind: 1, content: 'gm', tags: [] };
 * ```
 */
export interface PowEventTemplate {
  kind: number;
  content: string;
  tags?: string[][];
  created_at?: number;
}

/**
 * `WorkerStat` row.
 *
 * @example
 * ```ts
 * const stat: PowWorkerStat = { workerId: 0, bestPow: 12, hashes: 250_000, hashRate: 250_000 };
 * ```
 */
export interface PowWorkerStat {
  workerId: number;
  bestPow: number;
  hashes: number;
  hashRate: number;
}

/**
 * One mining job tracked by the mock.
 *
 * @example
 * ```ts
 * const job = createMockPowService().mock.state().jobs.get('job-1');
 * ```
 */
export interface MockPowJob {
  jobId: string;
  windowId: string;
  mode: 'mine' | 'mineAndPublish';
  template: PowEventTemplate;
  target: number;
  priority: number;
  workers: number;
  timeoutMs?: number;
  state: PowState;
  bestPow: number;
  bestNonce?: string;
  hashes: number;
  elapsedMs: number;
  /** `created_at` committed when mining started. */
  committedCreatedAt?: number;
  /** Mined event once `done`. */
  event?: NostrEvent;
}

/**
 * In-memory state of the pow mock.
 *
 * @example
 * ```ts
 * const state = createMockPowService().mock.state();
 * state.minerPaused === false;
 * ```
 */
export interface MockPowState {
  jobs: Map<string, MockPowJob>;
  /** Submission order used for scheduling. */
  order: string[];
  minerPaused: boolean;
  /** Pending autoplay timer cancel function. */
  tick?: () => void;
}

/**
 * Factory options for the pow mock.
 *
 * @example
 * ```ts
 * const service = createMockPowService({ bitsPerStep: 8, maxConcurrent: 2 });
 * ```
 */
export interface MockPowOptions extends MockServiceOptions {
  /** Jobs mined at once; others queue. Default `1`. */
  maxConcurrent?: number;
  /** Highest accepted `target`. Default `32`. */
  maxTarget?: number;
  /** Worker cap per job. Default `4`. */
  maxWorkers?: number;
  /** Hashes each worker contributes per step. Default `250000`. */
  hashesPerWorker?: number;
  /** Elapsed mining ms per step. Default `1000`. */
  stepMs?: number;
  /** Leading-zero bits gained per step. Default `6`. */
  bitsPerStep?: number;
  /** Run `advance()` every `tickMs` while a job is mining. Default `false`. */
  autoplay?: boolean;
  /** Autoplay interval in ms. Default `stepMs`. */
  tickMs?: number;
  /** Make `mineAndPublish` fail with `publish denied` after mining. Default `false`. */
  denyPublish?: boolean;
}

/**
 * The pow mock service type.
 *
 * @example
 * ```ts
 * createMockPowService().advance(3);
 * ```
 */
export type MockPowService = MockService<MockPowState> & {
  /**
   * Advance every mining job by `steps` simulated steps, pushing progress
   * and completing jobs whose `bestPow` reaches `target`.
   *
   * @param steps - Steps to run. Default `1`.
   * @returns Job ids that reached a terminal state during this call.
   */
  advance(steps?: number): string[];
};

const SHELL_USER = MOCK_ACCOUNTS[0]!;

/**
 * Count NIP-13 leading zero bits of a hex event id.
 *
 * @param hex - Lowercase hex string.
 * @returns Number of leading zero bits.
 * @example
 * ```ts
 * leadingZeroBits('000007ab'.padEnd(64, 'f')) === 21;
 * ```
 */
export function leadingZeroBits(hex: string): number {
  let count = 0;
  for (const char of hex) {
    const nibble = Number.parseInt(char, 16);
    if (Number.isNaN(nibble)) break;
    if (nibble === 0) { count += 4; continue; }
    count += Math.clz32(nibble) - 28;
    break;
  }
  return count;
}

function withLeadingZeroBits(hex: string, bits: number): string {
  const full = Math.floor(bits / 4);
  const rest = bits % 4;
  let out = '0'.repeat(full) + hex.slice(full);
  if (rest > 0 && full < hex.length) {
    const nibble = Number.parseInt(hex[full]!, 16) & ((1 << (4 - rest)) - 1);
    out = out.slice(0, full) + nibble.toString(16) + out.slice(full + 1);
  }
  return out;
}

function isUint(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPowTemplate(raw: unknown): raw is PowEventTemplate {
  if (!raw || typeof raw !== 'object') return false;
  const template = raw as Record<string, unknown>;
  if (!isUint(template.kind) || typeof template.content !== 'string') return false;
  if (template.tags !== undefined && !Array.isArray(template.tags)) return false;
  return template.created_at === undefined || isUint(template.created_at);
}

function parseTemplate(raw: unknown): PowEventTemplate | undefined {
  return isPowTemplate(raw) ? raw : undefined;
}

/** Shared engine state the module-level helpers operate on. */
interface PowEngine {
  service: MockService<MockPowState>;
  options: MockPowOptions;
  maxConcurrent: number;
  maxTarget: number;
  maxWorkers: number;
  hashesPerWorker: number;
  stepMs: number;
  bitsPerStep: number;
  scheduler: MockScheduler;
  clock: MockClock;
  rng: SeededRng;
}

function isTerminal(state: PowState): boolean {
  return state === 'done' || state === 'cancelled' || state === 'error';
}

function owned(state: MockPowState, windowId: string, jobId: unknown): MockPowJob | undefined {
  const job = typeof jobId === 'string' ? state.jobs.get(jobId) : undefined;
  return job && job.windowId === windowId ? job : undefined;
}

function hashRate(engine: PowEngine, job: MockPowJob): number {
  return job.state === 'mining' ? (job.workers * engine.hashesPerWorker * 1000) / engine.stepMs : 0;
}

function workerStats(engine: PowEngine, job: MockPowJob): PowWorkerStat[] {
  const rate = hashRate(engine, job) / Math.max(1, job.workers);
  return Array.from({ length: job.workers }, (_, workerId) => ({
    workerId,
    bestPow: Math.max(0, job.bestPow - workerId),
    hashes: Math.floor(job.hashes / job.workers),
    hashRate: rate,
  }));
}

function progressOf(engine: PowEngine, job: MockPowJob): Record<string, unknown> {
  return {
    jobId: job.jobId, target: job.target, state: job.state, bestPow: job.bestPow,
    ...(job.bestNonce !== undefined ? { bestNonce: job.bestNonce } : {}),
    hashes: job.hashes, hashRate: hashRate(engine, job), workers: workerStats(engine, job), elapsedMs: job.elapsedMs,
  };
}

function queuePosition(state: MockPowState, jobId: string): number {
  return state.order.filter((id) => state.jobs.get(id)?.state === 'queued').indexOf(jobId);
}

function activeCount(state: MockPowState): number {
  return [...state.jobs.values()].filter((job) => job.state === 'mining').length;
}

function push(engine: PowEngine, job: MockPowJob, message: NappletMessage & Record<string, unknown>): void {
  pushToWindow(engine.service, job.windowId, message);
}

function transition(engine: PowEngine, job: MockPowJob, next: PowState): void {
  job.state = next;
  if (next === 'mining' && job.committedCreatedAt === undefined) {
    job.committedCreatedAt = job.template.created_at ?? Math.floor(engine.clock.now() / 1000);
  }
  const state = engine.service.mock.state();
  push(engine, job, { type: 'pow.state', jobId: job.jobId, state: next, ...(next === 'queued' ? { position: queuePosition(state, job.jobId) } : {}) });
}

/** Promote queued jobs into free mining slots in submission order. */
function schedule(engine: PowEngine, state: MockPowState): void {
  if (!state.minerPaused) {
    for (const id of state.order) {
      if (activeCount(state) >= engine.maxConcurrent) break;
      const job = state.jobs.get(id);
      if (job?.state === 'queued') transition(engine, job, 'mining');
    }
  }
  armAutoplay(engine, state);
}

function armAutoplay(engine: PowEngine, state: MockPowState): void {
  if (!engine.options.autoplay || state.tick || activeCount(state) === 0) return;
  state.tick = engine.scheduler.schedule(engine.options.tickMs ?? engine.stepMs, () => {
    state.tick = undefined;
    advance(engine, 1);
  });
}

/** Route-supplied inputs for a mining submission. */
interface PowSubmission {
  windowId: string;
  message: Record<string, unknown>;
  mode: MockPowJob['mode'];
  reply: (fields?: Record<string, unknown>) => void;
}

function submit(engine: PowEngine, { windowId, message, mode, reply }: PowSubmission): void {
  const state = engine.service.mock.state();
  const jobId = message.jobId;
  if (typeof jobId !== 'string' || jobId.length === 0) { reply({ jobId, accepted: false, error: 'invalid template' }); return; }
  if (state.jobs.has(jobId)) { reply({ jobId, accepted: false, error: 'duplicate jobId' }); return; }
  const template = parseTemplate(message.template);
  if (!template) { reply({ jobId, accepted: false, error: 'invalid template' }); return; }
  if (!isUint(message.target) || message.target > engine.maxTarget) { reply({ jobId, accepted: false, error: 'invalid target' }); return; }
  const opts = (message.options && typeof message.options === 'object' ? message.options : {}) as Record<string, unknown>;
  const job: MockPowJob = {
    jobId, windowId, mode, template, target: message.target,
    priority: typeof opts.priority === 'number' ? opts.priority : 0,
    workers: Math.max(1, Math.min(engine.maxWorkers, isUint(opts.workers) ? opts.workers : 1)),
    ...(isUint(opts.timeoutMs) ? { timeoutMs: opts.timeoutMs } : {}),
    state: 'queued', bestPow: 0, hashes: 0, elapsedMs: 0,
  };
  state.jobs.set(jobId, job);
  state.order.push(jobId);
  const startsNow = !state.minerPaused && activeCount(state) < engine.maxConcurrent;
  if (startsNow) {
    job.state = 'mining';
    job.committedCreatedAt = template.created_at ?? Math.floor(engine.clock.now() / 1000);
    armAutoplay(engine, state);
  }
  reply({ jobId, accepted: true, state: job.state, ...(startsNow ? {} : { position: queuePosition(state, jobId) }) });
}

function minedEvent(job: MockPowJob, nonce: string): NostrEvent {
  const tags = (job.template.tags ?? []).filter((tag) => tag[0] !== 'nonce');
  tags.push(['nonce', nonce, String(job.target)]);
  const label = `pow:${job.jobId}:${nonce}`;
  return {
    id: withLeadingZeroBits(mockEventId(label), job.target),
    pubkey: SHELL_USER.pubkey,
    created_at: job.committedCreatedAt ?? 0,
    kind: job.template.kind,
    tags,
    content: job.template.content,
    ...(job.mode === 'mineAndPublish' ? { sig: mockSignature(label) } : {}),
  } as NostrEvent;
}

function finish(engine: PowEngine, job: MockPowJob, state: 'done' | 'cancelled' | 'error', error?: string): void {
  transition(engine, job, state);
  if (state === 'done') {
    const nonce = job.bestNonce ?? '0';
    const event = minedEvent(job, nonce);
    job.event = event;
    const denied = job.mode === 'mineAndPublish' && engine.options.denyPublish === true;
    push(engine, job, { type: 'pow.done', jobId: job.jobId, result: {
      jobId: job.jobId, ok: !denied, event, pow: job.target, nonce, hashes: job.hashes, elapsedMs: job.elapsedMs,
      ...(job.mode === 'mineAndPublish' && !denied ? { published: { eventId: event.id, relays: Object.fromEntries(SHELL_USER.writeRelays.map((url) => [url, true])) } } : {}),
      ...(denied ? { error: 'publish denied' } : {}),
    } });
  } else {
    push(engine, job, { type: 'pow.error', jobId: job.jobId, error: error ?? state });
  }
  schedule(engine, engine.service.mock.state());
}

function step(engine: PowEngine, job: MockPowJob): boolean {
  job.elapsedMs += engine.stepMs;
  job.hashes += job.workers * engine.hashesPerWorker;
  job.bestPow = Math.min(job.target, job.bestPow + engine.bitsPerStep);
  job.bestNonce = String(job.hashes - engine.rng.int(engine.hashesPerWorker));
  if (job.timeoutMs !== undefined && job.elapsedMs > job.timeoutMs && job.bestPow < job.target) {
    finish(engine, job, 'error', 'timeout');
    return true;
  }
  push(engine, job, { type: 'pow.progress', jobId: job.jobId, progress: progressOf(engine, job) });
  if (job.bestPow >= job.target) {
    finish(engine, job, 'done');
    return true;
  }
  return false;
}

function dropWindow(engine: PowEngine, state: MockPowState, windowId: string): void {
  for (const job of state.jobs.values()) {
    if (job.windowId !== windowId) continue;
    if (!isTerminal(job.state)) job.state = 'cancelled';
    state.jobs.delete(job.jobId);
  }
  state.order = state.order.filter((id) => state.jobs.has(id));
  schedule(engine, state);
}

function advance(engine: PowEngine, steps: number): string[] {
  const state = engine.service.mock.state();
  const finished: string[] = [];
  for (let index = 0; index < steps; index += 1) {
    const mining = state.order.filter((id) => state.jobs.get(id)?.state === 'mining');
    for (const id of mining) {
      const job = state.jobs.get(id);
      if (job && step(engine, job)) finished.push(id);
    }
  }
  armAutoplay(engine, state);
  return finished;
}

function powRoutes(engine: PowEngine): Record<string, MockRoute<MockPowState>> {
  return {
    'pow.mine': ({ windowId, message, reply }) => submit(engine, { windowId, message, mode: 'mine', reply }),
    'pow.mineAndPublish': ({ windowId, message, reply }) => submit(engine, { windowId, message, mode: 'mineAndPublish', reply }),
    'pow.queue': ({ state, windowId, reply }) => {
      const jobs = state.order
        .map((id) => state.jobs.get(id)!)
        .filter((job) => job.windowId === windowId && !isTerminal(job.state))
        .map((job) => ({
          jobId: job.jobId, target: job.target, state: job.state, priority: job.priority,
          ...(job.state === 'queued' ? { position: queuePosition(state, job.jobId) } : {}),
          bestPow: job.bestPow, hashRate: hashRate(engine, job), kind: job.template.kind, mode: job.mode,
        }));
      reply({ jobs });
    },
    'pow.job': ({ state, windowId, message, reply }) => {
      const job = owned(state, windowId, message.jobId);
      if (!job) { reply({ error: 'unknown jobId' }); return; }
      reply({ progress: progressOf(engine, job) });
    },
    'pow.hashrate': ({ state, windowId, reply }) => {
      const mining = [...state.jobs.values()].filter((job) => job.windowId === windowId && job.state === 'mining');
      const perWorker = mining.flatMap((job) => workerStats(engine, job).map((stat) => ({ workerId: stat.workerId, hashRate: stat.hashRate })));
      reply({ hashrate: {
        hashRate: mining.reduce((sum, job) => sum + hashRate(engine, job), 0),
        workers: mining.reduce((sum, job) => sum + job.workers, 0),
        perWorker,
        byJob: mining.map((job) => ({ jobId: job.jobId, hashRate: hashRate(engine, job) })),
      } });
    },
    'pow.cancel': ({ state, windowId, message, reply }) => {
      const job = owned(state, windowId, message.jobId);
      if (!job) { reply({ jobId: message.jobId, cancelled: false, error: 'unknown jobId' }); return; }
      const running = !isTerminal(job.state);
      if (running) finish(engine, job, 'cancelled', 'cancelled');
      reply({ jobId: job.jobId, cancelled: running });
    },
    'pow.pause': ({ state, windowId, message, reply }) => {
      if (message.jobId === undefined) {
        state.minerPaused = true;
        for (const job of state.jobs.values()) if (job.state === 'mining') transition(engine, job, 'paused');
        reply({});
        return;
      }
      const job = owned(state, windowId, message.jobId);
      if (!job) { reply({ jobId: message.jobId, error: 'unknown jobId' }); return; }
      if (job.state === 'mining' || job.state === 'queued') transition(engine, job, 'paused');
      schedule(engine, state);
      reply({ jobId: job.jobId });
    },
    'pow.resume': ({ state, windowId, message, reply }) => {
      if (message.jobId === undefined) {
        state.minerPaused = false;
        for (const job of state.jobs.values()) if (job.state === 'paused') transition(engine, job, 'queued');
        schedule(engine, state);
        reply({});
        return;
      }
      const job = owned(state, windowId, message.jobId);
      if (!job) { reply({ jobId: message.jobId, error: 'unknown jobId' }); return; }
      if (job.state === 'paused') transition(engine, job, 'queued');
      schedule(engine, state);
      reply({ jobId: job.jobId });
    },
  };
}

/**
 * Create the NAP-POW mock.
 *
 * @param options - Simulation knobs and policy caps.
 * @returns The mock service with an `advance()` control.
 * @example
 * ```ts
 * const pow = createMockPowService();
 * pow.handleMessage('win', { type: 'pow.mine', id: 'm1', jobId: 'job-1', template: { kind: 1, content: 'gm' }, target: 12 }, console.log);
 * pow.advance(2); // pushes pow.progress then pow.done
 * ```
 */
export function createMockPowService(options: MockPowOptions = {}): MockPowService {
  const seed = (options.seed ?? 1) + 0x504f57;
  const engine: PowEngine = {
    // Routes only read `engine.service` after the factory returns.
    get service() { return service; },
    options,
    maxConcurrent: options.maxConcurrent ?? 1,
    maxTarget: options.maxTarget ?? 32,
    maxWorkers: options.maxWorkers ?? 4,
    hashesPerWorker: options.hashesPerWorker ?? 250_000,
    stepMs: options.stepMs ?? 1000,
    bitsPerStep: options.bitsPerStep ?? 6,
    scheduler: options.scheduler ?? DEFAULT_SCHEDULER,
    clock: options.clock ?? DEFAULT_CLOCK,
    rng: createSeededRng(seed),
  };
  const service = defineMockService<MockPowState>({
    domain: 'pow',
    version: '0.1.0',
    description: 'Mock NAP-POW NIP-13 proof-of-work miner',
    kind: 'extension',
    pushes: { 'pow.state': null, 'pow.progress': null, 'pow.done': null, 'pow.error': null },
    initialState: () => ({ jobs: new Map(), order: [], minerPaused: false }),
    routes: powRoutes(engine),
    onWindowDestroyed: (windowId, state) => dropWindow(engine, state, windowId),
    onCapabilityRevoked: (windowId, _capability, state) => dropWindow(engine, state, windowId),
  }, options);

  const baseReset = service.mock.reset;
  service.mock.reset = () => {
    service.mock.state().tick?.();
    engine.rng = createSeededRng(seed);
    baseReset();
  };

  return Object.assign(service, { advance: (steps = 1) => advance(engine, steps) });
}

/**
 * Registry row for NAP-POW.
 *
 * @example
 * ```ts
 * POW_MOCK_ENTRY.create?.({ seed: 1 });
 * ```
 */
export const POW_MOCK_ENTRY: MockDomainEntry = {
  domain: 'pow',
  kind: 'extension',
  spec: POW_SPEC_REF,
  create: (options) => createMockPowService(options),
};

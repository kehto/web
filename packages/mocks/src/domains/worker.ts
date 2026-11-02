/**
 * domains/worker.ts — Mock NAP-WORKER extension.
 *
 * Spec: naps/NAP-WORKER.md @ napplet/naps PR #107 head 0a54af9a9838 (draft)
 * Routes: worker.info, worker.create, worker.post, worker.terminate
 * Pushes: worker.message, worker.error, worker.closed
 * Spec gaps / decisions:
 * - No source is executed. Every worker runs the same fixed program
 *   (`runMockWorkerProgram`): `{task:'sum',values}` → `{sum}`,
 *   `{task:'upper',text}` → `{text}`, `{task:'reverse',items}` → `{items}`,
 *   anything else → `{echo: data}`. Output follows the post acknowledgment
 *   by one scheduler tick.
 * - A source containing `throw` fails one tick after creation
 *   (`worker.error` EXECUTION_FAILED, then `worker.closed` failed); a source
 *   containing `close()` closes itself one tick after creation (`selfClosed`).
 * - `maxMessageBytes` is measured on the JSON encoding (UTF-16 code units).
 * - Closed worker records are retained for the window's lifetime so a closed
 *   id is distinguishable from one never issued.
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_SCHEDULER, defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockScheduler, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/**
 * NAP-WORKER draft the mock implements.
 *
 * @example
 * ```ts
 * WORKER_SPEC_REF.pr === 107;
 * ```
 */
export const WORKER_SPEC_REF: NapSpecRef = {
  nap: 'NAP-WORKER',
  status: 'draft',
  source: 'pr',
  pr: 107,
  sha: '0a54af9a9838',
  path: 'naps/NAP-WORKER.md',
};

/**
 * JSON-compatible worker data.
 *
 * @example
 * ```ts
 * const data: MockWorkerData = { task: 'sum', values: [2, 3] };
 * ```
 */
export type MockWorkerData = null | boolean | string | number | MockWorkerData[] | { [key: string]: MockWorkerData };

/**
 * Policy snapshot returned by `worker.info`.
 *
 * @example
 * ```ts
 * const limits: MockWorkerLimits = { ...MOCK_WORKER_LIMITS, maxWorkers: 1 };
 * ```
 */
export interface MockWorkerLimits {
  /** Live workers per endpoint. */
  maxWorkers: number;
  /** UTF-8 bytes of `source`. */
  maxSourceBytes: number;
  /** Encoded message size either direction. */
  maxMessageBytes: number;
  /** Pending messages per worker per direction. */
  maxQueuedMessages: number;
}

/**
 * Why a worker closed.
 *
 * @example
 * ```ts
 * const reason: MockWorkerCloseReason = 'terminated';
 * ```
 */
export type MockWorkerCloseReason = 'terminated' | 'selfClosed' | 'failed' | 'limitExceeded' | 'revoked';

/**
 * One allocated worker.
 *
 * @example
 * ```ts
 * const worker = service.mock.state().workers.get('w-0123abcd');
 * worker?.state === 'live';
 * ```
 */
export interface MockWorker {
  /** Opaque id. */
  workerId: string;
  /** Owning window. */
  windowId: string;
  /** Program source as supplied. */
  source: string;
  /** Lifecycle state. */
  state: 'live' | 'closed';
  /** Close reason once closed. */
  reason?: MockWorkerCloseReason;
  /** Messages accepted but not yet processed. */
  queued: number;
  /** Pending scheduler cancels. */
  timers: Set<() => void>;
}

/**
 * In-memory state of the mock worker extension.
 *
 * @example
 * ```ts
 * service.mock.state().workers.size;
 * ```
 */
export interface MockWorkerState {
  /** Policy limits. */
  limits: MockWorkerLimits;
  /** Worker id → record (closed records retained). */
  workers: Map<string, MockWorker>;
}

/**
 * Options for `createMockWorkerService`.
 *
 * @example
 * ```ts
 * const worker = createMockWorkerService({ limits: { maxWorkers: 1 }, tickMs: 0 });
 * ```
 */
export interface MockWorkerOptions extends MockServiceOptions {
  /** Override any policy limit. */
  limits?: Partial<MockWorkerLimits>;
  /** Delay before program output / failure events. Default 5. */
  tickMs?: number;
}

/**
 * Mock worker extension with output controls.
 *
 * @example
 * ```ts
 * const worker = createMockWorkerService();
 * worker.emitMessage('w-0123abcd', { ready: true });
 * ```
 */
export type MockWorkerService = MockService<MockWorkerState> & {
  /** Push program output from a live worker; `false` when unknown or closed. */
  emitMessage(workerId: string, data: MockWorkerData): boolean;
  /** Fail a live worker: `worker.error` then `worker.closed` (`failed`). */
  crash(workerId: string, message?: string): boolean;
};

/**
 * Default limits.
 *
 * @example
 * ```ts
 * MOCK_WORKER_LIMITS.maxWorkers === 4;
 * ```
 */
export const MOCK_WORKER_LIMITS: MockWorkerLimits = Object.freeze({
  maxWorkers: 4,
  maxSourceBytes: 65_536,
  maxMessageBytes: 16_384,
  maxQueuedMessages: 32,
});

type Context = MockRouteContext<MockWorkerState>;

/**
 * Whether a value is `WorkerData`: null, boolean, text, finite number, list
 * or plain map of `WorkerData`.
 *
 * @param value - Candidate.
 * @returns Type guard result.
 * @example
 * ```ts
 * isMockWorkerData({ task: 'sum', values: [2, 3] }) === true;
 * isMockWorkerData(() => 1) === false;
 * ```
 */
export function isMockWorkerData(value: unknown): value is MockWorkerData {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isMockWorkerData);
  if (typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value as Record<string, unknown>).every(isMockWorkerData);
}

/**
 * The fixed program every mock worker runs.
 *
 * @param data - Posted data.
 * @returns Program output.
 * @example
 * ```ts
 * runMockWorkerProgram({ task: 'sum', values: [2, 3] }); // { sum: 5 }
 * ```
 */
export function runMockWorkerProgram(data: MockWorkerData): MockWorkerData {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const { task, values, text, items } = data;
    if (task === 'sum' && Array.isArray(values) && values.every((item) => typeof item === 'number')) {
      return { sum: (values as number[]).reduce((total, item) => total + item, 0) };
    }
    if (task === 'upper' && typeof text === 'string') return { text: text.toUpperCase() };
    if (task === 'reverse' && Array.isArray(items)) return { items: [...items].reverse() };
  }
  return { echo: data };
}

function requestId(message: Record<string, unknown>): string | undefined {
  return typeof message.id === 'string' && message.id.length > 0 ? message.id : undefined;
}

function reject(push: (msg: NappletMessage) => void, type: string, id: string, code: string, message: string): void {
  push({ type: `${type}.result`, id, ok: false, error: { code, message } } as NappletMessage);
}

function ownedWorker(state: MockWorkerState, windowId: string, workerId: unknown): MockWorker | undefined {
  const worker = typeof workerId === 'string' ? state.workers.get(workerId) : undefined;
  return worker && worker.windowId === windowId ? worker : undefined;
}

/**
 * Create the mock NAP-WORKER extension.
 *
 * @param options - Limits and tick cadence.
 * @returns An extension handler (every route published with `null` capability) with mock controls.
 * @example
 * ```ts
 * const worker = createMockWorkerService();
 * worker.handleMessage('win-1', { type: 'worker.create', id: 'c1', source: 'self.onmessage = () => {}' }, console.log);
 * ```
 */
export function createMockWorkerService(options: MockWorkerOptions = {}): MockWorkerService {
  const scheduler: MockScheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const tickMs = options.tickMs ?? 5;
  const encoder = new TextEncoder();

  const later = (worker: MockWorker, fn: () => void): void => {
    const cancel = scheduler.schedule(tickMs, () => { worker.timers.delete(cancel); if (worker.state === 'live') fn(); });
    worker.timers.add(cancel);
  };
  const close = (worker: MockWorker, reason: MockWorkerCloseReason, notify: boolean): void => {
    if (worker.state === 'closed') return;
    for (const cancel of worker.timers) cancel();
    worker.timers.clear();
    worker.state = 'closed';
    worker.reason = reason;
    worker.queued = 0;
    if (notify) pushToWindow(service, worker.windowId, { type: 'worker.closed', workerId: worker.workerId, reason } as NappletMessage);
  };
  const fail = (worker: MockWorker, code: string, message: string, reason: MockWorkerCloseReason): void => {
    pushToWindow(service, worker.windowId, { type: 'worker.error', workerId: worker.workerId, error: { code, message } } as NappletMessage);
    close(worker, reason, true);
  };

  const createRoute = ({ message, windowId, state, reply, push, rng }: Context): void => {
    const id = requestId(message);
    if (!id) return;
    const source = message.source;
    if (typeof source !== 'string' || source.length === 0) { reject(push, 'worker.create', id, 'INVALID_REQUEST', 'source must be non-empty text.'); return; }
    if (encoder.encode(source).length > state.limits.maxSourceBytes) { reject(push, 'worker.create', id, 'LIMIT_EXCEEDED', 'source exceeds maxSourceBytes.'); return; }
    const live = [...state.workers.values()].filter((item) => item.windowId === windowId && item.state === 'live').length;
    if (live >= state.limits.maxWorkers) { reject(push, 'worker.create', id, 'LIMIT_EXCEEDED', 'maxWorkers reached for this endpoint.'); return; }
    const worker: MockWorker = { workerId: `w-${rng.hex(8)}`, windowId, source, state: 'live', queued: 0, timers: new Set() };
    state.workers.set(worker.workerId, worker);
    reply({ ok: true, workerId: worker.workerId });
    if (source.includes('throw')) later(worker, () => fail(worker, 'EXECUTION_FAILED', 'Uncaught error in worker program.', 'failed'));
    else if (source.includes('close()')) later(worker, () => close(worker, 'selfClosed', true));
  };

  const postRoute = ({ message, windowId, state, reply, push }: Context): void => {
    const id = requestId(message);
    if (!id) return;
    if (typeof message.workerId !== 'string') { reject(push, 'worker.post', id, 'INVALID_REQUEST', 'workerId must be text.'); return; }
    const worker = ownedWorker(state, windowId, message.workerId);
    if (!worker) { reject(push, 'worker.post', id, 'NOT_FOUND', 'No such worker for this endpoint.'); return; }
    if (worker.state === 'closed') { reject(push, 'worker.post', id, 'WORKER_CLOSED', 'The worker has closed.'); return; }
    if (!Object.hasOwn(message, 'data') || !isMockWorkerData(message.data)) { reject(push, 'worker.post', id, 'INVALID_REQUEST', 'data must be WorkerData.'); return; }
    const data = message.data;
    if (JSON.stringify(data).length > state.limits.maxMessageBytes) { reject(push, 'worker.post', id, 'LIMIT_EXCEEDED', 'data exceeds maxMessageBytes.'); return; }
    if (worker.queued >= state.limits.maxQueuedMessages) { reject(push, 'worker.post', id, 'LIMIT_EXCEEDED', 'The worker inbound queue is full.'); return; }
    worker.queued += 1;
    reply({ ok: true });
    later(worker, () => {
      worker.queued -= 1;
      pushToWindow(service, worker.windowId, { type: 'worker.message', workerId: worker.workerId, data: runMockWorkerProgram(data) } as NappletMessage);
    });
  };

  const terminateRoute = ({ message, windowId, state, reply, push }: Context): void => {
    const id = requestId(message);
    if (!id) return;
    if (typeof message.workerId !== 'string') { reject(push, 'worker.terminate', id, 'INVALID_REQUEST', 'workerId must be text.'); return; }
    const worker = ownedWorker(state, windowId, message.workerId);
    if (!worker) { reject(push, 'worker.terminate', id, 'NOT_FOUND', 'No such worker for this endpoint.'); return; }
    close(worker, 'terminated', true);
    reply({ ok: true });
  };

  const base = defineMockService<MockWorkerState>({
    domain: 'worker',
    version: '1.0.0',
    description: 'Mock NAP-WORKER: runtime-owned workers running a fixed echo/transform program',
    kind: 'extension',
    pushes: { 'worker.message': null, 'worker.error': null, 'worker.closed': null },
    initialState: () => ({ limits: { ...MOCK_WORKER_LIMITS, ...options.limits }, workers: new Map() }),
    routes: {
      'worker.info': ({ message, state, reply }) => { if (requestId(message)) reply({ ok: true, limits: { ...state.limits } }); },
      'worker.create': createRoute,
      'worker.post': postRoute,
      'worker.terminate': terminateRoute,
    },
    onWindowDestroyed: (windowId, state) => {
      for (const [workerId, worker] of state.workers) {
        if (worker.windowId !== windowId) continue;
        close(worker, 'terminated', false);
        state.workers.delete(workerId);
      }
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability !== null && !capability.startsWith('worker')) return;
      for (const worker of state.workers.values()) if (worker.windowId === windowId) close(worker, 'revoked', true);
    },
  }, options);

  const baseReset = base.mock.reset;
  base.mock.reset = () => {
    for (const worker of base.mock.state().workers.values()) close(worker, 'terminated', false);
    baseReset();
  };

  const service: MockWorkerService = Object.assign(base, {
    emitMessage(workerId: string, data: MockWorkerData): boolean {
      const worker = base.mock.state().workers.get(workerId);
      if (!worker || worker.state !== 'live') return false;
      return pushToWindow(service, worker.windowId, { type: 'worker.message', workerId, data } as NappletMessage);
    },
    crash(workerId: string, message = 'Uncaught error in worker program.'): boolean {
      const worker = base.mock.state().workers.get(workerId);
      if (!worker || worker.state !== 'live') return false;
      fail(worker, 'EXECUTION_FAILED', message, 'failed');
      return true;
    },
  });
  return service;
}

/**
 * Registry row for the `worker` domain.
 *
 * @example
 * ```ts
 * WORKER_MOCK_ENTRY.create?.({ seed: 1 }).descriptor.name === 'worker';
 * ```
 */
export const WORKER_MOCK_ENTRY: MockDomainEntry = {
  domain: 'worker',
  kind: 'extension',
  spec: WORKER_SPEC_REF,
  create: (options) => createMockWorkerService(options),
};

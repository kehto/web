import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { MOCK_WORKER_LIMITS, WORKER_MOCK_ENTRY, WORKER_SPEC_REF, createMockWorkerService, isMockWorkerData, runMockWorkerProgram } from './worker.js';

type Msg = NappletMessage & Record<string, unknown>;

function manualScheduler() {
  const queue: Array<() => void> = [];
  const scheduler: MockScheduler = {
    schedule: (_ms, fn) => {
      queue.push(fn);
      return () => { const index = queue.indexOf(fn); if (index >= 0) queue.splice(index, 1); };
    },
  };
  const drain = (): void => { while (queue.length > 0) (queue.shift() as () => void)(); };
  return { scheduler, queue, drain };
}

function setup(options: Parameters<typeof createMockWorkerService>[0] = {}) {
  const timers = manualScheduler();
  const service = createMockWorkerService({ scheduler: timers.scheduler, ...options });
  const sent: Msg[] = [];
  const send = (msg: NappletMessage): void => { sent.push(msg as Msg); };
  const call = (message: Record<string, unknown>, windowId = 'w1') => service.handleMessage(windowId, message as unknown as NappletMessage, send);
  const last = (): Msg => sent.at(-1) as Msg;
  const create = (windowId = 'w1', source = 'self.onmessage = (e) => self.postMessage(e.data)'): string => {
    call({ type: 'worker.create', id: `create-${sent.length}`, source }, windowId);
    return last().workerId as string;
  };
  return { service, sent, call, last, create, ...timers };
}

describe('createMockWorkerService', () => {
  it('is an extension publishing every route with a null capability', () => {
    const { service } = setup();
    expect(service.descriptor.name).toBe('worker');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.mock.routes).toEqual(['worker.info', 'worker.create', 'worker.post', 'worker.terminate']);
    expect(service.messageCapabilities).toEqual({ 'worker.info': null, 'worker.create': null, 'worker.post': null, 'worker.terminate': null });
    expect(WORKER_MOCK_ENTRY).toMatchObject({ domain: 'worker', kind: 'extension', spec: WORKER_SPEC_REF });
    expect(WORKER_SPEC_REF).toEqual({ nap: 'NAP-WORKER', status: 'draft', source: 'pr', pr: 107, sha: '0a54af9a9838', path: 'naps/NAP-WORKER.md' });
  });

  it('worker.info returns the limits snapshot', () => {
    const { call, last } = setup({ limits: { maxWorkers: 2 } });
    call({ type: 'worker.info', id: 'i1' });
    expect(last()).toEqual({ type: 'worker.info.result', id: 'i1', ok: true, limits: { ...MOCK_WORKER_LIMITS, maxWorkers: 2 } });
  });

  it('worker.create allocates ids and enforces source and worker-count limits', () => {
    const { call, last, sent } = setup({ limits: { maxWorkers: 1, maxSourceBytes: 16 } });
    call({ type: 'worker.create', id: 'c1', source: 'postMessage(1)' });
    expect(last().type).toBe('worker.create.result');
    expect(last().id).toBe('c1');
    expect(last().ok).toBe(true);
    expect(last().workerId).toMatch(/^w-[0-9a-f]{8}$/);
    call({ type: 'worker.create', id: 'c2', source: '' });
    expect(last()).toEqual({ type: 'worker.create.result', id: 'c2', ok: false, error: { code: 'INVALID_REQUEST', message: 'source must be non-empty text.' } });
    call({ type: 'worker.create', id: 'c3', source: 'ünïcödé bytes overflow' });
    expect(last()).toEqual({ type: 'worker.create.result', id: 'c3', ok: false, error: { code: 'LIMIT_EXCEEDED', message: 'source exceeds maxSourceBytes.' } });
    call({ type: 'worker.create', id: 'c4', source: 'postMessage(2)' });
    expect(last()).toEqual({ type: 'worker.create.result', id: 'c4', ok: false, error: { code: 'LIMIT_EXCEEDED', message: 'maxWorkers reached for this endpoint.' } });
    call({ type: 'worker.create', source: 'postMessage(3)' });
    expect(sent).toHaveLength(4);
  });

  it('worker.post acknowledges first, then the program answers one tick later in order', () => {
    const { call, last, sent, create, queue, drain } = setup();
    const workerId = create();
    sent.length = 0;
    call({ type: 'worker.post', id: 'p1', workerId, data: { task: 'sum', values: [2, 3] } });
    call({ type: 'worker.post', id: 'p2', workerId, data: { task: 'upper', text: 'debian' } });
    call({ type: 'worker.post', id: 'p3', workerId, data: ['a', null, 1.5] });
    expect(sent).toEqual([
      { type: 'worker.post.result', id: 'p1', ok: true },
      { type: 'worker.post.result', id: 'p2', ok: true },
      { type: 'worker.post.result', id: 'p3', ok: true },
    ]);
    expect(queue).toHaveLength(3);
    drain();
    expect(sent.slice(3)).toEqual([
      { type: 'worker.message', workerId, data: { sum: 5 } },
      { type: 'worker.message', workerId, data: { text: 'DEBIAN' } },
      { type: 'worker.message', workerId, data: { echo: ['a', null, 1.5] } },
    ]);
    expect(runMockWorkerProgram({ task: 'reverse', items: [1, 2, 3] })).toEqual({ items: [3, 2, 1] });
    call({ type: 'worker.post', id: 'p4', workerId, data: { fn: () => 1 } as unknown as Record<string, unknown> });
    expect(last()).toEqual({ type: 'worker.post.result', id: 'p4', ok: false, error: { code: 'INVALID_REQUEST', message: 'data must be WorkerData.' } });
    call({ type: 'worker.post', id: 'p5', workerId });
    expect((last().error as { code: string }).code).toBe('INVALID_REQUEST');
    expect(isMockWorkerData({ nested: [{ ok: true }, 'x', 2] })).toBe(true);
    expect(isMockWorkerData(Number.NaN)).toBe(false);
    expect(isMockWorkerData(new Map())).toBe(false);
    call({ type: 'worker.post', id: 'p6', workerId: 'w-00000000', data: 1 });
    expect(last()).toEqual({ type: 'worker.post.result', id: 'p6', ok: false, error: { code: 'NOT_FOUND', message: 'No such worker for this endpoint.' } });
    call({ type: 'worker.post', id: 'p7', workerId, data: 1 }, 'w2');
    expect((last().error as { code: string }).code).toBe('NOT_FOUND');
  });

  it('enforces message size and inbound queue limits', () => {
    const { call, last, create } = setup({ limits: { maxMessageBytes: 8, maxQueuedMessages: 1 } });
    const workerId = create();
    call({ type: 'worker.post', id: 'p1', workerId, data: 'this is longer than eight' });
    expect(last()).toEqual({ type: 'worker.post.result', id: 'p1', ok: false, error: { code: 'LIMIT_EXCEEDED', message: 'data exceeds maxMessageBytes.' } });
    call({ type: 'worker.post', id: 'p2', workerId, data: 1 });
    expect(last().ok).toBe(true);
    call({ type: 'worker.post', id: 'p3', workerId, data: 2 });
    expect(last()).toEqual({ type: 'worker.post.result', id: 'p3', ok: false, error: { code: 'LIMIT_EXCEEDED', message: 'The worker inbound queue is full.' } });
  });

  it('worker.terminate emits closed before the acknowledgment, is idempotent and discards pending output', () => {
    const { call, last, sent, create, queue, drain } = setup();
    const workerId = create();
    call({ type: 'worker.post', id: 'p1', workerId, data: 1 });
    sent.length = 0;
    call({ type: 'worker.terminate', id: 't1', workerId });
    expect(sent).toEqual([
      { type: 'worker.closed', workerId, reason: 'terminated' },
      { type: 'worker.terminate.result', id: 't1', ok: true },
    ]);
    expect(queue).toHaveLength(0);
    drain();
    expect(sent).toHaveLength(2);
    call({ type: 'worker.terminate', id: 't2', workerId });
    expect(sent.slice(2)).toEqual([{ type: 'worker.terminate.result', id: 't2', ok: true }]);
    call({ type: 'worker.post', id: 'p2', workerId, data: 1 });
    expect(last()).toEqual({ type: 'worker.post.result', id: 'p2', ok: false, error: { code: 'WORKER_CLOSED', message: 'The worker has closed.' } });
    call({ type: 'worker.terminate', id: 't3', workerId: 'w-00000000' });
    expect(last()).toEqual({ type: 'worker.terminate.result', id: 't3', ok: false, error: { code: 'NOT_FOUND', message: 'No such worker for this endpoint.' } });
    call({ type: 'worker.terminate', id: 't4', workerId }, 'w2');
    expect((last().error as { code: string }).code).toBe('NOT_FOUND');
  });

  it('fails a throwing program after allocation, honors self close, and exposes crash/emit controls', () => {
    const { service, call, sent, create, drain } = setup();
    const failing = create('w1', 'throw new Error("boom")');
    expect(sent.at(-1)?.ok).toBe(true);
    drain();
    expect(sent.slice(-2)).toEqual([
      { type: 'worker.error', workerId: failing, error: { code: 'EXECUTION_FAILED', message: 'Uncaught error in worker program.' } },
      { type: 'worker.closed', workerId: failing, reason: 'failed' },
    ]);
    const quitter = create('w1', 'self.close()');
    drain();
    expect(sent.at(-1)).toEqual({ type: 'worker.closed', workerId: quitter, reason: 'selfClosed' });

    const live = create();
    expect(service.emitMessage(live, { ready: true })).toBe(true);
    expect(sent.at(-1)).toEqual({ type: 'worker.message', workerId: live, data: { ready: true } });
    expect(service.crash(live, 'out of memory')).toBe(true);
    expect(sent.slice(-2)).toEqual([
      { type: 'worker.error', workerId: live, error: { code: 'EXECUTION_FAILED', message: 'out of memory' } },
      { type: 'worker.closed', workerId: live, reason: 'failed' },
    ]);
    expect(service.crash(live)).toBe(false);
    expect(service.emitMessage(live, 1)).toBe(false);
    call({ type: 'worker.terminate', id: 't1', workerId: live });
    expect(sent.at(-1)).toEqual({ type: 'worker.terminate.result', id: 't1', ok: true });
    expect(sent.filter((msg) => msg.type === 'worker.closed' && msg.workerId === live)).toHaveLength(1);
  });

  it('terminates on window destruction silently, closes with revoked on revocation, and resets timers', () => {
    const { service, call, sent, create, queue } = setup();
    const first = create('w1');
    const second = create('w2');
    call({ type: 'worker.post', id: 'p1', workerId: first, data: 1 });
    sent.length = 0;
    service.onWindowDestroyed?.('w1');
    expect(sent).toEqual([]);
    expect(queue).toHaveLength(0);
    expect(service.mock.state().workers.has(first)).toBe(false);
    service.onCapabilityRevoked?.('w2', null);
    expect(sent).toEqual([{ type: 'worker.closed', workerId: second, reason: 'revoked' }]);
    expect(service.mock.state().workers.get(second)?.state).toBe('closed');
    const third = create('w3');
    call({ type: 'worker.post', id: 'p2', workerId: third, data: 1 }, 'w3');
    expect(queue).toHaveLength(1);
    service.mock.reset();
    expect(queue).toHaveLength(0);
    expect(service.mock.state().workers.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});

/**
 * Per-endpoint NAP-CVM admission (kehto/web#355).
 *
 * Spec checked: NAP-CVM napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f.
 * - Security Considerations: shells SHOULD apply per-napplet concurrency limits.
 * - Timeouts: the accepted duration runs from receipt through queueing; expiry
 *   returns `relay timeout`.
 * - Sessions: `close` completes pending operations with `session closed`
 *   before acknowledging and never interrupts another endpoint.
 * Spec gap: the draft's error table has no load-shedding entry, so a full
 * queue is refused with `policy denied` (shell policy), not an invented code.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';
import { createCvmAdmission, DEFAULT_CVM_MAX_IN_FLIGHT, DEFAULT_CVM_MAX_QUEUED } from './cvm-admission.js';
import { createCvmOperations } from './cvm-operations.js';
import { createCvmService, type CvmTransport } from './cvm-service.js';
import type { CvmRequestOptions, CvmServerRef, McpMessage } from './cvm-types.js';

const SERVER: CvmServerRef = { pubkey: 'a'.repeat(64), relays: ['wss://relay.example'] };
const OTHER: CvmServerRef = { pubkey: 'b'.repeat(64), relays: ['wss://relay.example'] };

interface Call {
  server: CvmServerRef;
  message: McpMessage;
  options?: CvmRequestOptions;
  signal: ApprovalSignal;
  resolve(message?: McpMessage): void;
  reject(error: Error): void;
}

/** Transport whose requests stay in flight until the test settles them. */
function deferredTransport() {
  const calls: Call[] = [];
  const transport = {
    discover: vi.fn(async () => []),
    close: vi.fn(async () => {}),
    dispose: vi.fn(),
    onEvent: () => ({ close() {} }),
    request: vi.fn((server: CvmServerRef, message: McpMessage, options?: CvmRequestOptions, execution?: { signal: ApprovalSignal }) =>
      new Promise<McpMessage>((resolve, reject) => {
        calls.push({ server, message, options, signal: execution!.signal, reject,
          resolve: (value = { jsonrpc: '2.0', id: message.id, result: {} }) => resolve(value) });
      })),
  } satisfies CvmTransport;
  return { transport, calls };
}

function request(id: string, server = SERVER, options?: CvmRequestOptions): NappletMessage {
  return { type: 'cvm.request', id, server, message: { jsonrpc: '2.0', id, method: 'tools/call' }, ...(options ? { options } : {}) } as NappletMessage;
}

function inbox() {
  const sent: Array<Record<string, unknown>> = [];
  return { sent, send: (message: NappletMessage) => { sent.push(message as unknown as Record<string, unknown>); } };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => { vi.useRealTimers(); });

describe('createCvmAdmission', () => {
  it('defaults to 8 running and 32 queued per owner', () => {
    expect([DEFAULT_CVM_MAX_IN_FLIGHT, DEFAULT_CVM_MAX_QUEUED]).toEqual([8, 32]);
    const admission = createCvmAdmission();
    const started = vi.fn();
    const tickets = Array.from({ length: 41 }, () => admission.admit('a', started));
    expect(started).toHaveBeenCalledTimes(8);
    expect(tickets.filter(Boolean)).toHaveLength(40);
    expect(tickets[40]).toBeUndefined();
    expect([admission.inFlight('a'), admission.queued('a')]).toEqual([8, 32]);
  });

  it('starts waiters in arrival order and forgets idle owners', () => {
    const admission = createCvmAdmission({ maxInFlight: 1, maxQueued: 2 });
    const order: string[] = [];
    const first = admission.admit('a', () => order.push('first'))!;
    const second = admission.admit('a', () => order.push('second'))!;
    const third = admission.admit('a', () => order.push('third'))!;
    expect(order).toEqual(['first']);
    first.release();
    first.release();
    expect(order).toEqual(['first', 'second']);
    expect([admission.inFlight('a'), admission.queued('a')]).toEqual([1, 1]);
    second.release();
    third.release();
    expect(order).toEqual(['first', 'second', 'third']);
    expect([admission.inFlight('a'), admission.queued('a')]).toEqual([0, 0]);
  });

  it('gives a queue position back without starting it', () => {
    const admission = createCvmAdmission({ maxInFlight: 1, maxQueued: 1 });
    const running = admission.admit('a', () => {})!;
    const start = vi.fn();
    admission.admit('a', start)!.release();
    expect(admission.queued('a')).toBe(0);
    running.release();
    expect(start).not.toHaveBeenCalled();
    expect(admission.inFlight('a')).toBe(0);
  });

  it('keeps a slot held when start throws until the ticket is released', () => {
    const admission = createCvmAdmission({ maxInFlight: 1, maxQueued: 0 });
    const ticket = admission.admit('a', () => { throw new Error('boom'); })!;
    expect(admission.admit('a', () => {})).toBeUndefined();
    ticket.release();
    expect(admission.admit('a', () => {})).toBeDefined();
  });

  it.each([
    { maxInFlight: 0 }, { maxInFlight: 1.5 }, { maxInFlight: Number.POSITIVE_INFINITY },
    { maxQueued: -1 }, { maxQueued: Number.NaN },
  ])('rejects out-of-range limits %j', (options) => {
    expect(() => createCvmAdmission(options)).toThrow(RangeError);
    expect(() => createCvmService({ transport: deferredTransport().transport, concurrency: options })).toThrow(RangeError);
  });
});

describe('createCvmOperations', () => {
  it('reports the remaining budget and refuses to run past the deadline', async () => {
    vi.useFakeTimers();
    const operations = createCvmOperations({ maxInFlight: 1, maxQueued: 1 });
    const remaining: number[] = [];
    const errors: unknown[] = [];
    let finish!: () => void;
    operations.run('a', 1_000, [], () => new Promise<void>((resolve) => { finish = resolve; }), () => {}, () => {});
    operations.run('a', 1_000, [], async (work) => { remaining.push(work.remaining()); }, () => {}, (error) => errors.push(error));
    await vi.advanceTimersByTimeAsync(400);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(remaining).toEqual([600]);
    expect(errors).toEqual([]);
    expect([operations.inFlight('a'), operations.queued('a')]).toEqual([0, 0]);
  });
});

describe('CVM service admission', () => {
  it('runs up to the limit, queues the rest in order, and starts them as slots free up', async () => {
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 2, maxQueued: 2 } });
    const { sent, send } = inbox();
    for (const id of ['r1', 'r2', 'r3', 'r4']) service.handleMessage('a', request(id), send);
    await tick();
    expect(calls.map((call) => call.message.id)).toEqual(['r1', 'r2']);
    calls[0].resolve();
    await tick();
    expect(calls.map((call) => call.message.id)).toEqual(['r1', 'r2', 'r3']);
    calls[1].reject(new Error('provider unavailable'));
    await tick();
    expect(calls.map((call) => call.message.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    calls[2].resolve();
    calls[3].resolve();
    await tick();
    expect(sent.map((message) => [message.id, message.error])).toEqual([
      ['r1', undefined], ['r2', 'provider unavailable'], ['r3', undefined], ['r4', undefined],
    ]);
    service.dispose();
  });

  it('refuses work beyond the queue at once with policy denied and without touching the transport', async () => {
    const { transport, calls } = deferredTransport();
    const authorizeOperation = vi.fn(async (_w: string, _o: string, _r: unknown, execute: (signal: ApprovalSignal) => Promise<unknown>) =>
      ({ status: 'executed' as const, value: await execute(new AbortController().signal) }));
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 1 } });
    service.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
    const { sent, send } = inbox();
    for (const id of ['r1', 'r2', 'r3']) service.handleMessage('a', request(id), send);
    await tick();
    expect(sent).toEqual([{ type: 'cvm.request.result', id: 'r3', error: 'policy denied' }]);
    // Neither the queued nor the refused request reached approval or the transport.
    expect(authorizeOperation).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    service.dispose();
  });

  it('counts discover and registry envelopes against the same endpoint budget', async () => {
    const { transport, calls } = deferredTransport();
    let finishDiscover!: () => void;
    transport.discover.mockImplementation(() => new Promise((resolve) => { finishDiscover = () => resolve([]); }));
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 1 },
      registry: [{ family: 'weather', server: SERVER, tools: [{ name: 'get_weather', schemaHash: 'c'.repeat(64) }] }] });
    const { sent, send } = inbox();
    service.handleMessage('a', { type: 'cvm.discover', id: 'd1' } as NappletMessage, send);
    service.handleMessage('a', { type: 'cvm.registry.describe', id: 'g1', selector: { family: 'weather' } } as unknown as NappletMessage, send);
    service.handleMessage('a', request('r1'), send);
    await tick();
    expect(sent).toEqual([{ type: 'cvm.request.result', id: 'r1', error: 'policy denied' }]);
    expect(calls).toHaveLength(0);
    finishDiscover();
    await tick();
    expect(calls.map((call) => call.message.method)).toEqual(['tools/list']);
    service.dispose();
  });

  it('never queues or refuses cvm.close', async () => {
    const { transport } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 0 } });
    const { sent, send } = inbox();
    service.handleMessage('a', request('r1'), send);
    service.handleMessage('a', { type: 'cvm.close', id: 'c1', server: OTHER } as NappletMessage, send);
    await tick();
    expect(sent).toEqual([{ type: 'cvm.close.result', id: 'c1' }]);
    service.dispose();
  });
});

describe('CVM admission isolation', () => {
  it('does not let an exhausted endpoint consume or delay another endpoint', async () => {
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 1 } });
    const greedy = inbox();
    const quiet = inbox();
    for (const id of ['g1', 'g2', 'g3', 'g4']) service.handleMessage('greedy', request(id), greedy.send);
    service.handleMessage('quiet', request('q1'), quiet.send);
    await tick();
    expect(greedy.sent.map((message) => message.error)).toEqual(['policy denied', 'policy denied']);
    expect(calls.map((call) => call.message.id)).toEqual(['g1', 'q1']);
    calls[1].resolve();
    await tick();
    expect(quiet.sent).toEqual([expect.objectContaining({ type: 'cvm.request.result', id: 'q1', message: expect.anything() })]);
    // The greedy endpoint's own queue is untouched by its neighbour finishing.
    expect(calls).toHaveLength(2);
    service.dispose();
  });

  it('budgets two windows of the same napplet separately', async () => {
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 0 } });
    service.onRegistered?.({ resolveDTag: () => 'same-napplet' } as unknown as ServiceRuntimeContext);
    const first = inbox();
    const second = inbox();
    service.handleMessage('window-1', request('a1'), first.send);
    service.handleMessage('window-2', request('b1'), second.send);
    service.handleMessage('window-1', request('a2'), first.send);
    await tick();
    expect(calls.map((call) => call.message.id)).toEqual(['a1', 'b1']);
    expect(first.sent).toEqual([{ type: 'cvm.request.result', id: 'a2', error: 'policy denied' }]);
    expect(second.sent).toEqual([]);
    service.dispose();
  });
});

describe('CVM admission deadline', () => {
  it('spends queued time from the request deadline and hands the transport only what is left', async () => {
    vi.useFakeTimers();
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 1 } });
    const { send } = inbox();
    service.handleMessage('a', request('r1', SERVER, { timeoutMs: 60_000 }), send);
    service.handleMessage('a', request('r2', SERVER, { timeoutMs: 10_000, initialize: true }), send);
    await vi.advanceTimersByTimeAsync(4_000);
    calls[0].resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls[0].options).toEqual({ timeoutMs: 60_000 });
    expect(calls[1].options).toEqual({ timeoutMs: 6_000, initialize: true });
    service.dispose();
  });

  it('expires a request that never leaves the queue with relay timeout and never publishes it', async () => {
    vi.useFakeTimers();
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 2 } });
    const { sent, send } = inbox();
    service.handleMessage('a', request('r1', SERVER, { timeoutMs: 60_000 }), send);
    service.handleMessage('a', request('r2', SERVER, { timeoutMs: 1_000 }), send);
    service.handleMessage('a', request('r3', SERVER, { timeoutMs: 60_000 }), send);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sent).toEqual([{ type: 'cvm.request.result', id: 'r2', error: 'relay timeout' }]);
    calls[0].resolve();
    await vi.advanceTimersByTimeAsync(0);
    // The expired entry left the queue: the next slot goes to r3, never r2.
    expect(calls.map((call) => call.message.id)).toEqual(['r1', 'r3']);
    calls[1].resolve({ jsonrpc: '2.0', id: 'r3', result: {} });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.filter((message) => message.id === 'r2')).toHaveLength(1);
    service.dispose();
  });

  it('applies the default 30 s deadline and rejects an out-of-range timeout before admission', async () => {
    vi.useFakeTimers();
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 0 } });
    const { sent, send } = inbox();
    for (const timeoutMs of [0, 300_001, 1.5]) service.handleMessage('a', request(`bad-${timeoutMs}`, SERVER, { timeoutMs }), send);
    expect(sent.map((message) => message.error)).toEqual(['invalid timeout', 'invalid timeout', 'invalid timeout']);
    sent.length = 0;
    service.handleMessage('a', request('r1'), send);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls[0].options).toEqual({ timeoutMs: 30_000 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sent).toEqual([{ type: 'cvm.request.result', id: 'r1', error: 'relay timeout' }]);
    expect(calls[0].signal.aborted).toBe(true);
    // The timed-out slot is free again.
    service.handleMessage('a', request('r2'), send);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
    service.dispose();
  });

  it('counts time spent waiting for approval against the same deadline', async () => {
    vi.useFakeTimers();
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport });
    let approve!: () => void;
    service.onRegistered?.({ authorizeOperation: (_w: string, _o: string, _r: unknown, execute: (signal: ApprovalSignal) => Promise<unknown>) =>
      new Promise((resolve) => { approve = () => resolve(Promise.resolve(execute(new AbortController().signal)).then((value) => ({ status: 'executed', value }))); }),
    } as unknown as ServiceRuntimeContext);
    const { send } = inbox();
    service.handleMessage('a', request('r1', SERVER, { timeoutMs: 5_000 }), send);
    await vi.advanceTimersByTimeAsync(2_000);
    approve();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls[0].options).toEqual({ timeoutMs: 3_000 });
    service.dispose();
  });
});

describe('CVM admission slot release', () => {
  /** One running, one queued; `act` must free both without a result from the transport. */
  async function saturated(act: (service: ReturnType<typeof createCvmService>, send: (message: NappletMessage) => void) => void) {
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 1 } });
    const first = inbox();
    service.handleMessage('a', request('r1'), first.send);
    service.handleMessage('a', request('r2'), first.send);
    await tick();
    act(service, first.send);
    await tick();
    return { transport, calls, service, first };
  }

  /** A fresh pair of requests must be admitted: one runs, one queues, neither is refused. */
  async function expectFreshBudget(service: ReturnType<typeof createCvmService>, calls: Call[]) {
    const before = calls.length;
    const next = inbox();
    service.handleMessage('a', request('n1'), next.send);
    service.handleMessage('a', request('n2'), next.send);
    await tick();
    expect(next.sent).toEqual([]);
    expect(calls.slice(before).map((call) => call.message.id)).toEqual(['n1']);
  }

  it('releases on explicit close, answering pending and queued work with session closed first', async () => {
    const { calls, service, first, transport } = await saturated((svc, send) =>
      svc.handleMessage('a', { type: 'cvm.close', id: 'c1', server: SERVER } as NappletMessage, send));
    expect(first.sent).toEqual([
      { type: 'cvm.request.result', id: 'r1', error: 'session closed' },
      { type: 'cvm.request.result', id: 'r2', error: 'session closed' },
      { type: 'cvm.close.result', id: 'c1' },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(true);
    expect(transport.close).toHaveBeenCalledWith(SERVER);
    // A late transport answer is not a second result.
    calls[0].resolve();
    await tick();
    expect(first.sent).toHaveLength(3);
    await expectFreshBudget(service, calls);
    service.dispose();
  });

  it('close leaves operations for other servers and other endpoints running', async () => {
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 2, maxQueued: 0 } });
    const a = inbox();
    const b = inbox();
    service.handleMessage('a', request('a-server'), a.send);
    service.handleMessage('a', request('a-other', OTHER), a.send);
    service.handleMessage('b', request('b-server'), b.send);
    await tick();
    service.handleMessage('a', { type: 'cvm.close', id: 'c1', server: SERVER } as NappletMessage, a.send);
    await tick();
    expect(a.sent).toEqual([
      { type: 'cvm.request.result', id: 'a-server', error: 'session closed' },
      { type: 'cvm.close.result', id: 'c1' },
    ]);
    expect(calls.map((call) => call.signal.aborted)).toEqual([true, false, false]);
    expect(b.sent).toEqual([]);
    // Endpoint b still holds a session with the server, so the shared transport session stays.
    expect(transport.close).not.toHaveBeenCalled();
    service.dispose();
  });

  it('releases on window destroy without replying to the retired endpoint', async () => {
    const { calls, service, first } = await saturated((svc) => svc.onWindowDestroyed?.('a'));
    expect(first.sent).toEqual([]);
    expect(calls[0].signal.aborted).toBe(true);
    await expectFreshBudget(service, calls);
    service.dispose();
  });

  it('releases on permission revocation', async () => {
    const { calls, service, first } = await saturated((svc) => svc.onPermissionRevoked?.('a'));
    expect(first.sent).toEqual([]);
    expect(calls[0].signal.aborted).toBe(true);
    await expectFreshBudget(service, calls);
    service.dispose();
  });

  it('releases when the approval coordinator cancels the running operation', async () => {
    const { transport, calls } = deferredTransport();
    let approval = new AbortController();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 0 } });
    service.onRegistered?.({ authorizeOperation: async (_w: string, _o: string, _r: unknown, execute: (signal: ApprovalSignal) => Promise<unknown>) => {
      try { return { status: 'executed', value: await execute(approval.signal) }; }
      catch { return { status: 'cancelled' }; }
    } } as unknown as ServiceRuntimeContext);
    const { sent, send } = inbox();
    service.handleMessage('a', request('r1'), send);
    await tick();
    approval.abort();
    await tick();
    expect(sent).toEqual([{ type: 'cvm.request.result', id: 'r1', error: 'policy denied' }]);
    expect(calls[0].signal.aborted).toBe(true);
    approval = new AbortController();
    service.handleMessage('a', request('r2'), send);
    await tick();
    expect(sent).toHaveLength(1);
    expect(calls.map((call) => call.message.id)).toEqual(['r1', 'r2']);
    service.dispose();
  });

  it('releases on runtime teardown (unregister) and on dispose', async () => {
    const unregistered = await saturated((svc) => svc.onUnregistered?.());
    expect(unregistered.first.sent).toEqual([]);
    expect(unregistered.calls[0].signal.aborted).toBe(true);
    await expectFreshBudget(unregistered.service, unregistered.calls);
    unregistered.service.dispose();

    const disposed = await saturated((svc) => svc.dispose());
    expect(disposed.first.sent).toEqual([]);
    expect(disposed.calls[0].signal.aborted).toBe(true);
    expect(disposed.transport.dispose).toHaveBeenCalledOnce();
  });

  it('gives a replacement endpoint on the same window id a fresh budget after the old one is retired', async () => {
    const { calls, service, first } = await saturated((svc) => svc.onWindowDestroyed?.('a'));
    const replacement = inbox();
    service.handleMessage('a', request('n1'), replacement.send);
    await tick();
    calls[0].resolve();
    calls[1].resolve({ jsonrpc: '2.0', id: 'n1', result: { fresh: true } });
    await tick();
    // The old endpoint's late answer goes nowhere; the new endpoint gets only its own.
    expect(first.sent).toEqual([]);
    expect(replacement.sent).toEqual([{ type: 'cvm.request.result', id: 'n1', message: { jsonrpc: '2.0', id: 'n1', result: { fresh: true } } }]);
    service.dispose();
  });
});

describe('CVM session retention', () => {
  it('releases the transport session of a request that failed, once its endpoint goes away', async () => {
    const { transport, calls } = deferredTransport();
    const service = createCvmService({ transport });
    const { sent, send } = inbox();
    service.handleMessage('a', request('r1'), send);
    await tick();
    calls[0].reject(new Error('relay timeout'));
    await tick();
    expect(sent).toEqual([{ type: 'cvm.request.result', id: 'r1', error: 'relay timeout' }]);
    service.onWindowDestroyed?.('a');
    await tick();
    expect(transport.close).toHaveBeenCalledWith(SERVER);
    service.dispose();
  });

  it('does not record a session for work that was refused, denied, or never left the queue', async () => {
    const { transport } = deferredTransport();
    const service = createCvmService({ transport, concurrency: { maxInFlight: 1, maxQueued: 1 } });
    service.onRegistered?.({ authorizeOperation: async () => ({ status: 'denied' }) } as unknown as ServiceRuntimeContext);
    const { sent, send } = inbox();
    for (const id of ['r1', 'r2', 'r3']) service.handleMessage('a', request(id), send);
    await tick();
    expect(sent.map((message) => message.error)).toEqual(['policy denied', 'policy denied', 'policy denied']);
    service.onWindowDestroyed?.('a');
    await tick();
    expect(transport.request).not.toHaveBeenCalled();
    expect(transport.close).not.toHaveBeenCalled();
    service.dispose();
  });
});

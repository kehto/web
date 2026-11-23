/**
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f) in
 * `createCvmService`: cancellation and server-request expiry.
 *
 * - Message handling: a shell that maps outgoing request ids must
 *   "consistently map request references such as cancellation", and
 *   "`notifications/cancelled` may refer only to this napplet's requests".
 * - Sessions and events: "Server requests still require a response or expire
 *   under session policy." The service uses the Timeouts bounds (default
 *   30000 ms, at most 300000 ms).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';

import { createCvmService, type CvmRequestHandle, type CvmTransport } from './cvm-service.js';
import type { CvmServerRef, McpMessage } from './cvm-types.js';

const SERVER: CvmServerRef = { pubkey: 'a'.repeat(64), relays: ['wss://relay.example'] };
const LIST = (id: string | number): McpMessage => ({ jsonrpc: '2.0', id, method: 'tools/list' });
const CANCEL = (requestId?: unknown): McpMessage =>
  ({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { ...(requestId === undefined ? {} : { requestId }), reason: 'user' } });

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function harness(options: { withCancel?: boolean; serverRequestTimeoutMs?: number } = {}) {
  const handlers = new Set<(server: CvmServerRef, message: McpMessage) => void>();
  /** Requests the server has not answered yet, by napplet MCP id. */
  const held = new Map<string, { handle?: CvmRequestHandle; answer: () => void }>();
  const settledHandles = new Set<CvmRequestHandle>();
  const publish = vi.fn(async (_server: CvmServerRef, _message: McpMessage) => {});
  const cancel = vi.fn(async (_server: CvmServerRef, handle: CvmRequestHandle, _message: McpMessage) => !settledHandles.has(handle));
  const transport = {
    discover: vi.fn(async () => []),
    request: vi.fn((_server: CvmServerRef, message: McpMessage, _options?: unknown, execution?: { handle?: CvmRequestHandle }) =>
      new Promise<McpMessage>((resolve) => {
        held.set(String(message.id), {
          handle: execution?.handle,
          answer: () => { if (execution?.handle) settledHandles.add(execution.handle); resolve({ jsonrpc: '2.0', id: message.id, result: {} }); },
        });
      })),
    publish,
    ...(options.withCancel === false ? {} : { cancel }),
    close: vi.fn(async () => {}),
    onEvent(handler: (server: CvmServerRef, message: McpMessage) => void) {
      handlers.add(handler);
      return { close: () => handlers.delete(handler) };
    },
  } satisfies CvmTransport;
  const svc = createCvmService({ transport, ...(options.serverRequestTimeoutMs !== undefined ? { serverRequestTimeoutMs: options.serverRequestTimeoutMs } : {}) });
  const sent: Record<string, NappletMessage[]> = {};
  const request = (windowId: string, id: string, message: unknown) =>
    svc.handleMessage(windowId, { type: 'cvm.request', id, server: SERVER, message } as NappletMessage, (reply) => { (sent[windowId] ??= []).push(reply); });
  const emit = (message: McpMessage) => { for (const handler of handlers) handler({ pubkey: SERVER.pubkey }, message); };
  const result = (windowId: string, id: string) => (sent[windowId] ?? []).find((item) => (item as { id?: string }).id === id);
  return { transport, publish, cancel, held, svc, request, emit, result };
}

describe('notifications/cancelled (NAP-CVM #31 @ 28cf1bdb)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  it('hands the cancellation of an in-flight request to the transport with that request\'s handle', async () => {
    const h = harness();
    h.request('win', 'call', LIST(2));
    await flush();
    const handle = h.held.get('2')!.handle;
    expect(handle).toBeDefined();
    h.request('win', 'cancel', CANCEL(2));
    await flush();
    expect(h.result('win', 'cancel')).toEqual({ type: 'cvm.request.result', id: 'cancel' });
    expect(h.cancel).toHaveBeenCalledTimes(1);
    expect(h.cancel.mock.calls[0][1]).toBe(handle);
    // The service passes the napplet's message; mapping the id is the transport's job.
    expect(h.cancel.mock.calls[0][2]).toEqual(CANCEL(2));
    expect(h.publish).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('drops the cancellation of a request that already settled, and still acknowledges it', async () => {
    const h = harness();
    h.request('win', 'call', LIST(2));
    await flush();
    h.held.get('2')!.answer();
    await flush();
    h.request('win', 'cancel', CANCEL(2));
    await flush();
    expect(h.result('win', 'cancel')).toEqual({ type: 'cvm.request.result', id: 'cancel' });
    expect(h.cancel).not.toHaveBeenCalled();
    expect(h.publish).not.toHaveBeenCalled();
  });

  // Spec-gap decision: a requestId that names no request of this napplet in
  // this session is `invalid message`, and nothing is published.
  it.each([
    ['an id this napplet never used', CANCEL(99)],
    ['a typed id that differs ("2" vs 2)', CANCEL('2')],
    ['no requestId', CANCEL()],
    ['a null requestId', CANCEL(null)],
  ])('rejects a cancellation naming %s with invalid message', async (_label, message) => {
    const h = harness();
    h.request('win', 'call', LIST(2));
    await flush();
    h.request('win', 'cancel', message);
    await flush();
    expect(h.result('win', 'cancel')).toEqual({ type: 'cvm.request.result', id: 'cancel', error: 'invalid message' });
    expect(h.cancel).not.toHaveBeenCalled();
    expect(h.publish).not.toHaveBeenCalled();
  });

  it('never lets one napplet cancel another\'s request with the same id', async () => {
    const h = harness();
    h.request('a', 'call', LIST(1));
    await flush();
    h.request('b', 'cancel', CANCEL(1));
    await flush();
    expect(h.result('b', 'cancel')).toEqual({ type: 'cvm.request.result', id: 'cancel', error: 'invalid message' });
    h.request('b', 'call', LIST(1));
    await flush();
    h.request('b', 'cancel-own', CANCEL(1));
    await flush();
    expect(h.cancel).toHaveBeenCalledTimes(1);
    expect(h.cancel.mock.calls[0][1]).toBe(h.held.get('1')!.handle);
    expect(h.cancel.mock.calls[0][1]).not.toBe(undefined);
  });

  it('forgets in-flight requests when the session closes', async () => {
    const h = harness();
    h.request('win', 'call', LIST(2));
    await flush();
    h.svc.handleMessage('win', { type: 'cvm.close', id: 'close', server: SERVER } as NappletMessage, () => {});
    await flush();
    h.request('win', 'cancel', CANCEL(2));
    await flush();
    // A closed session starts over, so id 2 is no longer this napplet's request.
    expect(h.result('win', 'cancel')).toEqual({ type: 'cvm.request.result', id: 'cancel', error: 'invalid message' });
    expect(h.cancel).not.toHaveBeenCalled();
  });

  describe('compatibility: KEHTO_CVM_TRANSPORT_CANCEL', () => {
    it('publishes the cancellation unchanged through a transport without cancel(), warning once', async () => {
      const h = harness({ withCancel: false });
      h.request('win', 'call', LIST(2));
      h.request('win', 'call-3', LIST(3));
      await flush();
      h.request('win', 'cancel', CANCEL(2));
      h.request('win', 'cancel-3', CANCEL(3));
      await flush();
      expect(h.result('win', 'cancel')).toEqual({ type: 'cvm.request.result', id: 'cancel' });
      expect(h.publish.mock.calls.map((call) => call[1])).toEqual([CANCEL(2), CANCEL(3)]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/^\[KEHTO_CVM_TRANSPORT_CANCEL\] .*Implement CvmTransport\.cancel\(\).*Warned once per CVM service\.$/u);
    });

    it('still drops settled and foreign cancellations without warning', async () => {
      const h = harness({ withCancel: false });
      h.request('win', 'call', LIST(2));
      await flush();
      h.held.get('2')!.answer();
      await flush();
      h.request('win', 'settled', CANCEL(2));
      h.request('win', 'foreign', CANCEL(5));
      await flush();
      expect(h.result('win', 'foreign')).toEqual({ type: 'cvm.request.result', id: 'foreign', error: 'invalid message' });
      expect(h.publish).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe('server requests expire (NAP-CVM #31 @ 28cf1bdb)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] }); });
  afterEach(() => { vi.useRealTimers(); });

  const tick = () => vi.advanceTimersByTimeAsync(0);

  async function delivered(options: { serverRequestTimeoutMs?: number } = {}) {
    const h = harness(options);
    h.request('win', 'open', LIST(1));
    await tick();
    h.held.get('1')!.answer();
    await tick();
    h.emit({ jsonrpc: '2.0', id: 'srv-1', method: 'roots/list' });
    return h;
  }

  it('answers a response before the default 30000 ms deadline', async () => {
    const h = await delivered();
    await vi.advanceTimersByTimeAsync(29_999);
    h.request('win', 'r', { jsonrpc: '2.0', id: 'srv-1', result: { roots: [] } });
    await tick();
    expect(h.result('win', 'r')).toEqual({ type: 'cvm.request.result', id: 'r' });
  });

  it('treats a response after the deadline as unmatched', async () => {
    const h = await delivered();
    await vi.advanceTimersByTimeAsync(30_000);
    h.request('win', 'r', { jsonrpc: '2.0', id: 'srv-1', result: { roots: [] } });
    await tick();
    expect(h.result('win', 'r')).toEqual({ type: 'cvm.request.result', id: 'r', error: 'invalid message' });
    expect(h.publish).not.toHaveBeenCalled();
  });

  it('honours a configured serverRequestTimeoutMs', async () => {
    const h = await delivered({ serverRequestTimeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    h.request('win', 'r', { jsonrpc: '2.0', id: 'srv-1', result: {} });
    await tick();
    expect(h.result('win', 'r')).toEqual({ type: 'cvm.request.result', id: 'r', error: 'invalid message' });
  });

  it.each([0, -1, 1.5, 300_001, Number.NaN])('rejects serverRequestTimeoutMs %s outside the Timeouts bounds', (value) => {
    expect(() => harness({ serverRequestTimeoutMs: value })).toThrow(RangeError);
  });
});

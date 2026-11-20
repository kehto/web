/**
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f): a
 * napplet's `notifications/cancelled` for its own request that has not
 * settled yet (kehto/web#510).
 *
 * - Message handling: "`notifications/cancelled` may refer only to this
 *   napplet's requests"; a notification completes "After transport
 *   publication, result without `message`".
 * - Error Handling: every request "return[s] exactly one corresponding
 *   `.result` with the same envelope `id`".
 * - Timeouts: "A late response MUST NOT produce a second result or be
 *   redelivered as `cvm.event`."
 * - MCP 2025-11-25 cancellation: "The sender of the cancellation notification
 *   SHOULD ignore any response to the request that arrives afterward."
 *
 * Spec-gap decision: the draft's error table has no entry for a request the
 * napplet cancelled itself. The service settles it with `session closed`, the
 * one code for pending work the calling endpoint ended locally.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';

import { createCvmService, type CvmRequestHandle, type CvmTransport } from './cvm-service.js';
import type { CvmConcurrencyOptions } from './cvm-admission.js';
import type { CvmServerRef, McpMessage } from './cvm-types.js';

const SERVER: CvmServerRef = { pubkey: 'a'.repeat(64), relays: ['wss://relay.example'] };
const LIST = (id: string | number): McpMessage => ({ jsonrpc: '2.0', id, method: 'tools/list' });
const CANCEL = (requestId: string | number): McpMessage =>
  ({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId, reason: 'user' } });
const CANCELLED = 'session closed';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface Held { handle?: CvmRequestHandle; signal?: ApprovalSignal; answer(): void }

function harness(options: { concurrency?: CvmConcurrencyOptions; withCancel?: boolean; cancelResult?: boolean } = {}) {
  const events = new Set<(server: CvmServerRef, message: McpMessage) => void>();
  /** Requests the transport received and the server has not answered, by napplet MCP id. */
  const held = new Map<string, Held>();
  const publish = vi.fn(async (_server: CvmServerRef, _message: McpMessage) => {});
  const cancel = vi.fn(async (_server: CvmServerRef, _handle: CvmRequestHandle, _message: McpMessage) => options.cancelResult ?? true);
  const transport = {
    discover: vi.fn(async () => []),
    request: vi.fn((_server: CvmServerRef, message: McpMessage, _options?: unknown, execution?: { signal?: ApprovalSignal; handle?: CvmRequestHandle }) =>
      new Promise<McpMessage>((resolve) => {
        held.set(String(message.id), {
          handle: execution?.handle, signal: execution?.signal,
          answer: () => resolve({ jsonrpc: '2.0', id: message.id, result: {} }),
        });
      })),
    publish,
    ...(options.withCancel === false ? {} : { cancel }),
    close: vi.fn(async () => {}),
    onEvent(handler: (server: CvmServerRef, message: McpMessage) => void) {
      events.add(handler);
      return { close: () => events.delete(handler) };
    },
  } satisfies CvmTransport;
  const svc = createCvmService({ transport, ...(options.concurrency ? { concurrency: options.concurrency } : {}) });
  const sent: NappletMessage[] = [];
  const send = (id: string, message: McpMessage) =>
    svc.handleMessage('win', { type: 'cvm.request', id, server: SERVER, message } as NappletMessage, (reply) => { sent.push(reply); });
  const result = (id: string) => sent.filter((item) => (item as { id?: string }).id === id);
  const order = () => sent.map((item) => (item as { id?: string }).id);
  return { svc, transport, publish, cancel, held, sent, send, result, order };
}

/** A host approval prompt that stays open until the test answers it. */
function heldApproval() {
  const prompts: Array<{ signal?: ApprovalSignal; approve(): void }> = [];
  const authorizeOperation = vi.fn((_w: string, _o: string, _r: unknown, execute: (signal: ApprovalSignal) => Promise<unknown>, signal?: ApprovalSignal) =>
    new Promise((resolve) => {
      prompts.push({
        signal,
        approve: () => resolve(Promise.resolve(execute(new AbortController().signal)).then((value) => ({ status: 'executed', value }))),
      });
    }));
  return { prompts, authorizeOperation, context: { authorizeOperation } as unknown as ServiceRuntimeContext };
}

describe('cancelling a request that has not left the shell (kehto/web#510)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  it('drops a queued request before publication, settles it, and does not queue the cancel itself', async () => {
    const h = harness({ concurrency: { maxInFlight: 1, maxQueued: 1 } });
    h.send('first', LIST(1));
    h.send('second', LIST(2));
    await flush();
    expect(h.transport.request).toHaveBeenCalledTimes(1);
    // The one slot and the one queue position are both taken: a cancel that
    // needed admission would be refused with `policy denied`.
    h.send('cancel', CANCEL(2));
    await flush();
    expect(h.result('second')).toEqual([{ type: 'cvm.request.result', id: 'second', error: CANCELLED }]);
    expect(h.result('cancel')).toEqual([{ type: 'cvm.request.result', id: 'cancel' }]);
    expect(h.order()).toEqual(['second', 'cancel']);
    // Its queue position is free again.
    h.send('third', LIST(3));
    await flush();
    expect(h.result('third')).toEqual([]);
    h.held.get('1')!.answer();
    await flush();
    expect(h.transport.request.mock.calls.map((call) => call[1].id)).toEqual([1, 3]);
    expect(h.cancel).not.toHaveBeenCalled();
    expect(h.publish).not.toHaveBeenCalled();
    expect(h.result('second')).toHaveLength(1);
    h.svc.dispose();
  });

  it('drops a request awaiting approval, withdraws its prompt, and never asks approval for the cancel', async () => {
    const h = harness();
    const approval = heldApproval();
    h.svc.onRegistered?.(approval.context);
    h.send('call', LIST(2));
    await flush();
    expect(approval.prompts).toHaveLength(1);
    h.send('cancel', CANCEL(2));
    await flush();
    expect(h.result('call')).toEqual([{ type: 'cvm.request.result', id: 'call', error: CANCELLED }]);
    expect(h.result('cancel')).toEqual([{ type: 'cvm.request.result', id: 'cancel' }]);
    expect(h.order()).toEqual(['call', 'cancel']);
    expect(approval.prompts[0].signal?.aborted).toBe(true);
    expect(approval.authorizeOperation).toHaveBeenCalledTimes(1);
    // A late approval cannot send it.
    approval.prompts[0].approve();
    await flush();
    expect(h.transport.request).not.toHaveBeenCalled();
    expect(h.cancel).not.toHaveBeenCalled();
    expect(h.publish).not.toHaveBeenCalled();
    expect(h.result('call')).toHaveLength(1);
    h.svc.dispose();
  });

  it('publishes a cancel for an in-flight request, then settles that request once', async () => {
    const h = harness();
    h.send('call', LIST(2));
    await flush();
    const held = h.held.get('2')!;
    h.send('cancel', CANCEL(2));
    await flush();
    expect(h.cancel).toHaveBeenCalledTimes(1);
    expect(h.cancel.mock.calls[0][1]).toBe(held.handle);
    expect(h.cancel.mock.calls[0][2]).toEqual(CANCEL(2));
    expect(h.result('call')).toEqual([{ type: 'cvm.request.result', id: 'call', error: CANCELLED }]);
    expect(h.result('cancel')).toEqual([{ type: 'cvm.request.result', id: 'cancel' }]);
    expect(h.order()).toEqual(['call', 'cancel']);
    // The transport sees the abort and the late response is ignored.
    expect(held.signal?.aborted).toBe(true);
    held.answer();
    await flush();
    expect(h.sent).toHaveLength(2);
    expect(h.sent.some((item) => item.type === 'cvm.event')).toBe(false);
    h.svc.dispose();
  });

  it('does not take a slot for an in-flight cancel', async () => {
    const h = harness({ concurrency: { maxInFlight: 1, maxQueued: 0 } });
    h.send('call', LIST(2));
    await flush();
    h.send('cancel', CANCEL(2));
    await flush();
    expect(h.result('cancel')).toEqual([{ type: 'cvm.request.result', id: 'cancel' }]);
    expect(h.cancel).toHaveBeenCalledTimes(1);
    h.svc.dispose();
  });

  it('settles a request the transport was still preparing, so it never goes out', async () => {
    // cancel() resolves false: the transport has not sent it (e.g. initializing).
    const h = harness({ cancelResult: false });
    h.send('call', LIST(2));
    await flush();
    h.send('cancel', CANCEL(2));
    await flush();
    expect(h.result('call')).toEqual([{ type: 'cvm.request.result', id: 'call', error: CANCELLED }]);
    expect(h.result('cancel')).toEqual([{ type: 'cvm.request.result', id: 'cancel' }]);
    expect(h.held.get('2')!.signal?.aborted).toBe(true);
    h.svc.dispose();
  });

  it('publishes one cancel per request even when the napplet repeats it', async () => {
    const h = harness();
    h.send('call', LIST(2));
    await flush();
    h.send('cancel-1', CANCEL(2));
    h.send('cancel-2', CANCEL(2));
    await flush();
    expect(h.cancel).toHaveBeenCalledTimes(1);
    expect(h.result('cancel-1')).toEqual([{ type: 'cvm.request.result', id: 'cancel-1' }]);
    expect(h.result('cancel-2')).toEqual([{ type: 'cvm.request.result', id: 'cancel-2' }]);
    expect(h.result('call')).toHaveLength(1);
    h.svc.dispose();
  });

  it('leaves the request running when the cancel cannot be published', async () => {
    const h = harness();
    h.cancel.mockRejectedValueOnce(new Error('relay timeout'));
    h.send('call', LIST(2));
    await flush();
    h.send('cancel', CANCEL(2));
    await flush();
    expect(h.result('cancel')).toEqual([{ type: 'cvm.request.result', id: 'cancel', error: 'relay timeout' }]);
    expect(h.result('call')).toEqual([]);
    h.held.get('2')!.answer();
    await flush();
    expect(h.result('call')).toEqual([{ type: 'cvm.request.result', id: 'call', message: { jsonrpc: '2.0', id: 2, result: {} } }]);
    h.svc.dispose();
  });

  it('settles locally through a transport without cancel() too (KEHTO_CVM_TRANSPORT_CANCEL)', async () => {
    const h = harness({ withCancel: false });
    h.send('call', LIST(2));
    await flush();
    h.send('cancel', CANCEL(2));
    await flush();
    expect(h.publish.mock.calls.map((call) => call[1])).toEqual([CANCEL(2)]);
    expect(h.result('call')).toEqual([{ type: 'cvm.request.result', id: 'call', error: CANCELLED }]);
    expect(warn).toHaveBeenCalledTimes(1);
    h.svc.dispose();
  });

  it('keeps one napplet\'s cancel away from another napplet\'s queued request', async () => {
    const h = harness({ concurrency: { maxInFlight: 1, maxQueued: 1 } });
    h.send('first', LIST(1));
    h.send('second', LIST(2));
    await flush();
    const other: NappletMessage[] = [];
    h.svc.handleMessage('other', { type: 'cvm.request', id: 'cancel', server: SERVER, message: CANCEL(2) } as NappletMessage, (reply) => { other.push(reply); });
    await flush();
    expect(other).toEqual([{ type: 'cvm.request.result', id: 'cancel', error: 'invalid message' }]);
    expect(h.result('second')).toEqual([]);
    h.held.get('1')!.answer();
    await flush();
    expect(h.transport.request).toHaveBeenCalledTimes(2);
    h.svc.dispose();
  });
});

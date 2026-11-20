/**
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f) request
 * lifecycle in `createCvmService`, from Message handling and Errors:
 *
 * - Notification / Response: "After transport publication, result without
 *   `message`; API returns `null`. No MCP response is awaited."
 * - "An ID already used for a client request in the same MCP session returns
 *   `"invalid message"`; a response must match an outstanding server request
 *   delivered to that napplet. An unmatched response returns `"invalid message"`."
 * - `invalid request`: "Malformed server reference, query, selector, or other
 *   non-message parameter."
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';

import { createCvmService, type CvmService, type CvmTransport } from './cvm-service.js';
import type { CvmServerRef, McpMessage } from './cvm-types.js';

const SERVER: CvmServerRef = { pubkey: 'a'.repeat(64), relays: ['wss://relay.example'] };
/** Leaves `server` out of the envelope. */
const ABSENT = Symbol('absent');
const LIST = (id: string | number): McpMessage => ({ jsonrpc: '2.0', id, method: 'tools/list' });

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function harness(withPublish = true) {
  const handlers = new Set<(server: CvmServerRef, message: McpMessage) => void>();
  const publish = vi.fn(async (_server: CvmServerRef, _message: McpMessage) => {});
  const transport = {
    discover: vi.fn(async () => []),
    request: vi.fn(async (_server: CvmServerRef, message: McpMessage) => ({ jsonrpc: '2.0', id: message.id, result: {} }) as McpMessage),
    ...(withPublish ? { publish } : {}),
    close: vi.fn(async () => {}),
    onEvent(handler: (server: CvmServerRef, message: McpMessage) => void) {
      handlers.add(handler);
      return { close: () => handlers.delete(handler) };
    },
  } satisfies CvmTransport;
  const svc: CvmService = createCvmService({ transport });
  const sent: Record<string, NappletMessage[]> = {};
  const send = (windowId: string, message: NappletMessage): void => {
    svc.handleMessage(windowId, message, (reply) => { (sent[windowId] ??= []).push(reply); });
  };
  const request = (windowId: string, id: string, message: unknown, server: unknown = SERVER, options?: unknown) =>
    send(windowId, { type: 'cvm.request', id, ...(server === ABSENT ? {} : { server }), message, ...(options ? { options } : {}) } as NappletMessage);
  const emit = (message: McpMessage) => { for (const handler of handlers) handler({ pubkey: SERVER.pubkey }, message); };
  const result = (windowId: string, id: string) => (sent[windowId] ?? []).find((item) => (item as { id?: string }).id === id);
  return { transport, publish, svc, sent, send, request, emit, result };
}

describe('cvm.request lifecycle (NAP-CVM #31 @ 28cf1bdb)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  describe('notifications and responses complete on publication', () => {
    it('publishes a notification as given and answers with only type and id', async () => {
      const h = harness();
      const notification = { jsonrpc: '2.0', method: 'notifications/initialized' };
      h.request('win', 'n1', notification);
      await flush();
      expect(h.sent.win).toEqual([{ type: 'cvm.request.result', id: 'n1' }]);
      expect(h.publish).toHaveBeenCalledTimes(1);
      // No id added: the shell "MUST NOT add an ID to a notification".
      expect(h.publish.mock.calls[0][1]).toEqual(notification);
      expect(h.transport.request).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('answers a matched response after publication, keeping the napplet id', async () => {
      const h = harness();
      h.request('win', 'open', LIST(1));
      await flush();
      h.emit({ jsonrpc: '2.0', id: 'srv-1', method: 'sampling/createMessage', params: {} });
      const response = { jsonrpc: '2.0', id: 'srv-1', result: { ok: true } };
      h.request('win', 'r1', response);
      await flush();
      expect(h.result('win', 'r1')).toEqual({ type: 'cvm.request.result', id: 'r1' });
      expect(h.publish.mock.calls[0][1]).toEqual(response);
      expect(h.transport.request).toHaveBeenCalledTimes(1);
    });

    it('reports a publication failure as the envelope error', async () => {
      const h = harness();
      h.publish.mockRejectedValueOnce(new Error('relay timeout'));
      h.request('win', 'n1', { jsonrpc: '2.0', method: 'notifications/initialized' });
      await flush();
      expect(h.sent.win).toEqual([{ type: 'cvm.request.result', id: 'n1', error: 'relay timeout' }]);
    });

    it('falls back to request() for a transport without publish(), warning once (KEHTO_CVM_TRANSPORT_PUBLISH)', async () => {
      const h = harness(false);
      h.request('win', 'n1', { jsonrpc: '2.0', method: 'notifications/initialized' });
      h.request('win', 'n2', { jsonrpc: '2.0', method: 'notifications/roots/list_changed' });
      await flush();
      expect(h.sent.win).toEqual([{ type: 'cvm.request.result', id: 'n1' }, { type: 'cvm.request.result', id: 'n2' }]);
      expect(h.transport.request).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/^\[KEHTO_CVM_TRANSPORT_PUBLISH\] .*Implement CvmTransport\.publish\(\).*once per CVM service/);
    });

    it('keeps a request-form message quiet on the legacy fallback path', async () => {
      const h = harness(false);
      h.request('win', 'q1', LIST(1));
      await flush();
      expect(h.sent.win).toEqual([{ type: 'cvm.request.result', id: 'q1', message: { jsonrpc: '2.0', id: 1, result: {} } }]);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('client request ids', () => {
    it('rejects an id already used in the same session with invalid message, before publication', async () => {
      const h = harness();
      h.request('win', 'a', LIST(7));
      await flush();
      h.request('win', 'b', LIST(7));
      await flush();
      expect(h.result('win', 'b')).toEqual({ type: 'cvm.request.result', id: 'b', error: 'invalid message' });
      expect(h.transport.request).toHaveBeenCalledTimes(1);
    });

    it('rejects a concurrent duplicate at receipt', async () => {
      const h = harness();
      h.request('win', 'a', LIST(7));
      h.request('win', 'b', LIST(7));
      await flush();
      expect(h.result('win', 'b')).toEqual({ type: 'cvm.request.result', id: 'b', error: 'invalid message' });
      expect(h.transport.request).toHaveBeenCalledTimes(1);
    });

    it('treats ids as typed, scopes them per napplet, and frees them on close', async () => {
      const h = harness();
      h.request('win', 'a', LIST(7));
      h.request('win', 'b', LIST('7'));
      h.request('other', 'c', LIST(7));
      await flush();
      h.send('win', { type: 'cvm.close', id: 'x', server: SERVER } as NappletMessage);
      await flush();
      h.request('win', 'd', LIST(7));
      await flush();
      for (const [windowId, id] of [['win', 'a'], ['win', 'b'], ['other', 'c'], ['win', 'd']]) {
        expect(h.result(windowId, id)).toMatchObject({ message: { result: {} } });
      }
    });

    it('does not consume an id when the request is rejected before admission', async () => {
      const h = harness();
      h.request('win', 'a', LIST(7), SERVER, { timeoutMs: 0 });
      h.request('win', 'b', LIST(7));
      await flush();
      expect(h.result('win', 'a')).toEqual({ type: 'cvm.request.result', id: 'a', error: 'invalid timeout' });
      expect(h.result('win', 'b')).toMatchObject({ message: { id: 7 } });
    });
  });

  describe('responses to server requests', () => {
    it('rejects a response matching no delivered server request with invalid message', async () => {
      const h = harness();
      h.request('win', 'open', LIST(1));
      await flush();
      h.request('win', 'r', { jsonrpc: '2.0', id: 'srv-9', result: {} });
      await flush();
      expect(h.result('win', 'r')).toEqual({ type: 'cvm.request.result', id: 'r', error: 'invalid message' });
      expect(h.publish).not.toHaveBeenCalled();
    });

    it('accepts one response per server request, matching its typed id, only from the napplet it was delivered to', async () => {
      const h = harness();
      h.request('win', 'open', LIST(1));
      await flush();
      h.emit({ jsonrpc: '2.0', id: 5, method: 'roots/list' });
      h.request('other', 'r0', { jsonrpc: '2.0', id: 5, result: {} });
      h.request('win', 'r1', { jsonrpc: '2.0', id: '5', result: {} });
      h.request('win', 'r2', { jsonrpc: '2.0', id: 5, error: { code: -1, message: 'no' } });
      h.request('win', 'r3', { jsonrpc: '2.0', id: 5, result: {} });
      await flush();
      expect(h.result('other', 'r0')).toMatchObject({ error: 'invalid message' });
      expect(h.result('win', 'r1')).toMatchObject({ error: 'invalid message' });
      expect(h.result('win', 'r2')).toEqual({ type: 'cvm.request.result', id: 'r2' });
      expect(h.result('win', 'r3')).toMatchObject({ error: 'invalid message' });
      expect(h.publish).toHaveBeenCalledTimes(1);
    });

    it('does not count a server notification as an answerable request', async () => {
      const h = harness();
      h.request('win', 'open', LIST(1));
      await flush();
      h.emit({ jsonrpc: '2.0', method: 'notifications/progress', params: {} });
      h.request('win', 'r', { jsonrpc: '2.0', id: 'srv-1', result: {} });
      await flush();
      expect(h.result('win', 'r')).toMatchObject({ error: 'invalid message' });
    });

    it('forgets outstanding server requests when the session closes', async () => {
      const h = harness();
      h.request('win', 'open', LIST(1));
      await flush();
      h.emit({ jsonrpc: '2.0', id: 'srv-1', method: 'roots/list' });
      h.send('win', { type: 'cvm.close', id: 'x', server: SERVER } as NappletMessage);
      await flush();
      h.request('win', 'r', { jsonrpc: '2.0', id: 'srv-1', result: {} });
      await flush();
      expect(h.result('win', 'r')).toMatchObject({ error: 'invalid message' });
    });
  });

  describe('malformed server references', () => {
    it.each([
      ['a missing server', ABSENT],
      ['a non-object server', 'a'.repeat(64)],
      ['a non-hex pubkey', { pubkey: 'z'.repeat(64) }],
      ['a short pubkey', { pubkey: 'a'.repeat(63) }],
      ['an array server', [SERVER]],
      ['non-string relays', { pubkey: SERVER.pubkey, relays: [7] }],
      ['a non-array relays', { pubkey: SERVER.pubkey, relays: 'wss://relay.example' }],
    ])('answers %s with invalid request and publishes nothing', async (_label, server) => {
      const h = harness();
      h.request('win', 'bad', LIST(1), server);
      h.send('win', { type: 'cvm.close', id: 'bad-close', ...(server === ABSENT ? {} : { server }) } as NappletMessage);
      await flush();
      expect(h.sent.win).toEqual([
        { type: 'cvm.request.result', id: 'bad', error: 'invalid request' },
        { type: 'cvm.close.result', id: 'bad-close', error: 'invalid request' },
      ]);
      expect(h.transport.request).not.toHaveBeenCalled();
    });
  });
});

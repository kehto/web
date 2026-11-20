/**
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f, Message
 * handling + Errors): the reference CVM service and the `@kehto/mocks` CVM
 * mock answer the same `cvm.request` lifecycle the same way, so a napplet sees
 * the same outcome whichever one Paja or a test host wires in:
 *
 * - notifications and responses complete "After transport publication" with a
 *   "result without `message`";
 * - a client request id reused in the same session, and a response matching no
 *   delivered server request, are `invalid message`;
 * - a malformed server reference is `invalid request`;
 * - "`notifications/cancelled` may refer only to this napplet's requests": a
 *   cancellation of a settled request of its own is acknowledged and dropped,
 *   and one naming no request of this napplet is `invalid message` (kehto
 *   spec-gap decision);
 * - "Server requests still require a response or expire under session
 *   policy": after 30000 ms (the Timeouts default) a response is unmatched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createCvmService, type CvmTransport } from '../../packages/services/src/cvm-service.js';
import type { CvmServerRef, McpMessage } from '../../packages/services/src/cvm-types.js';
import { MOCK_CVM_SERVERS, createMockCvmService } from '../../packages/mocks/src/domains/cvm.js';

const PUBKEY = MOCK_CVM_SERVERS[0]!.server.pubkey;
const SERVER = { pubkey: PUBKEY };
const flush = async (): Promise<void> => {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
  else await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A napplet-visible outcome: the error text, `message` for a response, or `ack` for a result without one. */
type Outcome = string;

interface Host {
  send(message: NappletMessage): Promise<Outcome | null>;
  serverRequest(method: string): string;
}

function outcome(reply: NappletMessage | undefined): Outcome | null {
  if (!reply) return null;
  const value = reply as { error?: string; message?: unknown };
  if (value.error !== undefined) return value.error;
  return 'message' in value ? 'message' : 'ack';
}

function referenceHost(): Host {
  const handlers = new Set<(server: CvmServerRef, message: McpMessage) => void>();
  const transport: CvmTransport = {
    async discover() { return []; },
    async request(_server, message) { return { jsonrpc: '2.0', id: message.id, result: {} }; },
    async publish() {},
    async close() {},
    onEvent(handler) { handlers.add(handler); return { close: () => handlers.delete(handler) }; },
  };
  const svc = createCvmService({ transport });
  let serverRequests = 0;
  return {
    async send(message) {
      const replies: NappletMessage[] = [];
      svc.handleMessage('win', message, (reply) => replies.push(reply));
      await flush();
      return outcome(replies.find((reply) => (reply as { id?: string }).id === (message as { id?: string }).id));
    },
    serverRequest(method) {
      serverRequests += 1;
      const id = `srv-${serverRequests}`;
      for (const handler of handlers) handler(SERVER, { jsonrpc: '2.0', id, method });
      return id;
    },
  };
}

function mockHost(): Host {
  const mock = createMockCvmService();
  return {
    async send(message) {
      const replies: NappletMessage[] = [];
      mock.handleMessage('win', message, (reply) => replies.push(reply));
      await flush();
      return outcome(replies.find((reply) => (reply as { id?: string }).id === (message as { id?: string }).id));
    },
    serverRequest(method) { return mock.emitServerRequest('win', PUBKEY, method)!; },
  };
}

const request = (id: string, message: unknown, server: unknown = SERVER) => ({ type: 'cvm.request', id, server, message }) as NappletMessage;
const list = (id: string | number) => ({ jsonrpc: '2.0', id, method: 'tools/list' });

/** One lifecycle, step by step; `serverRequest` steps resolve the id the host issued. */
async function run(host: Host): Promise<Array<readonly [string, Outcome | null]>> {
  const rows: Array<readonly [string, Outcome | null]> = [];
  const step = async (label: string, message: NappletMessage) => { rows.push([label, await host.send(message)]); };
  await step('first request id 7', request('a', list(7)));
  await step('reused request id 7', request('b', list(7)));
  await step('typed id "7" is distinct', request('c', list('7')));
  await step('notification', request('d', { jsonrpc: '2.0', method: 'notifications/initialized' }));
  await step('unmatched response', request('e', { jsonrpc: '2.0', id: 'srv-404', result: {} }));
  const issued = host.serverRequest('roots/list');
  await step('response to a delivered server request', request('f', { jsonrpc: '2.0', id: issued, result: { roots: [] } }));
  await step('second response to it', request('g', { jsonrpc: '2.0', id: issued, error: { code: -1, message: 'late' } }));
  await step('malformed server', request('h', list(8), { pubkey: 'not-hex' }));
  await step('missing server', { type: 'cvm.request', id: 'i', message: list(9) } as NappletMessage);
  const cancel = (requestId?: unknown) => ({ jsonrpc: '2.0', method: 'notifications/cancelled', params: requestId === undefined ? {} : { requestId } });
  await step('cancel a settled request of its own', request('c1', cancel(7)));
  await step('cancel an id it never used', request('c2', cancel(404)));
  await step('cancel without a requestId', request('c3', cancel()));
  await step('close', { type: 'cvm.close', id: 'j', server: SERVER } as NappletMessage);
  await step('id 7 after close', request('k', list(7)));
  await step('close with a malformed server', { type: 'cvm.close', id: 'l', server: { pubkey: 7 } } as NappletMessage);
  return rows;
}

describe('NAP-CVM cvm.request lifecycle: services and mocks agree', () => {
  it('answers the same lifecycle with the same outcomes', async () => {
    const reference = await run(referenceHost());
    expect(reference).toEqual([
      ['first request id 7', 'message'],
      ['reused request id 7', 'invalid message'],
      ['typed id "7" is distinct', 'message'],
      ['notification', 'ack'],
      ['unmatched response', 'invalid message'],
      ['response to a delivered server request', 'ack'],
      ['second response to it', 'invalid message'],
      ['malformed server', 'invalid request'],
      ['missing server', 'invalid request'],
      ['cancel a settled request of its own', 'ack'],
      ['cancel an id it never used', 'invalid message'],
      ['cancel without a requestId', 'invalid message'],
      ['close', 'ack'],
      ['id 7 after close', 'message'],
      ['close with a malformed server', 'invalid request'],
    ]);
    expect(await run(mockHost())).toEqual(reference);
  });

  describe('server requests expire', () => {
    afterEach(() => { vi.useRealTimers(); });

    async function expiry(host: () => Host): Promise<Array<readonly [string, Outcome | null]>> {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
      const h = host();
      const rows: Array<readonly [string, Outcome | null]> = [];
      rows.push(['open the session', await h.send(request('o', list(1)))]);
      const early = h.serverRequest('roots/list');
      await vi.advanceTimersByTimeAsync(29_999);
      rows.push(['respond just before 30000 ms', await h.send(request('r1', { jsonrpc: '2.0', id: early, result: {} }))]);
      const late = h.serverRequest('roots/list');
      await vi.advanceTimersByTimeAsync(30_000);
      rows.push(['respond at 30000 ms', await h.send(request('r2', { jsonrpc: '2.0', id: late, result: {} }))]);
      vi.useRealTimers();
      return rows;
    }

    it('expire after the same deadline in both', async () => {
      const reference = await expiry(referenceHost);
      expect(reference).toEqual([
        ['open the session', 'message'],
        ['respond just before 30000 ms', 'ack'],
        ['respond at 30000 ms', 'invalid message'],
      ]);
      expect(await expiry(mockHost)).toEqual(reference);
    });
  });
});

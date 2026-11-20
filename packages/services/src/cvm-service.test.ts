import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';

import { createCvmService, type CvmService, type CvmTransport } from './cvm-service.js';
import type { CvmServer, CvmServerRef, McpMessage } from './cvm-types.js';

const WINDOW = 'win-1';
const SERVER: CvmServerRef = { pubkey: 'a'.repeat(64), relays: ['wss://relay.example'] };

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface MockTransport extends CvmTransport {
  emitEvent(server: CvmServerRef, message: McpMessage): void;
  eventClosed(): boolean;
}

function createMockTransport(overrides: Partial<CvmTransport> = {}): MockTransport {
  const handlers = new Set<(s: CvmServerRef, m: McpMessage) => void>();
  let closed = false;
  return {
    discover: overrides.discover ?? vi.fn(async () => [] as CvmServer[]),
    request: overrides.request ?? vi.fn(async () => ({ jsonrpc: '2.0', id: 1, result: {} } as McpMessage)),
    close: overrides.close ?? vi.fn(async () => {}),
    dispose: overrides.dispose ?? vi.fn(),
    onEvent:
      overrides.onEvent ??
      ((handler) => {
        handlers.add(handler);
        return {
          close() {
            handlers.delete(handler);
            closed = true;
          },
        };
      }),
    emitEvent(server, message) {
      for (const h of handlers) h(server, message);
    },
    eventClosed() {
      return closed;
    },
  };
}

function collectSent(): { sent: NappletMessage[]; send: (m: NappletMessage) => void } {
  const sent: NappletMessage[] = [];
  return { sent, send: (m) => sent.push(m) };
}

describe('createCvmService', () => {
  let transport: MockTransport;
  let svc: CvmService;

  beforeEach(() => {
    transport = createMockTransport();
    svc = createCvmService({ transport });
  });

  it('throws when transport is missing', () => {
    // @ts-expect-error intentional misuse
    expect(() => createCvmService({})).toThrow(/transport is required/);
  });

  it('exposes a cvm descriptor', () => {
    expect(svc.descriptor.name).toBe('cvm');
    expect(svc.descriptor.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  describe('cvm.discover', () => {
    it('rejects invalid relay hints before authorization or transport', async () => {
      const authorizeOperation = vi.fn();
      svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const { sent, send } = collectSent();

      svc.handleMessage(WINDOW, { type: 'cvm.discover', id: 'invalid', query: { relays: ['https://not-a-relay.example'] } } as NappletMessage, send);
      await flush();

      expect(sent).toEqual([{ type: 'cvm.discover.result', id: 'invalid', error: 'invalid relay' }]);
      expect(authorizeOperation).not.toHaveBeenCalled();
      expect(transport.discover).not.toHaveBeenCalled();
    });

    it('resolves servers and echoes the id', async () => {
      const servers: CvmServer[] = [{ pubkey: SERVER.pubkey, name: 'Relatr' }];
      transport.discover = vi.fn(async () => servers);
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.discover', id: 'd1', query: { search: 'relay' } } as NappletMessage, send);
      await flush();
      expect(sent).toEqual([{ type: 'cvm.discover.result', id: 'd1', servers }]);
      expect(transport.discover).toHaveBeenCalledWith({ search: 'relay' }, { signal: expect.any(AbortSignal) });
    });

    it('returns empty servers + error string on transport failure', async () => {
      transport.discover = vi.fn(async () => { throw new Error('relay timeout'); });
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.discover', id: 'd2' } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.discover.result', id: 'd2', error: 'relay timeout' });
    });
  });

  describe('cvm.request', () => {
    it('approves selected server relay origins before transport', async () => {
      const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, execute) => ({
        status: 'executed' as const,
        value: await execute({ aborted: false, addEventListener() {}, removeEventListener() {} }),
      }));
      svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const { sent, send } = collectSent();

      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'approved', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();

      expect(authorizeOperation).toHaveBeenCalledWith(WINDOW, 'cvm.request', expect.arrayContaining([
        expect.objectContaining({ category: 'interface', domain: 'cvm', operation: 'access' }),
        expect.objectContaining({ category: 'network', domain: 'cvm', operation: 'cvm.request', scope: { kind: 'origin', value: 'wss://relay.example' } }),
      ]), expect.any(Function), expect.any(AbortSignal));
      expect(transport.request).toHaveBeenCalledTimes(1);
      expect(sent).toEqual([expect.objectContaining({ type: 'cvm.request.result', id: 'approved' })]);
    });

    it('does not contact a server when authorization is denied', async () => {
      const authorizeOperation = vi.fn(async () => ({ status: 'denied' as const }));
      svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const { sent, send } = collectSent();

      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'denied', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();

      expect(transport.request).not.toHaveBeenCalled();
      expect(sent).toEqual([{ type: 'cvm.request.result', id: 'denied', error: 'policy denied' }]);
    });
    it('returns the MCP response message with the echoed id', async () => {
      const mcp: McpMessage = { jsonrpc: '2.0', id: 2, result: { content: [], isError: false } };
      transport.request = vi.fn(async () => mcp);
      const { sent, send } = collectSent();
      const msg = {
        type: 'cvm.request',
        id: 'r1',
        server: SERVER,
        message: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'x' } },
        options: { initialize: true },
      } as NappletMessage;
      svc.handleMessage(WINDOW, msg, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.request.result', id: 'r1', message: mcp });
      expect(transport.request).toHaveBeenCalledWith(
        SERVER,
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'x' } },
        // The service owns the deadline from receipt and hands over what is left of it.
        { initialize: true, timeoutMs: expect.any(Number) },
        // The handle lets a later notifications/cancelled name this request.
        { signal: expect.any(AbortSignal), handle: expect.any(Object) },
      );
      const timeoutMs = vi.mocked(transport.request).mock.calls[0][2]!.timeoutMs!;
      expect(timeoutMs).toBeGreaterThan(29_000);
      expect(timeoutMs).toBeLessThanOrEqual(30_000);
    });

    // NAP-CVM #31 @ 28cf1bdb, Errors: `invalid request` is a "Malformed server
    // reference, query, selector, or other non-message parameter".
    it('rejects with "invalid request" when the server reference is missing', async () => {
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r2', message: { jsonrpc: '2.0' } } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.request.result', id: 'r2', error: 'invalid request' });
    });

    // NAP-CVM (napplet/naps#31 @ 28cf1bdb, Message handling + Conformance):
    // "Missing messages, batches, invalid IDs, and invalid field combinations
    // return \"invalid message\"" and "Missing message, id: null, or both result
    // and error" get `invalid message` "with no publication".
    it.each([
      ['a missing message', undefined],
      ['id: null', { jsonrpc: '2.0', id: null, method: 'tools/list' }],
      ['both result and error', { jsonrpc: '2.0', id: 9, result: {}, error: { code: 1, message: 'x' } }],
      ['a batch', [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]],
      ['a non-2.0 jsonrpc', { jsonrpc: '1.0', id: 1, method: 'tools/list' }],
      ['a boolean id', { jsonrpc: '2.0', id: true, method: 'tools/list' }],
      ['a fractional id', { jsonrpc: '2.0', id: 1.5, method: 'tools/list' }],
      ['an empty method', { jsonrpc: '2.0', id: 1, method: '' }],
      ['a non-string method', { jsonrpc: '2.0', id: 1, method: 7 }],
      ['non-object params', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: [1] }],
      ['a request with a result', { jsonrpc: '2.0', id: 1, method: 'tools/list', result: {} }],
      ['a notification with an error', { jsonrpc: '2.0', method: 'notifications/progress', error: { code: 1, message: 'x' } }],
      ['a response with params', { jsonrpc: '2.0', id: 1, result: {}, params: {} }],
      ['a response with neither result nor error', { jsonrpc: '2.0', id: 1 }],
      ['a response without an id', { jsonrpc: '2.0', result: {} }],
      ['no method and no id', { jsonrpc: '2.0' }],
    ])('rejects %s with "invalid message" and publishes nothing', async (_label, message) => {
      const authorizeOperation = vi.fn();
      svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'bad', server: SERVER, ...(message === undefined ? {} : { message }) } as NappletMessage, send);
      await flush();
      expect(sent).toEqual([{ type: 'cvm.request.result', id: 'bad', error: 'invalid message' }]);
      expect(transport.request).not.toHaveBeenCalled();
      expect(authorizeOperation).not.toHaveBeenCalled();
      // No session was opened, so closing it has nothing to tear down.
      svc.handleMessage(WINDOW, { type: 'cvm.close', id: 'close', server: SERVER } as NappletMessage, send);
      await flush();
      expect(transport.close).not.toHaveBeenCalled();
    });

    it.each([
      ['a request', { jsonrpc: '2.0', id: 'r-1', method: 'tools/call', params: { name: 'x' } }],
      // A cancellation must name one of this napplet's requests; cvm-cancel-expiry.test.ts covers it.
      ['a notification', { jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: 't', progress: 1 } }],
    ])('admits %s unchanged', async (_label, message) => {
      const publish = vi.fn(async () => {});
      svc = createCvmService({ transport: { ...transport, publish } });
      const { send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'ok', server: SERVER, message } as NappletMessage, send);
      await flush();
      const carried = 'id' in message ? transport.request : publish;
      expect(carried).toHaveBeenCalledWith(SERVER, message, expect.any(Object), expect.any(Object));
    });

    // A response must answer "an outstanding server request delivered to that
    // napplet"; cvm-request-lifecycle.test.ts covers the unmatched cases.
    it.each([
      ['a result response', { jsonrpc: '2.0', id: 3, result: {} }],
      ['an error response', { jsonrpc: '2.0', id: 'srv-1', error: { code: -1, message: 'no' } }],
    ])('admits %s to a delivered server request unchanged', async (_label, message) => {
      const publish = vi.fn(async () => {});
      svc = createCvmService({ transport: { ...transport, publish } });
      const { send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'open', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();
      transport.emitEvent(SERVER, { jsonrpc: '2.0', id: message.id, method: 'roots/list' });
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'ok', server: SERVER, message } as NappletMessage, send);
      await flush();
      expect(publish).toHaveBeenCalledWith(SERVER, message, expect.any(Object), expect.any(Object));
    });

    it('surfaces a transport error as the envelope error', async () => {
      transport.request = vi.fn(async () => { throw new Error('policy denied'); });
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r4', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.request.result', id: 'r4', error: 'policy denied' });
    });
  });

  describe('cvm.close', () => {
    it('closes transport session and echoes id', async () => {
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'open', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();
      sent.length = 0;
      svc.handleMessage(WINDOW, { type: 'cvm.close', id: 'c1', server: SERVER } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.close.result', id: 'c1' });
      expect(transport.close).toHaveBeenCalledWith(SERVER);
    });

    it('does not let another window close an owned session', async () => {
      const owner = collectSent();
      const intruder = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'open', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, owner.send);
      await flush();
      svc.handleMessage('other-window', { type: 'cvm.close', id: 'forged', server: SERVER } as NappletMessage, intruder.send);
      await flush();

      expect(intruder.sent).toEqual([{ type: 'cvm.close.result', id: 'forged' }]);
      expect(transport.close).not.toHaveBeenCalled();
    });

    it('allows an owned close after later authorization is denied', async () => {
      const approve = vi.fn(async (_windowId, _operation, _requirements, execute) => ({
        status: 'executed' as const,
        value: await execute({ aborted: false, addEventListener() {}, removeEventListener() {} }),
      }));
      svc.onRegistered?.({ authorizeOperation: approve } as unknown as ServiceRuntimeContext);
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'open', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();
      svc.onRegistered?.({ authorizeOperation: async () => ({ status: 'denied' }) } as unknown as ServiceRuntimeContext);
      sent.length = 0;
      svc.handleMessage(WINDOW, { type: 'cvm.close', id: 'close', server: SERVER } as NappletMessage, send);
      await flush();

      expect(sent).toEqual([{ type: 'cvm.close.result', id: 'close' }]);
      expect(transport.close).toHaveBeenCalledWith(SERVER);
    });
  });

  describe('cvm.event fan-out', () => {
    it('delivers server-pushed events to windows with an active session', async () => {
      const { sent, send } = collectSent();
      // open a session by issuing a request
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r1', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();
      const note: McpMessage = { jsonrpc: '2.0', method: 'notifications/progress', params: { progress: 50 } };
      transport.emitEvent(SERVER, note);
      const event = sent.find((m) => m.type === 'cvm.event');
      expect(event).toEqual({ type: 'cvm.event', server: SERVER, message: note });
    });

    it('does not deliver events for servers the window has no session with', async () => {
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r1', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();
      transport.emitEvent({ pubkey: 'b'.repeat(64) }, { jsonrpc: '2.0', method: 'notifications/progress' });
      expect(sent.some((m) => m.type === 'cvm.event')).toBe(false);
    });

    it('stops delivering events after the window is destroyed', async () => {
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r1', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, send);
      await flush();
      svc.onWindowDestroyed?.(WINDOW);
      await flush();
      transport.emitEvent(SERVER, { jsonrpc: '2.0', method: 'notifications/progress' });
      expect(sent.some((m) => m.type === 'cvm.event')).toBe(false);
      expect(transport.close).toHaveBeenCalledWith(SERVER);
    });

    it('revokes only the affected source and suppresses its late result', async () => {
      let resolveRequest!: (message: McpMessage) => void;
      transport.request = vi.fn(() => new Promise<McpMessage>((resolve) => { resolveRequest = resolve; }));
      const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, execute) => ({
        status: 'executed' as const,
        value: await execute({ aborted: false, addEventListener() {}, removeEventListener() {} }),
      }));
      svc.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const first = collectSent();
      const sibling = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'pending', server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } } as NappletMessage, first.send);
      svc.handleMessage('sibling', { type: 'cvm.request', id: 'open', server: SERVER, message: { jsonrpc: '2.0', id: 2, method: 'tools/list' } } as NappletMessage, sibling.send);
      await flush();
      svc.onPermissionRevoked?.(WINDOW);
      resolveRequest({ jsonrpc: '2.0', id: 1, result: {} });
      await flush();

      expect(first.sent).toEqual([]);
      transport.emitEvent(SERVER, { jsonrpc: '2.0', method: 'notifications/progress' });
      expect(sibling.sent).toContainEqual(expect.objectContaining({ type: 'cvm.event' }));
      expect(transport.close).not.toHaveBeenCalled();
    });
  });

  it('ignores unknown cvm.* actions', async () => {
    const { sent, send } = collectSent();
    svc.handleMessage(WINDOW, { type: 'cvm.bogus', id: 'x' } as NappletMessage, send);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it('dispose() detaches the transport event subscription', () => {
    svc.dispose();
    expect(transport.eventClosed()).toBe(true);
    expect(transport.dispose).toHaveBeenCalledOnce();
  });
});

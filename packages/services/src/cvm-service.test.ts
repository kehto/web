import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NappletMessage } from '@napplet/core';

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
    it('resolves servers and echoes the id', async () => {
      const servers: CvmServer[] = [{ pubkey: SERVER.pubkey, name: 'Relatr' }];
      transport.discover = vi.fn(async () => servers);
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.discover', id: 'd1', query: { search: 'relay' } } as NappletMessage, send);
      await flush();
      expect(sent).toEqual([{ type: 'cvm.discover.result', id: 'd1', servers }]);
      expect(transport.discover).toHaveBeenCalledWith({ search: 'relay' });
    });

    it('returns empty servers + error string on transport failure', async () => {
      transport.discover = vi.fn(async () => { throw new Error('relay timeout'); });
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.discover', id: 'd2' } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.discover.result', id: 'd2', servers: [], error: 'relay timeout' });
    });
  });

  describe('cvm.request', () => {
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
        { initialize: true },
      );
    });

    it('rejects with "server not found" when server pubkey is missing', async () => {
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r2', message: { jsonrpc: '2.0' } } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.request.result', id: 'r2', error: 'server not found' });
    });

    it('rejects with "unsupported method" when the MCP message is missing', async () => {
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r3', server: SERVER } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.request.result', id: 'r3', error: 'unsupported method' });
    });

    it('surfaces a transport error as the envelope error', async () => {
      transport.request = vi.fn(async () => { throw new Error('policy denied'); });
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r4', server: SERVER, message: { jsonrpc: '2.0' } } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.request.result', id: 'r4', error: 'policy denied' });
    });
  });

  describe('cvm.close', () => {
    it('closes transport session and echoes id', async () => {
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.close', id: 'c1', server: SERVER } as NappletMessage, send);
      await flush();
      expect(sent[0]).toEqual({ type: 'cvm.close.result', id: 'c1' });
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
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r1', server: SERVER, message: { jsonrpc: '2.0', id: 1 } } as NappletMessage, send);
      await flush();
      transport.emitEvent({ pubkey: 'b'.repeat(64) }, { jsonrpc: '2.0', method: 'notifications/progress' });
      expect(sent.some((m) => m.type === 'cvm.event')).toBe(false);
    });

    it('stops delivering events after the window is destroyed', async () => {
      const { sent, send } = collectSent();
      svc.handleMessage(WINDOW, { type: 'cvm.request', id: 'r1', server: SERVER, message: { jsonrpc: '2.0', id: 1 } } as NappletMessage, send);
      await flush();
      svc.onWindowDestroyed?.(WINDOW);
      transport.emitEvent(SERVER, { jsonrpc: '2.0', method: 'notifications/progress' });
      expect(sent.some((m) => m.type === 'cvm.event')).toBe(false);
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
  });
});

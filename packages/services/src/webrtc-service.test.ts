import { describe, expect, it, vi } from 'vitest';
import type {
  NappletMessage,
  WebrtcEvent,
  WebrtcOpenRequest,
  WebrtcOpenResult,
} from '@napplet/core';

import { createWebrtcService, type WebrtcServiceOptions } from './webrtc-service.js';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';

const WINDOW_ID = 'win-webrtc';
const PEER_PUBKEY = '7'.repeat(64);
const REQUEST: WebrtcOpenRequest = {
  scope: { type: 'direct', pubkey: PEER_PUBKEY },
  channel: 'chat',
  protocol: 'chat:live',
};
const OPEN_RESULT: WebrtcOpenResult = {
  session: {
    id: 'webrtc-session-1',
    scope: REQUEST.scope,
    channel: 'chat',
    protocol: 'chat:live',
    state: 'open',
  },
};
const MESSAGE_EVENT: WebrtcEvent = {
  type: 'message',
  sessionId: 'webrtc-session-1',
  from: PEER_PUBKEY,
  payload: { body: 'hello' },
};

function collectSent(): { sent: NappletMessage[]; send: (msg: NappletMessage) => void } {
  const sent: NappletMessage[] = [];
  return {
    sent,
    send: (msg) => { sent.push(msg); },
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createWebrtcService', () => {
  it('returns a webrtc service descriptor', () => {
    const service = createWebrtcService();
    expect(service.descriptor.name).toBe('webrtc');
    expect(service.descriptor.version).toBe('1.0.0');
  });

  it('returns structured unsupported results for unavailable hooks', () => {
    const service = createWebrtcService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'webrtc.open', id: 'open-1', request: REQUEST } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'webrtc.send', id: 'send-1', sessionId: 'webrtc-session-1', payload: { body: 'hi' } } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'webrtc.close', id: 'close-1', sessionId: 'webrtc-session-1' } as NappletMessage, send);

    expect(sent).toEqual([
      { type: 'webrtc.open.result', id: 'open-1', error: 'webrtc.open unavailable' },
      { type: 'webrtc.send.result', id: 'send-1', error: 'session not found' },
      { type: 'webrtc.close.result', id: 'close-1', error: 'session not found' },
    ]);
  });

  it('delegates requests with context and supports host-pushed events', async () => {
    const options: WebrtcServiceOptions = {
      planOpen: () => ({ signalingRelayUrls: ['wss://signal.example'], iceEndpoints: [], resource: `peer:${PEER_PUBKEY}` }),
      open: vi.fn((_request, context) => {
        expect(context.windowId).toBe(WINDOW_ID);
        context.emit({ type: 'state', sessionId: 'webrtc-session-1', state: 'open' });
        return OPEN_RESULT;
      }),
      send: vi.fn((_sessionId, _payload, context) => {
        context.emit(MESSAGE_EVENT);
      }),
      close: vi.fn(),
    };
    const service = createWebrtcService(options);
    service.onRegistered?.({ authorizeOperation: async (_windowId: string, _operation: string, _requirements: readonly unknown[], run: (signal: ApprovalSignal) => unknown) =>
      ({ status: 'executed' as const, value: await run(new AbortController().signal) }) } as unknown as ServiceRuntimeContext);
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'webrtc.open', id: 'open-2', request: REQUEST } as NappletMessage, send);
    await flush();
    service.handleMessage(WINDOW_ID, { type: 'webrtc.send', id: 'send-2', sessionId: 'webrtc-session-1', payload: { body: 'hello' } } as NappletMessage, send);
    await flush();
    service.handleMessage(WINDOW_ID, { type: 'webrtc.close', id: 'close-2', sessionId: 'webrtc-session-1', reason: 'done' } as NappletMessage, send);
    await flush();

    expect(options.open).toHaveBeenCalledWith(REQUEST, expect.objectContaining({ windowId: WINDOW_ID, emit: expect.any(Function) }), expect.objectContaining({ signalingRelayUrls: ['wss://signal.example'] }));
    expect(options.send).toHaveBeenCalledWith('webrtc-session-1', { body: 'hello' }, expect.objectContaining({ windowId: WINDOW_ID, emit: expect.any(Function) }));
    expect(options.close).toHaveBeenCalledWith('webrtc-session-1', 'done', expect.objectContaining({ windowId: WINDOW_ID, emit: expect.any(Function) }));
    expect(sent).toEqual([
      { type: 'webrtc.event', event: { type: 'state', sessionId: 'webrtc-session-1', state: 'open' } },
      { type: 'webrtc.open.result', id: 'open-2', session: OPEN_RESULT.session },
      { type: 'webrtc.event', event: MESSAGE_EVENT },
      { type: 'webrtc.send.result', id: 'send-2' },
      { type: 'webrtc.close.result', id: 'close-2' },
    ]);
  });

  it('contains host exceptions as shaped error results', async () => {
    const service = createWebrtcService({ send: () => { throw new Error('session not found'); } });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'webrtc.send', id: 'send-3', sessionId: 'missing', payload: {} } as NappletMessage, send);
    await flush();

    expect(sent).toEqual([{ type: 'webrtc.send.result', id: 'send-3', error: 'session not found' }]);
  });

  it('contains unknown webrtc actions', () => {
    const service = createWebrtcService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'webrtc.unknown', id: 'u1' } as NappletMessage, send);

    expect(sent).toEqual([{ type: 'webrtc.unknown.error', id: 'u1', error: 'Unknown webrtc method: webrtc.unknown' }]);
  });

  it('delegates window destroy cleanup when configured', () => {
    const destroyWindow = vi.fn();
    const service = createWebrtcService({ destroyWindow });

    service.onWindowDestroyed?.(WINDOW_ID);

    expect(destroyWindow).toHaveBeenCalledWith(WINDOW_ID);
  });

  it('plans signaling destinations and waits for runtime approval before opening a peer', async () => {
    const open = vi.fn(() => OPEN_RESULT);
    const planOpen = vi.fn(() => ({
      signalingRelayUrls: ['wss://signal.example'],
      iceEndpoints: [],
      resource: `peer:${PEER_PUBKEY}`,
    }));
    let approve!: () => void;
    const gate = new Promise<void>((resolve) => { approve = resolve; });
    const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, run: (signal: ApprovalSignal) => Promise<WebrtcOpenResult>) => {
      await gate;
      return { status: 'executed' as const, value: await run(new AbortController().signal) };
    });
    const service = createWebrtcService({ open, planOpen } as WebrtcServiceOptions & { planOpen: typeof planOpen });
    service.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'webrtc.open', id: 'planned-open', request: REQUEST } as NappletMessage, send);
    await vi.waitFor(() => expect(authorizeOperation).toHaveBeenCalledTimes(1));
    expect(planOpen).toHaveBeenCalledWith(REQUEST, expect.objectContaining({ windowId: WINDOW_ID }));
    expect(open).not.toHaveBeenCalled();
    expect(authorizeOperation.mock.calls[0]?.[2]).toEqual([
      { category: 'interface', domain: 'webrtc', operation: 'access', scope: { kind: 'exact', value: 'webrtc' } },
      { category: 'resource', domain: 'webrtc', operation: 'webrtc.open', scope: { kind: 'exact', value: `peer:${PEER_PUBKEY}` } },
      { category: 'network', domain: 'webrtc', operation: 'webrtc.open', scope: { kind: 'origin', value: 'wss://signal.example' } },
    ]);

    approve();
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    expect(sent).toContainEqual({ type: 'webrtc.open.result', id: 'planned-open', session: OPEN_RESULT.session });
  });
});

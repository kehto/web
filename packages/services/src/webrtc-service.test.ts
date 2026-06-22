import { describe, expect, it, vi } from 'vitest';
import type {
  NappletMessage,
  WebrtcEvent,
  WebrtcOpenRequest,
  WebrtcOpenResult,
} from '@napplet/core';

import { createWebrtcService, type WebrtcServiceOptions } from './webrtc-service.js';

const WINDOW_ID = 'win-webrtc';
const REQUEST: WebrtcOpenRequest = {
  scope: { type: 'direct', pubkey: '7'.repeat(64) },
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
  from: '7'.repeat(64),
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
      { type: 'webrtc.send.result', id: 'send-1', error: 'webrtc.send unavailable' },
      { type: 'webrtc.close.result', id: 'close-1', error: 'webrtc.close unavailable' },
    ]);
  });

  it('delegates requests with context and supports host-pushed events', async () => {
    const options: WebrtcServiceOptions = {
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
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'webrtc.open', id: 'open-2', request: REQUEST } as NappletMessage, send);
    await flush();
    service.handleMessage(WINDOW_ID, { type: 'webrtc.send', id: 'send-2', sessionId: 'webrtc-session-1', payload: { body: 'hello' } } as NappletMessage, send);
    await flush();
    service.handleMessage(WINDOW_ID, { type: 'webrtc.close', id: 'close-2', sessionId: 'webrtc-session-1', reason: 'done' } as NappletMessage, send);
    await flush();

    expect(options.open).toHaveBeenCalledWith(REQUEST, expect.objectContaining({ windowId: WINDOW_ID, emit: expect.any(Function) }));
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
});

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

  it('silently ignores unknown webrtc types and warns the host once', () => {
    // NIP-5D (nostr-protocol/nips#2303 @ dskvr/nips@f60550c3): "Messages with an
    // unrecognized `type` MUST be silently ignored." The old `.error` reply broke that.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = createWebrtcService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'webrtc.unknown', id: 'u1' } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'webrtc.unknown', id: 'u2' } as NappletMessage, send);

    expect(sent).toEqual([]);
    const lines = warn.mock.calls.map(([line]) => String(line)).filter((line) => line.includes('[KEHTO_UNRECOGNIZED_MESSAGE_TYPE]'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"webrtc.unknown"');
    expect(lines[0]).not.toContain('u1');
    warn.mockRestore();
  });

  it('answers sendBytes with unsupported but ignores a stats request', () => {
    // NAP-WEBRTC #59 @ fb4dd6f0: "A shell that does not support byte payloads
    // returns the error `unsupported`." `stats` is only a shell-pushed event there,
    // so a `webrtc.stats` request is an unrecognized type (NIP-5D: no reply).
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = createWebrtcService(), { sent, send } = collectSent();
    for (const type of ['webrtc.sendBytes', 'webrtc.stats']) service.handleMessage(WINDOW_ID, { type, id: type } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'webrtc.sendBytes.result', id: 'webrtc.sendBytes', error: 'unsupported' }]);
    warn.mockRestore();
  });

  it('contains synchronous backend send exceptions after a successful open', async () => {
    const service = createWebrtcService({ planOpen: () => ({ signalingRelayUrls: [], iceEndpoints: [], resource: 'room:test' }),
      open: () => OPEN_RESULT, send: () => { throw new Error('QUEUE_FULL'); } });
    service.onRegistered?.({ authorizeOperation: async (_w: string, _op: string, _r: unknown, run: (s: ApprovalSignal) => unknown) => ({ status: 'executed', value: await run(new AbortController().signal) }) } as unknown as ServiceRuntimeContext);
    const { sent, send } = collectSent();
    service.handleMessage(WINDOW_ID, { type: 'webrtc.open', id: 'open', request: REQUEST } as NappletMessage, send);
    await flush();
    service.handleMessage(WINDOW_ID, { type: 'webrtc.send', id: 'send', sessionId: OPEN_RESULT.session.id, payload: {} } as NappletMessage, send);
    await flush();
    expect(sent).toContainEqual({ type: 'webrtc.send.result', id: 'send', error: 'QUEUE_FULL' });
  });

  it('delegates window destroy cleanup when configured', () => {
    const destroyWindow = vi.fn();
    const service = createWebrtcService({ destroyWindow });

    service.onWindowDestroyed?.(WINDOW_ID);

    expect(destroyWindow).toHaveBeenCalledWith(WINDOW_ID);
  });

  // NAP-WEBRTC (napplet/naps#59 @ fb4dd6f0, Wire Protocol): the shell "MUST NOT
  // deliver messages for an unknown sessionId"; a closed session is unknown.
  describe('after webrtc.close', () => {
    const approveAll = { authorizeOperation: async (_w: string, _o: string, _r: readonly unknown[], run: (signal: ApprovalSignal) => unknown) =>
      ({ status: 'executed' as const, value: await run(new AbortController().signal) }) } as unknown as ServiceRuntimeContext;
    // `stats` is in NAP-WEBRTC @ fb4dd6f0 but not yet in @napplet/core's WebrtcEvent (upstream package drift).
    const STATS_EVENT = { type: 'stats', sessionId: 'webrtc-session-1', pubkey: PEER_PUBKEY, rttMs: 42, lossRatio: 0 } as unknown as WebrtcEvent;
    const STATE_EVENT: WebrtcEvent = { type: 'state', sessionId: 'webrtc-session-1', state: 'closed' };
    const LATE_EVENTS: readonly WebrtcEvent[] = [MESSAGE_EVENT, STATE_EVENT, STATS_EVENT,
      { type: 'peer', sessionId: 'webrtc-session-1', pubkey: PEER_PUBKEY, state: 'left' },
      { type: 'closed', sessionId: 'webrtc-session-1', reason: 'peer disconnected' }];

    async function openSession(close: WebrtcServiceOptions['close']) {
      let emit!: (event: WebrtcEvent) => void;
      const service = createWebrtcService({
        planOpen: () => ({ signalingRelayUrls: [], iceEndpoints: [], resource: `peer:${PEER_PUBKEY}` }),
        open: (_request, context) => { emit = (event) => context.emit(event); return OPEN_RESULT; },
        close,
      });
      service.onRegistered?.(approveAll);
      const { sent, send } = collectSent();
      service.handleMessage(WINDOW_ID, { type: 'webrtc.open', id: 'open', request: REQUEST } as NappletMessage, send);
      await flush();
      emit(MESSAGE_EVENT);
      expect(sent).toEqual([
        { type: 'webrtc.open.result', id: 'open', session: OPEN_RESULT.session },
        { type: 'webrtc.event', event: MESSAGE_EVENT },
      ]);
      sent.length = 0;
      return { service, sent, send, emit: (event: WebrtcEvent) => emit(event) };
    }

    it.each(LATE_EVENTS.map((event) => [event.type, event] as const))('drops a late %s event from the open context', async (_type, event) => {
      const { service, sent, send, emit } = await openSession(vi.fn());
      service.handleMessage(WINDOW_ID, { type: 'webrtc.close', id: 'close', sessionId: 'webrtc-session-1' } as NappletMessage, send);
      await flush();
      emit(event);
      expect(sent).toEqual([{ type: 'webrtc.close.result', id: 'close' }]);
    });

    it('drops events the backend emits while close is still tearing down', async () => {
      let finish!: () => void;
      const { service, sent, send, emit } = await openSession(vi.fn((_id, _reason, context) => {
        // The backend's own teardown notifications and a racing remote message.
        context.emit(STATE_EVENT);
        context.emit({ type: 'closed', sessionId: 'webrtc-session-1' });
        return new Promise<void>((resolve) => { finish = resolve; });
      }));
      service.handleMessage(WINDOW_ID, { type: 'webrtc.close', id: 'close', sessionId: 'webrtc-session-1' } as NappletMessage, send);
      await flush();
      emit(MESSAGE_EVENT);
      emit(STATS_EVENT);
      expect(sent).toEqual([]);
      finish();
      await flush();
      expect(sent).toEqual([{ type: 'webrtc.close.result', id: 'close' }]);
    });

    it('keeps delivering when the close hook fails and the session stays open', async () => {
      const { service, sent, send, emit } = await openSession(vi.fn(async () => { throw new Error('signaling unavailable'); }));
      service.handleMessage(WINDOW_ID, { type: 'webrtc.close', id: 'close', sessionId: 'webrtc-session-1' } as NappletMessage, send);
      await flush();
      emit(MESSAGE_EVENT);
      expect(sent).toEqual([
        { type: 'webrtc.close.result', id: 'close', error: 'signaling unavailable' },
        { type: 'webrtc.event', event: MESSAGE_EVENT },
      ]);
    });

    it('drops events for a sessionId the window never opened', async () => {
      const { sent, emit } = await openSession(vi.fn());
      emit({ ...MESSAGE_EVENT, sessionId: 'someone-else' });
      expect(sent).toEqual([]);
    });
  });

  it('plans signaling destinations and waits for runtime approval before opening a peer', async () => {
    const open = vi.fn(() => OPEN_RESULT);
    const planOpen = vi.fn(() => ({
      signalingRelayUrls: ['wss://signal.example'],
      iceEndpoints: ['turn:relay.example:3478?transport=udp'],
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
      { category: 'network', domain: 'webrtc', operation: 'webrtc.open', scope: { kind: 'ice', value: 'turn:relay.example:3478?transport=udp' } },
    ]);

    approve();
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    expect(sent).toContainEqual({ type: 'webrtc.open.result', id: 'planned-open', session: OPEN_RESULT.session });
  });
});

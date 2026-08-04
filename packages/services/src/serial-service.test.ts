import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, SerialOpenRequest, SerialOpenResult } from '@napplet/core';

import {
  createSerialService,
  type SerialServiceContext,
  type SerialServiceOptions,
} from './serial-service.js';

const WINDOW_ID = 'win-serial';
const REQUEST: SerialOpenRequest = { options: { baudRate: 9600 }, label: 'demo serial' };
const OPEN_RESULT: SerialOpenResult = {
  session: {
    id: 'serial-session-1',
    state: 'open',
    info: { displayName: 'Demo serial' },
  },
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

describe('createSerialService', () => {
  it('returns a serial service descriptor', () => {
    const service = createSerialService();
    expect(service.descriptor.name).toBe('serial');
    expect(service.descriptor.version).toBe('1.0.0');
  });

  it('returns structured unsupported results for unavailable hooks', () => {
    const service = createSerialService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'open-1', request: REQUEST } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'serial.write', id: 'write-1', sessionId: 'serial-session-1', data: [1] } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'serial.close', id: 'close-1', sessionId: 'serial-session-1' } as NappletMessage, send);

    expect(sent).toEqual([
      { type: 'serial.open.result', id: 'open-1', error: 'serial.open unavailable' },
      { type: 'serial.write.result', id: 'write-1', error: 'serial.write unavailable' },
      { type: 'serial.close.result', id: 'close-1', error: 'serial.close unavailable' },
    ]);
  });

  it('delegates open/write/close with request data and caller context', async () => {
    const options: SerialServiceOptions = {
      open: vi.fn(() => OPEN_RESULT),
      write: vi.fn(),
      close: vi.fn(),
    };
    const service = createSerialService(options);
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'open-2', request: REQUEST } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'serial.write', id: 'write-2', sessionId: 'serial-session-1', data: [1, 2, 3] } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'serial.close', id: 'close-2', sessionId: 'serial-session-1', reason: 'done' } as NappletMessage, send);
    await flush();

    expect(options.open).toHaveBeenCalledWith(REQUEST, expect.objectContaining({ windowId: WINDOW_ID }));
    expect(options.write).toHaveBeenCalledWith('serial-session-1', [1, 2, 3], expect.objectContaining({ windowId: WINDOW_ID }));
    expect(options.close).toHaveBeenCalledWith('serial-session-1', 'done', expect.objectContaining({ windowId: WINDOW_ID }));
    expect(sent).toEqual([
      { type: 'serial.open.result', id: 'open-2', session: OPEN_RESULT.session },
      { type: 'serial.write.result', id: 'write-2' },
      { type: 'serial.close.result', id: 'close-2' },
    ]);
  });

  it('lets the host deliver serial data and lifecycle events', async () => {
    const service = createSerialService({
      open: (_request, context) => {
        context.emit({ type: 'state', sessionId: 'serial-session-1', state: 'open' });
        context.emit({ type: 'data', sessionId: 'serial-session-1', data: [4, 5, 6] });
        return OPEN_RESULT;
      },
    });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'open-events', request: REQUEST } as NappletMessage, send);
    await flush();

    expect(sent).toEqual([
      { type: 'serial.open.result', id: 'open-events', session: OPEN_RESULT.session },
      { type: 'serial.event', event: { type: 'state', sessionId: 'serial-session-1', state: 'open' } },
      { type: 'serial.event', event: { type: 'data', sessionId: 'serial-session-1', data: [4, 5, 6] } },
    ]);
  });

  it('suppresses serial events after their session closes or window is destroyed', async () => {
    const contexts: SerialServiceContext[] = [];
    const service = createSerialService({
      open: (_request, context) => {
        contexts.push(context);
        return OPEN_RESULT;
      },
      close: vi.fn(),
    });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'open-before-close', request: REQUEST } as NappletMessage, send);
    await flush();
    service.handleMessage(WINDOW_ID, { type: 'serial.close', id: 'close-1', sessionId: 'serial-session-1' } as NappletMessage, send);
    await flush();
    contexts[0]!.emit({ type: 'data', sessionId: 'serial-session-1', data: [1] });

    service.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'open-before-destroy', request: REQUEST } as NappletMessage, send);
    await flush();
    service.onWindowDestroyed?.(WINDOW_ID);
    contexts[1]!.emit({ type: 'data', sessionId: 'serial-session-1', data: [2] });

    expect(sent).toEqual([
      { type: 'serial.open.result', id: 'open-before-close', session: OPEN_RESULT.session },
      { type: 'serial.close.result', id: 'close-1' },
      { type: 'serial.open.result', id: 'open-before-destroy', session: OPEN_RESULT.session },
    ]);
  });

  it('suppresses a destroyed window context after that window id is reused', async () => {
    let resolveFirstOpen!: (result: SerialOpenResult) => void;
    let firstContext!: SerialServiceContext;
    let opens = 0;
    const service = createSerialService({
      open: (_request, context) => {
        opens += 1;
        if (opens === 1) {
          firstContext = context;
          return new Promise<SerialOpenResult>((resolve) => { resolveFirstOpen = resolve; });
        }
        return OPEN_RESULT;
      },
    });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'first-open', request: REQUEST } as NappletMessage, send);
    service.onWindowDestroyed?.(WINDOW_ID);
    service.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'second-open', request: REQUEST } as NappletMessage, send);
    await flush();

    resolveFirstOpen(OPEN_RESULT);
    await flush();
    firstContext.emit({ type: 'data', sessionId: 'serial-session-1', data: [9] });

    expect(sent).toEqual([
      { type: 'serial.open.result', id: 'second-open', session: OPEN_RESULT.session },
    ]);
  });

  it('contains host exceptions as shaped error results', async () => {
    const service = createSerialService({ write: () => { throw new Error('port closed'); } });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'serial.write', id: 'write-3', sessionId: 'missing', data: [1] } as NappletMessage, send);
    await flush();

    expect(sent).toEqual([{ type: 'serial.write.result', id: 'write-3', error: 'port closed' }]);
  });

  it('contains unknown serial actions', () => {
    const service = createSerialService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'serial.unknown', id: 'u1' } as NappletMessage, send);

    expect(sent).toEqual([{ type: 'serial.unknown.error', id: 'u1', error: 'Unknown serial method: serial.unknown' }]);
  });

  it('delegates window destroy cleanup when configured', () => {
    const destroyWindow = vi.fn();
    const service = createSerialService({ destroyWindow });

    service.onWindowDestroyed?.(WINDOW_ID);

    expect(destroyWindow).toHaveBeenCalledWith(WINDOW_ID);
  });
});

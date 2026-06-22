import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, SerialOpenRequest, SerialOpenResult } from '@napplet/core';

import { createSerialService, type SerialServiceOptions } from './serial-service.js';

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

    expect(options.open).toHaveBeenCalledWith(REQUEST, { windowId: WINDOW_ID });
    expect(options.write).toHaveBeenCalledWith('serial-session-1', [1, 2, 3], { windowId: WINDOW_ID });
    expect(options.close).toHaveBeenCalledWith('serial-session-1', 'done', { windowId: WINDOW_ID });
    expect(sent).toEqual([
      { type: 'serial.open.result', id: 'open-2', session: OPEN_RESULT.session },
      { type: 'serial.write.result', id: 'write-2' },
      { type: 'serial.close.result', id: 'close-2' },
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

import { describe, expect, it, vi } from 'vitest';
import type {
  BleAttribute,
  BleOpenRequest,
  BleOpenResult,
  BleService,
  NappletMessage,
} from '@napplet/core';

import { createBleService, type BleServiceOptions } from './ble-service.js';

const WINDOW_ID = 'win-ble';
const TARGET: BleAttribute = { service: 'battery_service', characteristic: 'battery_level' };
const REQUEST: BleOpenRequest = { acceptAllDevices: true, optionalServices: ['battery_service'], label: 'demo ble' };
const OPEN_RESULT: BleOpenResult = {
  session: {
    id: 'ble-session-1',
    state: 'open',
    device: { id: 'ble-device-1', name: 'Demo BLE', services: ['battery_service'] },
  },
};
const SERVICES: BleService[] = [{
  uuid: 'battery_service',
  characteristics: [{ uuid: 'battery_level', properties: { read: true, write: true, notify: true } }],
}];

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

describe('createBleService', () => {
  it('returns a ble service descriptor', () => {
    const service = createBleService();
    expect(service.descriptor.name).toBe('ble');
    expect(service.descriptor.version).toBe('1.0.0');
  });

  it('returns structured unsupported results for unavailable hooks', () => {
    const service = createBleService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'ble.open', id: 'open-1', request: REQUEST } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.services', id: 'services-1', sessionId: 'ble-session-1' } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.read', id: 'read-1', sessionId: 'ble-session-1', target: TARGET } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.write', id: 'write-1', sessionId: 'ble-session-1', target: TARGET, data: [1] } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.subscribe', id: 'sub-1', sessionId: 'ble-session-1', target: TARGET } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.unsubscribe', id: 'unsub-1', sessionId: 'ble-session-1', target: TARGET } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.close', id: 'close-1', sessionId: 'ble-session-1' } as NappletMessage, send);

    expect(sent).toEqual([
      { type: 'ble.open.result', id: 'open-1', error: 'ble.open unavailable' },
      { type: 'ble.services.result', id: 'services-1', error: 'ble.services unavailable' },
      { type: 'ble.read.result', id: 'read-1', error: 'ble.read unavailable' },
      { type: 'ble.write.result', id: 'write-1', error: 'ble.write unavailable' },
      { type: 'ble.subscribe.result', id: 'sub-1', error: 'ble.subscribe unavailable' },
      { type: 'ble.unsubscribe.result', id: 'unsub-1', error: 'ble.unsubscribe unavailable' },
      { type: 'ble.close.result', id: 'close-1', error: 'ble.close unavailable' },
    ]);
  });

  it('delegates all request types with request data and caller context', async () => {
    const options: BleServiceOptions = {
      open: vi.fn(() => OPEN_RESULT),
      services: vi.fn(() => SERVICES),
      read: vi.fn(() => [87]),
      write: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      close: vi.fn(),
    };
    const service = createBleService(options);
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'ble.open', id: 'open-2', request: REQUEST } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.services', id: 'services-2', sessionId: 'ble-session-1' } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.read', id: 'read-2', sessionId: 'ble-session-1', target: TARGET } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.write', id: 'write-2', sessionId: 'ble-session-1', target: TARGET, data: [1, 2], options: { response: 'with-response' } } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.subscribe', id: 'sub-2', sessionId: 'ble-session-1', target: TARGET } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.unsubscribe', id: 'unsub-2', sessionId: 'ble-session-1', target: TARGET } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'ble.close', id: 'close-2', sessionId: 'ble-session-1', reason: 'done' } as NappletMessage, send);
    await flush();

    expect(options.open).toHaveBeenCalledWith(REQUEST, { windowId: WINDOW_ID });
    expect(options.services).toHaveBeenCalledWith('ble-session-1', { windowId: WINDOW_ID });
    expect(options.read).toHaveBeenCalledWith('ble-session-1', TARGET, { windowId: WINDOW_ID });
    expect(options.write).toHaveBeenCalledWith('ble-session-1', TARGET, [1, 2], { response: 'with-response' }, { windowId: WINDOW_ID });
    expect(options.subscribe).toHaveBeenCalledWith('ble-session-1', TARGET, { windowId: WINDOW_ID });
    expect(options.unsubscribe).toHaveBeenCalledWith('ble-session-1', TARGET, { windowId: WINDOW_ID });
    expect(options.close).toHaveBeenCalledWith('ble-session-1', 'done', { windowId: WINDOW_ID });
    expect(sent).toEqual([
      { type: 'ble.open.result', id: 'open-2', session: OPEN_RESULT.session },
      { type: 'ble.services.result', id: 'services-2', services: SERVICES },
      { type: 'ble.read.result', id: 'read-2', data: [87] },
      { type: 'ble.write.result', id: 'write-2' },
      { type: 'ble.subscribe.result', id: 'sub-2' },
      { type: 'ble.unsubscribe.result', id: 'unsub-2' },
      { type: 'ble.close.result', id: 'close-2' },
    ]);
  });

  it('contains host exceptions as shaped error results', async () => {
    const service = createBleService({ read: () => { throw new Error('device disconnected'); } });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'ble.read', id: 'read-3', sessionId: 'missing', target: TARGET } as NappletMessage, send);
    await flush();

    expect(sent).toEqual([{ type: 'ble.read.result', id: 'read-3', error: 'device disconnected' }]);
  });

  it('contains unknown ble actions', () => {
    const service = createBleService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'ble.unknown', id: 'u1' } as NappletMessage, send);

    expect(sent).toEqual([{ type: 'ble.unknown.error', id: 'u1', error: 'Unknown ble method: ble.unknown' }]);
  });

  it('delegates window destroy cleanup when configured', () => {
    const destroyWindow = vi.fn();
    const service = createBleService({ destroyWindow });

    service.onWindowDestroyed?.(WINDOW_ID);

    expect(destroyWindow).toHaveBeenCalledWith(WINDOW_ID);
  });
});

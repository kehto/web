import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';

import {
  MOCK_SERIAL_PORTS,
  SERIAL_MOCK_ENTRY,
  SERIAL_SPEC_REF,
  createMockSerialService,
  mockSerialEcho,
} from './serial.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

const OPEN = { type: 'serial.open', id: 's1', request: { options: { baudRate: 115200 }, label: 'controller' } } as NappletMessage;
const ARDUINO_INFO = { usbVendorId: 0x2341, usbProductId: 0x0043, displayName: 'Arduino Uno' };

function opened() {
  const service = createMockSerialService();
  const { sent, send } = sink();
  service.handleMessage('w1', OPEN, send);
  sent.length = 0;
  return { service, sent, send };
}

describe('createMockSerialService', () => {
  it('describes the serial domain and spec ref', () => {
    const service = createMockSerialService();
    expect(service.descriptor.name).toBe('serial');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.messageCapabilities).toBeUndefined();
    expect(service.mock.routes).toEqual(['serial.open', 'serial.write', 'serial.close']);
    expect(SERIAL_SPEC_REF).toEqual({ nap: 'NAP-SERIAL', status: 'draft', source: 'pr', pr: 61, sha: '0c6e88ab8003', path: 'naps/NAP-SERIAL.md' });
    expect(SERIAL_MOCK_ENTRY).toMatchObject({ domain: 'serial', kind: 'service', spec: SERIAL_SPEC_REF });
    expect(SERIAL_MOCK_ENTRY.create?.({}).descriptor.name).toBe('serial');
  });

  it('serial.open selects the first seeded port and returns an open session', () => {
    const service = createMockSerialService();
    const { sent, send } = sink();
    service.handleMessage('w1', OPEN, send);
    expect(sent).toEqual([{ type: 'serial.open.result', id: 's1', session: { id: 'serial-1', state: 'open', info: ARDUINO_INFO } }]);
    const session = service.mock.state().sessions.get('serial-1');
    expect(session).toMatchObject({ windowId: 'w1', state: 'open', label: 'controller', options: { baudRate: 115200 }, writes: [] });
  });

  it('serial.open honors usb filters and reports port unavailable on a miss', () => {
    const service = createMockSerialService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'serial.open', id: 's2', request: { filters: [{ usbVendorId: 0x10c4 }], options: { baudRate: 9600 } } } as NappletMessage, send);
    expect(sent[0]).toEqual({
      type: 'serial.open.result',
      id: 's2',
      session: { id: 'serial-1', state: 'open', info: { usbVendorId: 0x10c4, usbProductId: 0xea60, displayName: MOCK_SERIAL_PORTS[1]!.displayName } },
    });
    service.handleMessage('w1', { type: 'serial.open', id: 's3', request: { filters: [{ usbVendorId: 1 }], options: { baudRate: 9600 } } } as NappletMessage, send);
    expect(sent[1]).toEqual({ type: 'serial.open.result', id: 's3', error: 'port unavailable' });
  });

  it('serial.open rejects a request without baudRate and never includes session with error', () => {
    const service = createMockSerialService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'serial.open', id: 's4', request: { options: {} } } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'serial.open.result', id: 's4', error: 'open failed' }]);
  });

  it('serial.write records the bytes, acks, then echoes them upper-cased as a data event', () => {
    const { service, sent, send } = opened();
    service.handleMessage('w1', { type: 'serial.write', id: 'w1', sessionId: 'serial-1', data: [112, 105, 110, 103, 10] } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'serial.write.result', id: 'w1' },
      { type: 'serial.event', event: { type: 'data', sessionId: 'serial-1', data: [80, 73, 78, 71, 10] } },
    ]);
    expect(service.mock.state().sessions.get('serial-1')?.writes).toEqual([[112, 105, 110, 103, 10]]);
    expect(mockSerialEcho([79, 75, 10])).toEqual([79, 75, 10]);
  });

  it('serial.write validates bytes and session ids', () => {
    const { service, sent, send } = opened();
    service.handleMessage('w1', { type: 'serial.write', id: 'w2', sessionId: 'serial-1', data: [256] } as NappletMessage, send);
    service.handleMessage('w1', { type: 'serial.write', id: 'w3', sessionId: 'serial-9', data: [1] } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'serial.write.result', id: 'w2', error: 'invalid data' },
      { type: 'serial.write.result', id: 'w3', error: 'session not found' },
    ]);
  });

  it('echo can be disabled or replaced', () => {
    const silent = createMockSerialService({ echo: false });
    const { sent, send } = sink();
    silent.handleMessage('w1', OPEN, send);
    silent.handleMessage('w1', { type: 'serial.write', id: 'w1', sessionId: 'serial-1', data: [1] } as NappletMessage, send);
    expect(sent.at(-1)).toEqual({ type: 'serial.write.result', id: 'w1' });
    const reversed = createMockSerialService({ echo: (bytes) => [...bytes].reverse() });
    const other = sink();
    reversed.handleMessage('w1', OPEN, other.send);
    reversed.handleMessage('w1', { type: 'serial.write', id: 'w1', sessionId: 'serial-1', data: [1, 2] } as NappletMessage, other.send);
    expect(other.sent.at(-1)).toEqual({ type: 'serial.event', event: { type: 'data', sessionId: 'serial-1', data: [2, 1] } });
  });

  it('serial.close acks, pushes a closed event, and is idempotent', () => {
    const { service, sent, send } = opened();
    service.handleMessage('w1', { type: 'serial.close', id: 'c1', sessionId: 'serial-1', reason: 'done' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'serial.close', id: 'c2', sessionId: 'serial-1' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'serial.close', id: 'c3', sessionId: 'missing' } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'serial.close.result', id: 'c1' },
      { type: 'serial.event', event: { type: 'closed', sessionId: 'serial-1', reason: 'done' } },
      { type: 'serial.close.result', id: 'c2' },
      { type: 'serial.close.result', id: 'c3', error: 'session not found' },
    ]);
    service.handleMessage('w1', { type: 'serial.write', id: 'w9', sessionId: 'serial-1', data: [1] } as NappletMessage, send);
    expect(sent.at(-1)).toEqual({ type: 'serial.write.result', id: 'w9', error: 'session not found' });
  });

  it('receive() pushes device bytes and disconnect() pushes a closed event', () => {
    const { service, sent, send } = opened();
    expect(service.receive('serial-1', [79, 75, 10])).toBe(true);
    expect(service.receive('serial-1', [300])).toBe(false);
    expect(service.receive('nope', [1])).toBe(false);
    expect(service.disconnect('serial-1')).toBe(true);
    expect(service.disconnect('serial-1')).toBe(false);
    expect(sent).toEqual([
      { type: 'serial.event', event: { type: 'data', sessionId: 'serial-1', data: [79, 75, 10] } },
      { type: 'serial.event', event: { type: 'closed', sessionId: 'serial-1', reason: 'device disconnected' } },
    ]);
    expect(service.mock.sent.slice(-2).map((entry) => entry.windowId)).toEqual(['w1', 'w1']);
    void send;
  });

  it('receive() routes through the runtime context when registered', () => {
    const { service } = opened();
    const runtime: ServiceRuntimeContext = {
      resolveDTag: () => 'dtag',
      listWindowIds: () => ['w1'],
      hasCapability: () => true,
      sendToEligibleNapplet: vi.fn(() => true),
    };
    service.onRegistered?.(runtime);
    service.receive('serial-1', [1]);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('w1', { type: 'serial.event', event: { type: 'data', sessionId: 'serial-1', data: [1] } });
  });

  it('reset() restores seeded ports, drops sessions, and restarts ids', () => {
    const { service, send } = opened();
    service.mock.reset();
    expect(service.mock.state().sessions.size).toBe(0);
    expect(service.mock.state().ports).toEqual([...MOCK_SERIAL_PORTS]);
    expect(service.mock.sent).toEqual([]);
    const { sent } = sink();
    service.handleMessage('w2', OPEN, (msg) => sent.push(msg));
    expect(sent[0]).toMatchObject({ session: { id: 'serial-1' } });
    void send;
  });

  it('onWindowDestroyed drops that window sessions only', () => {
    const { service, send } = opened();
    service.handleMessage('w2', { ...OPEN, id: 's2' } as NappletMessage, send);
    service.onWindowDestroyed?.('w1');
    expect([...service.mock.state().sessions.keys()]).toEqual(['serial-2']);
    expect(service.receive('serial-1', [1])).toBe(false);
  });

  it('onCapabilityRevoked(null) closes the window sessions with permission denied', () => {
    const { service, sent } = opened();
    service.onCapabilityRevoked?.('w1', 'relay:read');
    expect(sent).toEqual([]);
    service.onCapabilityRevoked?.('w1', null);
    expect(sent).toEqual([{ type: 'serial.event', event: { type: 'closed', sessionId: 'serial-1', reason: 'permission denied' } }]);
    expect(service.mock.state().sessions.get('serial-1')?.state).toBe('closed');
  });
});

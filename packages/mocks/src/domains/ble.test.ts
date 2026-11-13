import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';

import {
  BLE_MOCK_ENTRY,
  BLE_SPEC_REF,
  MOCK_BLE_DEVICE,
  MOCK_BLE_UUIDS,
  canonicalBleUuid,
  createMockBleService,
} from './ble.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

const OPEN = { type: 'ble.open', id: 'b1', request: { filters: [{ services: ['battery_service'] }], label: 'sensor' } } as NappletMessage;
const BATTERY = { service: 'battery_service', characteristic: 0x2a19 };
const TX = { service: MOCK_BLE_UUIDS.uartService, characteristic: MOCK_BLE_UUIDS.uartTx };
const RX = { service: MOCK_BLE_UUIDS.uartService, characteristic: MOCK_BLE_UUIDS.uartRx };
const WIRE_DEVICE = {
  id: MOCK_BLE_DEVICE.id,
  name: 'Kehto Sensor Tag',
  services: [MOCK_BLE_UUIDS.batteryService, MOCK_BLE_UUIDS.uartService],
};

function opened() {
  const service = createMockBleService();
  const { sent, send } = sink();
  service.handleMessage('w1', OPEN, send);
  sent.length = 0;
  const call = (msg: Record<string, unknown>) =>
    service.handleMessage('w1', { sessionId: 'ble-1', ...msg } as unknown as NappletMessage, send);
  return { service, sent, send, call };
}

describe('canonicalBleUuid', () => {
  it('resolves names, 16-bit numbers, hex strings, and canonical strings', () => {
    expect(canonicalBleUuid('battery_service')).toBe(MOCK_BLE_UUIDS.batteryService);
    expect(canonicalBleUuid(0x180f)).toBe(MOCK_BLE_UUIDS.batteryService);
    expect(canonicalBleUuid('0x2A19')).toBe(MOCK_BLE_UUIDS.batteryLevel);
    expect(canonicalBleUuid(MOCK_BLE_UUIDS.uartTx.toUpperCase())).toBe(MOCK_BLE_UUIDS.uartTx);
    expect(canonicalBleUuid('heart_rate')).toBe('heart_rate');
  });
});

describe('createMockBleService', () => {
  it('describes the ble domain and spec ref', () => {
    const service = createMockBleService();
    expect(service.descriptor.name).toBe('ble');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.messageCapabilities).toBeUndefined();
    expect(service.mock.routes).toEqual(['ble.open', 'ble.services', 'ble.read', 'ble.write', 'ble.subscribe', 'ble.unsubscribe', 'ble.close']);
    expect(BLE_SPEC_REF).toEqual({ nap: 'NAP-BLE', status: 'draft', source: 'pr', pr: 62, sha: 'b46b86913c23', path: 'naps/NAP-BLE.md' });
    expect(BLE_MOCK_ENTRY).toMatchObject({ domain: 'ble', kind: 'service', spec: BLE_SPEC_REF });
    expect(BLE_MOCK_ENTRY.create?.({}).descriptor.name).toBe('ble');
  });

  it('ble.open returns an open session with the redacted device', () => {
    const service = createMockBleService();
    const { sent, send } = sink();
    service.handleMessage('w1', OPEN, send);
    expect(sent).toEqual([{ type: 'ble.open.result', id: 'b1', session: { id: 'ble-1', state: 'open', device: WIRE_DEVICE } }]);
    expect(service.mock.state().sessions.get('ble-1')).toMatchObject({ windowId: 'w1', state: 'open', label: 'sensor' });
  });

  it('ble.open enforces filter rules and device matching', () => {
    const service = createMockBleService();
    const { sent, send } = sink();
    const open = (id: string, request: unknown) => service.handleMessage('w1', { type: 'ble.open', id, request } as NappletMessage, send);
    open('o1', {});
    open('o2', { acceptAllDevices: true, filters: [{ name: 'x' }] });
    open('o3', { filters: [{ namePrefix: 'Other' }] });
    open('o4', { filters: [{ services: [0x180f] }], exclusionFilters: [{ name: 'Kehto Sensor Tag' }] });
    open('o5', { acceptAllDevices: true });
    expect(sent).toEqual([
      { type: 'ble.open.result', id: 'o1', error: 'open failed' },
      { type: 'ble.open.result', id: 'o2', error: 'open failed' },
      { type: 'ble.open.result', id: 'o3', error: 'device unavailable' },
      { type: 'ble.open.result', id: 'o4', error: 'device unavailable' },
      { type: 'ble.open.result', id: 'o5', session: { id: 'ble-1', state: 'open', device: WIRE_DEVICE } },
    ]);
  });

  it('ble.services lists canonical services and characteristic properties', () => {
    const { sent, call } = opened();
    call({ type: 'ble.services', id: 'sv1' });
    expect(sent).toEqual([{
      type: 'ble.services.result',
      id: 'sv1',
      services: [
        { uuid: MOCK_BLE_UUIDS.batteryService, characteristics: [{ uuid: MOCK_BLE_UUIDS.batteryLevel, properties: { read: true, notify: true } }] },
        {
          uuid: MOCK_BLE_UUIDS.uartService,
          characteristics: [
            { uuid: MOCK_BLE_UUIDS.uartTx, properties: { write: true, writeWithoutResponse: true } },
            { uuid: MOCK_BLE_UUIDS.uartRx, properties: { notify: true } },
          ],
        },
      ],
    }]);
    call({ type: 'ble.services', id: 'sv2', sessionId: 'ble-9' });
    expect(sent[1]).toEqual({ type: 'ble.services.result', id: 'sv2', error: 'session not found' });
  });

  it('ble.read returns the seeded battery level and resolves target errors', () => {
    const { sent, call } = opened();
    call({ type: 'ble.read', id: 'r1', target: BATTERY });
    call({ type: 'ble.read', id: 'r2', target: { service: 'heart_rate', characteristic: 0x2a37 } });
    call({ type: 'ble.read', id: 'r3', target: { service: 'battery_service', characteristic: 0x2a37 } });
    call({ type: 'ble.read', id: 'r4', target: { ...BATTERY, descriptor: 0x2901 } });
    call({ type: 'ble.read', id: 'r5', target: RX });
    call({ type: 'ble.read', id: 'r6', target: { ...BATTERY, descriptor: 'client_characteristic_configuration' } });
    expect(sent).toEqual([
      { type: 'ble.read.result', id: 'r1', data: [87] },
      { type: 'ble.read.result', id: 'r2', error: 'service not found' },
      { type: 'ble.read.result', id: 'r3', error: 'characteristic not found' },
      { type: 'ble.read.result', id: 'r4', error: 'descriptor not found' },
      { type: 'ble.read.result', id: 'r5', error: 'operation not supported' },
      { type: 'ble.read.result', id: 'r6', data: [0, 0] },
    ]);
  });

  it('ble.write records writes, honors response modes, and rejects bad bytes', () => {
    const { service, sent, call } = opened();
    call({ type: 'ble.write', id: 'w1', target: TX, data: [104, 105], options: { response: 'without-response' } });
    call({ type: 'ble.write', id: 'w2', target: TX, data: [256] });
    call({ type: 'ble.write', id: 'w3', target: BATTERY, data: [1] });
    call({ type: 'ble.write', id: 'w4', target: { ...BATTERY, descriptor: 0x2902 }, data: [1, 0] });
    expect(sent).toEqual([
      { type: 'ble.write.result', id: 'w1' },
      { type: 'ble.write.result', id: 'w2', error: 'invalid data' },
      { type: 'ble.write.result', id: 'w3', error: 'operation not supported' },
      { type: 'ble.write.result', id: 'w4', error: 'operation not supported' },
    ]);
    expect(service.mock.state().sessions.get('ble-1')?.writes).toEqual([
      { target: { service: MOCK_BLE_UUIDS.uartService, characteristic: MOCK_BLE_UUIDS.uartTx }, data: [104, 105], response: 'without-response' },
    ]);
  });

  it('ble.subscribe gates on notify/indicate, reflects in the CCCD, and echoes UART TX to RX', () => {
    const { sent, call } = opened();
    call({ type: 'ble.subscribe', id: 's1', target: RX });
    call({ type: 'ble.subscribe', id: 's2', target: TX });
    call({ type: 'ble.subscribe', id: 's3', target: { ...RX, descriptor: 0x2902 } });
    call({ type: 'ble.read', id: 'r1', target: { ...RX, descriptor: 0x2902 } });
    call({ type: 'ble.write', id: 'w1', target: TX, data: [112, 105, 110, 103] });
    call({ type: 'ble.unsubscribe', id: 'u1', target: RX });
    call({ type: 'ble.unsubscribe', id: 'u2', target: RX });
    call({ type: 'ble.write', id: 'w2', target: TX, data: [1] });
    expect(sent).toEqual([
      { type: 'ble.subscribe.result', id: 's1' },
      { type: 'ble.subscribe.result', id: 's2', error: 'operation not supported' },
      { type: 'ble.subscribe.result', id: 's3', error: 'operation not supported' },
      { type: 'ble.read.result', id: 'r1', data: [1, 0] },
      { type: 'ble.write.result', id: 'w1' },
      { type: 'ble.event', event: { type: 'notification', sessionId: 'ble-1', target: RX, data: [112, 105, 110, 103] } },
      { type: 'ble.unsubscribe.result', id: 'u1' },
      { type: 'ble.unsubscribe.result', id: 'u2' },
      { type: 'ble.write.result', id: 'w2' },
    ]);
  });

  it('ble.close acks, pushes a closed event, drops subscriptions, and is idempotent', () => {
    const { service, sent, call } = opened();
    call({ type: 'ble.subscribe', id: 's1', target: BATTERY });
    sent.length = 0;
    call({ type: 'ble.close', id: 'c1', reason: 'done' });
    call({ type: 'ble.close', id: 'c2' });
    call({ type: 'ble.close', id: 'c3', sessionId: 'missing' });
    expect(sent).toEqual([
      { type: 'ble.close.result', id: 'c1' },
      { type: 'ble.event', event: { type: 'closed', sessionId: 'ble-1', reason: 'done' } },
      { type: 'ble.close.result', id: 'c2' },
      { type: 'ble.close.result', id: 'c3', error: 'session not found' },
    ]);
    expect(service.mock.state().sessions.get('ble-1')?.subscriptions.size).toBe(0);
    expect(service.notify('ble-1', BATTERY, [1])).toBe(false);
  });

  it('notify() pushes only for subscribed characteristics and disconnect() closes', () => {
    const { service, sent, call } = opened();
    expect(service.notify('ble-1', 'battery_level', [86])).toBe(false);
    call({ type: 'ble.subscribe', id: 's1', target: BATTERY });
    sent.length = 0;
    expect(service.notify('ble-1', 'battery_level', [86])).toBe(true);
    expect(service.notify('ble-1', BATTERY, [300])).toBe(false);
    expect(service.notify('ble-1', 'heart_rate', [1])).toBe(false);
    expect(service.disconnect('ble-1')).toBe(true);
    expect(service.disconnect('ble-1')).toBe(false);
    expect(sent).toEqual([
      { type: 'ble.event', event: { type: 'notification', sessionId: 'ble-1', target: { service: MOCK_BLE_UUIDS.batteryService, characteristic: MOCK_BLE_UUIDS.batteryLevel }, data: [86] } },
      { type: 'ble.event', event: { type: 'closed', sessionId: 'ble-1', reason: 'device disconnected' } },
    ]);
  });

  it('notify() routes through the runtime context when registered', () => {
    const { service, call } = opened();
    call({ type: 'ble.subscribe', id: 's1', target: BATTERY });
    const runtime: ServiceRuntimeContext = {
      resolveDTag: () => 'dtag',
      listWindowIds: () => ['w1'],
      hasCapability: () => true,
      sendToEligibleNapplet: vi.fn(() => true),
    };
    service.onRegistered?.(runtime);
    service.notify('ble-1', 0x2a19, [5]);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('w1', {
      type: 'ble.event',
      event: { type: 'notification', sessionId: 'ble-1', target: { service: MOCK_BLE_UUIDS.batteryService, characteristic: MOCK_BLE_UUIDS.batteryLevel }, data: [5] },
    });
  });

  it('reset() drops sessions and restarts ids', () => {
    const { service, send } = opened();
    service.mock.reset();
    expect(service.mock.state().sessions.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
    const { sent } = sink();
    service.handleMessage('w2', OPEN, (msg) => sent.push(msg));
    expect(sent[0]).toMatchObject({ session: { id: 'ble-1' } });
    void send;
  });

  it('onWindowDestroyed drops that window sessions only', () => {
    const { service, send } = opened();
    service.handleMessage('w2', { ...OPEN, id: 'b2' } as NappletMessage, send);
    service.onWindowDestroyed?.('w1');
    expect([...service.mock.state().sessions.keys()]).toEqual(['ble-2']);
  });

  it('onCapabilityRevoked(null) closes the window sessions with permission denied', () => {
    const { service, sent, call } = opened();
    call({ type: 'ble.subscribe', id: 's1', target: BATTERY });
    sent.length = 0;
    service.onCapabilityRevoked?.('w1', 'relay:read');
    expect(sent).toEqual([]);
    service.onCapabilityRevoked?.('w1', null);
    expect(sent).toEqual([{ type: 'ble.event', event: { type: 'closed', sessionId: 'ble-1', reason: 'permission denied' } }]);
    expect(service.mock.state().sessions.get('ble-1')).toMatchObject({ state: 'closed' });
    expect(service.mock.state().sessions.get('ble-1')?.subscriptions.size).toBe(0);
  });
});

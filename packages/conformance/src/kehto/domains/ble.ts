import { createBleService, type BleServiceContext } from '@kehto/services';
import { createSessionTable } from './sessions.js';
import type { DomainBackendModule } from './types.js';

type BleEvent = Parameters<BleServiceContext['emit']>[0];
type Target = { service: string | number; characteristic: string | number; descriptor?: string | number };

/** Canonical UUIDs of the simulated heart-rate monitor. */
export const BLE_UUIDS = Object.freeze({
  heartRate: '0000180d-0000-1000-8000-00805f9b34fb',
  heartRateMeasurement: '00002a37-0000-1000-8000-00805f9b34fb',
  battery: '0000180f-0000-1000-8000-00805f9b34fb',
  batteryLevel: '00002a19-0000-1000-8000-00805f9b34fb',
});

const SERVICES = [
  { uuid: BLE_UUIDS.heartRate, characteristics: [{ uuid: BLE_UUIDS.heartRateMeasurement, properties: { notify: true } }] },
  { uuid: BLE_UUIDS.battery, characteristics: [{ uuid: BLE_UUIDS.batteryLevel, properties: { read: true, write: true } }] },
];

const key = (sessionId: string, target: Target): string => `${sessionId}|${String(target.service)}|${String(target.characteristic)}`;

function bytesOf(payload: unknown): number[] {
  const data = (payload as { data?: unknown } | undefined)?.data;
  return Array.isArray(data) ? data.map(Number) : [0, 72];
}

/**
 * NAP-BLE backend: the reference BLE service over a simulated heart-rate monitor.
 *
 * Opens get the lowest free `ble-<n>` id. Like a Web Bluetooth device (and
 * Paja's browser controller), the simulated characteristic only notifies
 * between `startNotifications` and `stopNotifications`, so `ble.notify` emits
 * on subscribed targets only; the reference service forwards whatever the
 * device emits.
 */
export const BLE_BACKEND: DomainBackendModule = {
  domain: 'ble',
  create() {
    const sessions = createSessionTable<BleEvent>('ble');
    const subscribed = new Map<string, { sessionId: string; target: Target; emit: (event: BleEvent) => void }>();
    let battery = [87];
    const service = createBleService({
      open(_request, context) {
        const open = () => ({ session: { id: sessions.open(context.windowId, (event) => context.emit(event)), state: 'open' as const, device: { id: 'conformance-hrm', name: 'Conformance HRM', services: [BLE_UUIDS.heartRate, BLE_UUIDS.battery] } } });
        return context.authorizeDevice ? context.authorizeDevice('ble:device:conformance-hrm', open) : open();
      },
      services: () => structuredClone(SERVICES),
      read: () => [...battery],
      write(_sessionId, _target, data) { battery = [...data]; },
      subscribe(sessionId, target, context) { subscribed.set(key(sessionId, target), { sessionId, target: { ...target }, emit: (event) => context.emit(event) }); },
      unsubscribe(sessionId, target) { subscribed.delete(key(sessionId, target)); },
      close(sessionId) {
        sessions.close(sessionId);
        for (const [entry, value] of subscribed) if (value.sessionId === sessionId) subscribed.delete(entry);
      },
      destroyWindow(windowId) { sessions.dropWindow(windowId); },
    });
    return {
      services: { ble: service },
      adapter: { ble: { isAvailable: () => true } },
      controls: {
        'ble.notify': (payload) => {
          for (const { sessionId, target, emit } of subscribed.values()) emit({ type: 'notification', sessionId, target, data: bytesOf(payload) });
        },
      },
    };
  },
};

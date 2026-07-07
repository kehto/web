import type {
  BleAttribute,
  BleOpenRequest,
  BleOpenResult,
  BleService as CoreBleService,
  BleWriteOptions,
  ListItem,
  ListRef,
  ListSupport,
  SerialOpenRequest,
  SerialOpenResult,
  WebrtcEvent,
  WebrtcOpenRequest,
  WebrtcOpenResult,
} from '@napplet/core';

const DEV_LISTS_EVENT_ID = '3'.repeat(64);
const DEV_SERIAL_LABEL = 'Paja serial';
const DEV_BLE_DEVICE_NAME = 'Paja BLE';
const DEV_BLE_SERVICE_UUID = 'battery_service';
const DEV_BLE_CHARACTERISTIC_UUID = 'battery_level';
const DEV_WEBRTC_PEER = '6'.repeat(64);

const DEV_LISTS_SUPPORT: ListSupport = {
  kind: 10003,
  type: 'bookmarks',
  addressable: false,
  supportedItemTypes: ['event', 'url'],
};

function destroyWindowSessions<T extends { windowId: string }>(
  sessions: Map<string, T>,
  windowId: string,
): void {
  for (const [sessionId, session] of sessions) {
    if (session.windowId === windowId) sessions.delete(sessionId);
  }
}

/** Create an in-memory development list store. */
export function createDevListStore() {
  const values = new Set<string>();
  const itemKey = (item: ListItem) => `${item.itemType}:${item.value}`;
  const isSupported = (list: ListRef): boolean =>
    ('type' in list && list.type === DEV_LISTS_SUPPORT.type)
    || ('kind' in list && list.kind === DEV_LISTS_SUPPORT.kind);
  return {
    supported: () => [DEV_LISTS_SUPPORT],
    add(list: ListRef, items: readonly ListItem[]) {
      if (!isSupported(list)) return { ok: false, error: 'unsupported-list' as const, reason: 'unsupported list', supported: [DEV_LISTS_SUPPORT] };
      let added = 0;
      let skipped = 0;
      for (const item of items) {
        const key = itemKey(item);
        if (values.has(key)) skipped += 1;
        else {
          values.add(key);
          added += 1;
        }
      }
      return { ok: true, eventId: DEV_LISTS_EVENT_ID, added, skipped };
    },
    remove(list: ListRef, items: readonly ListItem[]) {
      if (!isSupported(list)) return { ok: false, error: 'unsupported-list' as const, reason: 'unsupported list', supported: [DEV_LISTS_SUPPORT] };
      let removed = 0;
      let skipped = 0;
      for (const item of items) {
        if (values.delete(itemKey(item))) removed += 1;
        else skipped += 1;
      }
      return { ok: true, eventId: DEV_LISTS_EVENT_ID, removed, skipped };
    },
  };
}

/** Create a deterministic development serial controller. */
export function createDevSerialController() {
  const sessions = new Map<string, { windowId: string; writes: number[][] }>();
  let nextSession = 1;

  return {
    open(_request: SerialOpenRequest, context: { windowId: string }): SerialOpenResult {
      const id = `paja-serial-${nextSession++}`;
      sessions.set(id, { windowId: context.windowId, writes: [] });
      return {
        session: {
          id,
          state: 'open',
          info: { displayName: DEV_SERIAL_LABEL },
        },
      };
    },
    write(sessionId: string, data: readonly number[]): void {
      const session = sessions.get(sessionId);
      if (!session) throw new Error('serial session not found');
      session.writes.push([...data]);
    },
    close(sessionId: string): void {
      if (!sessions.delete(sessionId)) throw new Error('serial session not found');
    },
    destroyWindow(windowId: string): void {
      destroyWindowSessions(sessions, windowId);
    },
  };
}

/** Create a deterministic development BLE controller. */
export function createDevBleController() {
  const sessions = new Map<string, { windowId: string; writes: number[][]; subscriptions: Set<string> }>();
  let nextSession = 1;
  const service: CoreBleService = {
    uuid: DEV_BLE_SERVICE_UUID,
    characteristics: [{
      uuid: DEV_BLE_CHARACTERISTIC_UUID,
      properties: { read: true, write: true, notify: true },
    }],
  };
  const targetKey = (target: BleAttribute): string =>
    `${String(target.service)}:${String(target.characteristic)}:${String(target.descriptor ?? '')}`;
  const getSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('ble session not found');
    return session;
  };

  return {
    open(_request: BleOpenRequest, context: { windowId: string }): BleOpenResult {
      const id = `paja-ble-${nextSession++}`;
      sessions.set(id, { windowId: context.windowId, writes: [], subscriptions: new Set() });
      return {
        session: {
          id,
          state: 'open',
          device: {
            id: 'paja-ble-device',
            name: DEV_BLE_DEVICE_NAME,
            services: [DEV_BLE_SERVICE_UUID],
          },
        },
      };
    },
    services(sessionId: string): CoreBleService[] {
      getSession(sessionId);
      return [service];
    },
    read(sessionId: string, _target: BleAttribute): number[] {
      getSession(sessionId);
      return [87];
    },
    write(sessionId: string, _target: BleAttribute, data: readonly number[], _options: BleWriteOptions | undefined): void {
      getSession(sessionId).writes.push([...data]);
    },
    subscribe(sessionId: string, target: BleAttribute): void {
      getSession(sessionId).subscriptions.add(targetKey(target));
    },
    unsubscribe(sessionId: string, target: BleAttribute): void {
      getSession(sessionId).subscriptions.delete(targetKey(target));
    },
    close(sessionId: string): void {
      if (!sessions.delete(sessionId)) throw new Error('ble session not found');
    },
    destroyWindow(windowId: string): void {
      destroyWindowSessions(sessions, windowId);
    },
  };
}

/** Create a deterministic development WebRTC controller. */
export function createDevWebrtcController() {
  const sessions = new Map<string, { windowId: string; payloads: unknown[] }>();
  let nextSession = 1;
  const getSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('webrtc session not found');
    return session;
  };

  return {
    open(request: WebrtcOpenRequest, context: { windowId: string; emit(event: WebrtcEvent): void }): WebrtcOpenResult {
      const id = `paja-webrtc-${nextSession++}`;
      const channel = request.channel ?? 'default';
      sessions.set(id, { windowId: context.windowId, payloads: [] });
      context.emit({ type: 'state', sessionId: id, state: 'open' });
      context.emit({ type: 'peer', sessionId: id, pubkey: DEV_WEBRTC_PEER, state: 'joined' });
      return {
        session: {
          id,
          scope: request.scope,
          channel,
          ...(request.protocol ? { protocol: request.protocol } : {}),
          state: 'open',
        },
      };
    },
    send(sessionId: string, payload: unknown, context: { emit(event: WebrtcEvent): void }): void {
      getSession(sessionId).payloads.push(payload);
      context.emit({ type: 'message', sessionId, from: DEV_WEBRTC_PEER, payload });
    },
    close(sessionId: string, reason: string | undefined, context: { emit(event: WebrtcEvent): void }): void {
      getSession(sessionId);
      sessions.delete(sessionId);
      context.emit({ type: 'closed', sessionId, ...(reason ? { reason } : {}) });
    },
    destroyWindow(windowId: string): void {
      destroyWindowSessions(sessions, windowId);
    },
  };
}

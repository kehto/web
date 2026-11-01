/**
 * domains/ble.ts — Mock NAP-BLE service.
 *
 * Spec: naps/NAP-BLE.md @ napplet/naps PR #62 head b46b86913c23 (draft)
 * Routes: ble.open, ble.services, ble.read, ble.write, ble.subscribe,
 *         ble.unsubscribe, ble.close
 * Spec gaps / decisions:
 * - The NAP names no error for an `open` request that violates its own rules
 *   (no filter and no `acceptAllDevices`, or `acceptAllDevices` together with
 *   filters); the mock answers `open failed`. A filter the seeded device does
 *   not match answers `device unavailable`.
 * - `ble.subscribe` with `target.descriptor`, and any read/write/subscribe the
 *   characteristic properties do not allow, answer `operation not supported`.
 * - The only descriptor the mock knows is the CCCD (`0x2902`) on notifying
 *   characteristics; reading it reports the subscription state as `[1, 0]` or
 *   `[0, 0]`. Other descriptors answer `descriptor not found`.
 * - Writes to the UART TX characteristic are echoed as a notification on the
 *   UART RX characteristic while RX is subscribed (`MockBleOptions.echo`).
 * - Repeated `ble.close` on an already closed session is idempotent; unknown
 *   ids answer `session not found`.
 * - No ACL capability maps to `ble`, so `onCapabilityRevoked` closes a
 *   window's sessions (reason `permission denied`) only on a block (`null`).
 * - `@napplet/nap@0.32.0` ble types match the PR #62 wire tables.
 */
import type { NappletMessage } from '@kehto/runtime';
import type {
  BleAttribute,
  BleCharacteristicProperties,
  BleDeviceFilter,
  BleEvent,
  BleOpenRequest,
  BleService,
  BleSession,
  BleSessionState,
  BleUuid,
  BleWriteOptions,
} from '@napplet/core';
import type {
  BleCloseMessage,
  BleOpenMessage,
  BleReadMessage,
  BleServicesMessage,
  BleSubscribeMessage,
  BleUnsubscribeMessage,
  BleWriteMessage,
} from '@napplet/nap/ble/types';

import { defineMockService, inheritMockPush, pushToWindow } from '../core/handler.js';
import { asRequest } from './nostr-store.js';
import { mockHex } from '../core/rng.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/**
 * NAP-BLE document checked when this mock was written.
 *
 * @example
 * ```ts
 * BLE_SPEC_REF.pr === 62;
 * ```
 */
export const BLE_SPEC_REF: NapSpecRef = {
  nap: 'NAP-BLE',
  status: 'draft',
  source: 'pr',
  pr: 62,
  sha: 'b46b86913c23',
  path: 'naps/NAP-BLE.md',
};

/** Bluetooth base UUID suffix for 16/32-bit assigned numbers. */
const BLE_BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Canonical UUIDs of the seeded device: a Bluetooth SIG battery service and a
 * UART-style custom service with a write (TX) and a notify (RX) characteristic.
 *
 * @example
 * ```ts
 * MOCK_BLE_UUIDS.batteryService === '0000180f-0000-1000-8000-00805f9b34fb';
 * ```
 */
export const MOCK_BLE_UUIDS = Object.freeze({
  batteryService: `0000180f${BLE_BASE_SUFFIX}`,
  batteryLevel: `00002a19${BLE_BASE_SUFFIX}`,
  cccd: `00002902${BLE_BASE_SUFFIX}`,
  uartService: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  uartTx: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  uartRx: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
} as const);

/** Assigned names the mock resolves in `BleUuid` requests. */
const ASSIGNED_NAMES: Readonly<Record<string, number>> = Object.freeze({
  generic_access: 0x1800,
  device_information: 0x180a,
  battery_service: 0x180f,
  battery_level: 0x2a19,
  client_characteristic_configuration: 0x2902,
});

/**
 * Resolve a `BleUuid` (assigned name, 16/32-bit number, or UUID string) to the
 * canonical lowercase UUID string results must use. Unknown names are
 * lower-cased and returned as-is so they simply fail to match.
 *
 * @param uuid - Request-side UUID reference.
 * @returns Canonical lowercase UUID string.
 * @example
 * ```ts
 * canonicalBleUuid('battery_service') === canonicalBleUuid(0x180f);
 * ```
 */
export function canonicalBleUuid(uuid: BleUuid): string {
  if (typeof uuid === 'number') {
    if (!Number.isInteger(uuid) || uuid < 0 || uuid > 0xffffffff) return String(uuid);
    return `${uuid.toString(16).padStart(8, '0')}${BLE_BASE_SUFFIX}`;
  }
  const text = String(uuid).trim().toLowerCase();
  if (CANONICAL_UUID.test(text)) return text;
  const assigned = ASSIGNED_NAMES[text];
  if (assigned !== undefined) return canonicalBleUuid(assigned);
  if (/^(0x)?[0-9a-f]{4}$/.test(text)) return canonicalBleUuid(Number.parseInt(text.replace(/^0x/, ''), 16));
  return text;
}

/**
 * A seeded characteristic with its current value.
 *
 * @example
 * ```ts
 * const level: MockBleCharacteristic = { uuid: MOCK_BLE_UUIDS.batteryLevel, properties: { read: true, notify: true }, value: [87] };
 * ```
 */
export interface MockBleCharacteristic {
  /** Canonical UUID. */
  uuid: string;
  /** Allowed operations. */
  properties: BleCharacteristicProperties;
  /** Initial value returned by `ble.read`. */
  value: number[];
}

/**
 * A seeded GATT service.
 *
 * @example
 * ```ts
 * MOCK_BLE_DEVICE.services[0]!.uuid === MOCK_BLE_UUIDS.batteryService;
 * ```
 */
export interface MockBleGattService {
  /** Canonical UUID. */
  uuid: string;
  /** Characteristics in declaration order. */
  characteristics: MockBleCharacteristic[];
}

/**
 * A seeded BLE device the mock chooser can pick.
 *
 * @example
 * ```ts
 * MOCK_BLE_DEVICE.name === 'Kehto Sensor Tag';
 * ```
 */
export interface MockBleDevice {
  /** Runtime-scoped opaque id. */
  id: string;
  /** Advertised name. */
  name: string;
  /** Exposed services. */
  services: MockBleGattService[];
}

/**
 * The single seeded device: a battery service (level 87%) and a UART-style
 * custom service.
 *
 * @example
 * ```ts
 * MOCK_BLE_DEVICE.services.map((s) => s.uuid);
 * ```
 */
export const MOCK_BLE_DEVICE: MockBleDevice = Object.freeze({
  id: `ble-device-${mockHex('ble:device:sensor-tag', 16)}`,
  name: 'Kehto Sensor Tag',
  services: [
    {
      uuid: MOCK_BLE_UUIDS.batteryService,
      characteristics: [{ uuid: MOCK_BLE_UUIDS.batteryLevel, properties: { read: true, notify: true }, value: [87] }],
    },
    {
      uuid: MOCK_BLE_UUIDS.uartService,
      characteristics: [
        { uuid: MOCK_BLE_UUIDS.uartTx, properties: { write: true, writeWithoutResponse: true }, value: [] },
        { uuid: MOCK_BLE_UUIDS.uartRx, properties: { notify: true }, value: [] },
      ],
    },
  ],
});

/**
 * One recorded write.
 *
 * @example
 * ```ts
 * const write = service.mock.state().sessions.get('ble-1')?.writes[0];
 * ```
 */
export interface MockBleWrite {
  /** Canonicalized target. */
  target: BleAttribute;
  /** Bytes written. */
  data: number[];
  /** Response mode requested, when given. */
  response?: BleWriteOptions['response'];
}

/**
 * One BLE session the mock holds for a window.
 *
 * @example
 * ```ts
 * service.mock.state().sessions.get('ble-1')?.subscriptions.has(MOCK_BLE_UUIDS.uartRx);
 * ```
 */
export interface MockBleSession {
  /** Runtime-assigned session id (`ble-N`). */
  id: string;
  /** Owning napplet window. */
  windowId: string;
  /** Lifecycle state. */
  state: BleSessionState;
  /** Optional chooser label from the request. */
  label?: string;
  /** Canonical characteristic UUIDs with active notifications. */
  subscriptions: Set<string>;
  /** Every accepted write, oldest first. */
  writes: MockBleWrite[];
  /** Characteristic values overridden by writes (canonical UUID → bytes). */
  values: Map<string, number[]>;
}

/**
 * In-memory state of the BLE mock.
 *
 * @example
 * ```ts
 * const state: MockBleState = service.mock.state();
 * ```
 */
export interface MockBleState {
  /** Device the chooser returns. */
  device: MockBleDevice;
  /** Sessions by id, including closed ones. */
  sessions: Map<string, MockBleSession>;
  /** Next session counter. */
  nextSession: number;
}

/**
 * Factory options for the BLE mock.
 *
 * @example
 * ```ts
 * const service = createMockBleService({ echo: false });
 * ```
 */
export interface MockBleOptions extends MockServiceOptions {
  /** Device to seed. Default `MOCK_BLE_DEVICE`. */
  device?: MockBleDevice;
  /** Echo UART TX writes as UART RX notifications while subscribed. Default `true`. */
  echo?: boolean;
}

/**
 * BLE mock with device-side controls.
 *
 * @example
 * ```ts
 * const service = createMockBleService();
 * service.notify('ble-1', MOCK_BLE_UUIDS.batteryLevel, [86]);
 * ```
 */
export type MockBleService = MockService<MockBleState> & {
  /**
   * Push a notification for a subscribed characteristic.
   *
   * @param sessionId - Open session.
   * @param characteristic - Characteristic UUID (any `BleUuid` form) or a full attribute.
   * @param bytes - Byte values 0..255.
   * @returns `false` when the session, characteristic, subscription, bytes, or
   * delivery path is missing.
   */
  notify(sessionId: string, characteristic: BleUuid | BleAttribute, bytes: readonly number[]): boolean;
  /**
   * Close a session from the device side and push a `closed` event.
   *
   * @param sessionId - Open session.
   * @param reason - Close reason. Default `device disconnected`.
   * @returns `false` when the session is unknown or already closed.
   */
  disconnect(sessionId: string, reason?: string): boolean;
};

interface ResolvedTarget {
  service: MockBleGattService;
  characteristic: MockBleCharacteristic;
  descriptor?: string;
}

const isByteArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);

const isFilterList = (value: unknown): value is BleDeviceFilter[] => value === undefined || Array.isArray(value);

function matchesFilter(device: MockBleDevice, filter: BleDeviceFilter): boolean {
  if (typeof filter !== 'object' || filter === null) return false;
  if (filter.manufacturerData?.length || filter.serviceData?.length) return false;
  if (filter.name !== undefined && filter.name !== device.name) return false;
  if (filter.namePrefix !== undefined && !device.name.startsWith(filter.namePrefix)) return false;
  const uuids = device.services.map((service) => service.uuid);
  return (filter.services ?? []).every((uuid) => uuids.includes(canonicalBleUuid(uuid)));
}

function openError(request: unknown, device: MockBleDevice): string | undefined {
  if (typeof request !== 'object' || request === null) return 'open failed';
  const { filters, exclusionFilters, acceptAllDevices } = request as BleOpenRequest;
  if (!isFilterList(filters) || !isFilterList(exclusionFilters)) return 'open failed';
  if (acceptAllDevices === true && (filters?.length || exclusionFilters?.length)) return 'open failed';
  if (acceptAllDevices !== true && !filters?.length) return 'open failed';
  if (filters?.length && !filters.some((filter) => matchesFilter(device, filter))) return 'device unavailable';
  if (exclusionFilters?.some((filter) => matchesFilter(device, filter))) return 'device unavailable';
  return undefined;
}

function resolveTarget(device: MockBleDevice, target: unknown): ResolvedTarget | string {
  if (typeof target !== 'object' || target === null) return 'service not found';
  const attribute = target as BleAttribute;
  const service = device.services.find((entry) => entry.uuid === canonicalBleUuid(attribute.service));
  if (!service) return 'service not found';
  const characteristic = service.characteristics.find((entry) => entry.uuid === canonicalBleUuid(attribute.characteristic));
  if (!characteristic) return 'characteristic not found';
  if (attribute.descriptor === undefined) return { service, characteristic };
  const descriptor = canonicalBleUuid(attribute.descriptor);
  const notifies = characteristic.properties.notify || characteristic.properties.indicate;
  if (descriptor !== MOCK_BLE_UUIDS.cccd || !notifies) return 'descriptor not found';
  return { service, characteristic, descriptor };
}

function wireTarget(resolved: ResolvedTarget): BleAttribute {
  return {
    service: resolved.service.uuid,
    characteristic: resolved.characteristic.uuid,
    ...(resolved.descriptor !== undefined ? { descriptor: resolved.descriptor } : {}),
  };
}

function writeError(resolved: ResolvedTarget, options: BleWriteOptions | undefined): string | undefined {
  if (resolved.descriptor !== undefined) return 'operation not supported';
  const { write, writeWithoutResponse } = resolved.characteristic.properties;
  const response = options?.response;
  if (response === 'with-response') return write ? undefined : 'operation not supported';
  if (response === 'without-response') return writeWithoutResponse ? undefined : 'operation not supported';
  return write || writeWithoutResponse ? undefined : 'operation not supported';
}

function toWireSession(session: MockBleSession, device: MockBleDevice): BleSession {
  return {
    id: session.id,
    state: session.state,
    device: { id: device.id, name: device.name, services: device.services.map((service) => service.uuid) },
  };
}

function toWireServices(device: MockBleDevice): BleService[] {
  return device.services.map((service) => ({
    uuid: service.uuid,
    characteristics: service.characteristics.map(({ uuid, properties }) => ({ uuid, properties: { ...properties } })),
  }));
}

function openSession(state: MockBleState, sessionId: unknown): MockBleSession | undefined {
  const session = typeof sessionId === 'string' ? state.sessions.get(sessionId) : undefined;
  return session?.state === 'open' ? session : undefined;
}

function findCharacteristic(device: MockBleDevice, characteristic: BleUuid | BleAttribute): ResolvedTarget | undefined {
  if (typeof characteristic === 'object') {
    const resolved = resolveTarget(device, characteristic);
    return typeof resolved === 'string' ? undefined : resolved;
  }
  const uuid = canonicalBleUuid(characteristic);
  for (const service of device.services) {
    const match = service.characteristics.find((entry) => entry.uuid === uuid);
    if (match) return { service, characteristic: match };
  }
  return undefined;
}

const eventMessage = (event: BleEvent): NappletMessage => ({ type: 'ble.event', event }) as NappletMessage;

/**
 * Create the NAP-BLE mock.
 *
 * @param options - Device seed, echo toggle, and shared mock options.
 * @returns A `ble` service handler with `mock`, `notify`, and `disconnect`.
 * @example
 * ```ts
 * const service = createMockBleService();
 * service.handleMessage('w1', { type: 'ble.open', id: 'b1', request: { filters: [{ services: ['battery_service'] }] } }, send);
 * ```
 */
export function createMockBleService(options: MockBleOptions = {}): MockBleService {
  const echo = options.echo ?? true;
  let service: MockBleService;
  const emit = (session: MockBleSession, event: BleEvent): boolean =>
    pushToWindow(service, session.windowId, eventMessage(event));
  const closeWindow = (windowId: string, state: MockBleState, reason: string | undefined): void => {
    for (const session of state.sessions.values()) {
      if (session.windowId !== windowId || session.state === 'closed') continue;
      session.state = 'closed';
      session.subscriptions.clear();
      if (reason) emit(session, { type: 'closed', sessionId: session.id, reason });
    }
  };
  const withTarget = (
    state: MockBleState,
    message: { sessionId?: unknown; target?: unknown },
    fail: (error: string) => void,
  ): { session: MockBleSession; resolved: ResolvedTarget } | undefined => {
    const session = openSession(state, message.sessionId);
    if (!session) {
      fail('session not found');
      return undefined;
    }
    const resolved = resolveTarget(state.device, message.target);
    if (typeof resolved === 'string') {
      fail(resolved);
      return undefined;
    }
    return { session, resolved };
  };

  const mock = defineMockService<MockBleState>({
    domain: 'ble',
    version: '1.0.0',
    description: 'Mock NAP-BLE service: one seeded GATT device with battery and UART services',
    kind: 'service',
    initialState: () => ({ device: options.device ?? MOCK_BLE_DEVICE, sessions: new Map(), nextSession: 1 }),
    routes: {
      'ble.open': ({ message, state, windowId, reply, fail }) => {
        const { request } = asRequest<BleOpenMessage>(message);
        const error = openError(request, state.device);
        if (error) return fail(error);
        const id = `ble-${state.nextSession++}`;
        const session: MockBleSession = {
          id,
          windowId,
          state: 'open',
          ...(request.label !== undefined ? { label: request.label } : {}),
          subscriptions: new Set(),
          writes: [],
          values: new Map(),
        };
        state.sessions.set(id, session);
        reply({ session: toWireSession(session, state.device) });
      },
      'ble.services': ({ message, state, reply, fail }) => {
        if (!openSession(state, (asRequest<BleServicesMessage>(message)).sessionId)) return fail('session not found');
        reply({ services: toWireServices(state.device) });
      },
      'ble.read': ({ message, state, reply, fail }) => {
        const hit = withTarget(state, asRequest<BleReadMessage>(message), fail);
        if (!hit) return;
        const { session, resolved } = hit;
        if (resolved.descriptor !== undefined) {
          return reply({ data: [session.subscriptions.has(resolved.characteristic.uuid) ? 1 : 0, 0] });
        }
        if (!resolved.characteristic.properties.read) return fail('operation not supported');
        reply({ data: [...(session.values.get(resolved.characteristic.uuid) ?? resolved.characteristic.value)] });
      },
      'ble.write': ({ message, state, reply, fail, push }) => {
        const { data, options: writeOptions } = asRequest<BleWriteMessage>(message);
        const hit = withTarget(state, asRequest<BleWriteMessage>(message), fail);
        if (!hit) return;
        const { session, resolved } = hit;
        if (!isByteArray(data)) return fail('invalid data');
        const error = writeError(resolved, writeOptions);
        if (error) return fail(error);
        const target = wireTarget(resolved);
        session.writes.push({ target, data: [...data], ...(writeOptions?.response !== undefined ? { response: writeOptions.response } : {}) });
        session.values.set(resolved.characteristic.uuid, [...data]);
        reply();
        const echoRx = echo && resolved.characteristic.uuid === MOCK_BLE_UUIDS.uartTx && session.subscriptions.has(MOCK_BLE_UUIDS.uartRx);
        if (echoRx) {
          push(eventMessage({
            type: 'notification',
            sessionId: session.id,
            target: { service: resolved.service.uuid, characteristic: MOCK_BLE_UUIDS.uartRx },
            data: [...data],
          }));
        }
      },
      'ble.subscribe': ({ message, state, reply, fail }) => {
        const { target } = asRequest<BleSubscribeMessage>(message);
        if (typeof target === 'object' && target !== null && target.descriptor !== undefined) return fail('operation not supported');
        const hit = withTarget(state, asRequest<BleSubscribeMessage>(message), fail);
        if (!hit) return;
        const { notify, indicate } = hit.resolved.characteristic.properties;
        if (!notify && !indicate) return fail('operation not supported');
        hit.session.subscriptions.add(hit.resolved.characteristic.uuid);
        reply();
      },
      'ble.unsubscribe': ({ message, state, reply, fail }) => {
        const hit = withTarget(state, asRequest<BleUnsubscribeMessage>(message), fail);
        if (!hit) return;
        hit.session.subscriptions.delete(hit.resolved.characteristic.uuid);
        reply();
      },
      'ble.close': ({ message, state, reply, fail, push }) => {
        const { sessionId, reason } = asRequest<BleCloseMessage>(message);
        const session = typeof sessionId === 'string' ? state.sessions.get(sessionId) : undefined;
        if (!session) return fail('session not found');
        if (session.state === 'closed') return reply();
        session.state = 'closed';
        session.subscriptions.clear();
        reply();
        push(eventMessage({ type: 'closed', sessionId: session.id, ...(reason !== undefined ? { reason } : {}) }));
      },
    },
    onWindowDestroyed: (windowId, state) => {
      closeWindow(windowId, state, undefined);
      for (const [id, session] of state.sessions) if (session.windowId === windowId) state.sessions.delete(id);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability === null) closeWindow(windowId, state, 'permission denied');
    },
  }, options);

  service = {
    ...mock,
    notify(sessionId, characteristic, bytes) {
      const state = mock.mock.state();
      const session = openSession(state, sessionId);
      const resolved = findCharacteristic(state.device, characteristic);
      if (!session || !resolved || !isByteArray(bytes) || !session.subscriptions.has(resolved.characteristic.uuid)) return false;
      const target = { service: resolved.service.uuid, characteristic: resolved.characteristic.uuid };
      return emit(session, { type: 'notification', sessionId: session.id, target, data: [...bytes] });
    },
    disconnect(sessionId, reason = 'device disconnected') {
      const session = openSession(mock.mock.state(), sessionId);
      if (!session) return false;
      session.state = 'closed';
      session.subscriptions.clear();
      emit(session, { type: 'closed', sessionId: session.id, reason });
      return true;
    },
  };
  inheritMockPush(service, mock);
  return service;
}

/**
 * Registry row for the BLE mock.
 *
 * @example
 * ```ts
 * BLE_MOCK_ENTRY.create?.({ seed: 3 });
 * ```
 */
export const BLE_MOCK_ENTRY: MockDomainEntry = {
  domain: 'ble',
  kind: 'service',
  spec: BLE_SPEC_REF,
  create: (o) => createMockBleService(o),
};

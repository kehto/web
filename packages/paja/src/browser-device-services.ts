import type {
  BleAttribute,
  BleDeviceFilter,
  BleEvent,
  BleOpenRequest,
  BleOpenResult,
  BleService,
  BleUuid,
  BleWriteOptions,
  SerialEvent,
  SerialOpenRequest,
  SerialOpenResult,
} from '@napplet/core';
import type {
  BleServiceContext,
  BleServiceOptions,
  SerialServiceContext,
  SerialServiceOptions,
} from '@kehto/services';

import type { PajaConfirmationRequest } from './browser-adapter.js';

/** Runs a browser chooser directly from Paja's host-owned approval click. */
export interface PajaUserActivationHandler {
  run<T>(request: PajaConfirmationRequest, operation: () => T | Promise<T>): Promise<T>;
}

interface WebSerialPortInfo {
  readonly usbVendorId?: number;
  readonly usbProductId?: number;
  readonly bluetoothServiceClassId?: string | number;
}

interface WebSerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialOpenRequest['options']): Promise<void>;
  close(): Promise<void>;
  getInfo(): WebSerialPortInfo;
}

interface WebSerialApi {
  requestPort(options?: { readonly filters?: SerialOpenRequest['filters'] }): Promise<WebSerialPort>;
}

interface SerialSessionRecord {
  readonly id: string;
  readonly windowId: string;
  readonly port: WebSerialPort;
  readonly emit: (event: SerialEvent) => void;
  readonly onDisconnect: () => void;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  writeTail: Promise<void>;
  closing: boolean;
  closed: boolean;
}

interface WebBluetoothCharacteristicProperties {
  readonly read?: boolean;
  readonly write?: boolean;
  readonly writeWithoutResponse?: boolean;
  readonly notify?: boolean;
  readonly indicate?: boolean;
}

interface WebBluetoothDescriptor {
  readonly uuid: string;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

interface WebBluetoothCharacteristic extends EventTarget {
  readonly uuid: string;
  readonly properties: WebBluetoothCharacteristicProperties;
  readonly value?: DataView | null;
  readValue(): Promise<DataView>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  getDescriptor(uuid: BleUuid): Promise<WebBluetoothDescriptor>;
  startNotifications(): Promise<WebBluetoothCharacteristic>;
  stopNotifications(): Promise<WebBluetoothCharacteristic>;
}

interface WebBluetoothService {
  readonly uuid: string;
  getCharacteristics(): Promise<WebBluetoothCharacteristic[]>;
  getCharacteristic(uuid: BleUuid): Promise<WebBluetoothCharacteristic>;
}

interface WebBluetoothGattServer {
  readonly connected: boolean;
  connect(): Promise<WebBluetoothGattServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<WebBluetoothService[]>;
  getPrimaryService(uuid: BleUuid): Promise<WebBluetoothService>;
}

interface WebBluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: WebBluetoothGattServer;
}

interface WebBluetoothApi {
  requestDevice(options: {
    readonly filters?: readonly unknown[];
    readonly exclusionFilters?: readonly unknown[];
    readonly acceptAllDevices?: boolean;
    readonly optionalServices?: readonly BleUuid[];
  }): Promise<WebBluetoothDevice>;
}

interface BleSubscriptionRecord {
  readonly characteristic: WebBluetoothCharacteristic;
  readonly target: BleAttribute;
  readonly listener: EventListener;
}

interface BleSessionRecord {
  readonly id: string;
  readonly windowId: string;
  readonly device: WebBluetoothDevice;
  readonly server: WebBluetoothGattServer;
  readonly emit: (event: BleEvent) => void;
  readonly onDisconnect: () => void;
  readonly subscriptions: Map<string, BleSubscriptionRecord>;
  closed: boolean;
}

function nextSessionId(prefix: string, counter: { value: number }): string {
  counter.value += 1;
  return `${prefix}-${counter.value}`;
}

function browserSerialApi(): WebSerialApi | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { serial?: WebSerialApi }).serial ?? null;
}

function browserBluetoothApi(): WebBluetoothApi | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { bluetooth?: WebBluetoothApi }).bluetooth ?? null;
}

/** Whether this browser exposes the Web Serial chooser and port API. */
export function hasWebSerial(api: WebSerialApi | null = browserSerialApi()): boolean {
  return typeof api?.requestPort === 'function';
}

/** Whether this browser exposes the Web Bluetooth chooser and GATT API. */
export function hasWebBluetooth(api: WebBluetoothApi | null = browserBluetoothApi()): boolean {
  return typeof api?.requestDevice === 'function';
}

function byteArray(view: DataView | Uint8Array): number[] {
  return Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
}

function serialInfo(port: WebSerialPort): NonNullable<SerialOpenResult['session']['info']> {
  const info = port.getInfo();
  return {
    ...(info.usbVendorId === undefined ? {} : { usbVendorId: info.usbVendorId }),
    ...(info.usbProductId === undefined ? {} : { usbProductId: info.usbProductId }),
    ...(info.bluetoothServiceClassId === undefined ? {} : {
      bluetoothServiceClassId: info.bluetoothServiceClassId,
    }),
  };
}

async function readSerialSession(session: SerialSessionRecord): Promise<void> {
  try {
    while (!session.closing && session.port.readable) {
      const reader = session.port.readable.getReader();
      session.reader = reader;
      try {
        while (!session.closing) {
          const result = await reader.read();
          if (result.done) break;
          if (result.value.byteLength > 0) {
            session.emit({ type: 'data', sessionId: session.id, data: byteArray(result.value) });
          }
        }
      } finally {
        reader.releaseLock();
        if (session.reader === reader) session.reader = null;
      }
    }
  } catch (error) {
    if (!session.closing) {
      await closeSerialSession(session, error instanceof Error ? error.message : 'serial read failed');
    }
  }
}

async function closeSerialSession(session: SerialSessionRecord, reason?: string): Promise<void> {
  if (session.closed) return;
  session.closing = true;
  session.port.removeEventListener('disconnect', session.onDisconnect);
  try {
    await session.reader?.cancel(reason).catch(() => {});
    await session.writeTail.catch(() => {});
    await session.port.close();
  } finally {
    session.closed = true;
    session.emit({ type: 'state', sessionId: session.id, state: 'closed' });
    session.emit({ type: 'closed', sessionId: session.id, ...(reason ? { reason } : {}) });
  }
}

/**
 * Create a NAP-SERIAL controller backed by the browser's Web Serial API.
 *
 * @param activation - Host UI broker that invokes the chooser from a user click.
 * @param api - Injectable Web Serial boundary for tests.
 * @returns Serial service hooks, or `null` when Web Serial is unavailable.
 */
export function createBrowserSerialController(
  activation: PajaUserActivationHandler,
  api: WebSerialApi | null = browserSerialApi(),
): SerialServiceOptions | null {
  if (!hasWebSerial(api)) return null;
  const sessions = new Map<string, SerialSessionRecord>();
  const counter = { value: 0 };

  const close = async (sessionId: string, reason?: string): Promise<void> => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('serial session not found');
    sessions.delete(sessionId);
    await closeSerialSession(session, reason);
  };

  return {
    async open(request: SerialOpenRequest, context: SerialServiceContext): Promise<SerialOpenResult> {
      const port = await activation.run({
        action: 'serial',
        windowId: context.windowId,
        label: request.label,
        details: `Baud rate: ${request.options.baudRate}`,
      }, () => api!.requestPort(request.filters ? { filters: request.filters } : undefined));
      await port.open(request.options);
      const id = nextSessionId('paja-serial', counter);
      let session!: SerialSessionRecord;
      const onDisconnect = () => {
        sessions.delete(id);
        void closeSerialSession(session, 'device disconnected');
      };
      session = {
        id,
        windowId: context.windowId,
        port,
        emit: context.emit,
        onDisconnect,
        reader: null,
        writeTail: Promise.resolve(),
        closing: false,
        closed: false,
      };
      sessions.set(id, session);
      port.addEventListener('disconnect', onDisconnect, { once: true });
      context.emit({ type: 'state', sessionId: id, state: 'open' });
      void readSerialSession(session);
      return { session: { id, state: 'open', info: serialInfo(port) } };
    },
    async write(sessionId, data): Promise<void> {
      const session = sessions.get(sessionId);
      if (!session || session.closing || !session.port.writable) {
        throw new Error('serial session is not writable');
      }
      const write = session.writeTail.then(async () => {
        const writer = session.port.writable!.getWriter();
        try {
          await writer.write(Uint8Array.from(data));
        } finally {
          writer.releaseLock();
        }
      });
      session.writeTail = write.then(
        () => undefined,
        () => undefined,
      );
      await write;
    },
    close,
    destroyWindow(windowId) {
      for (const session of sessions.values()) {
        if (session.windowId !== windowId) continue;
        sessions.delete(session.id);
        void closeSerialSession(session, 'napplet closed');
      }
    },
  };
}

function bluetoothBytes(values: readonly number[] | undefined): Uint8Array | undefined {
  return values ? Uint8Array.from(values) : undefined;
}

function bluetoothFilter(filter: BleDeviceFilter): Record<string, unknown> {
  return {
    ...(filter.services ? { services: filter.services } : {}),
    ...(filter.name ? { name: filter.name } : {}),
    ...(filter.namePrefix ? { namePrefix: filter.namePrefix } : {}),
    ...(filter.manufacturerData ? {
      manufacturerData: filter.manufacturerData.map((entry) => ({
        companyIdentifier: entry.companyIdentifier,
        ...(entry.dataPrefix ? { dataPrefix: bluetoothBytes(entry.dataPrefix) } : {}),
        ...(entry.mask ? { mask: bluetoothBytes(entry.mask) } : {}),
      })),
    } : {}),
    ...(filter.serviceData ? {
      serviceData: filter.serviceData.map((entry) => ({
        service: entry.service,
        ...(entry.dataPrefix ? { dataPrefix: bluetoothBytes(entry.dataPrefix) } : {}),
        ...(entry.mask ? { mask: bluetoothBytes(entry.mask) } : {}),
      })),
    } : {}),
  };
}

function bluetoothRequestOptions(request: BleOpenRequest): Parameters<WebBluetoothApi['requestDevice']>[0] {
  return {
    ...(request.filters ? { filters: request.filters.map(bluetoothFilter) } : {}),
    ...(request.exclusionFilters ? { exclusionFilters: request.exclusionFilters.map(bluetoothFilter) } : {}),
    ...(request.acceptAllDevices === undefined ? {} : { acceptAllDevices: request.acceptAllDevices }),
    ...(request.optionalServices ? { optionalServices: request.optionalServices } : {}),
  };
}

function targetKey(target: BleAttribute): string {
  return `${String(target.service)}:${String(target.characteristic)}:${String(target.descriptor ?? '')}`;
}

function characteristicProperties(properties: WebBluetoothCharacteristicProperties) {
  return {
    ...(properties.read ? { read: true } : {}),
    ...(properties.write ? { write: true } : {}),
    ...(properties.writeWithoutResponse ? { writeWithoutResponse: true } : {}),
    ...(properties.notify ? { notify: true } : {}),
    ...(properties.indicate ? { indicate: true } : {}),
  };
}

async function resolveBleCharacteristic(
  session: BleSessionRecord,
  target: BleAttribute,
): Promise<WebBluetoothCharacteristic> {
  const service = await session.server.getPrimaryService(target.service);
  return service.getCharacteristic(target.characteristic);
}

async function resolveBleAttribute(
  session: BleSessionRecord,
  target: BleAttribute,
): Promise<WebBluetoothCharacteristic | WebBluetoothDescriptor> {
  const characteristic = await resolveBleCharacteristic(session, target);
  return target.descriptor === undefined
    ? characteristic
    : characteristic.getDescriptor(target.descriptor);
}

async function closeBleSession(session: BleSessionRecord, reason?: string): Promise<void> {
  if (session.closed) return;
  session.closed = true;
  session.device.removeEventListener('gattserverdisconnected', session.onDisconnect);
  for (const subscription of session.subscriptions.values()) {
    subscription.characteristic.removeEventListener('characteristicvaluechanged', subscription.listener);
    await subscription.characteristic.stopNotifications().catch(() => subscription.characteristic);
  }
  session.subscriptions.clear();
  if (session.server.connected) session.server.disconnect();
  session.emit({ type: 'state', sessionId: session.id, state: 'closed' });
  session.emit({ type: 'closed', sessionId: session.id, ...(reason ? { reason } : {}) });
}

/**
 * Create a NAP-BLE controller backed by the browser's Web Bluetooth API.
 *
 * @param activation - Host UI broker that invokes the chooser from a user click.
 * @param api - Injectable Web Bluetooth boundary for tests.
 * @returns BLE service hooks, or `null` when Web Bluetooth is unavailable.
 */
export function createBrowserBleController(
  activation: PajaUserActivationHandler,
  api: WebBluetoothApi | null = browserBluetoothApi(),
): BleServiceOptions | null {
  if (!hasWebBluetooth(api)) return null;
  const sessions = new Map<string, BleSessionRecord>();
  const counter = { value: 0 };

  const getSession = (sessionId: string): BleSessionRecord => {
    const session = sessions.get(sessionId);
    if (!session || session.closed) throw new Error('ble session not found');
    return session;
  };

  const close = async (sessionId: string, reason?: string): Promise<void> => {
    const session = getSession(sessionId);
    sessions.delete(sessionId);
    await closeBleSession(session, reason);
  };

  return {
    async open(request: BleOpenRequest, context: BleServiceContext): Promise<BleOpenResult> {
      const device = await activation.run({
        action: 'ble',
        windowId: context.windowId,
        label: request.label,
        details: request.acceptAllDevices ? 'Any nearby BLE device may be selected.' : 'Only matching BLE devices are shown.',
      }, () => api!.requestDevice(bluetoothRequestOptions(request)));
      if (!device.gatt) throw new Error('selected BLE device has no GATT server');
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      const id = nextSessionId('paja-ble', counter);
      let session!: BleSessionRecord;
      const onDisconnect = () => {
        sessions.delete(id);
        void closeBleSession(session, 'device disconnected');
      };
      session = {
        id,
        windowId: context.windowId,
        device,
        server,
        emit: context.emit,
        onDisconnect,
        subscriptions: new Map(),
        closed: false,
      };
      sessions.set(id, session);
      device.addEventListener('gattserverdisconnected', onDisconnect, { once: true });
      context.emit({ type: 'state', sessionId: id, state: 'open' });
      return {
        session: {
          id,
          state: 'open',
          device: {
            id,
            ...(device.name ? { name: device.name } : {}),
            services: services.map((service) => service.uuid),
          },
        },
      };
    },
    async services(sessionId): Promise<BleService[]> {
      const services = await getSession(sessionId).server.getPrimaryServices();
      return Promise.all(services.map(async (service) => ({
        uuid: service.uuid,
        characteristics: (await service.getCharacteristics()).map((characteristic) => ({
          uuid: characteristic.uuid,
          properties: characteristicProperties(characteristic.properties),
        })),
      })));
    },
    async read(sessionId, target): Promise<number[]> {
      return byteArray(await (await resolveBleAttribute(getSession(sessionId), target)).readValue());
    },
    async write(sessionId, target, data, options: BleWriteOptions | undefined): Promise<void> {
      const attribute = await resolveBleAttribute(getSession(sessionId), target);
      const bytes = Uint8Array.from(data);
      if ('writeValueWithResponse' in attribute) {
        if (options?.response === 'without-response') await attribute.writeValueWithoutResponse(bytes);
        else if (options?.response === 'with-response') await attribute.writeValueWithResponse(bytes);
        else if (attribute.properties.write) await attribute.writeValueWithResponse(bytes);
        else await attribute.writeValueWithoutResponse(bytes);
        return;
      }
      await attribute.writeValue(bytes);
    },
    async subscribe(sessionId, target): Promise<void> {
      if (target.descriptor !== undefined) throw new Error('BLE descriptors do not emit notifications');
      const session = getSession(sessionId);
      const key = targetKey(target);
      if (session.subscriptions.has(key)) return;
      const characteristic = await resolveBleCharacteristic(session, target);
      const listener: EventListener = (event) => {
        const source = event.currentTarget as WebBluetoothCharacteristic | null;
        const value = source?.value;
        if (!value) return;
        session.emit({ type: 'notification', sessionId, target, data: byteArray(value) });
      };
      characteristic.addEventListener('characteristicvaluechanged', listener);
      try {
        await characteristic.startNotifications();
        session.subscriptions.set(key, { characteristic, target, listener });
      } catch (error) {
        characteristic.removeEventListener('characteristicvaluechanged', listener);
        throw error;
      }
    },
    async unsubscribe(sessionId, target): Promise<void> {
      const subscription = getSession(sessionId).subscriptions.get(targetKey(target));
      if (!subscription) return;
      subscription.characteristic.removeEventListener('characteristicvaluechanged', subscription.listener);
      await subscription.characteristic.stopNotifications();
      getSession(sessionId).subscriptions.delete(targetKey(target));
    },
    close,
    destroyWindow(windowId) {
      for (const session of sessions.values()) {
        if (session.windowId !== windowId) continue;
        sessions.delete(session.id);
        void closeBleSession(session, 'napplet closed');
      }
    },
  };
}

/**
 * ble-service.ts — NAP-BLE reference service.
 *
 * Shell-mediated BLE/GATT sessions. The napplet requests `ble.*`; the shell
 * owns chooser UI, permissions, GATT handles, notifications, and policy.
 */

import type {
  BleAttribute,
  BleEvent,
  BleOpenRequest,
  BleOpenResult,
  BleService,
  BleUuid,
  BleWriteOptions,
  NappletMessage,
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
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';

const BLE_SERVICE_VERSION = '1.0.0';

/** Context passed to host-provided NAP-BLE hooks. */
export interface BleServiceContext {
  /** Window id of the requesting napplet. */
  windowId: string;
  /** Active approval lifetime for this host operation. */
  readonly signal?: ApprovalSignal;
  /** Emit a runtime-owned BLE event back to the requesting napplet. */
  emit(event: BleEvent): void;
  /** Authorize a host-private selected device before connecting GATT. */
  authorizeDevice?<T>(scope: string, execute: (signal: ApprovalSignal) => T | Promise<T>): Promise<T>;
}

/** Options for {@link createBleService}. */
export interface BleServiceOptions {
  /** Host-owned BLE open hook. */
  open?: (
    request: BleOpenRequest,
    context: BleServiceContext,
  ) => BleOpenResult | Promise<BleOpenResult>;
  /** Host-owned GATT service listing hook. */
  services?: (
    sessionId: string,
    context: BleServiceContext,
  ) => BleService[] | Promise<BleService[]>;
  /** Host-owned GATT read hook. */
  read?: (
    sessionId: string,
    target: BleAttribute,
    context: BleServiceContext,
  ) => number[] | Promise<number[]>;
  /** Host-owned GATT write hook. */
  write?: (
    sessionId: string,
    target: BleAttribute,
    data: readonly number[],
    options: BleWriteOptions | undefined,
    context: BleServiceContext,
  ) => void | Promise<void>;
  /** Host-owned notification subscription hook. */
  subscribe?: (
    sessionId: string,
    target: BleAttribute,
    context: BleServiceContext,
  ) => void | Promise<void>;
  /** Host-owned notification unsubscribe hook. */
  unsubscribe?: (
    sessionId: string,
    target: BleAttribute,
    context: BleServiceContext,
  ) => void | Promise<void>;
  /** Host-owned BLE close hook. */
  close?: (
    sessionId: string,
    reason: string | undefined,
    context: BleServiceContext,
  ) => void | Promise<void>;
  /** Optional host cleanup when a napplet window is destroyed. */
  destroyWindow?: (windowId: string) => void;
}

type Send = (msg: NappletMessage) => void;

const BLE_DESCRIPTOR: ServiceDescriptor = {
  name: 'ble',
  version: BLE_SERVICE_VERSION,
  description: 'NAP-BLE reference handler for shell-mediated BLE/GATT sessions',
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

function settle<T>(
  call: () => T | Promise<T>,
  send: Send,
  okFalse: (error: string) => NappletMessage,
  onValue: (value: T) => NappletMessage,
): void {
  let pending: Promise<T>;
  try {
    pending = Promise.resolve(call());
  } catch (err) {
    send(okFalse(errorMessage(err, 'ble request failed')));
    return;
  }
  pending
    .then((value) => send(onValue(value)))
    .catch((err) => send(okFalse(errorMessage(err, 'ble request failed'))));
}

function unsupported(resultType: string, id: string): NappletMessage {
  return {
    type: resultType,
    id,
    error: `${resultType.replace('.result', '')} unavailable`,
  } as NappletMessage;
}

function createContext(
  windowId: string,
  send: Send,
  signal?: ApprovalSignal,
  authorizeDevice?: BleServiceContext['authorizeDevice'],
): BleServiceContext {
  return {
    windowId,
    ...(signal ? { signal } : {}),
    emit(event) {
      send({ type: 'ble.event', event } as NappletMessage);
    },
    ...(authorizeDevice ? { authorizeDevice } : {}),
  };
}

function validUuid(value: unknown): value is BleUuid {
  return (typeof value === 'string' && value.length > 0 && value.length <= 128)
    || (Number.isSafeInteger(value) && (value as number) >= 0);
}

function validTarget(target: unknown, notifications = false): target is BleAttribute {
  if (!target || typeof target !== 'object') return false;
  const value = target as BleAttribute;
  return validUuid(value.service) && validUuid(value.characteristic)
    && (value.descriptor === undefined || (!notifications && validUuid(value.descriptor)));
}

function validBytes(data: unknown): data is readonly number[] {
  return Array.isArray(data) && data.length <= 1024 * 1024
    && data.every((value) => Number.isInteger(value) && value >= 0 && value <= 255);
}

function validOpenRequest(request: unknown): request is BleOpenRequest {
  if (!request || typeof request !== 'object') return false;
  const value = request as BleOpenRequest;
  const validFilter = (filter: unknown): boolean => {
    if (!filter || typeof filter !== 'object') return false;
    const candidate = filter as {
      services?: unknown;
      name?: unknown;
      namePrefix?: unknown;
      manufacturerData?: unknown;
      serviceData?: unknown;
    };
    if (candidate.services !== undefined && (!Array.isArray(candidate.services) || !candidate.services.every(validUuid))) return false;
    if (candidate.name !== undefined && (typeof candidate.name !== 'string' || candidate.name.length > 256)) return false;
    if (candidate.namePrefix !== undefined && (typeof candidate.namePrefix !== 'string' || candidate.namePrefix.length > 256)) return false;
    if (candidate.manufacturerData !== undefined && (!Array.isArray(candidate.manufacturerData) || candidate.manufacturerData.some((entry) => {
      if (!entry || typeof entry !== 'object') return true;
      const data = entry as { companyIdentifier?: unknown; dataPrefix?: unknown; mask?: unknown };
      return !Number.isSafeInteger(data.companyIdentifier) || (data.companyIdentifier as number) < 0
        || (data.dataPrefix !== undefined && !validBytes(data.dataPrefix))
        || (data.mask !== undefined && !validBytes(data.mask));
    }))) return false;
    return candidate.serviceData === undefined || (Array.isArray(candidate.serviceData) && !candidate.serviceData.some((entry) => {
      if (!entry || typeof entry !== 'object') return true;
      const data = entry as { service?: unknown; dataPrefix?: unknown; mask?: unknown };
      return !validUuid(data.service)
        || (data.dataPrefix !== undefined && !validBytes(data.dataPrefix))
        || (data.mask !== undefined && !validBytes(data.mask));
    }));
  };
  if (value.optionalServices !== undefined && (!Array.isArray(value.optionalServices) || !value.optionalServices.every(validUuid))) return false;
  if (value.acceptAllDevices === true) return value.filters === undefined && value.exclusionFilters === undefined;
  return Array.isArray(value.filters) && value.filters.length > 0 && value.filters.every(validFilter)
    && (value.exclusionFilters === undefined || (Array.isArray(value.exclusionFilters) && value.exclusionFilters.every(validFilter)));
}

function targetScope(deviceScope: string, target: BleAttribute): string {
  return `${deviceScope}:service:${String(target.service)}:characteristic:${String(target.characteristic)}${target.descriptor === undefined ? '' : `:descriptor:${String(target.descriptor)}`}`;
}

/**
 * Create the NAP-BLE reference service.
 *
 * @param options - Host BLE session hooks for ble.* requests.
 * @returns A runtime service handler for the `ble` domain.
 */
export function createBleService(options: BleServiceOptions = {}): ServiceHandler {
  const windows = new Map<string, Map<string, { deviceScope?: string }>>();
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;
  const warnLegacy = (): void => {
    if (warnedLegacy) return;
    warnedLegacy = true;
    console.warn('[FW-BLE-LEGACY-001] Configure RuntimeAdapter.permissions and host-private selected-device approval; unbound BLE hooks are deprecated. Warning once per service instance.');
  };
  const currentWindow = (windowId: string): Map<string, { deviceScope?: string }> => {
    const existing = windows.get(windowId);
    if (existing) return existing;
    const record = new Map<string, { deviceScope?: string }>();
    windows.set(windowId, record);
    return record;
  };

  return {
    descriptor: BLE_DESCRIPTOR,
    onRegistered(context) { runtime = context; },
    onUnregistered() { runtime = undefined; windows.clear(); },
    onPermissionRevoked(windowId) {
      const record = windows.get(windowId);
      if (!record) return;
      windows.delete(windowId);
      for (const sessionId of record.keys()) {
        void Promise.resolve(options.close?.(sessionId, 'policy denied', createContext(windowId, () => {}))).catch(() => undefined);
      }
    },
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      const record = currentWindow(windowId);
      const current = (): boolean => windows.get(windowId) === record;
      const currentSend: Send = (outbound) => { if (current()) send(outbound); };
      const context = (signal?: ApprovalSignal, authorizeDevice?: BleServiceContext['authorizeDevice']) =>
        createContext(windowId, currentSend, signal, authorizeDevice);
      const authorize = <T>(operation: string, scope: string, run: (signal?: ApprovalSignal) => T | Promise<T>): Promise<T> => {
        if (!runtime?.authorizeOperation) {
          warnLegacy();
          return Promise.resolve().then(() => run());
        }
        return runtime.authorizeOperation(windowId, operation, [
          { category: 'interface', domain: 'ble', operation: 'access', scope: { kind: 'exact', value: 'ble' } },
          { category: 'resource', domain: 'ble', operation, scope: { kind: 'exact', value: scope } },
        ], (signal) => run(signal)).then((approval) => {
          if (approval.status !== 'executed') throw new Error('policy denied');
          return approval.value;
        });
      };

      if (message.type === 'ble.open') {
        if (!options.open) {
          send(unsupported('ble.open.result', id));
          return;
        }
        const bleMessage = message as BleOpenMessage;
        if (!validOpenRequest(bleMessage.request)) {
          currentSend({ type: 'ble.open.result', id, error: 'invalid data' } as NappletMessage);
          return;
        }
        settle(
          () => authorize('ble.select', 'ble:chooser', async (signal) => {
            let deviceScope: string | undefined;
            const authorizeDevice: BleServiceContext['authorizeDevice'] = async <T>(scope: string, execute: (signal: ApprovalSignal) => T | Promise<T>): Promise<T> => {
              if (!/^ble:device:[A-Za-z0-9_-]{1,256}$/u.test(scope)) throw new Error('invalid BLE device scope');
              const value = await authorize('ble.open', scope, (signal) => {
                if (!signal) throw new Error('policy denied');
                return execute(signal);
              });
              deviceScope = scope;
              return value;
            };
            const result = await options.open!(bleMessage.request, context(signal, authorizeDevice));
            if (runtime?.authorizeOperation && !deviceScope) {
              await Promise.resolve(options.close?.(result.session.id, 'policy denied', context(signal))).catch(() => undefined);
              throw new Error('policy denied');
            }
            if (!current()) throw new Error('policy denied');
            record.set(result.session.id, { deviceScope });
            return result;
          }),
          currentSend,
          (error) => ({ type: 'ble.open.result', id, error } as NappletMessage),
          (result) => ({ type: 'ble.open.result', id, session: result.session } as NappletMessage),
        );
        return;
      }

      if (message.type === 'ble.services') {
        if (!options.services) {
          send(unsupported('ble.services.result', id));
          return;
        }
        const bleMessage = message as BleServicesMessage;
        const owned = record.get(bleMessage.sessionId);
        if (!owned) {
          currentSend({ type: 'ble.services.result', id, error: 'session not found' } as NappletMessage);
          return;
        }
        settle(
          () => authorize('ble.services', owned.deviceScope ?? 'ble:legacy', (signal) => options.services!(bleMessage.sessionId, context(signal))),
          currentSend,
          (error) => ({ type: 'ble.services.result', id, error } as NappletMessage),
          (services) => ({ type: 'ble.services.result', id, services } as NappletMessage),
        );
        return;
      }

      if (message.type === 'ble.read') {
        if (!options.read) {
          send(unsupported('ble.read.result', id));
          return;
        }
        const bleMessage = message as BleReadMessage;
        const owned = record.get(bleMessage.sessionId);
        if (!owned || !validTarget(bleMessage.target)) {
          currentSend({ type: 'ble.read.result', id, error: owned ? 'invalid data' : 'session not found' } as NappletMessage);
          return;
        }
        settle(
          () => authorize('ble.read', owned.deviceScope ? targetScope(owned.deviceScope, bleMessage.target) : 'ble:legacy', (signal) => options.read!(bleMessage.sessionId, bleMessage.target, context(signal))),
          currentSend,
          (error) => ({ type: 'ble.read.result', id, error } as NappletMessage),
          (data) => ({ type: 'ble.read.result', id, data } as NappletMessage),
        );
        return;
      }

      if (message.type === 'ble.write') {
        if (!options.write) {
          send(unsupported('ble.write.result', id));
          return;
        }
        const bleMessage = message as BleWriteMessage;
        const owned = record.get(bleMessage.sessionId);
        if (!owned || !validTarget(bleMessage.target) || !validBytes(bleMessage.data)) {
          currentSend({ type: 'ble.write.result', id, error: owned ? 'invalid data' : 'session not found' } as NappletMessage);
          return;
        }
        settle(
          () => authorize('ble.write', owned.deviceScope ? targetScope(owned.deviceScope, bleMessage.target) : 'ble:legacy', (signal) => options.write!(bleMessage.sessionId, bleMessage.target, [...bleMessage.data], bleMessage.options, context(signal))),
          currentSend,
          (error) => ({ type: 'ble.write.result', id, error } as NappletMessage),
          () => ({ type: 'ble.write.result', id } as NappletMessage),
        );
        return;
      }

      if (message.type === 'ble.subscribe') {
        if (!options.subscribe) {
          send(unsupported('ble.subscribe.result', id));
          return;
        }
        const bleMessage = message as BleSubscribeMessage;
        const owned = record.get(bleMessage.sessionId);
        if (!owned || !validTarget(bleMessage.target, true)) {
          currentSend({ type: 'ble.subscribe.result', id, error: owned ? 'invalid data' : 'session not found' } as NappletMessage);
          return;
        }
        settle(
          () => authorize('ble.subscribe', owned.deviceScope ? targetScope(owned.deviceScope, bleMessage.target) : 'ble:legacy', (signal) => options.subscribe!(bleMessage.sessionId, bleMessage.target, context(signal))),
          currentSend,
          (error) => ({ type: 'ble.subscribe.result', id, error } as NappletMessage),
          () => ({ type: 'ble.subscribe.result', id } as NappletMessage),
        );
        return;
      }

      if (message.type === 'ble.unsubscribe') {
        if (!options.unsubscribe) {
          send(unsupported('ble.unsubscribe.result', id));
          return;
        }
        const bleMessage = message as BleUnsubscribeMessage;
        const owned = record.get(bleMessage.sessionId);
        if (!owned || !validTarget(bleMessage.target, true)) {
          currentSend({ type: 'ble.unsubscribe.result', id, error: owned ? 'invalid data' : 'session not found' } as NappletMessage);
          return;
        }
        settle(
          () => authorize('ble.unsubscribe', owned.deviceScope ? targetScope(owned.deviceScope, bleMessage.target) : 'ble:legacy', (signal) => options.unsubscribe!(bleMessage.sessionId, bleMessage.target, context(signal))),
          currentSend,
          (error) => ({ type: 'ble.unsubscribe.result', id, error } as NappletMessage),
          () => ({ type: 'ble.unsubscribe.result', id } as NappletMessage),
        );
        return;
      }

      if (message.type === 'ble.close') {
        if (!options.close) {
          send(unsupported('ble.close.result', id));
          return;
        }
        const bleMessage = message as BleCloseMessage;
        if (!record.has(bleMessage.sessionId)) {
          currentSend({ type: 'ble.close.result', id, error: 'session not found' } as NappletMessage);
          return;
        }
        record.delete(bleMessage.sessionId);
        settle(
          () => options.close!(bleMessage.sessionId, bleMessage.reason, context()),
          currentSend,
          (error) => ({ type: 'ble.close.result', id, error } as NappletMessage),
          () => ({ type: 'ble.close.result', id } as NappletMessage),
        );
        return;
      }

      currentSend({
        type: `${message.type}.error`,
        id,
        error: `Unknown ble method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(windowId: string): void {
      windows.delete(windowId);
      options.destroyWindow?.(windowId);
    },
  };
}

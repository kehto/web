/**
 * serial-service.ts — NAP-SERIAL reference service.
 *
 * Shell-mediated serial sessions. The napplet requests `serial.*`; the shell
 * owns device selection, permissions, session handles, reads, write ordering,
 * close events, and policy.
 */

import type {
  NappletMessage,
  SerialEvent,
  SerialOpenRequest,
  SerialOpenResult,
} from '@napplet/core';
import type {
  SerialCloseMessage,
  SerialOpenMessage,
  SerialWriteMessage,
} from '@napplet/nap/serial/types';
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';

const SERIAL_SERVICE_VERSION = '1.0.0';

/** Context passed to host-provided NAP-SERIAL hooks. */
export interface SerialServiceContext {
  /** Window id of the requesting napplet. */
  windowId: string;
  /** Active approval lifetime for this host operation. */
  readonly signal?: ApprovalSignal;
  /** Emit a runtime-owned serial event back to the requesting napplet. */
  emit(event: SerialEvent): void;
  /**
   * Authorize one host-private selected device before opening it.
   *
   * Browser projections call this after their chooser resolves and before the
   * port is opened. The device key is never sent on the napplet wire.
   */
  authorizeDevice?<T>(scope: string, execute: (signal: ApprovalSignal) => T | Promise<T>): Promise<T>;
}

/** Options for {@link createSerialService}. */
export interface SerialServiceOptions {
  /** Host-owned serial open hook. */
  open?: (
    request: SerialOpenRequest,
    context: SerialServiceContext,
  ) => SerialOpenResult | Promise<SerialOpenResult>;
  /** Host-owned serial write hook. */
  write?: (
    sessionId: string,
    data: readonly number[],
    context: SerialServiceContext,
  ) => void | Promise<void>;
  /** Host-owned serial close hook. */
  close?: (
    sessionId: string,
    reason: string | undefined,
    context: SerialServiceContext,
  ) => void | Promise<void>;
  /** Optional host cleanup when a napplet window is destroyed. */
  destroyWindow?: (windowId: string) => void;
}

type Send = (msg: NappletMessage) => void;

interface SerialConnection {
  state: 'opening' | 'open' | 'closed';
  readonly bufferedEvents: SerialEvent[];
  sessionId?: string;
  deviceScope?: string;
}

interface SerialWindow {
  readonly connections: Map<string, SerialConnection>;
  readonly pendingConnections: Set<SerialConnection>;
}

const SERIAL_DESCRIPTOR: ServiceDescriptor = {
  name: 'serial',
  version: SERIAL_SERVICE_VERSION,
  description: 'NAP-SERIAL reference handler for shell-mediated serial sessions',
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
    send(okFalse(errorMessage(err, 'serial request failed')));
    return;
  }
  pending
    .then((value) => send(onValue(value)))
    .catch((err) => send(okFalse(errorMessage(err, 'serial request failed'))));
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
  emit: (event: SerialEvent) => void,
  signal?: ApprovalSignal,
  authorizeDevice?: SerialServiceContext['authorizeDevice'],
): SerialServiceContext {
  return {
    windowId,
    ...(signal ? { signal } : {}),
    emit,
    ...(authorizeDevice ? { authorizeDevice } : {}),
  };
}

function validBytes(data: unknown): data is readonly number[] {
  return Array.isArray(data) && data.length <= 1024 * 1024
    && data.every((value) => Number.isInteger(value) && value >= 0 && value <= 255);
}

function validOpenRequest(request: unknown): request is SerialOpenRequest {
  if (!request || typeof request !== 'object') return false;
  const value = request as SerialOpenRequest;
  if (!value.options || !Number.isSafeInteger(value.options.baudRate) || value.options.baudRate <= 0) return false;
  if (value.filters !== undefined && (!Array.isArray(value.filters) || value.filters.some((filter) => {
    if (!filter || typeof filter !== 'object') return true;
    const candidate = filter as { usbVendorId?: unknown; usbProductId?: unknown; bluetoothServiceClassId?: unknown };
    return (candidate.usbVendorId !== undefined && (typeof candidate.usbVendorId !== 'number' || !Number.isSafeInteger(candidate.usbVendorId) || candidate.usbVendorId < 0))
      || (candidate.usbProductId !== undefined && (typeof candidate.usbProductId !== 'number' || !Number.isSafeInteger(candidate.usbProductId) || candidate.usbProductId < 0))
      || (candidate.bluetoothServiceClassId !== undefined && typeof candidate.bluetoothServiceClassId !== 'string' && !Number.isSafeInteger(candidate.bluetoothServiceClassId));
  }))) return false;
  return typeof value.label === 'undefined' || (typeof value.label === 'string' && value.label.length <= 256);
}

function approvalError(status: string): string {
  return status === 'cancelled' ? 'policy denied' : 'policy denied';
}

function revokeSerialWindow(options: SerialServiceOptions, windows: Map<string, SerialWindow>, windowId: string): void {
  const record = windows.get(windowId);
  if (!record) return;
  for (const [sessionId, connection] of record.connections) {
    if (connection.state === 'closed') continue;
    connection.state = 'closed';
    record.connections.delete(sessionId);
    void Promise.resolve(options.close?.(sessionId, 'policy denied', createContext(windowId, () => {}))).catch(() => undefined);
  }
  for (const connection of record.pendingConnections) connection.state = 'closed';
  record.pendingConnections.clear();
}

function destroySerialWindow(options: SerialServiceOptions, windows: Map<string, SerialWindow>, windowId: string): void {
  const record = windows.get(windowId);
  if (record) {
    for (const connection of record.connections.values()) connection.state = 'closed';
    for (const connection of record.pendingConnections) connection.state = 'closed';
    record.connections.clear();
    record.pendingConnections.clear();
    windows.delete(windowId);
  }
  options.destroyWindow?.(windowId);
}

function closeSerialConnection(input: { options: SerialServiceOptions; windowId: string; record: SerialWindow; message: SerialCloseMessage; id: string; send: Send; emit: (event: SerialEvent) => void }): void {
  const { options, windowId, record, message, id, send, emit } = input;
  if (!options.close) { send(unsupported('serial.close.result', id)); return; }
  const connection = record.connections.get(message.sessionId);
  if (connection) { connection.state = 'closed'; record.connections.delete(message.sessionId); }
  const context = createContext(windowId, emit);
  settle(
    () => options.close!(message.sessionId, message.reason, context),
    send,
    (error) => ({ type: 'serial.close.result', id, error } as NappletMessage),
    () => ({ type: 'serial.close.result', id } as NappletMessage),
  );
}

/**
 * Create the NAP-SERIAL reference service.
 *
 * @param options - Host serial session hooks for serial.* requests.
 * @returns A runtime service handler for the `serial` domain.
 */
export function createSerialService(options: SerialServiceOptions = {}): ServiceHandler {
  if (!options || typeof options !== 'object') {
    throw new TypeError('createSerialService options must be an object');
  }
  return buildSerialService(options);
}

/** Internal stateful handler builder, separated from the public factory API. */
function buildSerialService(options: SerialServiceOptions): ServiceHandler {
  const windows = new Map<string, SerialWindow>();
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;

  const warnLegacy = (): void => {
    if (warnedLegacy) return;
    warnedLegacy = true;
    console.warn('[FW-SERIAL-LEGACY-001] Configure RuntimeAdapter.permissions and host-private selected-device approval; unbound serial hooks are deprecated. Warning once per service instance.');
  };

  const currentWindow = (windowId: string): SerialWindow => {
    const existing = windows.get(windowId);
    if (existing) return existing;
    const record: SerialWindow = {
      connections: new Map<string, SerialConnection>(),
      pendingConnections: new Set<SerialConnection>(),
    };
    windows.set(windowId, record);
    return record;
  };

  const emit = (
    windowId: string,
    record: SerialWindow,
    connection: SerialConnection | undefined,
    send: Send,
    event: SerialEvent,
  ): void => {
    if (!connection || windows.get(windowId) !== record || connection.state === 'closed') return;
    if (connection.state === 'opening') {
      connection.bufferedEvents.push(event);
      return;
    }
    send({ type: 'serial.event', event } as NappletMessage);
  };

  return {
    descriptor: SERIAL_DESCRIPTOR,
    onRegistered(context) { runtime = context; },
    onUnregistered() { runtime = undefined; windows.clear(); },
    onPermissionRevoked(windowId) { revokeSerialWindow(options, windows, windowId); },
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      const record = currentWindow(windowId);
      const isCurrent = (): boolean => windows.get(windowId) === record;
      const currentSend: Send = (outbound) => {
        if (isCurrent()) send(outbound);
      };
      if (message.type === 'serial.open') {
        if (!options.open) {
          currentSend(unsupported('serial.open.result', id));
          return;
        }
        const serialMessage = message as SerialOpenMessage;
        if (!validOpenRequest(serialMessage.request)) {
          currentSend({ type: 'serial.open.result', id, error: 'invalid data' } as NappletMessage);
          return;
        }
        const connection: SerialConnection = { state: 'opening', bufferedEvents: [] };
        record.pendingConnections.add(connection);
        const runOpen = async (signal?: ApprovalSignal): Promise<SerialOpenResult> => {
          let deviceScope: string | undefined;
          const authorizeDevice: SerialServiceContext['authorizeDevice'] | undefined = runtime?.authorizeOperation
            ? async <T>(scope: string, execute: (approved: ApprovalSignal) => T | Promise<T>): Promise<T> => {
              if (!/^serial:device:[A-Za-z0-9_-]{1,256}$/u.test(scope)) throw new Error('invalid serial device scope');
              const approval = await runtime!.authorizeOperation!(windowId, 'serial.open', [{
                category: 'resource', domain: 'serial', operation: 'serial.open', scope: { kind: 'exact', value: scope },
              }], execute, signal);
              if (approval.status !== 'executed') throw new Error(approvalError(approval.status));
              deviceScope = scope;
              return approval.value;
            }
            : undefined;
          const context = createContext(windowId, (event) => emit(windowId, record, connection, currentSend, event), signal, authorizeDevice);
          const result = await options.open!(serialMessage.request, context);
          if (runtime?.authorizeOperation && !deviceScope) {
            await Promise.resolve(options.close?.(result.session.id, 'policy denied', context)).catch(() => undefined);
            throw new Error('policy denied');
          }
          connection.deviceScope = deviceScope;
          return result;
        };
        const pending: Promise<SerialOpenResult> = runtime?.authorizeOperation
          ? runtime.authorizeOperation(windowId, 'serial.open', [
            { category: 'interface', domain: 'serial', operation: 'access', scope: { kind: 'exact', value: 'serial' } },
            { category: 'resource', domain: 'serial', operation: 'serial.select', scope: { kind: 'exact', value: 'serial:chooser' } },
          ], (signal) => runOpen(signal)).then((approval) => {
            if (approval.status !== 'executed') throw new Error(approvalError(approval.status));
            return approval.value;
          })
          : (warnLegacy(), Promise.resolve().then(() => runOpen()));
        void pending
          .then((result) => {
            record.pendingConnections.delete(connection);
            if (!isCurrent() || connection.state === 'closed') return;
            connection.state = 'open';
            connection.sessionId = result.session.id;
            record.connections.set(result.session.id, connection);
            currentSend({ type: 'serial.open.result', id, session: result.session } as NappletMessage);
            if (!isCurrent() || connection.state !== 'open') return;
            for (const event of connection.bufferedEvents) {
              if (!isCurrent() || connection.state !== 'open') break;
              currentSend({ type: 'serial.event', event } as NappletMessage);
            }
            connection.bufferedEvents.length = 0;
          })
          .catch((error) => {
            record.pendingConnections.delete(connection);
            connection.state = 'closed';
            currentSend({
              type: 'serial.open.result',
              id,
              error: errorMessage(error, 'serial request failed'),
            } as NappletMessage);
          });
        return;
      }

      if (message.type === 'serial.write') {
        if (!options.write) {
          currentSend(unsupported('serial.write.result', id));
          return;
        }
        const serialMessage = message as SerialWriteMessage;
        if (!validBytes(serialMessage.data)) {
          currentSend({ type: 'serial.write.result', id, error: 'invalid data' } as NappletMessage);
          return;
        }
        const connection = record.connections.get(serialMessage.sessionId);
        if (!connection || connection.state !== 'open') {
          currentSend({ type: 'serial.write.result', id, error: 'session not found' } as NappletMessage);
          return;
        }
        const runWrite = (signal?: ApprovalSignal) => options.write!(serialMessage.sessionId, [...serialMessage.data], createContext(windowId, (event) => emit(
          windowId,
          record,
          connection,
          currentSend,
          event,
        ), signal));
        const pending = runtime?.authorizeOperation && connection.deviceScope
          ? runtime.authorizeOperation(windowId, 'serial.write', [
            { category: 'interface', domain: 'serial', operation: 'access', scope: { kind: 'exact', value: 'serial' } },
            { category: 'resource', domain: 'serial', operation: 'serial.write', scope: { kind: 'exact', value: connection.deviceScope } },
          ], (signal) => runWrite(signal)).then((approval) => {
            if (approval.status !== 'executed') throw new Error(approvalError(approval.status));
          })
          : (runtime?.authorizeOperation ? Promise.reject(new Error('policy denied')) : (warnLegacy(), Promise.resolve().then(() => runWrite())));
        settle(
          () => pending,
          currentSend,
          (error) => ({ type: 'serial.write.result', id, error } as NappletMessage),
          () => ({ type: 'serial.write.result', id } as NappletMessage),
        );
        return;
      }

      if (message.type === 'serial.close') {
        closeSerialConnection({ options, windowId, record, message: message as SerialCloseMessage, id, send: currentSend, emit: (event) => emit(windowId, record, undefined, currentSend, event) });
        return;
      }

      currentSend({
        type: `${message.type}.error`,
        id,
        error: `Unknown serial method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(windowId: string): void { destroySerialWindow(options, windows, windowId); },
  };
}

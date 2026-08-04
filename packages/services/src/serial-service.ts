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
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

const SERIAL_SERVICE_VERSION = '1.0.0';

/** Context passed to host-provided NAP-SERIAL hooks. */
export interface SerialServiceContext {
  /** Window id of the requesting napplet. */
  windowId: string;
  /** Emit a runtime-owned serial event back to the requesting napplet. */
  emit(event: SerialEvent): void;
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

function createContext(windowId: string, emit: (event: SerialEvent) => void): SerialServiceContext {
  return {
    windowId,
    emit,
  };
}

/**
 * Create the NAP-SERIAL reference service.
 *
 * @param options - Host serial session hooks for serial.* requests.
 * @returns A runtime service handler for the `serial` domain.
 */
export function createSerialService(options: SerialServiceOptions = {}): ServiceHandler {
  const windows = new Map<string, SerialWindow>();

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
        const connection: SerialConnection = { state: 'opening', bufferedEvents: [] };
        record.pendingConnections.add(connection);
        const context = createContext(windowId, (event) => emit(windowId, record, connection, currentSend, event));
        let pending: Promise<SerialOpenResult>;
        try {
          pending = Promise.resolve(options.open(serialMessage.request, context));
        } catch (error) {
          record.pendingConnections.delete(connection);
          connection.state = 'closed';
          currentSend({
            type: 'serial.open.result',
            id,
            error: errorMessage(error, 'serial request failed'),
          } as NappletMessage);
          return;
        }
        void pending
          .then((result) => {
            record.pendingConnections.delete(connection);
            if (!isCurrent() || connection.state === 'closed') return;
            connection.state = 'open';
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
        const context = createContext(windowId, (event) => emit(
          windowId,
          record,
          record.connections.get(serialMessage.sessionId),
          currentSend,
          event,
        ));
        settle(
          () => options.write!(serialMessage.sessionId, serialMessage.data, context),
          currentSend,
          (error) => ({ type: 'serial.write.result', id, error } as NappletMessage),
          () => ({ type: 'serial.write.result', id } as NappletMessage),
        );
        return;
      }

      if (message.type === 'serial.close') {
        if (!options.close) {
          currentSend(unsupported('serial.close.result', id));
          return;
        }
        const serialMessage = message as SerialCloseMessage;
        const connection = record.connections.get(serialMessage.sessionId);
        if (connection) {
          connection.state = 'closed';
          record.connections.delete(serialMessage.sessionId);
        }
        const context = createContext(windowId, (event) => emit(
          windowId,
          record,
          connection,
          currentSend,
          event,
        ));
        settle(
          () => options.close!(serialMessage.sessionId, serialMessage.reason, context),
          currentSend,
          (error) => ({ type: 'serial.close.result', id, error } as NappletMessage),
          () => ({ type: 'serial.close.result', id } as NappletMessage),
        );
        return;
      }

      currentSend({
        type: `${message.type}.error`,
        id,
        error: `Unknown serial method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(windowId: string): void {
      const record = windows.get(windowId);
      if (record) {
        for (const connection of record.connections.values()) connection.state = 'closed';
        for (const connection of record.pendingConnections) connection.state = 'closed';
        record.connections.clear();
        record.pendingConnections.clear();
        windows.delete(windowId);
      }
      options.destroyWindow?.(windowId);
    },
  };
}

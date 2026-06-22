/**
 * serial-service.ts — NAP-SERIAL reference service.
 *
 * Shell-mediated serial sessions. The napplet requests `serial.*`; the shell
 * owns device selection, permissions, session handles, reads, write ordering,
 * close events, and policy.
 */

import type {
  NappletMessage,
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

/**
 * Create the NAP-SERIAL reference service.
 *
 * @param options - Host serial session hooks for serial.* requests.
 * @returns A runtime service handler for the `serial` domain.
 */
export function createSerialService(options: SerialServiceOptions = {}): ServiceHandler {
  return {
    descriptor: SERIAL_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      const context = { windowId };

      if (message.type === 'serial.open') {
        if (!options.open) {
          send(unsupported('serial.open.result', id));
          return;
        }
        const serialMessage = message as SerialOpenMessage;
        settle(
          () => options.open!(serialMessage.request, context),
          send,
          (error) => ({ type: 'serial.open.result', id, error } as NappletMessage),
          (result) => ({ type: 'serial.open.result', id, session: result.session } as NappletMessage),
        );
        return;
      }

      if (message.type === 'serial.write') {
        if (!options.write) {
          send(unsupported('serial.write.result', id));
          return;
        }
        const serialMessage = message as SerialWriteMessage;
        settle(
          () => options.write!(serialMessage.sessionId, serialMessage.data, context),
          send,
          (error) => ({ type: 'serial.write.result', id, error } as NappletMessage),
          () => ({ type: 'serial.write.result', id } as NappletMessage),
        );
        return;
      }

      if (message.type === 'serial.close') {
        if (!options.close) {
          send(unsupported('serial.close.result', id));
          return;
        }
        const serialMessage = message as SerialCloseMessage;
        settle(
          () => options.close!(serialMessage.sessionId, serialMessage.reason, context),
          send,
          (error) => ({ type: 'serial.close.result', id, error } as NappletMessage),
          () => ({ type: 'serial.close.result', id } as NappletMessage),
        );
        return;
      }

      send({
        type: `${message.type}.error`,
        id,
        error: `Unknown serial method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(windowId: string): void {
      options.destroyWindow?.(windowId);
    },
  };
}

/**
 * ble-service.ts — NAP-BLE reference service.
 *
 * Shell-mediated BLE/GATT sessions. The napplet requests `ble.*`; the shell
 * owns chooser UI, permissions, GATT handles, notifications, and policy.
 */

import type {
  BleAttribute,
  BleOpenRequest,
  BleOpenResult,
  BleService,
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
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

const BLE_SERVICE_VERSION = '1.0.0';

/** Context passed to host-provided NAP-BLE hooks. */
export interface BleServiceContext {
  /** Window id of the requesting napplet. */
  windowId: string;
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

/**
 * Create the NAP-BLE reference service.
 *
 * @param options - Host BLE session hooks for ble.* requests.
 * @returns A runtime service handler for the `ble` domain.
 */
export function createBleService(options: BleServiceOptions = {}): ServiceHandler {
  return {
    descriptor: BLE_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      const context = { windowId };

      if (message.type === 'ble.open') {
        if (!options.open) {
          send(unsupported('ble.open.result', id));
          return;
        }
        const bleMessage = message as BleOpenMessage;
        settle(
          () => options.open!(bleMessage.request, context),
          send,
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
        settle(
          () => options.services!(bleMessage.sessionId, context),
          send,
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
        settle(
          () => options.read!(bleMessage.sessionId, bleMessage.target, context),
          send,
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
        settle(
          () => options.write!(bleMessage.sessionId, bleMessage.target, bleMessage.data, bleMessage.options, context),
          send,
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
        settle(
          () => options.subscribe!(bleMessage.sessionId, bleMessage.target, context),
          send,
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
        settle(
          () => options.unsubscribe!(bleMessage.sessionId, bleMessage.target, context),
          send,
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
        settle(
          () => options.close!(bleMessage.sessionId, bleMessage.reason, context),
          send,
          (error) => ({ type: 'ble.close.result', id, error } as NappletMessage),
          () => ({ type: 'ble.close.result', id } as NappletMessage),
        );
        return;
      }

      send({
        type: `${message.type}.error`,
        id,
        error: `Unknown ble method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(windowId: string): void {
      options.destroyWindow?.(windowId);
    },
  };
}

/**
 * lists-service.ts — NAP-LISTS reference service.
 *
 * Shell-mediated NIP-51 list metadata and mutation hooks. The napplet requests
 * `lists.*`; the shell owns list lookup, validation, signing, publishing, and
 * private-item policy.
 */

import type {
  ListItem,
  ListMutationResult,
  ListOptions,
  ListRef,
  ListSupport,
  NappletMessage,
} from '@napplet/core';
import type {
  ListsAddMessage,
  ListsRemoveMessage,
} from '@napplet/nap/lists/types';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

const LISTS_SERVICE_VERSION = '1.0.0';

/** Context passed to host-provided NAP-LISTS hooks. */
export interface ListsServiceContext {
  /** Window id of the requesting napplet. */
  windowId: string;
}

/** Options for {@link createListsService}. */
export interface ListsServiceOptions {
  /** Host-owned supported list metadata. */
  supported?: (context: ListsServiceContext) => readonly ListSupport[] | Promise<readonly ListSupport[]>;
  /** Host-owned add mutation. */
  add?: (
    list: ListRef,
    items: readonly ListItem[],
    options: ListOptions | undefined,
    context: ListsServiceContext,
  ) => ListMutationResult | Promise<ListMutationResult>;
  /** Host-owned remove mutation. */
  remove?: (
    list: ListRef,
    items: readonly ListItem[],
    options: ListOptions | undefined,
    context: ListsServiceContext,
  ) => ListMutationResult | Promise<ListMutationResult>;
}

type Send = (msg: NappletMessage) => void;
type MutationHook = NonNullable<ListsServiceOptions['add'] | ListsServiceOptions['remove']>;

const LISTS_DESCRIPTOR: ServiceDescriptor = {
  name: 'lists',
  version: LISTS_SERVICE_VERSION,
  description: 'NAP-LISTS reference handler for shell-mediated NIP-51 list mutations',
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
    send(okFalse(errorMessage(err, 'lists request failed')));
    return;
  }
  pending
    .then((value) => send(onValue(value)))
    .catch((err) => send(okFalse(errorMessage(err, 'lists request failed'))));
}

function unsupportedMutation(resultType: string, id: string): NappletMessage {
  return {
    type: resultType,
    id,
    ok: false,
    error: 'unsupported',
    reason: `${resultType.replace('.result', '')} unavailable`,
    supported: [],
  } as NappletMessage;
}

function settleMutation(
  hook: MutationHook | undefined,
  message: ListsAddMessage | ListsRemoveMessage,
  context: ListsServiceContext,
  send: Send,
  resultType: 'lists.add.result' | 'lists.remove.result',
): void {
  if (!hook) {
    send(unsupportedMutation(resultType, message.id));
    return;
  }
  settle(
    () => hook(message.list, message.items, message.options, context),
    send,
    (error) => ({ type: resultType, id: message.id, ok: false, error: 'list-unavailable', reason: error } as NappletMessage),
    (result) => ({ type: resultType, id: message.id, ...result } as NappletMessage),
  );
}

/**
 * Create the NAP-LISTS reference service.
 *
 * @param options - Host list metadata and mutation hooks for lists.* requests.
 * @returns A runtime service handler for the `lists` domain.
 */
export function createListsService(options: ListsServiceOptions = {}): ServiceHandler {
  return {
    descriptor: LISTS_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      const context = { windowId };

      if (message.type === 'lists.supported') {
        if (!options.supported) {
          send({ type: 'lists.supported.result', id, lists: [] } as NappletMessage);
          return;
        }
        settle(
          () => options.supported!(context),
          send,
          (error) => ({ type: 'lists.supported.result', id, error } as NappletMessage),
          (lists) => ({ type: 'lists.supported.result', id, lists: [...lists] } as NappletMessage),
        );
        return;
      }

      if (message.type === 'lists.add') {
        settleMutation(options.add, message as ListsAddMessage, context, send, 'lists.add.result');
        return;
      }

      if (message.type === 'lists.remove') {
        settleMutation(options.remove, message as ListsRemoveMessage, context, send, 'lists.remove.result');
        return;
      }

      send({
        type: `${message.type}.error`,
        id,
        error: `Unknown lists method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(_windowId: string): void {
      /* no per-window state */
    },
  };
}

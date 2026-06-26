/**
 * dm-service.ts -- NAP-DM reference service.
 *
 * Routes `dm.*` envelopes to an injected adapter. The service owns request
 * correlation, per-window live subscription fan-out, and lifecycle cleanup;
 * adapters own protocol-specific transport/encryption/storage behavior.
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  DmAdapter,
  DmConversationsMessage,
  DmMessagesMessage,
  DmSendMessage,
  DmSubscribeMessage,
  DmUnsubscribeMessage,
} from './dm-types.js';

/** Options for {@link createDmService}. */
export interface DmServiceOptions {
  /** Adapter that implements one or more chat backends under NAP-DM. */
  adapter: DmAdapter;
}

/** Created DM service. */
export interface DmService extends ServiceHandler {
  /** Close adapter resources. Idempotent when adapter close is idempotent. */
  dispose(): void;
}

type Send = (msg: NappletMessage) => void;

const DM_DESCRIPTOR: ServiceDescriptor = {
  name: 'dm',
  version: '1.0.0',
  description: 'NAP-DM runtime-mediated direct messages',
};

function err(error: unknown, fallback = 'dm request failed'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

/**
 * Create a NAP-DM service handler.
 *
 * @param options - DM adapter to route requests through.
 * @returns Service handler for `runtime.registerService('dm', handler)`.
 */
export function createDmService(options: DmServiceOptions): DmService {
  if (!options || typeof options.adapter !== 'object' || options.adapter === null) {
    throw new Error('createDmService: options.adapter is required');
  }
  const { adapter } = options;
  const ownedSubscriptions = new Map<string, Set<string>>();

  function remember(windowId: string, subscriptionId: string): void {
    let subs = ownedSubscriptions.get(windowId);
    if (!subs) {
      subs = new Set();
      ownedSubscriptions.set(windowId, subs);
    }
    subs.add(subscriptionId);
  }

  function forget(windowId: string, subscriptionId: string): void {
    const subs = ownedSubscriptions.get(windowId);
    if (!subs) return;
    subs.delete(subscriptionId);
    if (subs.size === 0) ownedSubscriptions.delete(windowId);
  }

  return {
    descriptor: DM_DESCRIPTOR,

    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = (message as { id?: unknown }).id;
      const requestId = typeof id === 'string' ? id : '';

      switch (message.type) {
        case 'dm.status':
          void Promise.resolve(adapter.status())
            .then((status) => send({ type: 'dm.status.result', id: requestId, ...status } as NappletMessage))
            .catch((error) => send({ type: 'dm.status.result', id: requestId, error: err(error) } as NappletMessage));
          return;

        case 'dm.conversations':
          void Promise.resolve(adapter.conversations(message as DmConversationsMessage))
            .then((page) => send({ type: 'dm.conversations.result', id: requestId, ...page } as NappletMessage))
            .catch((error) =>
              send({ type: 'dm.conversations.result', id: requestId, conversations: [], error: err(error) } as NappletMessage),
            );
          return;

        case 'dm.messages':
          void Promise.resolve(adapter.messages(message as DmMessagesMessage))
            .then((page) => send({ type: 'dm.messages.result', id: requestId, ...page } as NappletMessage))
            .catch((error) =>
              send({ type: 'dm.messages.result', id: requestId, messages: [], error: err(error) } as NappletMessage),
            );
          return;

        case 'dm.send':
          void adapter
            .send(message as DmSendMessage)
            .then((result) => send({ type: 'dm.send.result', id: requestId, ...result } as NappletMessage))
            .catch((error) => send({ type: 'dm.send.result', id: requestId, error: err(error) } as NappletMessage));
          return;

        case 'dm.subscribe': {
            let activeSubscriptionId = '';
            void Promise.resolve(
              adapter.subscribe(message as DmSubscribeMessage, (dmMessage) => {
                if (activeSubscriptionId.length > 0) {
                  send({ type: 'dm.message', subscriptionId: activeSubscriptionId, message: dmMessage } as NappletMessage);
                }
              }),
            )
              .then((subscription) => {
                remember(windowId, subscription.subscriptionId);
                activeSubscriptionId = subscription.subscriptionId;
                send({ type: 'dm.subscribe.result', id: requestId, ...subscription } as NappletMessage);
              })
              .catch((error) => {
                send({ type: 'dm.subscribe.result', id: requestId, error: err(error) } as NappletMessage);
              });
            return;
          }

        case 'dm.unsubscribe': {
          const subId = (message as DmUnsubscribeMessage).subscriptionId;
          if (typeof subId !== 'string' || subId.length === 0) {
            send({ type: 'dm.unsubscribe.result', id: requestId, ok: false, error: 'subscription not found' } as NappletMessage);
            return;
          }
          void Promise.resolve(adapter.unsubscribe(subId))
            .then((ok) => {
              forget(windowId, subId);
              send({ type: 'dm.unsubscribe.result', id: requestId, ...ok } as NappletMessage);
            })
            .catch((error) => send({ type: 'dm.unsubscribe.result', id: requestId, ok: false, error: err(error) } as NappletMessage));
          return;
        }

        default:
          return;
      }
    },

    onWindowDestroyed(windowId: string): void {
      const subs = ownedSubscriptions.get(windowId);
      if (!subs) return;
      for (const subId of subs) void Promise.resolve(adapter.unsubscribe(subId)).catch(() => undefined);
      ownedSubscriptions.delete(windowId);
    },

    dispose(): void {
      adapter.close?.();
      ownedSubscriptions.clear();
    },
  };
}

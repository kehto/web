/**
 * dm-service.ts -- NAP-DM reference service.
 *
 * Routes `dm.*` envelopes to an injected adapter. The service owns request
 * correlation, per-window live subscription fan-out, and lifecycle cleanup;
 * adapters own protocol-specific transport/encryption/storage behavior.
 */

import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
import type {
  DmAdapter,
  DmConversationsMessage,
  DmMessagesMessage,
  DmSendMessage,
  DmSubscribeMessage,
  DmUnsubscribeMessage,
} from './dm-types.js';

type DmPermissionRequirement = Parameters<NonNullable<ServiceRuntimeContext['authorizeOperation']>>[2][number];

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

function relayRequirements(operation: string, relays: readonly string[], recipients: readonly string[] = []): readonly DmPermissionRequirement[] {
  const requirements: DmPermissionRequirement[] = recipients.map((recipient) => ({
    category: 'resource', domain: 'dm', operation, scope: { kind: 'exact', value: recipient },
  }));
  for (const relay of relays) {
    let origin: string;
    try {
      const parsed = new URL(relay);
      if (!['ws:', 'wss:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error();
      origin = parsed.origin;
    } catch { throw new Error('forbidden'); }
    requirements.push({ category: 'network', domain: 'dm', operation, scope: { kind: 'origin', value: origin } });
  }
  if (requirements.length === 0) throw new Error('unavailable');
  return requirements;
}

/**
 * Create a NAP-DM service handler.
 *
 * @param options - DM adapter to route requests through.
 * @returns Service handler for `runtime.registerService('dm', handler)`.
 */
// aislop-ignore-next-line function-too-long -- Relay-plan approval, source generations, and live subscription ownership are one private lifecycle boundary.
export function createDmService(options: DmServiceOptions): DmService {
  if (!options || typeof options.adapter !== 'object' || options.adapter === null) {
    throw new Error('createDmService: options.adapter is required');
  }
  const { adapter } = options;
  const ownedSubscriptions = new Map<string, Set<string>>();
  const generations = new Map<string, symbol>();
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;

  function generationFor(windowId: string): symbol {
    let generation = generations.get(windowId);
    if (!generation) { generation = Symbol(windowId); generations.set(windowId, generation); }
    return generation;
  }
  function current(windowId: string, generation: symbol): boolean { return generations.get(windowId) === generation; }
  function warnLegacy(): void {
    if (warnedLegacy) return;
    warnedLegacy = true;
    console.warn('[FW-DM-LEGACY-001] Configure an approval-aware DM adapter with immutable relay planning; legacy adapter execution is deprecated. Warning once per service instance.');
  }
  function plan(operation: 'history' | 'send' | 'subscribe'): readonly string[] {
    const relays = adapter.planRelays?.(operation);
    if (!relays || relays.length === 0) throw new Error('unavailable');
    return Object.freeze([...new Set(relays)]);
  }
  function relaysFor(operation: 'history' | 'send' | 'subscribe'): readonly string[] {
    return runtime?.authorizeOperation ? plan(operation) : [];
  }
  async function authorized<T>(windowId: string, generation: symbol, operation: string, relays: readonly string[], recipients: readonly string[], execute: (signal: ApprovalSignal) => T | Promise<T>): Promise<T> {
    if (!runtime?.authorizeOperation) { warnLegacy(); return execute({ aborted: false, addEventListener() {}, removeEventListener() {} }); }
    const outcome = await runtime.authorizeOperation(windowId, operation, relayRequirements(operation, relays, recipients), async (signal) => {
      if (!current(windowId, generation) || signal.aborted) throw new Error('cancelled');
      const value = await execute(signal);
      if (!current(windowId, generation) || signal.aborted) throw new Error('cancelled');
      return value;
    });
    if (outcome.status !== 'executed') throw new Error('forbidden');
    return outcome.value;
  }

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
    onRegistered(context): void { runtime = context; },
    onUnregistered(): void { runtime = undefined; },

    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const generation = generationFor(windowId);
      const id = (message as { id?: unknown }).id;
      const requestId = typeof id === 'string' ? id : '';

      switch (message.type) {
        case 'dm.status':
          void Promise.resolve().then(() => adapter.status())
            .then((status) => send({ type: 'dm.status.result', id: requestId, ...status } as NappletMessage))
            .catch((error) => send({ type: 'dm.status.result', id: requestId, error: err(error) } as NappletMessage));
          return;

        case 'dm.conversations':
          void Promise.resolve().then(async () => {
            const request = message as DmConversationsMessage;
            const relays = relaysFor('history');
            return authorized(windowId, generation, 'dm.conversations', relays, [], (signal) =>
              adapter.conversationsWithRelays?.(request, relays, signal) ?? adapter.conversations(request));
          })
            .then((page) => { if (current(windowId, generation)) send({ type: 'dm.conversations.result', id: requestId, ...page } as NappletMessage); })
            .catch((error) =>
              send({ type: 'dm.conversations.result', id: requestId, error: err(error) } as NappletMessage),
            );
          return;

        case 'dm.messages':
          void Promise.resolve().then(async () => {
            const request = message as DmMessagesMessage;
            const relays = relaysFor('history');
            return authorized(windowId, generation, 'dm.messages', relays, [request.conversationId], (signal) =>
              adapter.messagesWithRelays?.(request, relays, signal) ?? adapter.messages(request));
          })
            .then((page) => { if (current(windowId, generation)) send({ type: 'dm.messages.result', id: requestId, ...page } as NappletMessage); })
            .catch((error) =>
              send({ type: 'dm.messages.result', id: requestId, error: err(error) } as NappletMessage),
            );
          return;

        case 'dm.send':
          void Promise.resolve().then(async () => {
            const request = message as DmSendMessage;
            if (runtime?.authorizeOperation && (!Array.isArray(request.recipients) || request.recipients.length === 0 || request.recipients.some((recipient) => typeof recipient !== 'string' || !/^[0-9a-f]{64}$/u.test(recipient)) || typeof request.content !== 'string' || request.content.length === 0)) throw new Error('invalid recipient');
            const relays = relaysFor('send');
            return authorized(windowId, generation, 'dm.send', relays, request.recipients, (signal) =>
              adapter.sendWithRelays?.(request, relays, signal) ?? adapter.send(request));
          })
            .then((result) => { if (current(windowId, generation)) send({ type: 'dm.send.result', id: requestId, ...result } as NappletMessage); })
            .catch((error) => send({ type: 'dm.send.result', id: requestId, error: err(error) } as NappletMessage));
          return;

        case 'dm.subscribe': {
            let activeSubscriptionId = '';
            const pending: Parameters<Parameters<DmAdapter['subscribe']>[1]>[0][] = [];
            void Promise.resolve().then(async () => {
              const request = message as DmSubscribeMessage;
              const relays = relaysFor('subscribe');
              return authorized(windowId, generation, 'dm.subscribe', relays, request.conversationId ? [request.conversationId] : [], (signal) =>
                (adapter.subscribeWithRelays?.(request, (dmMessage) => {
                if (!current(windowId, generation)) return;
                if (activeSubscriptionId.length > 0) {
                  if (ownedSubscriptions.get(windowId)?.has(activeSubscriptionId)) {
                    send({ type: 'dm.message', subscriptionId: activeSubscriptionId, message: dmMessage } as NappletMessage);
                  }
                } else {
                  pending.push(dmMessage);
                }
              }, relays, signal) ?? adapter.subscribe(request, (dmMessage) => {
                if (activeSubscriptionId.length > 0 && current(windowId, generation) && ownedSubscriptions.get(windowId)?.has(activeSubscriptionId)) send({ type: 'dm.message', subscriptionId: activeSubscriptionId, message: dmMessage } as NappletMessage);
                else pending.push(dmMessage);
              })));
            })
              .then((subscription) => {
                remember(windowId, subscription.subscriptionId);
                activeSubscriptionId = subscription.subscriptionId;
                send({ type: 'dm.subscribe.result', id: requestId, ...subscription } as NappletMessage);
                for (const dmMessage of pending) {
                  send({ type: 'dm.message', subscriptionId: activeSubscriptionId, message: dmMessage } as NappletMessage);
                }
                pending.length = 0;
              })
              .catch((error) => {
                send({ type: 'dm.subscribe.result', id: requestId, error: err(error) } as NappletMessage);
              });
            return;
          }

        case 'dm.unsubscribe': {
          const subId = (message as DmUnsubscribeMessage).subscriptionId;
          if (
            typeof subId !== 'string'
            || subId.length === 0
            || ownedSubscriptions.get(windowId)?.has(subId) !== true
          ) {
            send({ type: 'dm.unsubscribe.result', id: requestId, error: 'subscription not found' } as NappletMessage);
            return;
          }
          void Promise.resolve().then(() => adapter.unsubscribe(subId))
            .then((ok) => {
              forget(windowId, subId);
              send({ type: 'dm.unsubscribe.result', id: requestId, ...ok } as NappletMessage);
            })
            .catch((error) => send({ type: 'dm.unsubscribe.result', id: requestId, error: err(error) } as NappletMessage));
          return;
        }

        default:
          return;
      }
    },

    onWindowDestroyed(windowId: string): void {
      generations.delete(windowId);
      const subs = ownedSubscriptions.get(windowId);
      if (!subs) return;
      for (const subId of subs) void Promise.resolve(adapter.unsubscribe(subId)).catch(() => undefined);
      ownedSubscriptions.delete(windowId);
    },

    onPermissionRevoked(windowId: string): void {
      const subs = ownedSubscriptions.get(windowId);
      if (!subs) return;
      for (const subId of subs) void Promise.resolve(adapter.unsubscribe(subId)).catch(() => undefined);
      ownedSubscriptions.delete(windowId);
    },

    dispose(): void {
      adapter.close?.();
      ownedSubscriptions.clear();
      generations.clear();
    },
  };
}

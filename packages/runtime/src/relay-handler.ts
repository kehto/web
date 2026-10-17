import type { EventTemplate, NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import type { RelayMessage } from '@napplet/nap/relay/types';

import { matchesAnyFilter, type EventBuffer, type SubscriptionEntry } from './event-buffer.js';
import type { ReplayDetector } from './replay.js';
import {
  createRelayEventResult,
  createRelayEventResultWithHints,
  relayEventResultFromCarrier,
  type RelayEventResult,
} from './relay-result.js';
import type { RuntimeAdapter, ServiceHandler, ServiceRegistry, ServiceRuntimeContext, Signer } from './types.js';
import { isRelayPlanningServiceHandler, type RelayOperationPlan } from './service-types.js';
import type { PermissionRequirement } from '@kehto/firewall';
import type { ApprovalSignal } from './approval-coordinator.js';

declare const console: { warn(message: string): void };

declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;

type RuntimeRelayMessage = RelayMessage & {
  subId?: string;
  filters?: NostrFilter[];
  event?: EventTemplate | NostrEvent;
  result?: RelayEventResult;
  id?: string;
  relay?: string;
};

type RelayHandlerContext = {
  hooks: RuntimeAdapter;
  serviceRegistry: ServiceRegistry;
  subscriptions: Map<string, SubscriptionEntry>;
  eventBuffer: EventBuffer;
  replayDetector: ReplayDetector;
  canReadRelay: (windowId: string) => boolean;
  authorizeOperation?: ServiceRuntimeContext['authorizeOperation'];
};

const legacyRelayServiceWarnings = new WeakSet<object>();
const legacyRelayAdapterWarnings = new WeakSet<object>();

function relayRequirements(plan: RelayOperationPlan): PermissionRequirement[] {
  const requirements: PermissionRequirement[] = [{
    category: 'interface', domain: 'relay', operation: 'access', scope: { kind: 'exact', value: 'relay' },
  }];
  for (const relayUrl of plan.relayUrls) {
    try {
      const origin = /^(wss?:\/\/[^/?#]+)/.exec(relayUrl)?.[1];
      if (!origin) throw new Error('scheme');
      requirements.push({ category: 'network', domain: 'relay', operation: 'relay.network',
        scope: { kind: 'origin', value: origin } });
    } catch {
      throw new Error('invalid relay destination');
    }
  }
  return requirements;
}

async function authorizeRelay<T>(context: RelayHandlerContext, windowId: string, operation: string,
  plan: RelayOperationPlan, execute: (signal: ApprovalSignal) => T | Promise<T>): Promise<void> {
  const run = context.authorizeOperation;
  if (!run) {
    await execute({ aborted: false, addEventListener() {}, removeEventListener() {} });
    return;
  }
  await run(windowId, operation, relayRequirements(plan), execute);
}

export type RelayHandler = (windowId: string, msg: NappletMessage) => void;

export function createRelayHandler(context: RelayHandlerContext): RelayHandler {
  return function handleRelayMessage(windowId: string, msg: NappletMessage): void {
    const m = msg as RuntimeRelayMessage;
    const dotIdx = msg.type.indexOf('.');
    const action = msg.type.slice(dotIdx + 1);

    switch (action) {
      case 'subscribe':
        handleRelaySubscribe(context, windowId, msg, m);
        return;
      case 'close':
        handleRelayClose(context, windowId, msg, m);
        return;
      case 'publish':
        handleRelayPublish(context, windowId, m);
        return;
      case 'publishEncrypted':
        handleRelayPublishEncrypted(context, windowId, msg);
        return;
      case 'query':
        handleRelayQuery(context, windowId, m);
        return;
      default:
        return;
    }
  };
}

function relayServiceFrom(context: RelayHandlerContext): ServiceHandler | undefined {
  return context.serviceRegistry['relay'] ?? context.serviceRegistry['relay-pool'];
}

function isShellKindQuery(filters: NostrFilter[]): boolean {
  return filters.length > 0 && filters.every((filter) => filter.kinds?.every((kind) => kind >= 29000 && kind < 30000));
}

function sendRelayEvent(hooks: RuntimeAdapter, windowId: string, subId: string, result: RelayEventResult): void {
  hooks.sendToNapplet(windowId, { type: 'relay.event', subId, result } as NappletMessage);
}

function normalizeRelayServiceResponse(resp: NappletMessage): NappletMessage {
  const m = resp as RuntimeRelayMessage;
  if (m.type !== 'relay.event') return resp;
  const result = relayEventResultFromCarrier(m);
  return result ? { type: 'relay.event', subId: m.subId, result } as NappletMessage : resp;
}

function handleRelaySubscribe(
  context: RelayHandlerContext,
  windowId: string,
  msg: NappletMessage,
  m: RuntimeRelayMessage,
): void {
  const { eventBuffer, hooks, subscriptions } = context;
  const subId = m.subId ?? '';
  const filters = m.filters ?? [];
  if (!subId) return;

  const relayService = relayServiceFrom(context);
  if (relayService) {
    if (!isRelayPlanningServiceHandler(relayService)) {
      if (!legacyRelayServiceWarnings.has(relayService)) {
        legacyRelayServiceWarnings.add(relayService);
        console.warn('FW-RELAY-SERVICE-LEGACY-001: relay service must implement planRelayOperation and executeRelayOperation; legacy service was denied (warns once per service instance).');
      }
      hooks.sendToNapplet(windowId, { type: 'relay.closed', subId, reason: 'relay service requires explicit planned execution' } as NappletMessage);
      return;
    }
    let plan: RelayOperationPlan;
    try { plan = relayService.planRelayOperation(windowId, msg); }
    catch {
      hooks.sendToNapplet(windowId, { type: 'relay.closed', subId, reason: 'invalid relay destination' } as NappletMessage);
      return;
    }
    void authorizeRelay(context, windowId, 'relay.subscribe', plan, (signal) => {
      if (signal.aborted) return;
      const subKey = `${windowId}:${subId}`;
      const entry = { windowId, filters };
      subscriptions.set(subKey, entry);
      const isActive = (): boolean => !signal.aborted && subscriptions.get(subKey) === entry && context.canReadRelay(windowId);
      const send = (response: NappletMessage): void => {
        if (isActive()) hooks.sendToNapplet(windowId, normalizeRelayServiceResponse(response));
      };
      const seenIds = new Set<string>();
      const deliver = (event: NostrEvent, relayHints?: string[]): void => {
        if (!isActive() || seenIds.has(event.id)) return;
        seenIds.add(event.id);
        sendRelayEvent(hooks, windowId, subId, createRelayEventResultWithHints(event, relayHints));
      };
      for (const bufferedEvent of eventBuffer.getBufferedEvents()) {
        if (matchesAnyFilter(bufferedEvent, filters)) deliver(bufferedEvent);
      }
      relayService.executeRelayOperation(windowId, msg, plan, signal, send);
      signal.addEventListener('abort', () => {
        if (subscriptions.get(subKey) !== entry) return;
        subscriptions.delete(subKey);
        closeRelayBackends(context, windowId, subId, subKey);
      }, { once: true });
      if (!isActive()) closeRelayBackends(context, windowId, subId, subKey);
    }).catch(() => {
      hooks.sendToNapplet(windowId, { type: 'relay.closed', subId, reason: 'relay authorization unavailable or denied' } as NappletMessage);
    });
    return;
  }

  const subKey = `${windowId}:${subId}`;
  const isShellKind = isShellKindQuery(filters);
  const pool = hooks.relayPool;
  const relayUrls = isShellKind ? [] : (typeof m.relay === 'string' && m.relay.length > 0
    ? [m.relay] : pool?.selectRelayTier(filters) ?? []);
  const plan: RelayOperationPlan = Object.freeze({ operation: 'subscribe', relayUrls: Object.freeze([...new Set(relayUrls)]), localOnly: isShellKind });
  if (!isShellKind && !pool?.subscribeToRelays) {
    if (pool && !legacyRelayAdapterWarnings.has(pool)) {
      legacyRelayAdapterWarnings.add(pool);
      console.warn('FW-RELAY-ADAPTER-LEGACY-001: relay adapter must implement subscribeToRelays/publishToRelays; legacy adapter was denied (warns once per adapter instance).');
    }
    hooks.sendToNapplet(windowId, { type: 'relay.closed', subId, reason: 'relay adapter requires explicit planned execution' } as NappletMessage);
    return;
  }
  void authorizeRelay(context, windowId, 'relay.subscribe', plan, (signal) => {
    if (signal.aborted) return;
    const entry = { windowId, filters };
    subscriptions.set(subKey, entry);
    const isActive = (): boolean => !signal.aborted && subscriptions.get(subKey) === entry && context.canReadRelay(windowId);
    const send = (response: NappletMessage): void => {
      if (isActive()) hooks.sendToNapplet(windowId, normalizeRelayServiceResponse(response));
    };
    const seenIds = new Set<string>();
    const deliver = (event: NostrEvent, relayHints?: string[]): void => {
      if (seenIds.has(event.id)) return;
      seenIds.add(event.id);
      if (isActive()) sendRelayEvent(hooks, windowId, subId, createRelayEventResultWithHints(event, relayHints));
    };
    for (const bufferedEvent of eventBuffer.getBufferedEvents()) {
      if (matchesAnyFilter(bufferedEvent, filters)) deliver(bufferedEvent);
    }
    deliverFromRuntimeBackends(context, subId, subKey, filters, isShellKind, deliver, send, isActive, plan.relayUrls);
    signal.addEventListener('abort', () => {
      if (subscriptions.get(subKey) !== entry) return;
      subscriptions.delete(subKey);
      closeRelayBackends(context, windowId, subId, subKey);
    }, { once: true });
  }).catch(() => hooks.sendToNapplet(windowId,
    { type: 'relay.closed', subId, reason: 'relay authorization unavailable or denied' } as NappletMessage));
}

function deliverFromRuntimeBackends(
  context: RelayHandlerContext,
  subId: string,
  subKey: string,
  filters: NostrFilter[],
  isShellKind: boolean,
  deliver: (event: NostrEvent, relayHints?: string[]) => void,
  send: (response: NappletMessage) => void,
  isActive: () => boolean,
  relayUrls: readonly string[],
): void {
  const { hooks } = context;
  const cache = hooks.cache;

  if (cache?.isAvailable() && !isShellKind) {
    cache.query(filters)
      .then((cachedEvents) => {
        for (const event of cachedEvents) deliver(event);
      })
      .catch(() => {});
  }

  const pool = hooks.relayPool;
  if (!pool?.isAvailable() && !isShellKind) {
    send({ type: 'relay.eose', subId } as NappletMessage);
    return;
  }
  if (!pool?.isAvailable() || isShellKind) return;

  let eoseSent = false;
  const eoseFallbackTimer = setTimeout(() => {
    if (!eoseSent) {
      eoseSent = true;
      send({ type: 'relay.eose', subId } as NappletMessage);
    }
  }, 15_000);

  const subscription = pool.subscribeToRelays!([...relayUrls], filters, (item) => {
    if (!isActive()) return;
    if (item === 'EOSE') {
      clearTimeout(eoseFallbackTimer);
      if (!eoseSent) {
        eoseSent = true;
        send({ type: 'relay.eose', subId } as NappletMessage);
      }
      return;
    }
    const event = item as NostrEvent;
    deliver(event, [...relayUrls]);
    if (cache?.isAvailable() && !isShellKind) {
      try { cache.store(event); } catch { return; }
    }
  });

  pool.trackSubscription(subKey, () => {
    clearTimeout(eoseFallbackTimer);
    subscription.unsubscribe();
  });
  if (!isActive()) pool.untrackSubscription(subKey);
}

type RelayLifecycleContext = Pick<RelayHandlerContext, 'hooks' | 'subscriptions' | 'serviceRegistry'>;

function closeRelayBackends(context: RelayLifecycleContext, windowId: string, subId: string, subKey: string): void {
  const relay = context.serviceRegistry['relay'] ?? context.serviceRegistry['relay-pool'];
  const cache = !context.serviceRegistry['relay'] ? context.serviceRegistry['cache'] : undefined;
  for (const service of new Set([relay, cache])) {
    try { service?.handleMessage(windowId, { type: 'relay.close', subId } as NappletMessage, () => {}); }
    catch { /* Other backends still need cleanup; delivery is already invalidated. */ }
  }
  try { context.hooks.relayPool?.untrackSubscription(subKey); }
  catch { /* A failed adapter cleanup must not restore delivery or abort retirement. */ }
}

/** Retire ordinary subscriptions when the host revokes a window's relay authority. */
export function revokeRelaySubscriptions(context: RelayLifecycleContext, windowId: string): void {
  const entries = [...context.subscriptions].filter(([, entry]) => entry.windowId === windowId);
  // Invalidate every callback before invoking any host/backend code.
  for (const [key] of entries) context.subscriptions.delete(key);
  for (const [key] of entries) {
    const subId = key.slice(windowId.length + 1);
    closeRelayBackends(context, windowId, subId, key);
    context.hooks.sendToNapplet(windowId, { type: 'relay.closed', subId, reason: 'denied: relay:read' } as NappletMessage);
  }
}

function handleRelayClose(
  context: RelayHandlerContext,
  windowId: string,
  msg: NappletMessage,
  m: RuntimeRelayMessage,
): void {
  const { hooks, subscriptions } = context;
  const subId = m.subId ?? '';
  if (!subId) return;
  const subKey = `${windowId}:${subId}`;
  subscriptions.delete(subKey);

  const relayService = relayServiceFrom(context);
  if (relayService) relayService.handleMessage(windowId, msg, () => {});
  hooks.relayPool?.untrackSubscription(subKey);
  hooks.sendToNapplet(windowId, { type: 'relay.closed', subId, message: '' } as NappletMessage);
}

function handleRelayPublish(
  context: RelayHandlerContext,
  windowId: string,
  m: RuntimeRelayMessage,
): void {
  const { hooks, replayDetector } = context;
  const eventTemplate = m.event;
  const id = m.id ?? '';
  if (!eventTemplate || typeof eventTemplate !== 'object') {
    sendRelayPublishResult(hooks, windowId, id, false, undefined, 'invalid event template');
    return;
  }

  const relayService = relayServiceFrom(context);
  let plan: RelayOperationPlan;
  try {
    if (relayService) {
      if (!isRelayPlanningServiceHandler(relayService)) throw new Error('legacy relay service');
      plan = relayService.planRelayOperation(windowId, { type: 'relay.publish', id, event: eventTemplate } as NappletMessage);
    } else {
      const pool = hooks.relayPool;
      if (!pool?.publishToRelays) throw new Error('legacy relay adapter');
      plan = Object.freeze({ operation: 'publish', relayUrls: Object.freeze([...new Set(pool.selectRelayTier([]))]), localOnly: false });
    }
  } catch {
    if (relayService && !legacyRelayServiceWarnings.has(relayService)) {
      legacyRelayServiceWarnings.add(relayService);
      console.warn('FW-RELAY-SERVICE-LEGACY-001: relay service must implement planRelayOperation and executeRelayOperation; legacy service was denied (warns once per service instance).');
    } else if (!relayService && hooks.relayPool && !legacyRelayAdapterWarnings.has(hooks.relayPool)) {
      legacyRelayAdapterWarnings.add(hooks.relayPool);
      console.warn('FW-RELAY-ADAPTER-LEGACY-001: relay adapter must implement subscribeToRelays/publishToRelays; legacy adapter was denied (warns once per adapter instance).');
    }
    sendRelayPublishResult(hooks, windowId, id, false, undefined, 'relay operation requires explicit planned execution');
    return;
  }

  const signer = hooks.auth.getSigner(windowId);
  const signEvent = signer?.signEvent?.bind(signer);
  if (!signEvent) {
    sendRelayPublishResult(hooks, windowId, id, false, undefined, 'no signer configured');
    return;
  }

  void authorizeRelay(context, windowId, 'relay.publish', plan, async (signal): Promise<void> => {
    try {
      if (signal.aborted) return;
      const signed = await signEvent(eventTemplate);
      if (signal.aborted) return;
      if (!signed) {
        sendRelayPublishResult(hooks, windowId, id, false, undefined, 'signEvent returned no event');
        return;
      }
      const replayResult = replayDetector.reserve(signed);
      if (replayResult !== null) {
        sendRelayPublishResult(hooks, windowId, id, false, undefined, replayResult);
        return;
      }
      publishSignedRelayEvent(context, windowId, id, signed, plan, signal, (ok, error) => {
        if (ok) replayDetector.commit(signed.id);
        else replayDetector.release(signed.id);
        sendRelayPublishResult(hooks, windowId, id, ok, ok ? signed : undefined, error);
      });
    } catch (error) {
      sendRelayPublishResult(
        hooks,
        windowId,
        id,
        false,
        undefined,
        error instanceof Error && error.message ? error.message : 'event signing failed',
      );
    }
  }).catch(() => sendRelayPublishResult(hooks, windowId, id, false, undefined, 'relay authorization unavailable or denied'));
}

function sendRelayPublishResult(
  hooks: RuntimeAdapter,
  windowId: string,
  id: string,
  ok: boolean,
  event?: NostrEvent,
  error?: string,
): void {
  const result = ok && event
    ? { type: 'relay.publish.result', id, ok: true, event, eventId: event.id }
    : { type: 'relay.publish.result', id, ok: false, error: error ?? 'publish failed' };
  hooks.sendToNapplet(windowId, result as NappletMessage);
}

function publishSignedRelayEvent(
  context: RelayHandlerContext,
  windowId: string,
  id: string,
  signed: NostrEvent,
  plan: RelayOperationPlan,
  signal: ApprovalSignal,
  reply: (ok: boolean, error?: string) => void,
): void {
  const { eventBuffer, hooks } = context;
  let settled = false;
  const settle = (ok: boolean, error?: string): void => {
    if (settled || signal.aborted) return;
    settled = true;
    if (ok) {
      try { eventBuffer.bufferAndDeliver(signed, windowId); } catch { /* local delivery is best-effort */ }
    }
    reply(ok, error);
  };

  const relayService = relayServiceFrom(context);
  if (relayService && isRelayPlanningServiceHandler(relayService)) {
    const publishMessage = { type: 'relay.publish', id, event: signed } as NappletMessage;
    try {
      relayService.executeRelayOperation(windowId, publishMessage, plan, signal, (response: NappletMessage) => {
        if (
          response.type !== 'relay.publish.result'
          && response.type !== 'relay.publish.error'
        ) {
          return;
        }
        const result = response as NappletMessage & {
          ok?: boolean;
          accepted?: boolean;
          error?: string;
          message?: string;
        };
        const ok = response.type === 'relay.publish.result'
          && (result.ok ?? result.accepted ?? false);
        settle(ok, ok ? undefined : result.error ?? result.message ?? 'publish failed');
      });
    } catch (error) {
      settle(
        false,
        error instanceof Error && error.message ? error.message : 'relay service failed',
      );
    }
    return;
  }

  if (!hooks.relayPool?.isAvailable()) {
    settle(false, 'no relay pool available');
    return;
  }
  try {
    const publishResult = hooks.relayPool.publishToRelays?.(plan.relayUrls, signed);
    void Promise.resolve(publishResult).then(
      () => settle(true),
      (error: unknown) => settle(
        false,
        error instanceof Error && error.message ? error.message : 'publish failed',
      ),
    );
  } catch (error) {
    settle(
      false,
      error instanceof Error && error.message ? error.message : 'publish failed',
    );
  }
}

function handleRelayPublishEncrypted(
  context: RelayHandlerContext,
  windowId: string,
  msg: NappletMessage,
): void {
  const { hooks } = context;
  const id = (msg as RuntimeRelayMessage).id ?? '';
  const eventTemplate = (msg as RuntimeRelayMessage).event;
  const peMsg = msg as NappletMessage & { recipient?: string; encryption?: string };
  const recipient = peMsg.recipient ?? '';
  const encryption = (peMsg.encryption ?? 'nip44') as 'nip04' | 'nip44' | string;

  const replyPe = (ok: boolean, extra: Record<string, unknown> = {}) => {
    hooks.sendToNapplet(windowId, { type: 'relay.publishEncrypted.result', id, ok, ...extra } as NappletMessage);
  };

  if (!recipient) { replyPe(false, { error: 'missing recipient' }); return; }
  if (encryption !== 'nip44' && encryption !== 'nip04') {
    replyPe(false, { error: `unsupported encryption scheme: ${encryption}` });
    return;
  }
  const peSigner = hooks.auth.getSigner(windowId);
  if (!peSigner) { replyPe(false, { error: 'no signer configured' }); return; }
  if (!eventTemplate || typeof eventTemplate !== 'object') {
    replyPe(false, { error: 'invalid event template' });
    return;
  }

  publishEncrypted(context, windowId, id, recipient, encryption, eventTemplate, peSigner, replyPe);
}

function publishEncrypted(
  context: RelayHandlerContext,
  windowId: string,
  id: string,
  recipient: string,
  encryption: 'nip04' | 'nip44' | string,
  eventTemplate: EventTemplate,
  peSigner: Signer,
  replyPe: (ok: boolean, extra?: Record<string, unknown>) => void,
): void {
  let plan: RelayOperationPlan;
  try {
    const relayService = relayServiceFrom(context);
    if (relayService) {
      if (!isRelayPlanningServiceHandler(relayService)) throw new Error('legacy relay service');
      plan = relayService.planRelayOperation(windowId,
        { type: 'relay.publishEncrypted', id, event: eventTemplate, recipient, encryption } as NappletMessage);
    } else {
      const pool = context.hooks.relayPool;
      if (!pool?.publishToRelays) throw new Error('legacy relay adapter');
      plan = Object.freeze({ operation: 'publishEncrypted', relayUrls: Object.freeze([...new Set(pool.selectRelayTier([]))]), localOnly: false });
    }
  } catch {
    replyPe(false, { error: 'relay operation requires explicit planned execution' });
    return;
  }
  void authorizeRelay(context, windowId, 'relay.publishEncrypted', plan, async (signal): Promise<void> => {
    try {
      if (signal.aborted) return;
      const plaintext = String((eventTemplate as { content?: unknown }).content ?? '');
      const ciphertext: string = encryption === 'nip44'
        ? (await peSigner.nip44?.encrypt(recipient, plaintext)) ?? ''
        : (await peSigner.nip04?.encrypt(recipient, plaintext)) ?? '';
      if (signal.aborted) return;
      const eventWithCiphertext = { ...eventTemplate, content: ciphertext };
      const signed = await peSigner.signEvent?.(eventWithCiphertext);
      if (signal.aborted) return;
      if (!signed) { replyPe(false, { error: 'signEvent returned null' }); return; }

      publishSignedRelayEvent(context, windowId, id, signed, plan, signal, (ok, error) => {
        replyPe(ok, ok
          ? { event: signed, eventId: signed.id }
          : { error: error ?? 'publish failed' });
      });
    } catch (err) {
      replyPe(false, { error: (err as Error)?.message ?? 'encryption failed' });
    }
  }).catch(() => replyPe(false, { error: 'relay authorization unavailable or denied' }));
}

function handleRelayQuery(
  context: RelayHandlerContext,
  windowId: string,
  m: RuntimeRelayMessage,
): void {
  const { hooks, serviceRegistry, eventBuffer } = context;
  const id = m.id ?? '';
  const filters = m.filters ?? [];

  const seenIds = new Set<string>();
  const events: RelayEventResult[] = [];
  for (const event of eventBuffer.getBufferedEvents()) {
    if (matchesAnyFilter(event, filters) && !seenIds.has(event.id)) {
      seenIds.add(event.id);
      events.push(createRelayEventResult(event));
    }
  }

  let settled = false;
  let fallbackTimer: unknown;

  function settle(): void {
    if (settled) return;
    settled = true;
    clearTimeout(fallbackTimer);
    hooks.sendToNapplet(windowId, { type: 'relay.query.result', id, events } as NappletMessage);
  }

  // Shell-kind queries (kinds 29000-29999): buffer-only, no relay delegation
  if (isShellKindQuery(filters)) {
    settle();
    return;
  }

  const relayService = relayServiceFrom(context);
  const cacheService = !serviceRegistry['relay'] ? serviceRegistry['cache'] : undefined;

  if (relayService) {
    const svc = relayService;
    // Delegate to registered relay service via a synthesized relay.subscribe
    const subId = '__query__:' + id;
    const subscribeMsg: RuntimeRelayMessage = {
      type: 'relay.subscribe',
      id,
      subId,
      filters,
    };
    if (typeof m.relay === 'string' && m.relay.length > 0) {
      subscribeMsg.relay = m.relay;
    }

    let openBackends = cacheService ? 2 : 1;

    function onBackendEose(): void {
      openBackends--;
      if (openBackends <= 0) {
        // Tear down the delegated subscriptions
        const closeMsg = { type: 'relay.close', id, subId } as NappletMessage;
        svc.handleMessage(windowId, closeMsg, () => {});
        if (cacheService) {
          cacheService.handleMessage(windowId, closeMsg, () => {});
        }
        settle();
      }
    }

    function makeCollector(): (resp: NappletMessage) => void {
      return function collector(resp: NappletMessage): void {
        const r = resp as RuntimeRelayMessage;
        const result = r.type === 'relay.event' ? relayEventResultFromCarrier(r) : null;
        if (result && !seenIds.has(result.event.id)) {
          seenIds.add(result.event.id);
          events.push(result);
        } else if (r.type === 'relay.eose') {
          onBackendEose();
        }
      };
    }

    fallbackTimer = setTimeout(() => {
      const closeMsg = { type: 'relay.close', id, subId } as NappletMessage;
      svc.handleMessage(windowId, closeMsg, () => {});
      if (cacheService) {
        cacheService.handleMessage(windowId, closeMsg, () => {});
      }
      settle();
    }, 15_000);

    svc.handleMessage(windowId, subscribeMsg as NappletMessage, makeCollector());
    if (cacheService) {
      cacheService.handleMessage(windowId, subscribeMsg as NappletMessage, makeCollector());
    }
    return;
  }

  // No registered relay service — fall back to runtime hooks (cache + relay pool)
  const cache = hooks.cache;
  const pool = hooks.relayPool;

  if (cache?.isAvailable()) {
    cache.query(filters)
      .then((cachedEvents) => {
        for (const event of cachedEvents) {
          if (!seenIds.has(event.id)) {
            seenIds.add(event.id);
            events.push(createRelayEventResult(event));
          }
        }
      })
      .catch(() => {});
  }

  if (!pool?.isAvailable()) {
    settle();
    return;
  }

  const relayHint = typeof m.relay === 'string' && m.relay.length > 0 ? m.relay : undefined;
  const relayUrls = relayHint ? [relayHint] : pool.selectRelayTier(filters);

  let poolSubscription: { unsubscribe(): void } | undefined;

  fallbackTimer = setTimeout(() => {
    poolSubscription?.unsubscribe();
    settle();
  }, 15_000);

  poolSubscription = pool.subscribe(filters, (item) => {
    if (item === 'EOSE') {
      clearTimeout(fallbackTimer);
      poolSubscription?.unsubscribe();
      settle();
      return;
    }
    const event = item as NostrEvent;
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      events.push(createRelayEventResultWithHints(event, relayUrls));
    }
    if (cache?.isAvailable()) {
      try { cache.store(event); } catch { return; }
    }
  }, relayUrls);
}

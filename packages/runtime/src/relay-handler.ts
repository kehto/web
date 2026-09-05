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
import type { RuntimeAdapter, ServiceHandler, ServiceRegistry, Signer } from './types.js';

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
};

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
  const { eventBuffer, hooks, serviceRegistry, subscriptions } = context;
  const subId = m.subId ?? '';
  const filters = m.filters ?? [];
  if (!subId) return;

  const subKey = `${windowId}:${subId}`;
  subscriptions.set(subKey, { windowId, filters });

  const seenIds = new Set<string>();
  function deliver(event: NostrEvent, relayHints?: string[]): void {
    if (seenIds.has(event.id)) return;
    seenIds.add(event.id);
    if (subscriptions.has(subKey)) {
      sendRelayEvent(hooks, windowId, subId, createRelayEventResultWithHints(event, relayHints));
    }
  }

  for (const bufferedEvent of eventBuffer.getBufferedEvents()) {
    if (matchesAnyFilter(bufferedEvent, filters)) deliver(bufferedEvent);
  }

  const isShellKind = isShellKindQuery(filters);
  const relayService = relayServiceFrom(context);
  const cacheService = !serviceRegistry['relay'] ? serviceRegistry['cache'] : undefined;

  if (!isShellKind && relayService) {
    relayService.handleMessage(windowId, msg, (resp: NappletMessage) => {
      if (!subscriptions.has(subKey)) return;
      hooks.sendToNapplet(windowId, normalizeRelayServiceResponse(resp));
    });
    if (cacheService) {
      cacheService.handleMessage(windowId, msg, (resp: NappletMessage) => {
        if (!subscriptions.has(subKey)) return;
        hooks.sendToNapplet(windowId, normalizeRelayServiceResponse(resp));
      });
    }
    return;
  }

  const relayHint = typeof m.relay === 'string' && m.relay.length > 0 ? m.relay : undefined;
  deliverFromRuntimeBackends(context, windowId, subId, subKey, filters, isShellKind, deliver, relayHint);
}

function deliverFromRuntimeBackends(
  context: RelayHandlerContext,
  windowId: string,
  subId: string,
  subKey: string,
  filters: NostrFilter[],
  isShellKind: boolean,
  deliver: (event: NostrEvent, relayHints?: string[]) => void,
  relayHint?: string,
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
    hooks.sendToNapplet(windowId, { type: 'relay.eose', subId } as NappletMessage);
    return;
  }
  if (!pool?.isAvailable() || isShellKind) return;

  const relayUrls = relayHint ? [relayHint] : pool.selectRelayTier(filters);
  let eoseSent = false;
  const eoseFallbackTimer = setTimeout(() => {
    if (!eoseSent) {
      eoseSent = true;
      hooks.sendToNapplet(windowId, { type: 'relay.eose', subId } as NappletMessage);
    }
  }, 15_000);

  const subscription = pool.subscribe(filters, (item) => {
    if (item === 'EOSE') {
      clearTimeout(eoseFallbackTimer);
      if (!eoseSent) {
        eoseSent = true;
        hooks.sendToNapplet(windowId, { type: 'relay.eose', subId } as NappletMessage);
      }
      return;
    }
    const event = item as NostrEvent;
    deliver(event, relayUrls);
    if (cache?.isAvailable() && !isShellKind) {
      try { cache.store(event); } catch { return; }
    }
  }, relayUrls);

  pool.trackSubscription(subKey, () => {
    clearTimeout(eoseFallbackTimer);
    subscription.unsubscribe();
  });
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

  const signer = hooks.auth.getSigner(windowId);
  const signEvent = signer?.signEvent?.bind(signer);
  if (!signEvent) {
    sendRelayPublishResult(hooks, windowId, id, false, undefined, 'no signer configured');
    return;
  }

  void (async (): Promise<void> => {
    try {
      const signed = await signEvent(eventTemplate);
      if (!signed) {
        sendRelayPublishResult(hooks, windowId, id, false, undefined, 'signEvent returned no event');
        return;
      }
      const replayResult = replayDetector.reserve(signed);
      if (replayResult !== null) {
        sendRelayPublishResult(hooks, windowId, id, false, undefined, replayResult);
        return;
      }
      publishSignedRelayEvent(context, windowId, id, signed, (ok, error) => {
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
  })();
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
  reply: (ok: boolean, error?: string) => void,
): void {
  const { eventBuffer, hooks } = context;
  let settled = false;
  const settle = (ok: boolean, error?: string): void => {
    if (settled) return;
    settled = true;
    if (ok) {
      try { eventBuffer.bufferAndDeliver(signed, windowId); } catch { /* local delivery is best-effort */ }
    }
    reply(ok, error);
  };

  const relayService = relayServiceFrom(context);
  if (relayService) {
    const publishMessage = { type: 'relay.publish', id, event: signed } as NappletMessage;
    try {
      relayService.handleMessage(windowId, publishMessage, (response: NappletMessage) => {
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
    const publishResult = hooks.relayPool.publish(signed);
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
  (async (): Promise<void> => {
    try {
      const plaintext = String((eventTemplate as { content?: unknown }).content ?? '');
      const ciphertext: string = encryption === 'nip44'
        ? (await peSigner.nip44?.encrypt(recipient, plaintext)) ?? ''
        : (await peSigner.nip04?.encrypt(recipient, plaintext)) ?? '';
      const eventWithCiphertext = { ...eventTemplate, content: ciphertext };
      const signed = await peSigner.signEvent?.(eventWithCiphertext);
      if (!signed) { replyPe(false, { error: 'signEvent returned null' }); return; }

      publishSignedRelayEvent(context, windowId, id, signed, (ok, error) => {
        replyPe(ok, ok
          ? { event: signed, eventId: signed.id }
          : { error: error ?? 'publish failed' });
      });
    } catch (err) {
      replyPe(false, { error: (err as Error)?.message ?? 'encryption failed' });
    }
  })();
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

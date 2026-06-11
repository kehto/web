import { EventStore } from 'applesauce-core';
import { RelayPool } from 'applesauce-relay';
import type { NappletMessage, NostrEvent, NostrFilter, RelayPoolHooks, RelayPoolLike } from '@kehto/shell';
import type { ServiceHandler } from '@kehto/runtime';
import type { Nip66Aggregator } from '@kehto/nip66';
import {
  DEFAULT_PLAYGROUND_RELAY_SELECTION,
  collectMailboxPubkeys,
  createNip66RelayDirectory,
  filterEvents,
  matchesFilter,
  selectRelaysForFilters,
  selectRelaysForPublish,
  uniqueRelays,
  type PlaygroundRelaySelectionConfig,
} from './playground-relay-selection.js';
import type { PlaygroundRelayCache } from './playground-worker-relay.js';

interface PublishResponse {
  ok: boolean;
  message?: string;
  from: string;
}

interface ObservableLike<T> {
  subscribe(
    observer: ((item: T) => void) | {
      next?: (item: T) => void;
      error?: (error: unknown) => void;
      complete?: () => void;
    },
  ): { unsubscribe(): void };
}

interface PlaygroundRelayPool {
  subscription(relayUrls: string[], filters: NostrFilter[], options?: { id?: string }): ObservableLike<NostrEvent>;
  request(relayUrls: string[], filters: NostrFilter[], options?: { id?: string; timeout?: number }): ObservableLike<NostrEvent>;
  publish(relayUrls: string[], event: NostrEvent, options?: { timeout?: number }): Promise<PublishResponse[]> | PublishResponse[] | void;
}

export interface PlaygroundRelayRuntimeOptions {
  nip66Aggregator?: Nip66Aggregator | null;
  cache: PlaygroundRelayCache;
  relayPool?: PlaygroundRelayPool;
  selection?: Partial<PlaygroundRelaySelectionConfig>;
  eoseTimeoutMs?: number;
  requestTimeoutMs?: number;
  publishTimeoutMs?: number;
}

export interface PlaygroundRelayRuntime {
  relayService: ServiceHandler;
  relayPoolHooks: RelayPoolHooks;
  destroy(): void;
}

type RelayEnvelope = NappletMessage & {
  id?: string;
  subId?: string;
  filters?: NostrFilter[];
  event?: NostrEvent;
};

interface TrackedSubscription {
  closed: boolean;
  seen: Set<string>;
  events: NostrEvent[];
  timer: ReturnType<typeof setTimeout> | null;
  handle?: { unsubscribe(): void };
}

export function createPlaygroundRelayRuntime(options: PlaygroundRelayRuntimeOptions): PlaygroundRelayRuntime {
  const runtime = new PlaygroundRelayRuntimeImpl(options);
  return runtime.publicApi();
}

class PlaygroundRelayRuntimeImpl {
  private readonly cache: PlaygroundRelayCache;
  private readonly pool: PlaygroundRelayPool;
  private readonly eventStore = new EventStore({ verifyEvent: () => true });
  private readonly tracked = new Map<string, TrackedSubscription>();
  private readonly hookTracked = new Map<string, () => void>();
  private readonly config: PlaygroundRelaySelectionConfig;
  private readonly eoseTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly publishTimeoutMs: number;
  private readonly nip66Aggregator: Nip66Aggregator | null;

  constructor(options: PlaygroundRelayRuntimeOptions) {
    this.cache = options.cache;
    this.pool = options.relayPool ?? new RelayPool() as PlaygroundRelayPool;
    this.nip66Aggregator = options.nip66Aggregator ?? null;
    this.config = {
      ...DEFAULT_PLAYGROUND_RELAY_SELECTION,
      ...options.selection,
    };
    this.eoseTimeoutMs = options.eoseTimeoutMs ?? 1_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 1_200;
    this.publishTimeoutMs = options.publishTimeoutMs ?? 1_200;
  }

  publicApi(): PlaygroundRelayRuntime {
    return {
      relayService: this.createServiceHandler(),
      relayPoolHooks: this.createRelayPoolHooks(),
      destroy: () => this.destroy(),
    };
  }

  private createServiceHandler(): ServiceHandler {
    return {
      descriptor: {
        name: 'relay',
        version: '1.1.0',
        description: 'Playground Applesauce relay service with worker cache and outbox relay selection',
      },
      handleMessage: (windowId, message, send) => {
        if (message.type === 'relay.subscribe') {
          void this.handleSubscribe(windowId, message as RelayEnvelope, send);
          return;
        }
        if (message.type === 'relay.close') {
          this.handleClose(windowId, message as RelayEnvelope);
          return;
        }
        if (message.type === 'relay.publish') {
          void this.handlePublish(message as RelayEnvelope, send);
        }
      },
      onWindowDestroyed: (windowId) => this.closeWindow(windowId),
    };
  }

  private createRelayPoolHooks(): RelayPoolHooks {
    const relayPoolLike: RelayPoolLike = {
      subscription: (relayUrls, filters) => ({
        subscribe: (observer) => this.pool.subscription(relayUrls, filters as NostrFilter[]).subscribe(observer as (item: NostrEvent) => void),
      }),
      publish: (relayUrls, event) => {
        void Promise.resolve(this.pool.publish(relayUrls, event as NostrEvent, { timeout: this.publishTimeoutMs })).catch(() => null);
      },
      request: (relayUrls, filters) => ({
        subscribe: (observer) => this.pool.request(relayUrls, filters as NostrFilter[], { timeout: this.requestTimeoutMs }).subscribe(observer as {
          next: (event: unknown) => void;
          complete: () => void;
          error: () => void;
        }),
      }),
    };

    return {
      getRelayPool: () => relayPoolLike,
      trackSubscription: (subKey, cleanup) => {
        this.hookTracked.set(subKey, cleanup);
      },
      untrackSubscription: (subKey) => {
        this.hookTracked.get(subKey)?.();
        this.hookTracked.delete(subKey);
      },
      openScopedRelay: () => {},
      closeScopedRelay: () => {},
      publishToScopedRelay: () => false,
      selectRelayTier: (filters) => this.selectRelayTier(filters),
    };
  }

  private async handleSubscribe(
    windowId: string,
    message: RelayEnvelope,
    send: (msg: NappletMessage) => void,
  ): Promise<void> {
    const subId = message.subId;
    if (!subId) return;

    const filters = Array.isArray(message.filters) ? message.filters : [];
    const subKey = `${windowId}:${subId}`;
    this.closeSubscription(subKey);

    const tracked: TrackedSubscription = { closed: false, seen: new Set(), events: [], timer: null };
    this.tracked.set(subKey, tracked);
    const sendEose = () => {
      if (tracked.closed) return;
      if (tracked.timer) {
        clearTimeout(tracked.timer);
        tracked.timer = null;
      }
      send({ type: 'relay.eose', subId } as NappletMessage);
    };
    const deliver = (event: NostrEvent) => {
      if (tracked.closed || tracked.seen.has(event.id)) return;
      tracked.seen.add(event.id);
      tracked.events.push(event);
      try { this.eventStore.add(event); } catch { /* keep delivery best-effort */ }
      void this.cache.store(event).catch(() => {});
      send({ type: 'relay.event', subId, event } as NappletMessage);
    };

    try {
      const mailboxes = await this.resolveMailboxes(
        needsMailboxResolution(filters) ? collectMailboxPubkeys(filters) : [],
      );
      if (tracked.closed) return;

      for (const event of this.getStoreEvents(filters)) deliver(event);
      for (const event of await this.cache.query(filters)) deliver(event);
      if (tracked.closed) return;
      if (areFiniteLimitsSatisfied(filters, tracked.events)) {
        sendEose();
        return;
      }

      const relays = this.selectRelays(filters, mailboxes);
      if (relays.length === 0) {
        sendEose();
        return;
      }

      tracked.timer = setTimeout(sendEose, this.eoseTimeoutMs);
      const source = this.pool.subscription(relays, filters, { id: subId });
      tracked.handle = source.subscribe({
        next: deliver,
        error: () => sendEose(),
        complete: () => sendEose(),
      });
    } catch {
      sendEose();
    }
  }

  private handleClose(windowId: string, message: RelayEnvelope): void {
    const subId = message.subId;
    if (!subId) return;
    this.closeSubscription(`${windowId}:${subId}`);
  }

  private async handlePublish(message: RelayEnvelope, send: (msg: NappletMessage) => void): Promise<void> {
    const id = message.id ?? '';
    const event = message.event;
    if (!event) {
      send({ type: 'relay.publish.error', id, error: 'invalid event' } as NappletMessage);
      return;
    }

    let cached = false;
    try {
      this.eventStore.add(event);
      await this.cache.store(event);
      cached = true;
    } catch {
      cached = false;
    }

    const mailboxes = await this.resolveMailboxes(collectMailboxPubkeys([], event));
    const relays = this.selectPublishRelays(event, mailboxes);
    const responses = await this.publishToRelays(relays, event);
    const accepted = responses.some((response) => response.ok);
    const messageText = accepted
      ? undefined
      : responses.find((response) => response.message)?.message ?? 'publish failed';

    send({
      type: 'relay.publish.result',
      id,
      eventId: event.id,
      accepted,
      ok: accepted,
      cached,
      relays,
      message: messageText,
    } as NappletMessage);
  }

  private async resolveMailboxes(pubkeys: readonly string[]): Promise<Map<string, NostrEvent>> {
    const needed = [...new Set(pubkeys)].filter(Boolean);
    const result = new Map<string, NostrEvent>();
    if (needed.length === 0) return result;

    const absorb = (events: readonly NostrEvent[]) => {
      for (const event of events) {
        if (event.kind !== 10002 || !needed.includes(event.pubkey)) continue;
        result.set(event.pubkey, event);
        try { this.eventStore.add(event); } catch { /* cache data is still useful for relay selection */ }
        void this.cache.store(event).catch(() => {});
      }
    };

    absorb(this.getStoreEvents([{ kinds: [10002], authors: needed, limit: needed.length }]));
    const missingAfterStore = needed.filter((pubkey) => !result.has(pubkey));
    if (missingAfterStore.length === 0) return result;

    absorb(await this.cache.query([{ kinds: [10002], authors: missingAfterStore, limit: missingAfterStore.length }]));
    const missingAfterCache = needed.filter((pubkey) => !result.has(pubkey));
    if (missingAfterCache.length === 0) return result;

    const indexers = uniqueRelays([
      ...(this.nip66Aggregator?.getRelaysForAttributeGroup('Indexer', this.config.relayAttributeGroups) ?? []),
      ...this.config.indexerRelays,
    ]);
    if (indexers.length === 0) return result;

    const events = await this.requestRelays(indexers, [
      { kinds: [10002], authors: missingAfterCache, limit: missingAfterCache.length },
    ]);
    absorb(events);
    return result;
  }

  private selectRelayTier(filters: NostrFilter[]): string[] {
    return this.selectRelays(filters, new Map());
  }

  private selectRelays(filters: readonly NostrFilter[], mailboxes: ReadonlyMap<string, NostrEvent>): string[] {
    return selectRelaysForFilters(
      filters,
      createNip66RelayDirectory(this.nip66Aggregator, mailboxes, this.config.relayAttributeGroups),
      this.config,
    );
  }

  private selectPublishRelays(event: NostrEvent, mailboxes: ReadonlyMap<string, NostrEvent>): string[] {
    return selectRelaysForPublish(
      event,
      createNip66RelayDirectory(this.nip66Aggregator, mailboxes, this.config.relayAttributeGroups),
      this.config,
    );
  }

  private getStoreEvents(filters: readonly NostrFilter[]): NostrEvent[] {
    try {
      const events = this.eventStore.getByFilters(filters as Parameters<EventStore['getByFilters']>[0]) as NostrEvent[];
      return filterEvents(events, filters);
    } catch {
      return [];
    }
  }

  private async requestRelays(relays: string[], filters: NostrFilter[]): Promise<NostrEvent[]> {
    if (relays.length === 0) return [];
    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      let done = false;
      let handle: { unsubscribe(): void } | undefined;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { handle?.unsubscribe(); } catch { /* best-effort */ }
        resolve(events);
      };
      const timer = setTimeout(finish, this.requestTimeoutMs);
      try {
        handle = this.pool.request(relays, filters, { timeout: this.requestTimeoutMs }).subscribe({
          next: (event) => events.push(event),
          error: finish,
          complete: finish,
        });
      } catch {
        finish();
      }
    });
  }

  private async publishToRelays(relays: string[], event: NostrEvent): Promise<PublishResponse[]> {
    if (relays.length === 0) return [];
    try {
      const response = await Promise.race([
        Promise.resolve(this.pool.publish(relays, event, { timeout: this.publishTimeoutMs })),
        new Promise<PublishResponse[]>((resolve) => setTimeout(() => resolve([]), this.publishTimeoutMs)),
      ]);
      return Array.isArray(response) ? response as PublishResponse[] : [];
    } catch {
      return [];
    }
  }

  private closeWindow(windowId: string): void {
    for (const key of this.tracked.keys()) {
      if (key.startsWith(`${windowId}:`)) this.closeSubscription(key);
    }
  }

  private closeSubscription(subKey: string): void {
    const tracked = this.tracked.get(subKey);
    if (!tracked) return;
    tracked.closed = true;
    if (tracked.timer) clearTimeout(tracked.timer);
    try { tracked.handle?.unsubscribe(); } catch { /* best-effort */ }
    this.tracked.delete(subKey);
  }

  private destroy(): void {
    for (const subKey of this.tracked.keys()) this.closeSubscription(subKey);
    for (const cleanup of this.hookTracked.values()) cleanup();
    this.hookTracked.clear();
  }
}

function areFiniteLimitsSatisfied(filters: readonly NostrFilter[], events: readonly NostrEvent[]): boolean {
  if (filters.length === 0) return false;
  return filters.every((filter) => {
    if (typeof filter.limit !== 'number' || !Number.isFinite(filter.limit)) return false;
    return events.filter((event) => matchesFilter(event, filter)).length >= filter.limit;
  });
}

function needsMailboxResolution(filters: readonly NostrFilter[]): boolean {
  return filters.some((filter) => {
    if (!filter.kinds || filter.kinds.length === 0) return true;
    return filter.kinds.some((kind) => kind !== 10002 && kind !== 30166 && kind !== 10166);
  });
}

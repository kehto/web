import { EventStore } from 'applesauce-core';
import { RelayPool } from 'applesauce-relay';
import type { NappletMessage, NostrEvent, NostrFilter, RelayPoolHooks, RelayPoolLike } from '@kehto/shell';
import { createRelayEventResultWithHints, type ServiceHandler } from '@kehto/runtime';
import type { Nip66Aggregator } from '@kehto/nip/66';
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

export interface PlaygroundRelayActivityEntry {
  url: string;
  lastAccessedAt: number;
  accessCount: number;
  subscriptionCount: number;
  requestCount: number;
  publishCount: number;
  eventsReceived: number;
}

interface PlaygroundRelayActivityRecord extends PlaygroundRelayActivityEntry {
  lastAccessSequence: number;
}

export interface PlaygroundRelayRuntime {
  relayService: ServiceHandler;
  relayPoolHooks: RelayPoolHooks;
  getRelayActivity(limit?: number): PlaygroundRelayActivityEntry[];
  destroy(): void;
}

type RelayEnvelope = NappletMessage & {
  id?: string;
  subId?: string;
  filters?: NostrFilter[];
  event?: NostrEvent;
  relay?: string;
};

type PlaygroundRelayFilter = NostrFilter & {
  relayCache?: unknown;
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
  private readonly relayActivity = new Map<string, PlaygroundRelayActivityRecord>();
  private relayActivitySequence = 0;

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
      getRelayActivity: (limit) => this.getRelayActivity(limit),
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
        subscribe: (observer) => {
          this.recordRelayAccess(relayUrls, 'subscription');
          return this.pool.subscription(relayUrls, filters as NostrFilter[]).subscribe((item: NostrEvent) => {
            this.recordRelayEvents(relayUrls, 1);
            observer(item);
          });
        },
      }),
      publish: (relayUrls, event) => {
        this.recordRelayAccess(relayUrls, 'publish');
        void Promise.resolve(this.pool.publish(relayUrls, event as NostrEvent, { timeout: this.publishTimeoutMs })).catch(() => null);
      },
      request: (relayUrls, filters) => ({
        subscribe: (observer) => {
          this.recordRelayAccess(relayUrls, 'request');
          return this.pool.request(relayUrls, filters as NostrFilter[], { timeout: this.requestTimeoutMs }).subscribe({
            next: (event: unknown) => {
              this.recordRelayEvents(relayUrls, 1);
              observer.next?.(event);
            },
            complete: () => observer.complete?.(),
            error: () => observer.error?.(),
          });
        },
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

    const rawFilters = Array.isArray(message.filters) ? message.filters : [];
    const skipCache = shouldSkipRelayCache(rawFilters);
    const filters = stripPlaygroundRelayFilterOptions(rawFilters);
    const relayHint = typeof message.relay === 'string' && message.relay.length > 0
      ? message.relay
      : undefined;
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
    const deliver = (event: NostrEvent, relayHints?: string[]) => {
      if (tracked.closed || tracked.seen.has(event.id)) return;
      tracked.seen.add(event.id);
      tracked.events.push(event);
      try { this.eventStore.add(event); } catch { /* keep delivery best-effort */ }
      if (!skipCache) void this.cache.store(event).catch(() => {});
      send({ type: 'relay.event', subId, result: createRelayEventResultWithHints(event, relayHints) } as NappletMessage);
    };

    try {
      const mailboxes = relayHint
        ? new Map<string, NostrEvent>()
        : await this.resolveMailboxes(
          needsMailboxResolution(filters) ? collectMailboxPubkeys(filters) : [],
          skipCache,
        );
      if (tracked.closed) return;

      for (const event of this.getStoreEvents(filters)) deliver(event);
      if (!skipCache) {
        for (const event of await this.cache.query(filters)) deliver(event);
      }
      if (tracked.closed) return;
      if (areFiniteLimitsSatisfied(filters, tracked.events)) {
        sendEose();
        return;
      }

      const relays = relayHint ? [relayHint] : this.selectRelays(filters, mailboxes);
      if (relays.length === 0) {
        sendEose();
        return;
      }

      this.recordRelayAccess(relays, 'subscription');
      tracked.timer = setTimeout(sendEose, this.eoseTimeoutMs);
      const source = this.pool.subscription(relays, filters, { id: subId });
      tracked.handle = source.subscribe({
        next: (event) => {
          this.recordRelayEvents(relays, 1);
          deliver(event, relays);
        },
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

  private async resolveMailboxes(
    pubkeys: readonly string[],
    skipCache = false,
  ): Promise<Map<string, NostrEvent>> {
    const needed = [...new Set(pubkeys)].filter(Boolean);
    const result = new Map<string, NostrEvent>();
    if (needed.length === 0) return result;

    const absorb = (events: readonly NostrEvent[]) => {
      for (const event of events) {
        if (event.kind !== 10002 || !needed.includes(event.pubkey)) continue;
        result.set(event.pubkey, event);
        try { this.eventStore.add(event); } catch { /* cache data is still useful for relay selection */ }
        if (!skipCache) void this.cache.store(event).catch(() => {});
      }
    };

    absorb(this.getStoreEvents([{ kinds: [10002], authors: needed, limit: needed.length }]));
    const missingAfterStore = needed.filter((pubkey) => !result.has(pubkey));
    if (missingAfterStore.length === 0) return result;

    let missingAfterCache = missingAfterStore;
    if (!skipCache) {
      absorb(await this.cache.query([{ kinds: [10002], authors: missingAfterStore, limit: missingAfterStore.length }]));
      missingAfterCache = needed.filter((pubkey) => !result.has(pubkey));
      if (missingAfterCache.length === 0) return result;
    }

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
    this.recordRelayAccess(relays, 'request');
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
          next: (event) => {
            events.push(event);
            this.recordRelayEvents(relays, 1);
          },
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
    this.recordRelayAccess(relays, 'publish');
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

  private getRelayActivity(limit = 5): PlaygroundRelayActivityEntry[] {
    return [...this.relayActivity.values()]
      .sort((a, b) => b.lastAccessSequence - a.lastAccessSequence || b.lastAccessedAt - a.lastAccessedAt)
      .slice(0, limit)
      .map(({ lastAccessSequence: _lastAccessSequence, ...entry }) => ({ ...entry }));
  }

  private recordRelayAccess(
    relayUrls: readonly string[],
    type: 'subscription' | 'request' | 'publish',
  ): void {
    const now = Date.now();
    for (const url of uniqueRelays([...relayUrls])) {
      const entry = this.getOrCreateRelayActivity(url);
      entry.lastAccessedAt = now;
      entry.lastAccessSequence = ++this.relayActivitySequence;
      entry.accessCount += 1;
      if (type === 'subscription') entry.subscriptionCount += 1;
      if (type === 'request') entry.requestCount += 1;
      if (type === 'publish') entry.publishCount += 1;
    }
  }

  private recordRelayEvents(relayUrls: readonly string[], count: number): void {
    if (count <= 0) return;
    const now = Date.now();
    for (const url of uniqueRelays([...relayUrls])) {
      const entry = this.getOrCreateRelayActivity(url);
      entry.lastAccessedAt = now;
      entry.lastAccessSequence = ++this.relayActivitySequence;
      entry.eventsReceived += count;
    }
  }

  private getOrCreateRelayActivity(url: string): PlaygroundRelayActivityRecord {
    let entry = this.relayActivity.get(url);
    if (!entry) {
      entry = {
        url,
        lastAccessedAt: 0,
        lastAccessSequence: 0,
        accessCount: 0,
        subscriptionCount: 0,
        requestCount: 0,
        publishCount: 0,
        eventsReceived: 0,
      };
      this.relayActivity.set(url, entry);
    }
    return entry;
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

function shouldSkipRelayCache(filters: readonly NostrFilter[]): boolean {
  return filters.some((filter) => (filter as PlaygroundRelayFilter).relayCache === 'skip');
}

function stripPlaygroundRelayFilterOptions(filters: readonly NostrFilter[]): NostrFilter[] {
  return filters.map((filter) => {
    const { relayCache: _relayCache, ...clean } = filter as PlaygroundRelayFilter;
    return clean;
  });
}

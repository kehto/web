import { EventStore } from 'applesauce-core';
import { createAddressLoader } from 'applesauce-loaders/loaders';
import { RelayGroup, RelayLiveness, RelayPool } from 'applesauce-relay';
import { Observable, lastValueFrom, merge, takeUntil, timer, toArray } from 'rxjs';
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
  error?: unknown;
}

interface PlaygroundRelayRequestOptions {
  id?: string;
  timeout?: number;
  firstResponseTimeout?: number | false;
  complete?: ReturnType<typeof RelayGroup.completeAfterFirstRelay>;
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
  request(relayUrls: string[], filters: NostrFilter[], options?: PlaygroundRelayRequestOptions): ObservableLike<NostrEvent>;
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
  private readonly ownedPool: RelayPool | null;
  private readonly ownedLiveness: RelayLiveness | null;
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
  private destroyed = false;

  constructor(options: PlaygroundRelayRuntimeOptions) {
    this.cache = options.cache;
    if (options.relayPool) {
      this.pool = options.relayPool;
      this.ownedPool = null;
      this.ownedLiveness = null;
    } else {
      // In-memory liveness only: the playground is ephemeral, so no storage is passed.
      this.ownedLiveness = new RelayLiveness();
      this.ownedPool = new RelayPool({ liveness: this.ownedLiveness });
      this.pool = this.ownedPool as PlaygroundRelayPool;
    }
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
      publish: async (relayUrls, event) => {
        this.recordRelayAccess(relayUrls, 'publish');
        const responses = await Promise.resolve(
          this.pool.publish(relayUrls, event as NostrEvent, { timeout: this.publishTimeoutMs }),
        );
        if (Array.isArray(responses) && !responses.some((response) => response.ok)) {
          throw new Error(publishFailureText(responses));
        }
      },
      request: (relayUrls, filters) => ({
        subscribe: (observer) => {
          this.recordRelayAccess(relayUrls, 'request');
          return this.pool.request(relayUrls, filters as NostrFilter[], this.requestOptions()).subscribe({
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
        // v7 subscriptions never emit EOSE (hence the local timer) and error with
        // RelayGroupError once every relay fails; that is reported as relay.eose.
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
      send({
        type: 'relay.publish.result',
        id,
        ok: false,
        error: 'invalid event',
      } as NappletMessage);
      return;
    }

    const mailboxes = await this.resolveMailboxes(collectMailboxPubkeys([], event));
    const relays = this.selectPublishRelays(event, mailboxes);
    const responses = await this.publishToRelays(relays, event);
    const ok = responses.some((response) => response.ok);
    if (!ok) {
      const error = publishFailureText(responses);
      send({ type: 'relay.publish.result', id, ok: false, error } as NappletMessage);
      return;
    }

    try { this.eventStore.add(event); } catch { /* remote publish already succeeded */ }
    try { await this.cache.store(event); } catch { /* local cache is best-effort */ }
    send({
      type: 'relay.publish.result',
      id,
      ok: true,
      event,
      eventId: event.id,
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

    // No cacheRequest is given to the loader: worker-cache reads/writes stay behind !skipCache.
    const loader = createAddressLoader(
      (relays, filters) => this.requestEvents(relays, filters as NostrFilter[]),
      { eventStore: this.eventStore, lookupRelays: indexers, bufferTime: 0 },
    );
    try {
      const events = await lastValueFrom(
        merge(...missingAfterCache.map((pubkey) => loader({ kind: 10002, pubkey }))).pipe(
          takeUntil(timer(this.requestTimeoutMs)),
          toArray(),
        ),
      );
      absorb(events as NostrEvent[]);
    } catch {
      // Best-effort: relay selection falls back to defaults when lookups fail.
    } finally {
      loader.stop();
    }
    return result;
  }

  private requestOptions(): PlaygroundRelayRequestOptions {
    return {
      timeout: this.requestTimeoutMs,
      firstResponseTimeout: this.requestTimeoutMs,
      complete: RelayGroup.completeAfterFirstRelay(this.requestTimeoutMs),
    };
  }

  /** Adapts the (possibly injected) pool to an rxjs Observable while recording relay activity. */
  private requestEvents(relays: string[], filters: NostrFilter[]): Observable<NostrEvent> {
    return new Observable<NostrEvent>((subscriber) => {
      this.recordRelayAccess(relays, 'request');
      try {
        const handle = this.pool.request(relays, filters, this.requestOptions()).subscribe({
          next: (event) => {
            this.recordRelayEvents(relays, 1);
            subscriber.next(event);
          },
          error: (error?: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
        return () => {
          try { handle.unsubscribe(); } catch { /* best-effort */ }
        };
      } catch (error) {
        subscriber.error(error);
        return undefined;
      }
    });
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

  private async publishToRelays(relays: string[], event: NostrEvent): Promise<PublishResponse[]> {
    if (relays.length === 0) return [];
    this.recordRelayAccess(relays, 'publish');
    try {
      // v7 converts each relay timeout into an { ok: false } response, so no outer race is needed.
      const response = await Promise.resolve(this.pool.publish(relays, event, { timeout: this.publishTimeoutMs }));
      return Array.isArray(response) ? response : [];
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
    if (this.destroyed) return;
    this.destroyed = true;
    for (const subKey of this.tracked.keys()) this.closeSubscription(subKey);
    for (const cleanup of this.hookTracked.values()) cleanup();
    this.hookTracked.clear();
    // Only resources created here are released; an injected pool belongs to the caller.
    this.ownedPool?.close();
    this.ownedLiveness?.destroy();
    this.eventStore.dispose();
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

function publishFailureText(responses: readonly PublishResponse[]): string {
  const message = responses.find((response) => typeof response.message === 'string' && response.message.length > 0)?.message;
  if (message) return message;
  for (const response of responses) {
    const { error } = response;
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.length > 0) return error;
  }
  return 'publish failed';
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

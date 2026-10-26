import { EventStore } from 'applesauce-core';
import { RelayLiveness, RelayPool } from 'applesauce-relay';
import { Observable } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent, NostrFilter } from '@kehto/shell';
import type { Nip66Aggregator } from '@kehto/nip/66';
import {
  createPlaygroundRelayRuntime,
  type PlaygroundRelayRuntimeOptions,
} from '../../apps/playground/src/playground-relay-service.js';
import {
  filterEvents,
  type PlaygroundRelaySelectionConfig,
} from '../../apps/playground/src/playground-relay-selection.js';
import type { PlaygroundRelayCache } from '../../apps/playground/src/playground-worker-relay.js';

const SELECTION: PlaygroundRelaySelectionConfig = {
  defaultRelays: [],
  indexerRelays: ['wss://fallback.indexer'],
  relayIndexerRelays: ['wss://fallback.relay-indexer'],
  maxConnections: 4,
  maxRelaysPerAuthor: 2,
};

interface FakePoolLog {
  requests: Array<{ relays: string[]; filters: NostrFilter[] }>;
  requestOptions: unknown[];
  subscriptions: Array<{ relays: string[]; filters: NostrFilter[] }>;
  publishes: Array<{ relays: string[]; event: NostrEvent }>;
  order: Array<'request' | 'subscription'>;
}

function event(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: '0'.repeat(64),
    pubkey: 'author',
    created_at: 1_700_000_000,
    kind: 1,
    tags: [],
    content: '',
    sig: '0'.repeat(128),
    ...partial,
  };
}

function mailbox(pubkey: string, relays: Array<[string, 'read' | 'write' | undefined]>): NostrEvent {
  return event({
    id: `${pubkey.slice(0, 1) || 'm'}`.repeat(64),
    pubkey,
    kind: 10002,
    tags: relays.map(([relay, mode]) => mode ? ['r', relay, mode] : ['r', relay]),
  });
}

function createCache(seed: readonly NostrEvent[] = []): PlaygroundRelayCache & { stored: NostrEvent[] } {
  const events = new Map(seed.map((item) => [item.id, item]));
  const stored: NostrEvent[] = [];
  return {
    stored,
    async query(filters) {
      return filterEvents([...events.values()], filters);
    },
    async store(item) {
      stored.push(item);
      events.set(item.id, item);
    },
    isAvailable: () => true,
  };
}

function createAggregator(groups: Record<string, string[]>): Nip66Aggregator {
  return {
    start: () => {},
    resync: () => {},
    stop: () => {},
    getRelaySet: () => new Set(Object.values(groups).flat()),
    getRelaysSupportingNip: () => [],
    relaySupportsNip: () => false,
    getRelayAttributes: () => undefined,
    getRelaysMatchingAttributes: () => [],
    getRelaysForAttributeGroup: (name: string) => groups[name] ?? [],
  };
}

function createPool(options: {
  requestEvents?: readonly NostrEvent[];
  subscriptionEvents?: readonly NostrEvent[];
  publishResponses?: Array<{ ok: boolean; message?: string; from: string; error?: unknown }>;
  onSubscriptionTeardown?: () => void;
  close?: () => void;
} = {}) {
  const log: FakePoolLog = { requests: [], requestOptions: [], subscriptions: [], publishes: [], order: [] };
  const pool = {
    log,
    close: options.close ?? (() => {}),
    subscription(relays: string[], filters: NostrFilter[]) {
      log.subscriptions.push({ relays, filters });
      log.order.push('subscription');
      return new Observable<NostrEvent>((subscriber) => {
        queueMicrotask(() => {
          for (const item of options.subscriptionEvents ?? []) subscriber.next(item);
        });
        return () => options.onSubscriptionTeardown?.();
      });
    },
    request(relays: string[], filters: NostrFilter[], requestOptions?: unknown) {
      log.requests.push({ relays, filters });
      log.requestOptions.push(requestOptions);
      log.order.push('request');
      return new Observable<NostrEvent>((subscriber) => {
        queueMicrotask(() => {
          for (const item of options.requestEvents ?? []) subscriber.next(item);
          subscriber.complete();
        });
      });
    },
    publish(relays: string[], item: NostrEvent) {
      log.publishes.push({ relays, event: item });
      return Promise.resolve(options.publishResponses ?? [{ ok: true, from: relays[0] ?? 'local' }]);
    },
  };
  return pool;
}

function createRuntime(overrides: Partial<PlaygroundRelayRuntimeOptions> = {}) {
  const cache = overrides.cache ?? createCache();
  const pool = overrides.relayPool ?? createPool();
  return createPlaygroundRelayRuntime({
    cache,
    relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'],
    nip66Aggregator: createAggregator({
      Indexer: ['wss://nip66.indexer'],
      RelayIndexer: ['wss://nip66.relay-indexer'],
    }),
    selection: SELECTION,
    requestTimeoutMs: 25,
    eoseTimeoutMs: 25,
    publishTimeoutMs: 25,
    ...overrides,
  });
}

async function waitFor(assertion: () => void | boolean): Promise<void> {
  const deadline = Date.now() + 500;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = assertion();
      if (result !== false) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  if (lastError) throw lastError;
  throw new Error('condition not satisfied');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('playground relay service', () => {
  it('resolves missing NIP-65 mailboxes through Indexer relays before author subscriptions', async () => {
    const pool = createPool({
      requestEvents: [
        mailbox('alice', [
          ['wss://alice.write', 'write'],
          ['wss://alice.read', 'read'],
        ]),
      ],
    });
    const runtime = createRuntime({ relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.subscribe', subId: 'sub-a', filters: [{ kinds: [1], authors: ['alice'] }] } as NappletMessage,
      () => {},
    );

    await waitFor(() => {
      expect(pool.log.requests).toHaveLength(1);
      expect(pool.log.subscriptions).toHaveLength(1);
    });
    expect(pool.log.requests[0]).toEqual({
      relays: ['wss://nip66.indexer', 'wss://fallback.indexer'],
      // The applesauce v7 address loader builds replaceable-pointer filters without a limit.
      filters: [{ kinds: [10002], authors: ['alice'] }],
    });
    expect(pool.log.order).toEqual(['request', 'subscription']);
    expect(pool.log.subscriptions[0]?.relays).toContain('wss://alice.write');
    expect(pool.log.subscriptions[0]?.relays).not.toContain('wss://alice.read');
  });

  it('routes NIP-65 bootstrap subscriptions directly to Indexer relays', async () => {
    const pool = createPool();
    const runtime = createRuntime({ relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.subscribe', subId: 'sub-a', filters: [{ kinds: [10002], authors: ['alice'] }] } as NappletMessage,
      () => {},
    );

    await waitFor(() => expect(pool.log.subscriptions).toHaveLength(1));
    expect(pool.log.requests).toHaveLength(0);
    expect(pool.log.subscriptions[0]?.relays).toEqual(['wss://nip66.indexer', 'wss://fallback.indexer']);
  });

  it('routes NIP-66 subscriptions directly to RelayIndexer relays', async () => {
    const pool = createPool();
    const runtime = createRuntime({ relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.subscribe', subId: 'sub-a', filters: [{ kinds: [30166] }] } as NappletMessage,
      () => {},
    );

    await waitFor(() => expect(pool.log.subscriptions).toHaveLength(1));
    expect(pool.log.subscriptions[0]?.relays).toEqual([
      'wss://nip66.relay-indexer',
      'wss://fallback.relay-indexer',
    ]);
  });

  it('honors canonical relay.subscribe relay hint without relay selection fallback', async () => {
    const pool = createPool();
    const runtime = createRuntime({ relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      {
        type: 'relay.subscribe',
        id: 'relay-hint',
        subId: 'sub-relay-hint',
        filters: [{ kinds: [1], authors: ['alice'] }],
        relay: 'wss://explicit.test',
      } as NappletMessage,
      () => {},
    );

    await waitFor(() => expect(pool.log.subscriptions).toHaveLength(1));
    expect(pool.log.requests).toHaveLength(0);
    expect(pool.log.subscriptions[0]?.relays).toEqual(['wss://explicit.test']);
  });

  it('tracks relay activity ordered by latest access', async () => {
    const pool = createPool({
      requestEvents: [
        mailbox('alice', [
          ['wss://alice.write', 'write'],
          ['wss://alice.read', 'read'],
        ]),
      ],
      subscriptionEvents: [event({ id: '4'.repeat(64), pubkey: 'alice' })],
    });
    const runtime = createRuntime({ relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.subscribe', subId: 'sub-a', filters: [{ kinds: [1], authors: ['alice'] }] } as NappletMessage,
      () => {},
    );

    await waitFor(() => {
      const activity = runtime.getRelayActivity(5);
      expect(activity.some((entry) => entry.url === 'wss://alice.write')).toBe(true);
      expect(activity.some((entry) => entry.eventsReceived > 0)).toBe(true);
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    runtime.relayService.handleMessage(
      'window-a',
      {
        type: 'relay.publish',
        id: 'publish-activity',
        event: event({ id: '5'.repeat(64), pubkey: 'charlie', tags: [['p', 'bob', 'wss://hint.relay']] }),
      } as NappletMessage,
      () => {},
    );
    await waitFor(() => expect(pool.log.publishes).toHaveLength(1));

    const activity = runtime.getRelayActivity(5);
    expect(activity).toHaveLength(4);
    expect(activity[0]).toMatchObject({
      url: 'wss://hint.relay',
      publishCount: 1,
    });
    expect(activity.find((entry) => entry.url === 'wss://alice.write')).toMatchObject({
      subscriptionCount: 1,
      eventsReceived: 1,
    });
    expect(activity.find((entry) => entry.url === 'wss://nip66.indexer')).toMatchObject({
      requestCount: 2,
      eventsReceived: 2,
    });
  });

  it('does not open live subscriptions when cache satisfies every finite filter limit', async () => {
    const cached = event({ id: '1'.repeat(64), kind: 1 });
    const cache = createCache([cached]);
    const pool = createPool();
    const sends: NappletMessage[] = [];
    const runtime = createRuntime({ cache, relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.subscribe', subId: 'sub-a', filters: [{ kinds: [1], limit: 1 }] } as NappletMessage,
      (message) => sends.push(message),
    );

    await waitFor(() => expect(sends.some((message) => message.type === 'relay.eose')).toBe(true));
    expect(pool.log.subscriptions).toHaveLength(0);
    expect(sends.find((message) => message.type === 'relay.event')).toMatchObject({
      type: 'relay.event',
      result: { event: cached },
    });
  });

  it('strips relayCache skip hints and bypasses cache reads plus cache writes', async () => {
    const cached = mailbox('alice', [['wss://cached.example', 'read']]);
    const live = mailbox('alice', [['wss://live.example', 'read']]);
    const cache = createCache([cached]);
    const pool = createPool({ subscriptionEvents: [live] });
    const sends: NappletMessage[] = [];
    const runtime = createRuntime({ cache, relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      {
        type: 'relay.subscribe',
        subId: 'sub-a',
        filters: [{ kinds: [10002], authors: ['alice'], limit: 1, relayCache: 'skip' } as NostrFilter],
      } as NappletMessage,
      (message) => sends.push(message),
    );

    await waitFor(() => expect(pool.log.subscriptions).toHaveLength(1));
    await waitFor(() => expect(sends.some((message) => message.type === 'relay.event')).toBe(true));

    expect(pool.log.subscriptions[0]?.filters).toEqual([{ kinds: [10002], authors: ['alice'], limit: 1 }]);
    expect(sends.find((message) => message.type === 'relay.event')).toMatchObject({
      type: 'relay.event',
      result: { event: live, sidecar: { relayHints: ['wss://nip66.indexer', 'wss://fallback.indexer'] } },
    });
    expect(sends.find((message) => message.type === 'relay.event')).not.toMatchObject({ result: { event: cached } });
    expect(cache.stored).toHaveLength(0);
  });

  it('publishes to relay hints, author outboxes, and recipient inboxes, then reports relay acknowledgement', async () => {
    const cache = createCache([
      mailbox('alice', [['wss://alice.write', 'write']]),
      mailbox('bob', [['wss://bob.inbox', 'read']]),
    ]);
    const pool = createPool({ publishResponses: [{ ok: true, from: 'wss://alice.write' }] });
    const sends: NappletMessage[] = [];
    const note = event({
      id: '2'.repeat(64),
      pubkey: 'alice',
      tags: [['p', 'bob', 'wss://hint.relay']],
    });
    const runtime = createRuntime({ cache, relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.publish', id: 'publish-a', event: note } as NappletMessage,
      (message) => sends.push(message),
    );

    await waitFor(() => expect(sends).toHaveLength(1));
    expect(pool.log.publishes[0]?.relays).toEqual(['wss://hint.relay', 'wss://alice.write', 'wss://bob.inbox']);
    expect(sends[0]).toEqual({
      type: 'relay.publish.result',
      id: 'publish-a',
      ok: true,
      event: note,
      eventId: note.id,
    });
    expect(cache.stored).toContain(note);
    expect(sends[0]).not.toHaveProperty('accepted');
    expect(sends[0]).not.toHaveProperty('message');
  });

  it('returns a canonical failure and does not cache when every relay rejects', async () => {
    const cache = createCache([mailbox('alice', [['wss://alice.write', 'write']])]);
    const pool = createPool({ publishResponses: [{ ok: false, from: 'wss://alice.write', message: 'blocked' }] });
    const sends: NappletMessage[] = [];
    const note = event({ id: '3'.repeat(64), pubkey: 'alice' });
    const runtime = createRuntime({ cache, relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.publish', id: 'publish-b', event: note } as NappletMessage,
      (message) => sends.push(message),
    );

    await waitFor(() => expect(sends).toHaveLength(1));
    expect(sends[0]).toEqual({
      type: 'relay.publish.result',
      id: 'publish-b',
      ok: false,
      error: 'blocked',
    });
    expect(cache.stored).not.toContain(note);
    expect(sends[0]).not.toHaveProperty('event');
    expect(sends[0]).not.toHaveProperty('eventId');
    expect(sends[0]).not.toHaveProperty('accepted');
    expect(sends[0]).not.toHaveProperty('message');
  });

  it('passes v7 request options to every pool.request', async () => {
    const pool = createPool({ requestEvents: [mailbox('alice', [['wss://alice.write', 'write']])] });
    const runtime = createRuntime({ relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.subscribe', subId: 'sub-a', filters: [{ kinds: [1], authors: ['alice'] }] } as NappletMessage,
      () => {},
    );

    await waitFor(() => expect(pool.log.requestOptions).toHaveLength(1));
    expect(pool.log.requestOptions[0]).toMatchObject({
      timeout: 25,
      firstResponseTimeout: 25,
      complete: expect.any(Function),
    });
  });

  it('reports the relay error text when every relay rejects without a message', async () => {
    const cache = createCache([mailbox('alice', [['wss://alice.write', 'write']])]);
    const pool = createPool({
      publishResponses: [{ ok: false, from: 'wss://alice.write', error: new Error('rate-limited') }],
    });
    const sends: NappletMessage[] = [];
    const runtime = createRuntime({ cache, relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      { type: 'relay.publish', id: 'publish-c', event: event({ id: '6'.repeat(64), pubkey: 'alice' }) } as NappletMessage,
      (message) => sends.push(message),
    );

    await waitFor(() => expect(sends).toHaveLength(1));
    expect(sends[0]).toEqual({
      type: 'relay.publish.result',
      id: 'publish-c',
      ok: false,
      error: 'rate-limited',
    });
    for (const key of ['message', 'accepted', 'event', 'eventId']) {
      expect(sends[0]).not.toHaveProperty(key);
    }
  });

  it('destroy() unsubscribes and leaves an injected pool open', async () => {
    const teardown = vi.fn();
    const close = vi.fn();
    const pool = createPool({ onSubscriptionTeardown: teardown, close });
    const runtime = createRuntime({ relayPool: pool as PlaygroundRelayRuntimeOptions['relayPool'] });

    runtime.relayService.handleMessage(
      'window-a',
      {
        type: 'relay.subscribe',
        subId: 'sub-a',
        filters: [{ kinds: [1] }],
        relay: 'wss://explicit.test',
      } as NappletMessage,
      () => {},
    );
    await waitFor(() => expect(pool.log.subscriptions).toHaveLength(1));

    runtime.destroy();
    expect(() => runtime.destroy()).not.toThrow();

    expect(teardown).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('destroy() closes the owned pool, liveness and store exactly once', () => {
    const closePool = vi.spyOn(RelayPool.prototype, 'close');
    const destroyLiveness = vi.spyOn(RelayLiveness.prototype, 'destroy');
    const disposeStore = vi.spyOn(EventStore.prototype, 'dispose');
    const runtime = createPlaygroundRelayRuntime({ cache: createCache(), selection: SELECTION });

    runtime.destroy();
    runtime.destroy();

    expect(closePool).toHaveBeenCalledTimes(1);
    expect(destroyLiveness).toHaveBeenCalledTimes(1);
    expect(disposeStore).toHaveBeenCalledTimes(1);
  });
});

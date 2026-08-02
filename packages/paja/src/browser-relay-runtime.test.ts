import type { NappletMessage, NostrEvent } from '@napplet/core';
import { createRelayPoolService } from '@kehto/services';
import { buildShellCapabilities } from '@kehto/shell';
import type { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { describe, expect, it, vi } from 'vitest';

const livePool = vi.hoisted(() => ({
  close: undefined as ReturnType<typeof vi.fn> | undefined,
  closeRejects: false,
  delivered: 0,
  events: [] as unknown[],
  querySyncEvents: [] as unknown[],
  querySyncRequests: [] as Array<{ relayUrls: string[]; filter: Record<string, unknown> }>,
  requests: [] as Array<{ relayUrls: string[]; filter: Record<string, unknown> }>,
  countRequests: [] as Array<{ relayUrl: string; filters: Record<string, unknown>[] }>,
  countValues: new Map<string, number>(),
  countFailures: new Set<string>(),
  publishRequests: [] as Array<{ relayUrls: string[]; event: unknown }>,
  subscribeMapRequests: [] as Array<Array<{ url: string; filter: Record<string, unknown> }>>,
  subscriptionClose: undefined as ReturnType<typeof vi.fn> | undefined,
  seenOn: new Map<string, Set<{ url: string }>>(),
}));

vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    trackRelays = false;
    seenOn = livePool.seenOn;

    subscribeEose(
      relayUrls: string[],
      filter: Record<string, unknown>,
      params: { onevent(event: unknown): void; onclose(): void },
    ) {
      let closed = false;
      const close = vi.fn(async () => {
        closed = true;
        if (livePool.closeRejects) throw new Error('close rejected');
        params.onclose();
      });
      livePool.close = close;
      livePool.requests.push({ relayUrls, filter });
      queueMicrotask(() => {
        for (const event of livePool.events) {
          if (closed) break;
          livePool.delivered += 1;
          params.onevent(event);
        }
      });
      return { close };
    }

    querySync(relayUrls: string[], filter: Record<string, unknown>) {
      livePool.querySyncRequests.push({ relayUrls, filter });
      return Promise.resolve(livePool.querySyncEvents);
    }

    async ensureRelay(relayUrl: string) {
      if (livePool.countFailures.has(relayUrl)) throw new Error('count refused');
      return {
        count: async (filters: Record<string, unknown>[]) => {
          livePool.countRequests.push({ relayUrl, filters });
          return livePool.countValues.get(relayUrl) ?? 0;
        },
      };
    }

    publish(relayUrls: string[], event: unknown) {
      livePool.publishRequests.push({ relayUrls, event });
      return relayUrls.map(() => Promise.resolve('accepted'));
    }

    subscribeMap(
      requests: Array<{ url: string; filter: Record<string, unknown> }>,
      params: { oneose(): void },
    ) {
      livePool.subscribeMapRequests.push(requests);
      const close = vi.fn();
      livePool.subscriptionClose = close;
      queueMicrotask(() => params.oneose());
      return { close };
    }

    destroy() {}
  },
}));

import {
  PAJA_CONTACT_LIST_CANDIDATE_LIMIT,
  createPajaContactListLoader,
  createPajaRelayBackend,
  getPajaRelayUrls,
  type PajaRelayBackend,
} from './browser-relay-runtime.js';
import { createPajaAdapter } from './browser-adapter.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';

const TEST_RELAYS = ['wss://relay-one.example', 'wss://relay-two.example'];

function testEvent(id: string): NostrEvent {
  return {
    id,
    pubkey: 'a'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: 'Paja publish',
    sig: 'b'.repeat(128),
  };
}

function createPajaRelayService(backend: PajaRelayBackend) {
  return createRelayPoolService({
    subscribe: (filters, callback, relayUrls) =>
      backend.subscription(relayUrls ?? TEST_RELAYS, filters).subscribe((item) => {
        callback(item as NostrEvent | 'EOSE');
      }),
    publish: (event) => backend.publish(TEST_RELAYS, event),
    selectRelayTier: () => TEST_RELAYS,
    isAvailable: () => backend.isAvailable(),
  });
}

describe('@kehto/paja effective relay URLs', () => {
  it('returns configured live relay URLs in their configured order', () => {
    const simulation = normalizePajaSimulation({
      relay: {
        mode: 'live',
        urls: ['wss://first.example', 'wss://second.example'],
      },
    });

    expect(getPajaRelayUrls(simulation)).toEqual([
      'wss://first.example',
      'wss://second.example',
    ]);
  });

  it('returns no fallback relay URLs when relay simulation is disabled', () => {
    const simulation = normalizePajaSimulation({
      relay: { mode: 'disabled', urls: ['wss://must-not-connect.example'] },
    });

    expect(getPajaRelayUrls(simulation)).toEqual([]);
  });

  it('never merges configured fixture events into live relay results', async () => {
    const fixture = testEvent('c'.repeat(64));
    let simulation = normalizePajaSimulation({
      relay: { mode: 'live', urls: TEST_RELAYS, fixtures: [{ ...fixture }] },
    });
    livePool.querySyncEvents = [];
    const backend = createPajaRelayBackend(() => simulation, () => true);

    await expect(backend.query(TEST_RELAYS, [{ kinds: [1] }])).resolves.toEqual([]);

    simulation = normalizePajaSimulation({
      relay: { mode: 'memory', urls: TEST_RELAYS, fixtures: [{ ...fixture }] },
    });
    await expect(backend.query(TEST_RELAYS, [{ kinds: [1] }])).resolves.toEqual([fixture]);
    backend.close();
  });

  it('reports only relay URLs tracked as actual event sources', () => {
    const event = testEvent('d'.repeat(64));
    livePool.seenOn.clear();
    livePool.seenOn.set(event.id, new Set([
      { url: TEST_RELAYS[1]! },
    ]));
    const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: TEST_RELAYS } });
    const backend = createPajaRelayBackend(() => simulation, () => true);

    expect(backend.observedRelayUrls(event.id)).toEqual([TEST_RELAYS[1]]);
    expect(backend.observedRelayUrls('unknown')).toEqual([]);
    backend.close();
  });

  it('bounds raw contact candidates deterministically before consumers verify them', async () => {
    const pubkey = 'a'.repeat(64);
    const candidates = Array.from({ length: PAJA_CONTACT_LIST_CANDIDATE_LIMIT + 3 }, (_, index): NostrEvent => ({
      id: index.toString(16).padStart(64, '0'),
      pubkey,
      kind: 3,
      created_at: index,
      tags: [],
      content: '',
      sig: 'e'.repeat(128),
    }));
    const query = vi.fn(async () => [...candidates].reverse());
    const backend = { query } as unknown as PajaRelayBackend;
    const loader = createPajaContactListLoader(
      backend,
      () => normalizePajaSimulation({ relay: { mode: 'memory' } }),
    );

    const loaded = await loader(pubkey);

    expect(loaded).toHaveLength(PAJA_CONTACT_LIST_CANDIDATE_LIMIT);
    expect(loaded.map((event) => event.created_at)).toEqual(
      Array.from({ length: PAJA_CONTACT_LIST_CANDIDATE_LIMIT }, (_, index) => candidates.length - 1 - index),
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.any(Array),
      [expect.objectContaining({ limit: PAJA_CONTACT_LIST_CANDIDATE_LIMIT })],
      expect.any(Number),
    );
  });

  it('closes a live contact-list query once its requested candidate limit is collected', async () => {
    const pubkey = 'a'.repeat(64);
    livePool.close = undefined;
    livePool.closeRejects = false;
    livePool.delivered = 0;
    livePool.requests = [];
    livePool.events = Array.from({ length: PAJA_CONTACT_LIST_CANDIDATE_LIMIT + 3 }, (_, index): NostrEvent => ({
      id: index.toString(16).padStart(64, '0'),
      pubkey,
      kind: 3,
      created_at: index,
      tags: [],
      content: '',
      sig: 'e'.repeat(128),
    }));
    const simulation = normalizePajaSimulation({
      relay: { mode: 'live', urls: ['wss://relay.example'] },
    });
    const loader = createPajaContactListLoader(
      createPajaRelayBackend(() => simulation, () => true),
      () => simulation,
    );

    const loaded = await loader(pubkey);

    expect(livePool.requests).toEqual([{
      relayUrls: ['wss://relay.example'],
      filter: {
        authors: [pubkey],
        kinds: [3],
        limit: PAJA_CONTACT_LIST_CANDIDATE_LIMIT,
      },
    }]);
    expect(livePool.delivered).toBe(PAJA_CONTACT_LIST_CANDIDATE_LIMIT);
    expect(livePool.close).toHaveBeenCalledWith('paja query limit reached');
    expect(loaded).toHaveLength(PAJA_CONTACT_LIST_CANDIDATE_LIMIT);
  });

  it('closes a superseded live contact-list query when its signal aborts', async () => {
    const pubkey = 'a'.repeat(64);
    livePool.close = undefined;
    livePool.closeRejects = false;
    livePool.delivered = 0;
    livePool.events = [];
    livePool.requests = [];
    const simulation = normalizePajaSimulation({
      relay: { mode: 'live', urls: ['wss://relay.example'] },
    });
    const loader = createPajaContactListLoader(
      createPajaRelayBackend(() => simulation, () => true),
      () => simulation,
    );
    const controller = new AbortController();

    const loaded = loader(pubkey, controller.signal);
    await vi.waitFor(() => expect(livePool.requests).toHaveLength(1));
    controller.abort();

    await expect(loaded).resolves.toEqual([]);
    expect(livePool.close).toHaveBeenCalledWith('paja query aborted');
  });

  it('settles a bounded contact-list query when close rejects without an unhandled rejection', async () => {
    const pubkey = 'a'.repeat(64);
    livePool.closeRejects = true;
    livePool.delivered = 0;
    livePool.events = Array.from({ length: PAJA_CONTACT_LIST_CANDIDATE_LIMIT }, (_, index) => ({
      id: index.toString(16).padStart(64, '0'),
      pubkey,
      kind: 3,
      created_at: index,
      tags: [],
      content: '',
      sig: 'e'.repeat(128),
    }));
    try {
      const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: ['wss://relay.example'] } });
      const loader = createPajaContactListLoader(createPajaRelayBackend(() => simulation, () => true), () => simulation);

      await expect(loader(pubkey)).resolves.toHaveLength(PAJA_CONTACT_LIST_CANDIDATE_LIMIT);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    } finally {
      livePool.closeRejects = false;
    }
  });

  it('keeps generic limited live queries on querySync and preserves sorted results', async () => {
    const older = { id: '1'.repeat(64), pubkey: 'a'.repeat(64), kind: 1, created_at: 1, tags: [], content: '', sig: 'e'.repeat(128) };
    const newer = { ...older, id: '2'.repeat(64), created_at: 2 };
    livePool.querySyncRequests = [];
    livePool.querySyncEvents = [older, newer];
    const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: ['wss://relay.example'] } });
    const backend = createPajaRelayBackend(() => simulation, () => true);

    await expect(backend.query(['wss://relay.example'], [{ kinds: [1], limit: 1 }])).resolves.toEqual([newer, older]);
    expect(livePool.querySyncRequests).toEqual([{
      relayUrls: ['wss://relay.example'],
      filter: { kinds: [1], limit: 1 },
    }]);
  });

  it('uses NIP-45 COUNT without downloading event payloads', async () => {
    livePool.countRequests = [];
    livePool.querySyncRequests = [];
    livePool.countValues.clear();
    livePool.countFailures.clear();
    livePool.countFailures.add(TEST_RELAYS[0]!);
    livePool.countValues.set(TEST_RELAYS[1]!, 7);
    const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: TEST_RELAYS } });
    const adapter = createPajaAdapter(
      { window: { id: 'paja-window', dTag: 'paja', aggregateHash: 'aggregate' } } as PajaHostConfig,
      () => simulation,
      () => {},
      () => {},
      () => true,
    );
    const sent: NappletMessage[] = [];

    adapter.services?.count?.handleMessage(
      'paja-window',
      { type: 'count.query', id: 'count-1', filters: [{ kinds: [1] }, { '#e': ['a'.repeat(64)] }] } as NappletMessage,
      (message) => sent.push(message),
    );

    await vi.waitFor(() => expect(sent).toEqual([{
      type: 'count.query.result',
      id: 'count-1',
      ok: true,
      count: 7,
      approximate: false,
      relays: [TEST_RELAYS[1]],
    }]));
    expect(livePool.countRequests).toEqual([{
      relayUrl: TEST_RELAYS[1],
      filters: [{ kinds: [1] }, { '#e': ['a'.repeat(64)] }],
    }]);
    expect(livePool.querySyncRequests).toEqual([]);
    (adapter.relayPool.getRelayPool() as PajaRelayBackend).close();
  });

  it('does not advertise COUNT for the memory relay fixture', () => {
    const simulation = normalizePajaSimulation({ relay: { mode: 'memory', urls: TEST_RELAYS } });
    const adapter = createPajaAdapter(
      { window: { id: 'paja-window', dTag: 'paja', aggregateHash: 'aggregate' } } as PajaHostConfig,
      () => simulation,
      () => {},
      () => {},
      () => true,
    );

    expect(adapter.services?.count).toBeUndefined();
    expect(adapter.services?.relay).toBeUndefined();
    expect(adapter.services?.outbox).toBeUndefined();
    expect(buildShellCapabilities(adapter).domains).not.toEqual(expect.arrayContaining([
      'relay',
      'outbox',
      'count',
    ]));
    (adapter.relayPool.getRelayPool() as PajaRelayBackend).close();
  });
});

describe('@kehto/paja relay publish settlement', () => {
  it('owns a verified live scoped-relay subscription and publish lifecycle', async () => {
    livePool.publishRequests = [];
    livePool.subscribeMapRequests = [];
    livePool.subscriptionClose = undefined;
    const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: TEST_RELAYS } });
    const adapter = createPajaAdapter(
      { window: { id: 'paja-window', dTag: 'paja', aggregateHash: 'aggregate' } } as PajaHostConfig,
      () => simulation,
      () => {},
      () => {},
      () => true,
    );
    const postMessage = vi.fn();
    const sourceWindow = { postMessage } as unknown as Window;
    const event = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'scoped relay publish',
    }, generateSecretKey()) as NostrEvent;

    adapter.relayPool.openScopedRelay(
      'paja-window',
      TEST_RELAYS[0]!,
      'scoped-sub',
      [{ kinds: [1] }],
      sourceWindow,
    );
    await Promise.resolve();
    expect(livePool.subscribeMapRequests).toEqual([[
      { url: TEST_RELAYS[0], filter: { kinds: [1] } },
    ]]);
    expect(postMessage).toHaveBeenCalledWith({ type: 'relay.eose', subId: 'scoped-sub' }, '*');
    await expect(adapter.relayPool.publishToScopedRelay('paja-window', event)).resolves.toBe(true);
    expect(livePool.publishRequests).toEqual([{ relayUrls: [TEST_RELAYS[0]], event }]);

    adapter.relayPool.closeScopedRelay('paja-window');
    expect(livePool.subscriptionClose).toHaveBeenCalledWith('paja unsubscribe');
    await expect(adapter.relayPool.publishToScopedRelay('paja-window', event)).resolves.toBe(false);
    (adapter.relayPool.getRelayPool() as PajaRelayBackend).close();
  });

  it('rejects scoped access to private unconfigured relays', async () => {
    const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: TEST_RELAYS } });
    const adapter = createPajaAdapter(
      { window: { id: 'paja-window', dTag: 'paja', aggregateHash: 'aggregate' } } as PajaHostConfig,
      () => simulation,
      () => {},
      () => {},
      () => true,
    );
    const postMessage = vi.fn();

    adapter.relayPool.openScopedRelay(
      'paja-window',
      'wss://127.0.0.1/private',
      'blocked-sub',
      [{ kinds: [1] }],
      { postMessage } as unknown as Window,
    );

    expect(postMessage).toHaveBeenCalledWith({
      type: 'relay.closed',
      subId: 'blocked-sub',
      reason: 'scoped relay unavailable',
    }, '*');
    await expect(adapter.relayPool.publishToScopedRelay('paja-window', testEvent('f'.repeat(64)))).resolves.toBe(false);
    (adapter.relayPool.getRelayPool() as PajaRelayBackend).close();
  });

  it('applies relay configuration changes to live transport selection', async () => {
    livePool.publishRequests = [];
    const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: TEST_RELAYS } });
    const adapter = createPajaAdapter(
      { window: { id: 'paja-window', dTag: 'paja', aggregateHash: 'aggregate' } } as PajaHostConfig,
      () => simulation,
      () => {},
      () => {},
      () => true,
    );

    adapter.relayConfig.addRelay('outbox', 'wss://added.example');
    adapter.relayConfig.removeRelay('outbox', TEST_RELAYS[0]!);
    adapter.relayConfig.removeRelay('outbox', TEST_RELAYS[1]!);
    adapter.relayConfig.removeRelay('discovery', TEST_RELAYS[0]!);
    adapter.relayConfig.removeRelay('super', TEST_RELAYS[0]!);
    expect(adapter.relayConfig.getRelayConfig().outbox).toEqual([
      'wss://added.example',
    ]);
    expect(adapter.relayPool.selectRelayTier([{ kinds: [1] }])).toEqual([TEST_RELAYS[1]]);
    expect(adapter.relayConfig.getNip66Suggestions()).toEqual([]);

    const sent: NappletMessage[] = [];
    const event = testEvent('e'.repeat(64));
    adapter.services?.relay?.handleMessage(
      'paja-window',
      { type: 'relay.publish', id: 'publish-configured', event } as NappletMessage,
      (message) => sent.push(message),
    );
    await vi.waitFor(() => expect(sent).toEqual([
      expect.objectContaining({ type: 'relay.publish.result', id: 'publish-configured', ok: true }),
    ]));
    expect(livePool.publishRequests).toEqual([{
      relayUrls: ['wss://added.example'],
      event,
    }]);
    (adapter.relayPool.getRelayPool() as PajaRelayBackend).close();
  });

  it('does not echo accepted live publishes as if a subscribed relay delivered them', async () => {
    const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: TEST_RELAYS } });
    const backend = createPajaRelayBackend(() => simulation, () => true);
    const received: Array<NostrEvent | 'EOSE'> = [];
    const subscription = backend.subscription(TEST_RELAYS, [{ kinds: [1] }]).subscribe((item) => {
      received.push(item as NostrEvent | 'EOSE');
    });
    const event = testEvent('a'.repeat(64));

    await backend.publish(TEST_RELAYS, event);
    await Promise.resolve();

    expect(received).not.toContainEqual(event);
    subscription.unsubscribe();
    backend.close();
  });

  it('settles scoped relay publication and reports denied publication as false', async () => {
    const simulation = normalizePajaSimulation({
      relay: { mode: 'memory', urls: TEST_RELAYS },
    });
    const adapter = createPajaAdapter(
      {
        window: {
          id: 'paja-window',
          dTag: 'paja',
          aggregateHash: 'aggregate',
        },
      } as PajaHostConfig,
      () => simulation,
      () => {},
      () => {},
      () => false,
    );
    const event = testEvent('e'.repeat(64));
    const publishResult = adapter.relayPool.publishToScopedRelay('paja-window', event);

    expect(publishResult).toBeInstanceOf(Promise);
    await expect(publishResult).resolves.toBe(false);

    const backend = adapter.relayPool.getRelayPool() as PajaRelayBackend;
    expect(await backend.query(TEST_RELAYS, [{ ids: [event.id] }])).toEqual([]);
    backend.close();
  });

  it('returns a canonical failure and retains nothing when confirmation is denied', async () => {
    const simulation = normalizePajaSimulation({
      relay: { mode: 'memory', urls: TEST_RELAYS },
    });
    const backend = createPajaRelayBackend(() => simulation, () => false);
    const service = createPajaRelayService(backend);
    const event = testEvent('c'.repeat(64));
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'paja-window',
      { type: 'relay.publish', id: 'denied', event } as NappletMessage,
      (message) => sent.push(message),
    );

    await vi.waitFor(() => {
      expect(sent).toEqual([{
        type: 'relay.publish.result',
        id: 'denied',
        ok: false,
        error: 'publish denied',
      }]);
    });
    expect(await backend.query(TEST_RELAYS, [{ ids: [event.id] }])).toEqual([]);
    backend.close();
  });

  it('reports all-live-relay rejection without retaining service or outbox events', async () => {
    let simulation = normalizePajaSimulation({
      relay: { mode: 'live', urls: TEST_RELAYS },
    });
    const rejectingPool = {
      publish: (relayUrls: string[]) =>
        relayUrls.map(() => Promise.reject(new Error('relay rejected'))),
      destroy: () => {},
    } as unknown as SimplePool;
    const backend = createPajaRelayBackend(() => simulation, () => true, rejectingPool);
    const service = createPajaRelayService(backend);
    const event = testEvent('d'.repeat(64));
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'paja-window',
      { type: 'relay.publish', id: 'rejected', event } as NappletMessage,
      (message) => sent.push(message),
    );

    await vi.waitFor(() => {
      expect(sent).toEqual([{
        type: 'relay.publish.result',
        id: 'rejected',
        ok: false,
        error: 'publish failed',
      }]);
    });
    expect(await backend.publishToRelays(TEST_RELAYS, event)).toEqual({
      [TEST_RELAYS[0]!]: false,
      [TEST_RELAYS[1]!]: false,
    });
    simulation = normalizePajaSimulation({
      relay: { mode: 'memory', urls: TEST_RELAYS },
    });
    expect(await backend.query(TEST_RELAYS, [{ ids: [event.id] }])).toEqual([]);
    backend.close();
  });
});

/**
 * relay-pool-outbox-router.test.ts — concrete outbox-model router.
 *
 * Drives a controllable mock OutboxRelayPool (one subscription per relay) to
 * exercise NIP-65 relay resolution, per-relay fanout + dedup + relay
 * attribution, signature validation, query limit/timeout/incomplete, live
 * subscriptions, and signed publish fanout.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRelayPoolOutboxRouter } from './relay-pool-outbox-router.js';
import type { OutboxRelayPool, RelayListEntry } from './relay-pool-outbox-router.js';
import type { EventTemplate, NostrEvent, NostrFilter } from '@napplet/core';

const PK_A = 'a'.repeat(64);
const PK_B = 'b'.repeat(64);

function ev(id: string, pubkey = PK_A, created_at = 1000): NostrEvent {
  return { id: id.padEnd(64, '0'), pubkey, kind: 1, content: id, tags: [], created_at, sig: 'f'.repeat(128) };
}

/** A microtask+timer flush. */
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface Sub {
  relays: string[];
  cb: (item: NostrEvent | 'EOSE') => void;
  closed: boolean;
  origin?: string;
  authors?: readonly string[];
  filters: unknown;
}

function makePool() {
  const subs: Sub[] = [];
  const published: { event: NostrEvent; relays: string[] }[] = [];
  const pool = {
    available: true,
    publishReturn: undefined as Record<string, boolean> | undefined,
    subs,
    published,
    isAvailable: () => pool.available,
    subscribe(
      filters: unknown,
      relayUrls: string[],
      cb: (item: NostrEvent | 'EOSE') => void,
      origin?: string,
      authors?: readonly string[],
    ) {
      const sub: Sub = { relays: relayUrls, cb, closed: false, origin, authors, filters };
      subs.push(sub);
      return { unsubscribe() { sub.closed = true; } };
    },
    publish(event: NostrEvent, relayUrls: string[]) {
      published.push({ event, relays: relayUrls });
      return pool.publishReturn;
    },
    /** Drive an event into the subscription bound to `relay`. */
    emit(relay: string, item: NostrEvent | 'EOSE') {
      for (const s of subs) if (s.relays.includes(relay) && !s.closed) s.cb(item);
    },
    /** EOSE every open subscription. */
    eoseAll() {
      for (const s of subs) if (!s.closed) s.cb('EOSE');
    },
    /** Relay URL -> how the router routed that relay's read. */
    originsByRelay() {
      return Object.fromEntries(subs.map((s) => [s.relays[0], s.origin]));
    },
  };
  return pool as OutboxRelayPool & typeof pool;
}

const NIP65 = new Map<string, RelayListEntry>([
  [PK_A, { read: ['wss://a-read.example'], write: ['wss://a-write.example'] }],
  [PK_B, { read: ['wss://b-read.example'], write: ['wss://b-write.example'] }],
]);

const FALLBACK = ['wss://fallback.example'];

function makeRouter(pool: OutboxRelayPool, overrides: Partial<Parameters<typeof createRelayPoolOutboxRouter>[0]> = {}) {
  return createRelayPoolOutboxRouter({
    relayPool: pool,
    loadRelayLists: (pubkeys) => new Map([...NIP65].filter(([pk]) => pubkeys.includes(pk))),
    fallbackRelays: FALLBACK,
    defaultTimeoutMs: 50,
    ...overrides,
  });
}

type ReadMode = 'query' | 'queryStream' | 'subscribe';

function startRead(
  mode: ReadMode,
  router: ReturnType<typeof makeRouter>,
  filters: NostrFilter[],
  options: Parameters<typeof router.query>[1],
) {
  if (mode === 'query') return { result: router.query(filters, options), close() {} };
  if (mode === 'queryStream') return router.queryStream(filters, options, { event() {} });
  const sub = router.subscribe(filters, options, { event() {}, closed() {} });
  return { result: Promise.resolve(), close: () => sub.close() };
}

const READ_MODES: ReadMode[] = ['query', 'queryStream', 'subscribe'];

describe('createRelayPoolOutboxRouter', () => {
  describe.each(READ_MODES)('%s routing author metadata', (mode) => {
    it.each([false, true])('preserves option-only owners with async discovery=%s', async (asyncDiscovery) => {
      const pool = makePool();
      const lists = deferred<Map<string, RelayListEntry>>();
      const owners = new Map([[PK_B, NIP65.get(PK_B)!]]);
      const router = makeRouter(pool, { loadRelayLists: () => asyncDiscovery ? lists.promise : owners });
      const filters: NostrFilter[] = [{ kinds: [1] }];
      const read = startRead(mode, router, filters, { authors: [PK_B, PK_B] });
      if (asyncDiscovery) {
        expect(pool.subs[0]).toMatchObject({ origin: 'fallback', authors: [PK_B] });
        lists.resolve(owners);
        await tick();
      }
      const discovered = pool.subs.find((sub) => sub.origin === 'nip65');
      expect(discovered).toMatchObject({ relays: ['wss://b-write.example'], authors: [PK_B] });
      for (const sub of pool.subs) expect(sub.filters).toBe(filters);
      expect(filters).toEqual([{ kinds: [1] }]);
      pool.eoseAll();
      await read.result;
      read.close();
    });

    it.each([false, true])('does not credit a missing filter author with async discovery=%s', async (asyncDiscovery) => {
      const pool = makePool();
      const lists = deferred<Map<string, RelayListEntry>>();
      const owners = new Map([[PK_B, NIP65.get(PK_B)!]]);
      const router = makeRouter(pool, { loadRelayLists: () => asyncDiscovery ? lists.promise : owners });
      const filters: NostrFilter[] = [{ authors: [PK_A], kinds: [1] }];
      const read = startRead(mode, router, filters, { authors: [PK_B], relays: ['wss://hint.example'] });
      lists.resolve(owners);
      await tick();
      expect(pool.subs.find((sub) => sub.origin === 'nip65')).toMatchObject({
        relays: ['wss://b-write.example'], authors: [PK_B],
      });
      expect(pool.subs.find((sub) => sub.origin === 'hint')).toMatchObject({ authors: [PK_A, PK_B] });
      for (const sub of pool.subs) expect(sub.filters).toBe(filters);
      pool.eoseAll();
      await read.result;
      read.close();
    });

    it.each([false, true])('attributes only allowed per-relay owners with async discovery=%s', async (asyncDiscovery) => {
      const pool = makePool();
      const lists = deferred<Map<string, RelayListEntry>>();
      const denied = 'c'.repeat(64);
      const owners = new Map([
        [PK_A, { read: [], write: ['wss://a-write.example', 'wss://shared.example', 'wss://shared.example'] }],
        [PK_B, { read: [], write: ['wss://b-write.example', 'wss://shared.example'] }],
        [denied, { read: [], write: ['wss://denied.example'] }],
        ['unrequested', { read: [], write: ['wss://a-write.example'] }],
      ]);
      const router = makeRouter(pool, {
        loadRelayLists: () => asyncDiscovery ? lists.promise : owners,
        isRelayAllowed: (url) => url !== 'wss://denied.example',
      });
      const read = startRead(mode, router, [{ authors: [PK_A, denied] }], { authors: [PK_B, PK_A] });
      if (asyncDiscovery) {
        expect(pool.subs[0]).toMatchObject({ origin: 'fallback', authors: [PK_A, denied, PK_B] });
      }
      lists.resolve(owners);
      await tick();
      expect(Object.fromEntries(pool.subs.filter((sub) => sub.origin === 'nip65')
        .map((sub) => [sub.relays[0], sub.authors]))).toEqual({
        'wss://a-write.example': [PK_A],
        'wss://b-write.example': [PK_B],
        'wss://shared.example': [PK_A, PK_B],
      });
      pool.eoseAll();
      await read.result;
      read.close();
    });

    it('keeps a validated hint origin when it is also an author write relay', async () => {
      const pool = makePool();
      const read = startRead(mode, makeRouter(pool), [{ kinds: [1] }], {
        authors: [PK_B], relays: ['wss://b-write.example'],
      });
      expect(pool.subs).toHaveLength(1);
      expect(pool.subs[0]).toMatchObject({ origin: 'hint', authors: [PK_B] });
      pool.eoseAll();
      await read.result;
      read.close();
    });

    it('sends an authoritative empty author set for authorless reads', async () => {
      const pool = makePool();
      const read = startRead(mode, makeRouter(pool), [{ kinds: [1] }], undefined);
      expect(pool.subs).not.toHaveLength(0);
      for (const sub of pool.subs) expect(sub.authors).toEqual([]);
      pool.eoseAll();
      await read.result;
      read.close();
    });
  });

  it.each<ReadMode>(['queryStream', 'subscribe'])('%s close prevents option-only late discovery reads', async (mode) => {
    const pool = makePool();
    const lists = deferred<Map<string, RelayListEntry>>();
    const router = makeRouter(pool, { loadRelayLists: () => lists.promise });
    const read = startRead(mode, router, [{ kinds: [1] }], { authors: [PK_B] });
    expect(pool.subs[0]).toMatchObject({ origin: 'fallback', authors: [PK_B] });
    read.close();
    lists.resolve(NIP65);
    await tick();
    await read.result;
    expect(pool.subs).toHaveLength(1);
    expect(pool.subs[0].closed).toBe(true);
  });

  it('query timeout prevents option-only late discovery reads', async () => {
    const pool = makePool();
    const lists = deferred<Map<string, RelayListEntry>>();
    const router = makeRouter(pool, { loadRelayLists: () => lists.promise });
    await expect(router.query([{ kinds: [1] }], { authors: [PK_B], timeoutMs: 10 }))
      .resolves.toEqual({ events: [], incomplete: true });
    lists.resolve(NIP65);
    await tick();
    expect(pool.subs).toHaveLength(1);
    expect(pool.subs[0]).toMatchObject({ origin: 'fallback', authors: [PK_B], closed: true });
  });

  it('keeps four-argument pool adapters assignable and callable without consuming metadata', async () => {
    const subscribe = vi.fn((
      _filters: NostrFilter[],
      _relayUrls: string[],
      callback: (item: NostrEvent | 'EOSE') => void,
      _origin?: 'nip65' | 'hint' | 'fallback',
    ) => {
      queueMicrotask(() => callback('EOSE'));
      return { unsubscribe() {} };
    });
    // Assignment is checked by tsc: adapters need not add a fifth parameter.
    const pool: OutboxRelayPool = { subscribe, publish() {}, isAvailable: () => true };
    const filters: NostrFilter[] = [{ kinds: [1] }];
    await expect(makeRouter(pool).query(filters, { authors: [PK_B] })).resolves.toEqual({ events: [] });
    expect(subscribe).toHaveBeenCalledWith(filters, ['wss://b-write.example'], expect.any(Function), 'nip65', [PK_B]);
  });

  it('reports per-relay routing origins for queries and subscriptions', async () => {
    const pool = makePool();
    const router = makeRouter(pool);

    const result = await router.query([{ authors: [PK_A] }], { relays: ['wss://hinted.example'] });
    expect(result.events).toEqual([]);
    expect(pool.originsByRelay()).toEqual({
      'wss://hinted.example': 'hint',
      'wss://a-write.example': 'nip65',
    });

    pool.subs.length = 0;
    const sub = router.subscribe(
      [{ authors: [PK_A] }],
      { timeoutMs: 20, relays: ['wss://hinted.example'] },
      { event() {}, closed() {} },
    );
    expect(pool.originsByRelay()).toEqual({
      'wss://hinted.example': 'hint',
      'wss://a-write.example': 'nip65',
    });
    sub.close();

    pool.subs.length = 0;
    await router.query([{ kinds: [1] }]);
    expect(pool.originsByRelay()).toEqual({ 'wss://fallback.example': 'fallback' });
  });

  it('throws on missing required options', () => {
    // @ts-expect-error — runtime guard
    expect(() => createRelayPoolOutboxRouter({})).toThrow(/relayPool is required/);
    // @ts-expect-error — runtime guard
    expect(() => createRelayPoolOutboxRouter({ relayPool: {} })).toThrow(/loadRelayLists is required/);
    expect(() => createRelayPoolOutboxRouter({
      relayPool: {} as OutboxRelayPool,
      loadRelayLists: () => new Map(),
      // @ts-expect-error — runtime guard
      fallbackRelays: undefined,
    })).toThrow(/fallbackRelays is required/);
  });

  describe('resolveRelays', () => {
    let router: ReturnType<typeof makeRouter>;
    beforeEach(() => { router = makeRouter(makePool()); });

    it('read direction → author WRITE relays (outbox model), source nip65', async () => {
      const plan = await router.resolveRelays({ pubkey: PK_A, direction: 'read' });
      expect(plan).toEqual({ relays: ['wss://a-write.example'], source: 'nip65' });
    });

    it('write direction → author READ relays (inbox model)', async () => {
      const plan = await router.resolveRelays({ pubkey: PK_A, direction: 'write' });
      expect(plan).toEqual({ relays: ['wss://a-read.example'], source: 'nip65' });
    });

    it('aggregates multiple authors and dedups', async () => {
      const plan = await router.resolveRelays({ authors: [PK_A, PK_B], direction: 'read' });
      expect(plan.relays.sort()).toEqual(['wss://a-write.example', 'wss://b-write.example']);
    });

    it('reports missingAuthors and falls back when no list is known', async () => {
      const plan = await router.resolveRelays({ authors: ['c'.repeat(64)], direction: 'read' });
      expect(plan).toEqual({ relays: ['wss://fallback.example'], source: 'fallback', missingAuthors: ['c'.repeat(64)] });
    });

    it('gates non-ws relay hints out of the plan', async () => {
      const pool = makePool();
      const r = makeRouter(pool);
      const plan = await r.resolveRelays({ authors: [], direction: 'read' });
      // no pubkeys, no hints → fallback
      expect(plan.source).toBe('fallback');
    });
  });

  it('resolves a read plan without subscribing or publishing', async () => {
    const pool = makePool();
    const router = makeRouter(pool);
    const plan = await router.planRead!([{ authors: [PK_A] }], { relays: ['wss://hint.test'] });

    expect(plan.relays).toEqual(expect.arrayContaining(['wss://a-write.example', 'wss://hint.test']));
    expect(pool.subs).toEqual([]);
    expect(pool.published).toEqual([]);
  });

  describe('query', () => {
    it('opens fallback reads immediately and applies the deadline while discovery is unresolved', async () => {
      const pool = makePool();
      const relayLists = deferred<Map<string, RelayListEntry>>();
      const router = makeRouter(pool, { loadRelayLists: () => relayLists.promise });

      const pending = router.query([{ authors: [PK_A], kinds: [1] }], { timeoutMs: 10 });

      expect(pool.subs.map((sub) => sub.relays[0])).toEqual(['wss://fallback.example']);
      pool.emit('wss://fallback.example', ev('seed'));
      const result = await Promise.race([pending, delay(100).then(() => 'deadline missed' as const)]);

      expect(result).not.toBe('deadline missed');
      expect(result).toEqual({
        events: [{ event: ev('seed'), sidecar: { relayHints: ['wss://fallback.example'] } }],
        incomplete: true,
      });

      relayLists.resolve(NIP65);
      await tick();
      expect(pool.subs).toHaveLength(1);
      expect(pool.subs[0].closed).toBe(true);
    });

    it('exposes an incremental query stream and attaches discovered relays to its collector', async () => {
      const pool = makePool();
      const relayLists = deferred<Map<string, RelayListEntry>>();
      const streamed: string[] = [];
      const router = makeRouter(pool, { loadRelayLists: () => relayLists.promise });

      const stream = router.queryStream(
        [{ authors: [PK_A], kinds: [1] }],
        { timeoutMs: 100 },
        { event: (result) => streamed.push(result.event.content) },
      );

      expect(pool.subs.map((sub) => sub.relays[0])).toEqual(['wss://fallback.example']);
      pool.emit('wss://fallback.example', ev('shared'));
      await tick();
      expect(streamed).toEqual(['shared']);

      relayLists.resolve(NIP65);
      await tick();
      expect(pool.subs.map((sub) => sub.relays[0]).sort()).toEqual(['wss://a-write.example', 'wss://fallback.example']);

      pool.emit('wss://a-write.example', ev('shared'));
      pool.emit('wss://a-write.example', ev('discovered'));
      pool.eoseAll();
      const result = await stream.result;

      expect(streamed).toEqual(['shared', 'discovered']);
      expect(result.events.map((item) => item.event.content).sort()).toEqual(['discovered', 'shared']);
      expect(result.events.find((item) => item.event.content === 'shared')?.sidecar?.relayHints?.sort()).toEqual([
        'wss://a-write.example',
        'wss://fallback.example',
      ]);
      expect(result.incomplete).toBeUndefined();
    });

    it('waits for discovery after seed EOSE, then completes after discovered EOSE', async () => {
      const pool = makePool();
      const relayLists = deferred<Map<string, RelayListEntry>>();
      const router = makeRouter(pool, { loadRelayLists: () => relayLists.promise });
      const stream = router.queryStream([{ authors: [PK_A] }], { timeoutMs: 100 }, { event: () => {} });
      let settled = false;
      void stream.result.then(() => { settled = true; });

      pool.eoseAll();
      await tick();
      expect(settled).toBe(false);

      relayLists.resolve(NIP65);
      await tick();
      expect(pool.subs.map((sub) => sub.relays[0]).sort()).toEqual(['wss://a-write.example', 'wss://fallback.example']);
      pool.emit('wss://a-write.example', 'EOSE');

      await expect(stream.result).resolves.toEqual({ events: [] });
    });

    it('uses a validated relay hint immediately and falls back when a hint is denied', () => {
      const hintedPool = makePool();
      const hintedLists = deferred<Map<string, RelayListEntry>>();
      const hinted = makeRouter(hintedPool, { loadRelayLists: () => hintedLists.promise });
      const hintedStream = hinted.queryStream(
        [{ authors: [PK_A] }],
        { relays: ['wss://hint.example'], timeoutMs: 100 },
        { event: () => {} },
      );
      expect(hintedPool.subs.map((sub) => sub.relays[0])).toEqual(['wss://hint.example']);
      hintedStream.close();

      const fallbackPool = makePool();
      const fallbackLists = deferred<Map<string, RelayListEntry>>();
      const fallback = makeRouter(fallbackPool, { loadRelayLists: () => fallbackLists.promise });
      const fallbackStream = fallback.queryStream(
        [{ authors: [PK_A] }],
        { relays: ['https://not-a-relay'], timeoutMs: 100 },
        { event: () => {} },
      );
      expect(fallbackPool.subs.map((sub) => sub.relays[0])).toEqual(['wss://fallback.example']);
      fallbackStream.close();
    });

    it('close() is idempotent, settles incomplete, and blocks late discovery', async () => {
      const pool = makePool();
      const relayLists = deferred<Map<string, RelayListEntry>>();
      const router = makeRouter(pool, { loadRelayLists: () => relayLists.promise });
      const stream = router.queryStream([{ authors: [PK_A] }], undefined, { event: () => {} });

      stream.close();
      stream.close();
      await expect(stream.result).resolves.toEqual({ events: [], incomplete: true });
      expect(pool.subs).toHaveLength(1);
      expect(pool.subs[0].closed).toBe(true);

      relayLists.resolve(NIP65);
      await tick();
      expect(pool.subs).toHaveLength(1);
    });

    it('does not let a hanging verifier overrun the overall deadline', async () => {
      const pool = makePool();
      const router = makeRouter(pool, {
        verifyEvent: () => new Promise<boolean>(() => {}),
      });
      const streamed = vi.fn();
      const stream = router.queryStream(
        [{ authors: [PK_A] }],
        { timeoutMs: 10 },
        { event: streamed },
      );
      pool.emit('wss://a-write.example', ev('unverified'));

      const result = await Promise.race([stream.result, delay(100).then(() => 'deadline missed' as const)]);
      expect(result).toEqual({ events: [], incomplete: true });
      expect(streamed).not.toHaveBeenCalled();
    });

    it('marks a fallback result incomplete when relay-list discovery fails', async () => {
      const pool = makePool();
      const router = makeRouter(pool, {
        loadRelayLists: () => Promise.reject(new Error('discovery offline')),
      });

      const pending = router.query([{ authors: [PK_A], kinds: [1] }], { timeoutMs: 100 });
      expect(pool.subs.map((sub) => sub.relays[0])).toEqual(['wss://fallback.example']);
      pool.emit('wss://fallback.example', ev('cached'));
      pool.eoseAll();

      await expect(pending).resolves.toEqual({
        events: [{ event: ev('cached'), sidecar: { relayHints: ['wss://fallback.example'] } }],
        incomplete: true,
      });
    });

    it('fans out per relay, dedups by id, and records every relay an event was seen on', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const p = router.query([{ authors: [PK_A, PK_B], kinds: [1] }]);
      await tick();
      // Subscriptions: one per resolved write relay (a-write, b-write).
      expect(pool.subs.map((s) => s.relays[0]).sort()).toEqual(['wss://a-write.example', 'wss://b-write.example']);

      pool.emit('wss://a-write.example', ev('e1'));
      pool.emit('wss://b-write.example', ev('e1')); // same event from a second relay
      pool.emit('wss://b-write.example', ev('e2', PK_B));
      pool.eoseAll();

      const result = await p;
      expect(result.events.map((e) => e.event.content).sort()).toEqual(['e1', 'e2']);
      expect(result.events.find((e) => e.event.id === ev('e1').id)?.sidecar?.relayHints?.sort()).toEqual(['wss://a-write.example', 'wss://b-write.example']);
      expect(result.events.find((e) => e.event.id === ev('e2', PK_B).id)?.sidecar?.relayHints).toEqual(['wss://b-write.example']);
      expect(result.incomplete).toBeUndefined();
    });

    it('drops events that fail signature verification', async () => {
      const pool = makePool();
      const verifyEvent = vi.fn((e: NostrEvent) => e.content !== 'bad');
      const router = makeRouter(pool, { verifyEvent });
      const p = router.query([{ authors: [PK_A] }]);
      await tick();
      pool.emit('wss://a-write.example', ev('good'));
      pool.emit('wss://a-write.example', ev('bad'));
      pool.eoseAll();
      const result = await p;
      expect(result.events.map((e) => e.event.content)).toEqual(['good']);
      expect(result.events.find((e) => e.event.id === ev('bad').id)).toBeUndefined();
    });

    it('applies the limit, keeping the most recent events', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const p = router.query([{ authors: [PK_A] }], { limit: 2 });
      await tick();
      pool.emit('wss://a-write.example', ev('old', PK_A, 100));
      pool.emit('wss://a-write.example', ev('mid', PK_A, 200));
      pool.emit('wss://a-write.example', ev('new', PK_A, 300));
      pool.eoseAll();
      const result = await p;
      expect(result.events.map((e) => e.event.content)).toEqual(['new', 'mid']);
    });

    it('marks incomplete on timeout when a relay never EOSEs', async () => {
      const pool = makePool();
      const router = makeRouter(pool, { defaultTimeoutMs: 20 });
      const p = router.query([{ authors: [PK_A] }]);
      await tick();
      pool.emit('wss://a-write.example', ev('e1'));
      // no EOSE — let the timeout fire
      const result = await p;
      expect(result.events.map((e) => e.event.content)).toEqual(['e1']);
      expect(result.incomplete).toBe(true);
    });

    it('marks incomplete when some authors have no relay list', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const p = router.query([{ authors: [PK_A, 'z'.repeat(64)] }]);
      await tick();
      pool.eoseAll();
      const result = await p;
      expect(result.incomplete).toBe(true);
    });

    it('treats authorless query relay hints as augmenting fallback relays', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const p = router.query([{ kinds: [30831], limit: 24 }], { relays: ['wss://hint.example'], timeoutMs: 20 });
      await tick();

      expect(pool.subs.map((s) => s.relays[0]).sort()).toEqual(['wss://fallback.example', 'wss://hint.example']);

      pool.eoseAll();
      await p;
    });

    it('returns relay-list-unavailable error when the pool is offline', async () => {
      const pool = makePool();
      pool.available = false;
      const router = makeRouter(pool);
      const result = await router.query([{ authors: [PK_A] }]);
      expect(result).toEqual({ events: [], incomplete: true, error: 'relay list unavailable' });
    });

    it('unsubscribes all relays once finalized', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const p = router.query([{ authors: [PK_A, PK_B] }]);
      await tick();
      pool.eoseAll();
      await p;
      expect(pool.subs.every((s) => s.closed)).toBe(true);
    });
  });

  describe('getEvent', () => {
    it('fetches a single event by id through the author outbox relays', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const target = ev('target');
      const p = router.getEvent!(target.id, { author: PK_A, timeoutMs: 20 });
      await tick();

      expect(pool.subs.map((s) => s.relays[0])).toEqual(['wss://a-write.example']);

      pool.emit('wss://a-write.example', target);
      pool.eoseAll();

      const result = await p;
      expect(result).toEqual({ result: { event: target, sidecar: { relayHints: ['wss://a-write.example'] } } });
    });

    it('does not return a relay event whose id differs from the requested id', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const wantedId = ev('wanted').id;
      const p = router.getEvent!(wantedId, { author: PK_A, timeoutMs: 20 });
      await tick();

      pool.emit('wss://a-write.example', ev('other'));
      pool.eoseAll();

      const result = await p;
      expect(result).toEqual({ error: 'not found' });
    });

    it('marks the lookup incomplete when a relay times out after finding the event', async () => {
      const pool = makePool();
      const router = makeRouter(pool, { defaultTimeoutMs: 20 });
      const target = ev('slow');
      const p = router.getEvent!(target.id, { author: PK_A });
      await tick();

      pool.emit('wss://a-write.example', target);

      const result = await p;
      expect(result).toEqual({ result: { event: target, sidecar: { relayHints: ['wss://a-write.example'] } }, incomplete: true });
    });
  });

  describe('subscribe', () => {
    it('uses only validated hints for authorless live reads', () => {
      const pool = makePool();
      const router = makeRouter(pool, { isRelayAllowed: (url) => url !== 'wss://denied.example' });
      const sub = router.subscribe(
        [{ kinds: [1] }],
        { relays: ['wss://hint.example', 'wss://denied.example', 'wss://hint.example'] },
        { event() {}, closed() {} },
      );

      expect(pool.subs.map((item) => item.relays)).toEqual([['wss://hint.example']]);
      expect(pool.originsByRelay()).toEqual({ 'wss://hint.example': 'hint' });
      sub.close();
      expect(pool.subs.every((item) => item.closed)).toBe(true);
    });

    it.each([
      { label: 'absent', options: undefined },
      { label: 'empty', options: { relays: [] } },
      { label: 'policy-denied', options: { relays: ['wss://denied.example'] } },
    ])('uses fallback for authorless live reads with $label hints', ({ options }) => {
      const pool = makePool();
      const router = makeRouter(pool, { isRelayAllowed: (url) => url !== 'wss://denied.example' });
      const sub = router.subscribe([{ kinds: [1] }], options, { event() {}, closed() {} });

      expect(pool.subs.map((item) => item.relays)).toEqual([FALLBACK]);
      expect(pool.originsByRelay()).toEqual({ 'wss://fallback.example': 'fallback' });
      sub.close();
      expect(pool.subs.every((item) => item.closed)).toBe(true);
    });

    it('streams from fallback immediately and adds discovered author relays later', async () => {
      const pool = makePool();
      const relayLists = deferred<Map<string, RelayListEntry>>();
      const events: string[] = [];
      const router = makeRouter(pool, { loadRelayLists: () => relayLists.promise });

      const sub = router.subscribe([{ authors: [PK_A] }], { timeoutMs: 20 }, {
        event: (result) => events.push(result.event.content),
        closed: () => { /* ignore */ },
      });

      expect(pool.subs.map((item) => item.relays[0])).toEqual(['wss://fallback.example']);
      pool.emit('wss://fallback.example', ev('seed'));
      await tick();
      expect(events).toEqual(['seed']);

      relayLists.resolve(NIP65);
      await tick();
      expect(pool.subs.map((item) => item.relays[0]).sort()).toEqual(['wss://a-write.example', 'wss://fallback.example']);
      pool.emit('wss://a-write.example', ev('discovered'));
      await tick();
      expect(events).toEqual(['seed', 'discovered']);

      sub.close();
      expect(pool.subs.every((item) => item.closed)).toBe(true);
    });

    it('keeps the fallback stream live when discovery rejects', async () => {
      const pool = makePool();
      const events: string[] = [];
      let closed = false;
      const router = makeRouter(pool, {
        loadRelayLists: () => Promise.reject(new Error('discovery offline')),
      });

      const sub = router.subscribe([{ authors: [PK_A] }], undefined, {
        event: (result) => events.push(result.event.content),
        closed: () => { closed = true; },
      });
      await tick();
      pool.emit('wss://fallback.example', ev('still-live'));
      await tick();

      expect(events).toEqual(['still-live']);
      expect(closed).toBe(false);
      sub.close();
    });

    it('streams attributed events and ignores relay EOSE at the outbox lifecycle boundary', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const events: Array<{ content: string; relayHints?: string[] }> = [];
      const sub = router.subscribe([{ authors: [PK_A, PK_B] }], undefined, {
        event: (result) => events.push({ content: result.event.content, relayHints: result.sidecar?.relayHints }),
        closed: () => { /* ignore */ },
      });
      await tick();
      pool.emit('wss://a-write.example', ev('s1'));
      pool.emit('wss://b-write.example', ev('s2', PK_B));
      pool.emit('wss://a-write.example', ev('s1')); // dup ignored
      pool.eoseAll();
      await tick();
      expect(events).toEqual([
        { content: 's1', relayHints: ['wss://a-write.example'] },
        { content: 's2', relayHints: ['wss://b-write.example'] },
      ]);
      expect(pool.subs.some((s) => !s.closed)).toBe(true);
      sub.close();
      expect(pool.subs.every((s) => s.closed)).toBe(true);
    });

    it('signals closed("relay list unavailable") when no relays resolve and the pool stays untouched', async () => {
      const pool = makePool();
      const router = makeRouter(pool, { fallbackRelays: [] });
      let reason: string | undefined = 'unset';
      router.subscribe([{ ids: ['x'] }], undefined, {
        event: () => { /* ignore */ },
        closed: (r) => { reason = r; },
      });
      await tick();
      expect(reason).toBe('relay list unavailable');
      expect(pool.subs).toHaveLength(0);
    });

    it('close() stops the immediate fallback and prevents late discovery attachment', async () => {
      const pool = makePool();
      const relayLists = deferred<Map<string, RelayListEntry>>();
      const router = makeRouter(pool, { loadRelayLists: () => relayLists.promise });
      const sub = router.subscribe([{ authors: [PK_A] }], undefined, {
        event: () => { /* ignore */ }, closed: () => { /* ignore */ },
      });
      expect(pool.subs.map((item) => item.relays[0])).toEqual(['wss://fallback.example']);
      sub.close();
      relayLists.resolve(NIP65);
      await tick();
      expect(pool.subs).toHaveLength(1);
      expect(pool.subs[0].closed).toBe(true);
    });
  });

  describe('publish', () => {
    const template: EventTemplate = { kind: 1, content: 'gm', tags: [], created_at: 1234 };

    it('returns "publish denied" when no signer is configured', async () => {
      const router = makeRouter(makePool());
      expect(await router.publish(template)).toEqual({ ok: false, error: 'publish denied' });
    });

    it('signs and fans out to the author\'s write relays (outbox), normalizing a void return to success', async () => {
      const pool = makePool();
      const signEvent = vi.fn(async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('signed'), ...t, pubkey: PK_A, id: 'signedid'.padEnd(64, '0') }));
      const router = makeRouter(pool, { signEvent });
      const result = await router.publish(template);
      expect(signEvent).toHaveBeenCalledWith(template);
      expect(pool.published).toHaveLength(1);
      expect(pool.published[0].relays).toEqual(['wss://a-write.example']);
      expect(result).toEqual({ ok: true, event: expect.objectContaining({ pubkey: PK_A }), eventId: 'signedid'.padEnd(64, '0'), relays: { 'wss://a-write.example': true } });
    });

    it('includes recipient inbox (read) relays for directed events and merges explicit relay targets', async () => {
      const pool = makePool();
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, { signEvent });
      await router.publish(template, { toInboxes: [PK_B], relays: ['wss://extra.example'] });
      expect(pool.published[0].relays.sort()).toEqual(['wss://a-write.example', 'wss://b-read.example', 'wss://extra.example']);
    });

    it('honors toOutbox:false while still publishing to required inboxes and explicit relays', async () => {
      const pool = makePool();
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, { signEvent });
      await router.publish(template, { toOutbox: false, toInboxes: [PK_B], relays: ['wss://extra.example'] });
      expect(pool.published[0].relays.sort()).toEqual(['wss://b-read.example', 'wss://extra.example']);
    });

    it('fails when the default own outbox publish target cannot resolve NIP-65 write relays', async () => {
      const pool = makePool();
      const missingPubkey = 'c'.repeat(64);
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: missingPubkey });
      const router = makeRouter(pool, { signEvent });
      const result = await router.publish(template);
      expect(result).toMatchObject({ ok: false, error: 'relay list unavailable', eventId: ev('d', missingPubkey).id });
      expect(pool.published).toHaveLength(0);
    });

    it('fails when a required inbox author has no resolvable NIP-65 read relays', async () => {
      const pool = makePool();
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, { signEvent });
      const result = await router.publish(template, { toInboxes: ['c'.repeat(64)] });
      expect(result).toMatchObject({ ok: false, error: 'relay list unavailable' });
      expect(pool.published).toHaveLength(0);
    });

    it('fails when policy denies every relay for a required inbox author', async () => {
      const pool = makePool();
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, {
        signEvent,
        isRelayAllowed: (url) => url !== 'wss://b-read.example',
      });
      const result = await router.publish(template, { toInboxes: [PK_B] });
      expect(result).toMatchObject({ ok: false, error: 'policy denied' });
      expect(pool.published).toHaveLength(0);
    });

    it('reports per-relay failure and ok:false when every relay rejects', async () => {
      const pool = makePool();
      pool.publishReturn = { 'wss://a-write.example': false };
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, { signEvent });
      const result = await router.publish(template);
      expect(result.ok).toBe(false);
      expect(result.relays).toEqual({ 'wss://a-write.example': false });
      expect(result.error).toBe('publish denied');
    });

    it('reports ok:false when a required relay rejects even if an explicit candidate succeeds', async () => {
      const pool = makePool();
      pool.publishReturn = { 'wss://a-write.example': false, 'wss://extra.example': true };
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, { signEvent });
      const result = await router.publish(template, { relays: ['wss://extra.example'] });
      expect(result.ok).toBe(false);
      expect(result.relays).toEqual({ 'wss://a-write.example': false, 'wss://extra.example': true });
      expect(result.error).toBe('publish denied');
    });

    it('allows explicit candidate failures when every required relay succeeds', async () => {
      const pool = makePool();
      pool.publishReturn = { 'wss://a-write.example': true, 'wss://extra.example': false };
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, { signEvent });
      const result = await router.publish(template, { relays: ['wss://extra.example'] });
      expect(result.ok).toBe(true);
      expect(result.relays).toEqual({ 'wss://a-write.example': true, 'wss://extra.example': false });
      expect(result.error).toBeUndefined();
    });

    it('surfaces a signer rejection as an error', async () => {
      const router = makeRouter(makePool(), { signEvent: async () => { throw new Error('user rejected'); } });
      expect(await router.publish(template)).toEqual({ ok: false, error: 'user rejected' });
    });
  });
});

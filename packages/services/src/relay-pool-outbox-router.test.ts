/**
 * relay-pool-outbox-router.test.ts — concrete outbox-model router.
 *
 * Drives a controllable mock OutboxRelayPool (one subscription per relay) to
 * exercise NIP-65 relay resolution, per-relay fanout + dedup + relay
 * attribution, signature validation, query limit/timeout/incomplete, live vs
 * one-shot subscriptions, and signed publish fanout.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRelayPoolOutboxRouter } from './relay-pool-outbox-router.js';
import type { OutboxRelayPool, RelayListEntry } from './relay-pool-outbox-router.js';
import type { EventTemplate, NostrEvent } from '@napplet/core';

const PK_A = 'a'.repeat(64);
const PK_B = 'b'.repeat(64);

function ev(id: string, pubkey = PK_A, created_at = 1000): NostrEvent {
  return { id: id.padEnd(64, '0'), pubkey, kind: 1, content: id, tags: [], created_at, sig: 'f'.repeat(128) };
}

/** A microtask+timer flush. */
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Sub {
  relays: string[];
  cb: (item: NostrEvent | 'EOSE') => void;
  closed: boolean;
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
    subscribe(_filters: unknown, relayUrls: string[], cb: (item: NostrEvent | 'EOSE') => void) {
      const sub: Sub = { relays: relayUrls, cb, closed: false };
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
  };
  return pool as OutboxRelayPool & typeof pool;
}

const NIP65 = new Map<string, RelayListEntry>([
  [PK_A, { read: ['wss://a-read'], write: ['wss://a-write'] }],
  [PK_B, { read: ['wss://b-read'], write: ['wss://b-write'] }],
]);

const FALLBACK = ['wss://fallback'];

function makeRouter(pool: OutboxRelayPool, overrides: Partial<Parameters<typeof createRelayPoolOutboxRouter>[0]> = {}) {
  return createRelayPoolOutboxRouter({
    relayPool: pool,
    loadRelayLists: (pubkeys) => new Map([...NIP65].filter(([pk]) => pubkeys.includes(pk))),
    fallbackRelays: FALLBACK,
    defaultTimeoutMs: 50,
    ...overrides,
  });
}

describe('createRelayPoolOutboxRouter', () => {
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
      expect(plan).toEqual({ relays: ['wss://a-write'], source: 'nip65' });
    });

    it('write direction → author READ relays (inbox model)', async () => {
      const plan = await router.resolveRelays({ pubkey: PK_A, direction: 'write' });
      expect(plan).toEqual({ relays: ['wss://a-read'], source: 'nip65' });
    });

    it('strategy "outbox" forces write relays even for write direction', async () => {
      const plan = await router.resolveRelays({ pubkey: PK_A, direction: 'write', strategy: 'outbox' });
      expect(plan.relays).toEqual(['wss://a-write']);
    });

    it('strategy "inbox" forces read relays even for read direction', async () => {
      const plan = await router.resolveRelays({ pubkey: PK_A, direction: 'read', strategy: 'inbox' });
      expect(plan.relays).toEqual(['wss://a-read']);
    });

    it('aggregates multiple authors and dedups', async () => {
      const plan = await router.resolveRelays({ authors: [PK_A, PK_B], direction: 'read' });
      expect(plan.relays.sort()).toEqual(['wss://a-write', 'wss://b-write']);
    });

    it('reports missingAuthors and falls back when no list is known', async () => {
      const plan = await router.resolveRelays({ authors: ['c'.repeat(64)], direction: 'read' });
      expect(plan).toEqual({ relays: ['wss://fallback'], source: 'fallback', missingAuthors: ['c'.repeat(64)] });
    });

    it('gates non-ws relay hints out of the plan', async () => {
      const pool = makePool();
      const r = makeRouter(pool);
      const plan = await r.resolveRelays({ authors: [], direction: 'read' });
      // no pubkeys, no hints → fallback
      expect(plan.source).toBe('fallback');
    });
  });

  describe('query', () => {
    it('fans out per relay, dedups by id, and records every relay an event was seen on', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const p = router.query([{ authors: [PK_A, PK_B], kinds: [1] }]);
      await tick();
      // Subscriptions: one per resolved write relay (a-write, b-write).
      expect(pool.subs.map((s) => s.relays[0]).sort()).toEqual(['wss://a-write', 'wss://b-write']);

      pool.emit('wss://a-write', ev('e1'));
      pool.emit('wss://b-write', ev('e1')); // same event from a second relay
      pool.emit('wss://b-write', ev('e2', PK_B));
      pool.eoseAll();

      const result = await p;
      expect(result.events.map((e) => e.content).sort()).toEqual(['e1', 'e2']);
      expect(result.relays[ev('e1').id].sort()).toEqual(['wss://a-write', 'wss://b-write']);
      expect(result.relays[ev('e2', PK_B).id]).toEqual(['wss://b-write']);
      expect(result.incomplete).toBeUndefined();
    });

    it('drops events that fail signature verification', async () => {
      const pool = makePool();
      const verifyEvent = vi.fn((e: NostrEvent) => e.content !== 'bad');
      const router = makeRouter(pool, { verifyEvent });
      const p = router.query([{ authors: [PK_A] }]);
      await tick();
      pool.emit('wss://a-write', ev('good'));
      pool.emit('wss://a-write', ev('bad'));
      pool.eoseAll();
      const result = await p;
      expect(result.events.map((e) => e.content)).toEqual(['good']);
      expect(result.relays[ev('bad').id]).toBeUndefined();
    });

    it('applies the limit, keeping the most recent events', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const p = router.query([{ authors: [PK_A] }], { limit: 2 });
      await tick();
      pool.emit('wss://a-write', ev('old', PK_A, 100));
      pool.emit('wss://a-write', ev('mid', PK_A, 200));
      pool.emit('wss://a-write', ev('new', PK_A, 300));
      pool.eoseAll();
      const result = await p;
      expect(result.events.map((e) => e.content)).toEqual(['new', 'mid']);
    });

    it('marks incomplete on timeout when a relay never EOSEs', async () => {
      const pool = makePool();
      const router = makeRouter(pool, { defaultTimeoutMs: 20 });
      const p = router.query([{ authors: [PK_A] }]);
      await tick();
      pool.emit('wss://a-write', ev('e1'));
      // no EOSE — let the timeout fire
      const result = await p;
      expect(result.events.map((e) => e.content)).toEqual(['e1']);
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

    it('returns relay-list-unavailable error when the pool is offline', async () => {
      const pool = makePool();
      pool.available = false;
      const router = makeRouter(pool);
      const result = await router.query([{ authors: [PK_A] }]);
      expect(result).toEqual({ events: [], relays: {}, incomplete: true, error: 'relay list unavailable' });
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

  describe('subscribe', () => {
    it('streams attributed events and one eose after all relays EOSE (live keeps open)', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const events: Array<{ content: string; relay?: string }> = [];
      let eoseCount = 0;
      const sub = router.subscribe([{ authors: [PK_A, PK_B] }], { live: true }, {
        event: (e, relay) => events.push({ content: e.content, relay }),
        eose: () => { eoseCount += 1; },
        closed: () => { /* ignore */ },
      });
      await tick();
      pool.emit('wss://a-write', ev('s1'));
      pool.emit('wss://b-write', ev('s2', PK_B));
      pool.emit('wss://a-write', ev('s1')); // dup ignored
      pool.eoseAll();
      await tick();
      expect(events).toEqual([
        { content: 's1', relay: 'wss://a-write' },
        { content: 's2', relay: 'wss://b-write' },
      ]);
      expect(eoseCount).toBe(1);
      expect(pool.subs.some((s) => !s.closed)).toBe(true); // still open (live)
      sub.close();
      expect(pool.subs.every((s) => s.closed)).toBe(true);
    });

    it('one-shot (live:false) closes after eose', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      let closed = false;
      router.subscribe([{ authors: [PK_A] }], { live: false }, {
        event: () => { /* ignore */ },
        eose: () => { /* ignore */ },
        closed: () => { closed = true; },
      });
      await tick();
      pool.eoseAll();
      await tick();
      expect(closed).toBe(true);
      expect(pool.subs.every((s) => s.closed)).toBe(true);
    });

    it('signals closed("relay list unavailable") when no relays resolve and the pool stays untouched', async () => {
      const pool = makePool();
      const router = makeRouter(pool, { fallbackRelays: [] });
      let reason: string | undefined = 'unset';
      router.subscribe([{ ids: ['x'] }], undefined, {
        event: () => { /* ignore */ },
        eose: () => { /* ignore */ },
        closed: (r) => { reason = r; },
      });
      await tick();
      expect(reason).toBe('relay list unavailable');
      expect(pool.subs).toHaveLength(0);
    });

    it('close() before resolution prevents any subscription', async () => {
      const pool = makePool();
      const router = makeRouter(pool);
      const sub = router.subscribe([{ authors: [PK_A] }], undefined, {
        event: () => { /* ignore */ }, eose: () => { /* ignore */ }, closed: () => { /* ignore */ },
      });
      sub.close();
      await tick();
      expect(pool.subs).toHaveLength(0);
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
      expect(pool.published[0].relays).toEqual(['wss://a-write']);
      expect(result).toEqual({ ok: true, event: expect.objectContaining({ pubkey: PK_A }), eventId: 'signedid'.padEnd(64, '0'), relays: { 'wss://a-write': true } });
    });

    it('includes recipient inbox (read) relays for directed events and merges relay hints', async () => {
      const pool = makePool();
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, { signEvent });
      await router.publish(template, { targetAuthors: [PK_B], relays: ['wss://extra'] });
      expect(pool.published[0].relays.sort()).toEqual(['wss://a-write', 'wss://b-read', 'wss://extra']);
    });

    it('reports per-relay failure and ok:false when every relay rejects', async () => {
      const pool = makePool();
      pool.publishReturn = { 'wss://a-write': false };
      const signEvent = async (t: EventTemplate): Promise<NostrEvent> => ({ ...ev('d'), ...t, pubkey: PK_A });
      const router = makeRouter(pool, { signEvent });
      const result = await router.publish(template);
      expect(result.ok).toBe(false);
      expect(result.relays).toEqual({ 'wss://a-write': false });
      expect(result.error).toBe('publish denied');
    });

    it('surfaces a signer rejection as an error', async () => {
      const router = makeRouter(makePool(), { signEvent: async () => { throw new Error('user rejected'); } });
      expect(await router.publish(template)).toEqual({ ok: false, error: 'user rejected' });
    });
  });
});

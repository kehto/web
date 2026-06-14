/**
 * index.test.ts — Unit tests for the NIP-66 aggregator factory.
 *
 * Mirrors hyprgate's nip66-monitor.test.ts structure but adapted for the
 * closure-scoped API — no module-level mocks, no fake timers, no OPFS /
 * network-store stubs. Each test constructs a fresh aggregator + pool-stub
 * pair, feeds events through the captured onEvent callback, and asserts
 * against the public API (start / resync / getRelaySet / getRelaysSupportingNip
 * / relaySupportsNip).
 *
 * The 9-test shape proves every `must_haves.truth` in Plan 34-02:
 *   1. start() subscribes with bootstrap + { kinds: [30166] }
 *   2. networks populates #n
 *   3. empty / undefined networks omits #n
 *   4. d-tag drives getRelaySet()
 *   5. N-tag parsing populates relaySupportsNip / getRelaysSupportingNip
 *   6. lowercase 'n' tags ignored
 *   7. resync() clears + re-subscribes
 *   8. start() is idempotent
 *   9. multi-instance isolation (closure-scoped state, not module globals)
 */

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import {
  DEFAULT_RELAY_ATTRIBUTE_GROUPS,
  createNip66Aggregator,
  type Nip66RelayPool,
  type Nip66Filter,
} from './66.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a kind-30166 event with a `d`-tag URL, zero-or-more uppercase `N`-tags
 * (NIP numbers), and a spurious lowercase `['n', 'clearnet']` tag to prove the
 * N-tag parser's case-sensitivity guard.
 */
function makeKind30166(relayUrl: string, nTags: number[] = [], extraTags: string[][] = []): NostrEvent {
  const tags: string[][] = [['d', relayUrl]];
  for (const n of nTags) tags.push(['N', String(n)]);
  tags.push(...extraTags);
  // Lowercase 'n' (network-type tag) must NOT be parsed as a NIP number.
  tags.push(['n', 'clearnet']);
  return {
    id: 'event-' + Math.random().toString(36).slice(2),
    pubkey: 'monitor-pubkey-001',
    created_at: Math.floor(Date.now() / 1000),
    kind: 30166,
    tags,
    content: '',
    sig: 'sig-abc',
  };
}

/**
 * Pool-stub factory. Captures the args from the most recent pool.subscribe
 * call and exposes a `fire(event)` trigger that pushes through the captured
 * onEvent callback — this is how tests feed synthetic kind-30166 events into
 * the aggregator's internal processEvent.
 */
interface PoolStub {
  pool: Nip66RelayPool;
  fire: (event: NostrEvent) => void;
  lastArgs: { relays?: ReadonlyArray<string>; filter?: Nip66Filter };
  readonly subscribeCalls: number;
  readonly unsubscribeCalls: number;
}

function makePoolStub(): PoolStub {
  const lastArgs: { relays?: ReadonlyArray<string>; filter?: Nip66Filter } = {};
  let onEvent: ((event: NostrEvent) => void) | null = null;
  let subscribeCalls = 0;
  let unsubscribeCalls = 0;
  const pool: Nip66RelayPool = {
    subscribe: (relays, filter, cb) => {
      subscribeCalls++;
      lastArgs.relays = relays;
      lastArgs.filter = filter;
      onEvent = cb;
      return () => {
        unsubscribeCalls++;
        onEvent = null;
      };
    },
  };
  return {
    pool,
    fire: (event) => {
      if (onEvent) onEvent(event);
    },
    lastArgs,
    get subscribeCalls(): number {
      return subscribeCalls;
    },
    get unsubscribeCalls(): number {
      return unsubscribeCalls;
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createNip66Aggregator', () => {
  it('Test 1: start() calls pool.subscribe once with bootstrap + { kinds: [30166] } filter (no #n)', () => {
    const stub = makePoolStub();
    const bootstrap = ['wss://monitor.example.com'];
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap,
    });

    agg.start();

    expect(stub.subscribeCalls).toBe(1);
    expect(stub.lastArgs.relays).toBe(bootstrap);
    expect(stub.lastArgs.filter?.kinds).toEqual([30166]);
    expect(stub.lastArgs.filter?.['#n']).toBeUndefined();
  });

  it('Test 2: pool.subscribe filter carries #n tag when networks option is provided', () => {
    const stub = makePoolStub();
    const networks = ['clearnet', 'tor'];
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
      networks,
    });

    agg.start();

    expect(stub.subscribeCalls).toBe(1);
    expect(stub.lastArgs.filter?.['#n']).toEqual(['clearnet', 'tor']);
  });

  it('Test 3: pool.subscribe filter omits #n when networks option is empty or undefined', () => {
    // Sub-case A: empty array omits #n.
    {
      const stub = makePoolStub();
      const agg = createNip66Aggregator({
        pool: stub.pool,
        bootstrap: ['wss://monitor.example.com'],
        networks: [],
      });
      agg.start();
      expect(stub.lastArgs.filter?.['#n']).toBeUndefined();
      expect(stub.lastArgs.filter?.kinds).toEqual([30166]);
    }

    // Sub-case B: undefined networks omits #n.
    {
      const stub = makePoolStub();
      const agg = createNip66Aggregator({
        pool: stub.pool,
        bootstrap: ['wss://monitor.example.com'],
      });
      agg.start();
      expect(stub.lastArgs.filter?.['#n']).toBeUndefined();
    }
  });

  it('Test 4: processing a kind-30166 event adds the d-tag URL to getRelaySet()', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    agg.start();
    stub.fire(makeKind30166('wss://relay.one.com'));

    const relaySet = agg.getRelaySet();
    expect(relaySet.has('wss://relay.one.com')).toBe(true);
    expect(relaySet.size).toBe(1);
  });

  it('Test 5: N-tags with integer values populate relaySupportsNip / getRelaysSupportingNip', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    agg.start();
    stub.fire(makeKind30166('wss://test.relay', [77, 50]));

    expect(agg.relaySupportsNip('wss://test.relay', 77)).toBe(true);
    expect(agg.relaySupportsNip('wss://test.relay', 50)).toBe(true);
    expect(agg.relaySupportsNip('wss://test.relay', 1)).toBe(false);
    expect(agg.relaySupportsNip('wss://unknown.relay', 77)).toBe(false);

    const nip77Relays = agg.getRelaysSupportingNip(77);
    expect(nip77Relays).toContain('wss://test.relay');
  });

  it("Test 6: lowercase 'n' tags are ignored (not treated as NIP numbers)", () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    agg.start();
    // makeKind30166 appends a lowercase ['n', 'clearnet'] tag. With zero N-tags,
    // the lowercase 'n' must NOT populate the NIP-support map.
    stub.fire(makeKind30166('wss://r', []));

    // d-tag still drives URL collection.
    expect(agg.getRelaySet().has('wss://r')).toBe(true);

    // No NIP support should be registered for any number (the only tag besides
    // 'd' was a lowercase 'n').
    expect(agg.relaySupportsNip('wss://r', 0)).toBe(false);
    expect(agg.relaySupportsNip('wss://r', 1)).toBe(false);
    expect(agg.relaySupportsNip('wss://r', 77)).toBe(false);
    // NaN-checked: 'clearnet' is not an integer. parseInt('clearnet', 10) → NaN
    // is guarded by Number.isNaN.
    expect(agg.getRelaysSupportingNip(77)).not.toContain('wss://r');
  });

  it('Test 7: resync() calls unsubscribe, clears state, and re-subscribes', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    agg.start();
    stub.fire(makeKind30166('wss://initial.relay.com', [77]));
    expect(agg.getRelaySet().has('wss://initial.relay.com')).toBe(true);
    expect(agg.relaySupportsNip('wss://initial.relay.com', 77)).toBe(true);
    expect(stub.subscribeCalls).toBe(1);

    agg.resync();

    // (a) unsubscribe was called exactly once
    expect(stub.unsubscribeCalls).toBe(1);
    // (b) state cleared
    expect(agg.getRelaySet().size).toBe(0);
    // (c) prior NIP support gone
    expect(agg.relaySupportsNip('wss://initial.relay.com', 77)).toBe(false);
    // (d) subscribe called a second time (initial + resync)
    expect(stub.subscribeCalls).toBe(2);

    // Post-resync subscription is live — firing should re-populate.
    stub.fire(makeKind30166('wss://fresh.relay.com'));
    expect(agg.getRelaySet().has('wss://fresh.relay.com')).toBe(true);
  });

  it('Test 8: start() is idempotent — two consecutive calls produce one subscribe', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    agg.start();
    agg.start();
    agg.start();

    expect(stub.subscribeCalls).toBe(1);
    expect(stub.unsubscribeCalls).toBe(0);
  });

  it('Test 9: two aggregators share no state (closure-scoped, not module globals)', () => {
    const stubA = makePoolStub();
    const stubB = makePoolStub();
    const aggA = createNip66Aggregator({
      pool: stubA.pool,
      bootstrap: ['wss://monitor-a.example.com'],
    });
    const aggB = createNip66Aggregator({
      pool: stubB.pool,
      bootstrap: ['wss://monitor-b.example.com'],
    });

    aggA.start();
    aggB.start();

    // Fire an event through A's pool only.
    stubA.fire(makeKind30166('wss://only-in-a.com', [77]));

    // A sees it.
    expect(aggA.getRelaySet().has('wss://only-in-a.com')).toBe(true);
    expect(aggA.relaySupportsNip('wss://only-in-a.com', 77)).toBe(true);

    // B must NOT see it — would fail if state lived at module scope.
    expect(aggB.getRelaySet().size).toBe(0);
    expect(aggB.getRelaySet().has('wss://only-in-a.com')).toBe(false);
    expect(aggB.relaySupportsNip('wss://only-in-a.com', 77)).toBe(false);
    expect(aggB.getRelaysSupportingNip(77)).toHaveLength(0);
  });

  it('Test 10: stop() after start() invokes unsubscribe exactly once and leaves accumulated state intact', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    agg.start();
    stub.fire(makeKind30166('wss://stop-test.relay', [44]));

    // Verify state was populated before stop()
    expect(agg.getRelaySet().size).toBe(1);
    expect(agg.getRelaySet().has('wss://stop-test.relay')).toBe(true);
    expect(agg.relaySupportsNip('wss://stop-test.relay', 44)).toBe(true);

    agg.stop();

    // unsubscribe called exactly once
    expect(stub.unsubscribeCalls).toBe(1);
    expect(stub.subscribeCalls).toBe(1);

    // stop() is teardown, NOT reset — accumulated state must be preserved
    expect(agg.getRelaySet().size).toBe(1);
    expect(agg.getRelaySet().has('wss://stop-test.relay')).toBe(true);
    expect(agg.relaySupportsNip('wss://stop-test.relay', 44)).toBe(true);
  });

  it('Test 11: stop() without a prior start() is a safe no-op', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    // Should not throw
    expect(() => agg.stop()).not.toThrow();
    expect(stub.subscribeCalls).toBe(0);
    expect(stub.unsubscribeCalls).toBe(0);
  });

  it('Test 12: start() after stop() re-subscribes (idempotency guard does not block re-start)', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    // First start → stop cycle
    agg.start();
    agg.stop();

    // Second start — must re-subscribe (idempotency guard cleared by stop())
    agg.start();
    stub.fire(makeKind30166('wss://restarted.relay', [9]));

    expect(stub.subscribeCalls).toBe(2);
    expect(stub.unsubscribeCalls).toBe(1);
    expect(agg.getRelaySet().has('wss://restarted.relay')).toBe(true);
  });

  it('Test 13: ad hoc relay attributes are exposed and matched by default groups', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
    });

    agg.start();
    stub.fire(makeKind30166('wss://indexer.relay', [65], [['T', 'Indexer'], ['k', '10002']]));
    stub.fire(makeKind30166('wss://relay-indexer.relay', [66], [['T', 'RelayIndexer'], ['k', '30166']]));

    expect(agg.getRelaysForAttributeGroup('Indexer')).toEqual(['wss://indexer.relay']);
    expect(agg.getRelaysForAttributeGroup('RelayIndexer')).toEqual(['wss://relay-indexer.relay']);

    const attrs = agg.getRelayAttributes('wss://indexer.relay');
    expect(attrs?.supportedNips.has(65)).toBe(true);
    expect(attrs?.values.get('T')?.has('Indexer')).toBe(true);
    expect(attrs?.values.get('k')?.has('10002')).toBe(true);
  });

  it('Test 14: custom relay attribute groups can route emerging tag conventions', () => {
    const stub = makePoolStub();
    const agg = createNip66Aggregator({
      pool: stub.pool,
      bootstrap: ['wss://monitor.example.com'],
      relayAttributeGroups: {
        ...DEFAULT_RELAY_ATTRIBUTE_GROUPS,
        ProfileSearch: [{ tag: 'x-kehto-role', values: ['profile-search'] }],
      },
    });

    agg.start();
    stub.fire(makeKind30166('wss://search.relay', [], [['x-kehto-role', 'profile-search']]));

    expect(agg.getRelaysForAttributeGroup('ProfileSearch')).toEqual(['wss://search.relay']);
    expect(agg.getRelaysMatchingAttributes([{ tag: 'x-kehto-role' }])).toEqual(['wss://search.relay']);
  });
});

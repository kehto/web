/**
 * mock-relay-pool.ts — In-memory mock relay pool for the demo (CONTEXT D-USER-01).
 *
 * Demo-only seam; not published. Holds 5 kind:1 fixture events and emits them on
 * relay.subscribe matching {kinds:[1]}. Stores relay.publish events in an in-memory
 * array for debug visibility. No scoped-relay support (NAP-06 does not require it).
 *
 * Anti-features enforced (verified by Plan 20-06 and 20-07 acceptance greps):
 * - No raw postMessage listeners on window
 * - No NIP-01 array wire format
 * - No direct nostr signer access, no internal service bus references, no legacy kind numbers
 */

import type { NostrEvent, NostrFilter } from '@kehto/shell';

// ─── Fixture events ───────────────────────────────────────────────────────────

/**
 * 5 deterministic kind:1 fixture events for the feed napplet and Playwright specs.
 * Timestamps are time-ordered (oldest → newest) relative to module load time.
 * Signatures are fixture-only — the demo does not verify signatures on received events.
 */
const _now = Math.floor(Date.now() / 1000);
const FIXTURE_EVENTS: NostrEvent[] = [
  {
    id: '1'.repeat(64),
    pubkey: 'aaaa0000000000000000000000000000000000000000000000000000000000aa',
    kind: 1,
    content: 'Welcome to the kehto demo!',
    created_at: _now - 4,
    tags: [['t', 'demo-feed']],
    sig: '0'.repeat(128),
  },
  {
    id: '2'.repeat(64),
    pubkey: 'bbbb0000000000000000000000000000000000000000000000000000000000bb',
    kind: 1,
    content: 'NIP-5D ships in v1.3 — 8 nub domains end-to-end',
    created_at: _now - 3,
    tags: [['t', 'demo-feed']],
    sig: '0'.repeat(128),
  },
  {
    id: '3'.repeat(64),
    pubkey: 'cccc0000000000000000000000000000000000000000000000000000000000cc',
    kind: 1,
    content: 'feed napplet subscribes; EOSE marks loaded',
    created_at: _now - 2,
    tags: [['t', 'demo-feed']],
    sig: '0'.repeat(128),
  },
  {
    id: '4'.repeat(64),
    pubkey: 'dddd0000000000000000000000000000000000000000000000000000000000dd',
    kind: 1,
    content: 'composer + preferences + toaster cover core domains',
    created_at: _now - 1,
    tags: [['t', 'demo-feed']],
    sig: '0'.repeat(128),
  },
  {
    id: '5'.repeat(64),
    pubkey: 'eeee0000000000000000000000000000000000000000000000000000000000ee',
    kind: 1,
    content: 'theme-switcher broadcasts; preferences observes',
    created_at: _now,
    tags: [['t', 'demo-feed']],
    sig: '0'.repeat(128),
  },
];

// ─── Published event store ────────────────────────────────────────────────────

/** In-memory store for relay.publish calls — for debug visibility and future test inspection. */
const publishedEvents: NostrEvent[] = [];

// ─── Filter matching ──────────────────────────────────────────────────────────

/**
 * Minimal filter matcher — only checks `kinds` and `limit`.
 * Other fields (authors, since, until, '#t') are intentionally ignored in v1.3.
 *
 * @param event - The NostrEvent to test
 * @param filter - A single NostrFilter
 * @returns true if the event matches the filter
 */
function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  if (filter.kinds !== undefined && !filter.kinds.includes(event.kind)) {
    return false;
  }
  return true;
}

// ─── SimplePool-shaped mock ───────────────────────────────────────────────────

/**
 * Builds a SimplePool-shaped object that emits fixture events on subscription.
 *
 * @returns SimplePool-shaped object for use as `getRelayPool()` return value
 */
function buildSimplePool() {
  return {
    /**
     * Subscribe to events. Emits matching fixture events via microtask, then EOSE.
     *
     * Returns an observable-shaped object with a `.subscribe(fn)` method that
     * matches the interface hooks-adapter.ts expects from nostr-tools SimplePool:
     *   pool.subscription(urls, filters).subscribe((item: NostrEvent | 'EOSE') => void)
     *
     * The callback receives NostrEvent objects for events, then the string 'EOSE'.
     * Both events and EOSE are dispatched via queueMicrotask so they arrive AFTER
     * subscribe() returns — matching real relay async behaviour (Pitfall 4).
     *
     * @param _relays - Relay URLs (ignored — in-memory pool)
     * @param filters - Filter or filters to match against fixture events
     * @returns Observable-shaped object with subscribe(fn) returning { unsubscribe }
     */
    subscription(
      _relays: string[],
      filters: NostrFilter | NostrFilter[],
    ): { subscribe: (fn: (item: NostrEvent | 'EOSE') => void) => { unsubscribe: () => void } } {
      const filterArr: NostrFilter[] = Array.isArray(filters) ? filters : [filters];

      // Collect matching events respecting per-filter limit
      const matchingEvents: NostrEvent[] = [];
      for (const filter of filterArr) {
        let count = 0;
        const cap = filter.limit ?? Infinity;
        for (const event of FIXTURE_EVENTS) {
          if (count >= cap) break;
          if (matchesFilter(event, filter)) {
            matchingEvents.push(event);
            count++;
          }
        }
      }

      return {
        subscribe(fn: (item: NostrEvent | 'EOSE') => void): { unsubscribe: () => void } {
          // Dispatch event callbacks via microtask so they arrive AFTER subscribe() returns
          // — matches real relay async behaviour (queueMicrotask per mock-relay-pool design).
          for (const event of matchingEvents) {
            const captured = event;
            queueMicrotask(() => fn(captured));
          }
          // Emit EOSE after all event microtasks have been queued
          queueMicrotask(() => fn('EOSE'));
          return { unsubscribe: () => { /* no-op — microtasks already queued */ } };
        },
      };
    },

    /**
     * Publish an event to the mock pool (stored in-memory; no network traffic).
     *
     * @param _relays - Relay URLs (ignored)
     * @param event - The NostrEvent to store
     * @returns Array with a single resolved promise (nostr-tools shape)
     */
    publish(_relays: string[], event: NostrEvent): Promise<string>[] {
      publishedEvents.push(event);
      return [Promise.resolve('ok')];
    },

    /**
     * No-op request method — kept for API shape compatibility with the existing stub.
     *
     * @returns Observable-like no-op handle
     */
    request(
      _relays: string[],
      _filters: NostrFilter | NostrFilter[],
    ): { subscribe: () => { unsubscribe: () => void } } {
      return { subscribe: () => ({ unsubscribe: () => {} }) };
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * ShellAdapter.relayPool interface — shape expected by @kehto/shell adapter.
 * Returned by createMockRelayPool().
 */
export interface MockRelayPool {
  getRelayPool(): ReturnType<typeof buildSimplePool>;
  trackSubscription(): void;
  untrackSubscription(): void;
  openScopedRelay(): void;
  closeScopedRelay(): void;
  publishToScopedRelay(): false;
  selectRelayTier(): string[];
  /** Returns events stored via relay.publish — for debug inspection and future spec use. */
  getPublishedEvents(): NostrEvent[];
}

/**
 * Creates an in-memory mock relay pool for the demo.
 *
 * Satisfies the `ShellAdapter.relayPool` slot required by ShellAdapter. On
 * relay.subscribe({kinds:[1]}) emits 5 fixture kind:1 events via microtask then EOSE.
 * On relay.publish stores the event in publishedEvents (no network traffic).
 *
 * @returns Object conforming to ShellAdapter.relayPool shape
 *
 * @example
 * ```ts
 * const hooks = {
 *   relayPool: createMockRelayPool(),
 *   // ...other hooks
 * };
 * ```
 */
export function createMockRelayPool(): MockRelayPool {
  const pool = buildSimplePool();

  return {
    getRelayPool: () => pool,
    trackSubscription: () => {},
    untrackSubscription: () => {},
    openScopedRelay: () => {},
    closeScopedRelay: () => {},
    publishToScopedRelay: () => false as const,
    selectRelayTier: () => [],
    getPublishedEvents: () => [...publishedEvents],
  };
}

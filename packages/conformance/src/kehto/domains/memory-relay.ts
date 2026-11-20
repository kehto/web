/**
 * kehto/domains/memory-relay.ts — A deterministic in-memory relay shared by the relay and outbox backends.
 *
 * It stores every published event, replays matching stored events to a new
 * subscription followed by EOSE (synchronously, so no fallback timer is ever
 * relied on), and fans new events out to live subscriptions. No sockets.
 */
import { finalizeEvent } from 'nostr-tools/pure';
import { matchFilters, type Filter } from 'nostr-tools/filter';
import type { NostrEvent } from 'nostr-tools';

/** Callback a subscription receives: an event, or `'EOSE'` once stored events are exhausted. */
export type MemoryRelayCallback = (item: NostrEvent | 'EOSE') => void;

/** One in-memory relay. */
export interface MemoryRelay {
  /** Subscribe: replay matching stored events, send EOSE, then stream new matches. */
  subscribe(filters: readonly unknown[], callback: MemoryRelayCallback): { unsubscribe(): void };
  /** Store an event and deliver it to every matching live subscription. */
  publish(event: NostrEvent): void;
  /** Sign a template with the relay's own author key and publish it, as another user would. */
  inject(template: { kind: number; content: string; tags: string[][] }): NostrEvent;
  /** Live subscription count (evidence that a close reached the backend). */
  liveSubscriptions(): number;
}

/** Key of the author whose events `inject` publishes. The key has no value. */
const AUTHOR_SECRET = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 0x09 : 0x44));

/** Fixed base time for injected events, so their ids are deterministic per injection. */
const INJECT_BASE_SECONDS = 1_700_000_000;

/**
 * Create an empty in-memory relay.
 *
 * @param seed - Signed events the relay starts with.
 * @returns The relay.
 * @example
 * ```ts
 * const relay = createMemoryRelay();
 * relay.subscribe([{ kinds: [1] }], (item) => console.log(item));
 * ```
 */
export function createMemoryRelay(seed: readonly NostrEvent[] = []): MemoryRelay {
  const events: NostrEvent[] = [...seed];
  const subscriptions = new Set<{ filters: Filter[]; callback: MemoryRelayCallback }>();
  let injected = 0;
  const relay: MemoryRelay = {
    subscribe(filters, callback) {
      const entry = { filters: filters as Filter[], callback };
      subscriptions.add(entry);
      for (const event of events) if (matchFilters(entry.filters, event)) callback(event);
      callback('EOSE');
      return { unsubscribe() { subscriptions.delete(entry); } };
    },
    publish(event) {
      if (!events.some((stored) => stored.id === event.id)) events.push(event);
      for (const entry of [...subscriptions]) if (matchFilters(entry.filters, event)) entry.callback(event);
    },
    inject(template) {
      injected += 1;
      const event = finalizeEvent({ ...template, created_at: INJECT_BASE_SECONDS + injected }, AUTHOR_SECRET);
      relay.publish(event);
      return event;
    },
    liveSubscriptions: () => subscriptions.size,
  };
  return relay;
}

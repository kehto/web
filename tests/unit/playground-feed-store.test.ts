import { describe, expect, it, vi } from 'vitest';
import type { NostrEvent, NostrFilter, Subscription } from '@napplet/core';
import { createFeedStore } from '../../apps/playground/napplets/feed/src/feed-store.js';

const PUBKEY = 'f'.repeat(64);
const OTHER_PUBKEY = 'e'.repeat(64);
const FOLLOW_PUBKEYS = ['a'.repeat(64), 'b'.repeat(64)];

interface RecordedCall {
  filters: NostrFilter | NostrFilter[];
  onEvent: (event: NostrEvent) => void;
  onEose: () => void;
  close: ReturnType<typeof vi.fn>;
}

function event(id: string, createdAt: number, pubkey = PUBKEY): NostrEvent {
  return {
    id,
    pubkey,
    kind: 1,
    content: `event ${id}`,
    created_at: createdAt,
    tags: [],
    sig: '0'.repeat(128),
  };
}

function profileEvent(pubkey: string, createdAt: number, content: unknown): NostrEvent {
  return {
    id: `${pubkey.slice(0, 8)}${createdAt}`.padEnd(64, '0'),
    pubkey,
    kind: 0,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    created_at: createdAt,
    tags: [],
    sig: '0'.repeat(128),
  };
}

function kind3Event(pubkey = PUBKEY, follows = FOLLOW_PUBKEYS): NostrEvent {
  return {
    id: '3'.repeat(64),
    pubkey,
    kind: 3,
    content: '',
    created_at: 30,
    tags: follows.map((follow) => ['p', follow]),
    sig: '0'.repeat(128),
  };
}

function firstFilter(filters: NostrFilter | NostrFilter[]): NostrFilter {
  return Array.isArray(filters) ? filters[0]! : filters;
}

describe('playground feed store', () => {
  it('subscribes to kind 3 contacts before following kind 1 authors', () => {
    const calls: RecordedCall[] = [];
    const store = createFeedStore(
      () => {},
      (filters, onEvent, onEose): Subscription => {
        const close = vi.fn();
        calls.push({ filters, onEvent, onEose, close });
        return { close };
      },
    );

    store.init(PUBKEY);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.filters).toEqual([{ kinds: [3], authors: [PUBKEY] }]);

    calls[0]?.onEvent(kind3Event());
    calls[0]?.onEose();

    expect(calls).toHaveLength(3);
    expect(firstFilter(calls[1]!.filters)).toEqual({ kinds: [1], authors: FOLLOW_PUBKEYS, limit: 50 });
    expect(firstFilter(calls[2]!.filters)).toMatchObject({ kinds: [1], authors: FOLLOW_PUBKEYS });
    expect(firstFilter(calls[2]!.filters)).toHaveProperty('since');
    expect(firstFilter(calls[1]!.filters)).not.toMatchObject({ authors: [PUBKEY] });
    expect(store.state.contactCount).toBe(2);
  });

  it('loads an empty real feed when the identity has no contact list', () => {
    const calls: RecordedCall[] = [];
    const store = createFeedStore(
      () => {},
      (filters, onEvent, onEose): Subscription => {
        const close = vi.fn();
        calls.push({ filters, onEvent, onEose, close });
        return { close };
      },
    );

    store.init(PUBKEY);
    calls[0]?.onEose();

    expect(calls).toHaveLength(1);
    expect(store.state.loaded).toBe(true);
    expect(store.state.loading).toBe(false);
    expect(store.state.timeline).toHaveLength(0);
    expect(store.state.eventCount).toBe(0);
    expect(store.state.contactCount).toBe(0);
  });

  it('dedupes and sorts received events newest first', () => {
    const calls: RecordedCall[] = [];
    const store = createFeedStore(
      () => {},
      (filters, onEvent, onEose): Subscription => {
        const close = vi.fn();
        calls.push({ filters, onEvent, onEose, close });
        return { close };
      },
    );

    store.init(PUBKEY);
    calls[0]?.onEvent(kind3Event());
    calls[0]?.onEose();
    calls[1]?.onEvent(event('a'.repeat(64), 10));
    calls[1]?.onEvent(event('b'.repeat(64), 20));
    calls[2]?.onEvent(event('a'.repeat(64), 10));
    calls[1]?.onEose();

    expect(store.state.timeline.map((item) => item.id[0])).toEqual(['b', 'a']);
    expect(store.state.eventCount).toBe(2);
    expect(store.state.loading).toBe(false);
    expect(store.state.loaded).toBe(true);
  });

  it('subscribes to kind 0 profile metadata for timeline authors', () => {
    const calls: RecordedCall[] = [];
    const author = FOLLOW_PUBKEYS[0]!;
    const store = createFeedStore(
      () => {},
      (filters, onEvent, onEose): Subscription => {
        const close = vi.fn();
        calls.push({ filters, onEvent, onEose, close });
        return { close };
      },
    );

    store.init(PUBKEY);
    calls[0]?.onEvent(kind3Event());
    calls[0]?.onEose();
    calls[1]?.onEvent(event('c'.repeat(64), 40, author));

    const profileCall = calls.find((call) => {
      const filter = firstFilter(call.filters);
      return filter.kinds?.includes(0) && filter.authors?.includes(author);
    });
    expect(profileCall).toBeDefined();
    expect(firstFilter(profileCall!.filters)).toEqual({ kinds: [0], authors: [author], limit: 1 });

    profileCall!.onEvent(profileEvent(author, 20, {
      name: 'alice',
      display_name: 'Alice Example',
      picture: 'https://example.com/alice.png',
    }));
    profileCall!.onEvent(profileEvent(author, 10, { name: 'older' }));
    profileCall!.onEvent(profileEvent(author, 30, '{not-json'));

    expect(store.state.profiles.get(author)).toEqual({
      name: 'alice',
      display_name: 'Alice Example',
      picture: 'https://example.com/alice.png',
    });
  });

  it('closes old shell relay subscriptions on identity change and destroy', () => {
    const closes: Array<ReturnType<typeof vi.fn>> = [];
    const store = createFeedStore(
      () => {},
      (): Subscription => {
        const close = vi.fn();
        closes.push(close);
        return { close };
      },
    );

    store.init(PUBKEY);
    store.init(OTHER_PUBKEY);
    expect(closes[0]?.mock.calls.length).toBe(1);

    store.destroy();
    expect(closes[1]?.mock.calls.length).toBe(1);
  });

  it('clears timeline state and closes subscriptions when identity is lost', () => {
    const closes: Array<ReturnType<typeof vi.fn>> = [];
    const calls: RecordedCall[] = [];
    const store = createFeedStore(
      () => {},
      (filters, onEvent, onEose): Subscription => {
        const close = vi.fn();
        closes.push(close);
        calls.push({ filters, onEvent, onEose, close });
        return { close };
      },
    );

    store.init(PUBKEY);
    calls[0]?.onEvent(kind3Event());
    calls[0]?.onEose();
    calls[1]?.onEvent(event('a'.repeat(64), 11));
    calls[2]?.onEvent(event('b'.repeat(64), 12));
    expect(store.state.eventCount).toBe(2);

    store.clear();

    expect(closes.every((close) => close.mock.calls.length === 1)).toBe(true);
    expect(store.state.pubkey).toBeNull();
    expect(store.state.timeline).toHaveLength(0);
    expect(store.state.eventCount).toBe(0);
    expect(store.state.loaded).toBe(false);
  });
});

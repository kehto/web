import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { createCoordinatedRelay } from './coordinated-relay.js';

describe('createCoordinatedRelay', () => {
  const event: NostrEvent = {
    id: 'd'.repeat(64),
    pubkey: 'e'.repeat(64),
    created_at: 1_800_000_000,
    kind: 1,
    tags: [],
    content: 'coordinated publish',
    sig: 'f'.repeat(128),
  };

  it('honors canonical relay.subscribe relay hint without falling back to relay selection', () => {
    const subscribe = vi.fn((
      _filters: NostrFilter[],
      callback: (item: NostrEvent | 'EOSE') => void,
      _relayUrls?: string[],
    ) => {
      callback('EOSE');
      return { unsubscribe() { /* no-op */ } };
    });
    const selectRelayTier = vi.fn(() => ['wss://selected.test']);
    const service = createCoordinatedRelay({
      relayPool: {
        subscribe,
        publish: vi.fn(),
        selectRelayTier,
        isAvailable: () => true,
      },
      cache: {
        query: vi.fn(async () => []),
        store: vi.fn(),
        isAvailable: () => false,
      },
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      {
        type: 'relay.subscribe',
        id: 'relay-hint',
        subId: 'sub-relay-hint',
        filters: [{ kinds: [1] }],
        relay: 'wss://explicit.test',
      } as NappletMessage,
      (message) => sent.push(message),
    );

    expect(selectRelayTier).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith(
      [{ kinds: [1] }],
      expect.any(Function),
      ['wss://explicit.test'],
    );
    expect(sent).toContainEqual({ type: 'relay.eose', subId: 'sub-relay-hint' });
  });

  it('publishes, caches, and returns the canonical signed event result', async () => {
    const publish = vi.fn();
    const store = vi.fn();
    const service = createCoordinatedRelay({
      relayPool: {
        subscribe: vi.fn(() => ({ unsubscribe() { /* no-op */ } })),
        publish,
        publishToRelays: (_urls, event) => publish(event),
        selectRelayTier: vi.fn(() => []),
        isAvailable: () => true,
      },
      cache: {
        query: vi.fn(async () => []),
        store,
        isAvailable: () => true,
      },
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'relay.publish', id: 'publish-ok', event } as NappletMessage,
      (message) => sent.push(message),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(publish).toHaveBeenCalledWith(event);
    expect(store).toHaveBeenCalledWith(event);
    expect(sent).toEqual([{
      type: 'relay.publish.result',
      id: 'publish-ok',
      ok: true,
      event,
      eventId: event.id,
    }]);
  });

  it('returns a canonical failure without caching when the relay pool is unavailable', () => {
    const publish = vi.fn();
    const store = vi.fn();
    const service = createCoordinatedRelay({
      relayPool: {
        subscribe: vi.fn(() => ({ unsubscribe() { /* no-op */ } })),
        publish,
        publishToRelays: (_urls, event) => publish(event),
        selectRelayTier: vi.fn(() => []),
        isAvailable: () => false,
      },
      cache: {
        query: vi.fn(async () => []),
        store,
        isAvailable: () => true,
      },
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'relay.publish', id: 'publish-offline', event } as NappletMessage,
      (message) => sent.push(message),
    );

    expect(publish).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
    expect(sent).toEqual([{
      type: 'relay.publish.result',
      id: 'publish-offline',
      ok: false,
      error: 'no relay pool available',
    }]);
  });
});

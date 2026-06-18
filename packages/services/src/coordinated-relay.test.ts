import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { createCoordinatedRelay } from './coordinated-relay.js';

describe('createCoordinatedRelay', () => {
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
});

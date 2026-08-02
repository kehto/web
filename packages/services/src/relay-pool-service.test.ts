import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { createRelayPoolService } from './relay-pool-service.js';

describe('createRelayPoolService', () => {
  const event: NostrEvent = {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 1_800_000_000,
    kind: 1,
    tags: [],
    content: 'relay pool publish',
    sig: 'c'.repeat(128),
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
    const service = createRelayPoolService({
      subscribe,
      publish: vi.fn(),
      selectRelayTier,
      isAvailable: () => true,
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

  it('returns the canonical signed event after relay.publish succeeds', async () => {
    const publish = vi.fn();
    const service = createRelayPoolService({
      subscribe: vi.fn(() => ({ unsubscribe() { /* no-op */ } })),
      publish,
      selectRelayTier: vi.fn(() => []),
      isAvailable: () => true,
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
    expect(sent).toEqual([{
      type: 'relay.publish.result',
      id: 'publish-ok',
      ok: true,
      event,
      eventId: event.id,
    }]);
  });

  it('reports observed relay URLs instead of relays merely requested', () => {
    const service = createRelayPoolService({
      subscribe: (_filters, callback) => {
        callback(event, ['wss://observed.test']);
        callback('EOSE');
        return { unsubscribe() {} };
      },
      publish: vi.fn(),
      selectRelayTier: () => ['wss://requested.test'],
      isAvailable: () => true,
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'relay.subscribe', id: 'observed', subId: 'sub-observed', filters: [{ kinds: [1] }] } as NappletMessage,
      (message) => sent.push(message),
    );

    expect(sent[0]).toEqual({
      type: 'relay.event',
      subId: 'sub-observed',
      result: { event, sidecar: { relayHints: ['wss://observed.test'] } },
    });
  });

  it('returns a canonical failure without publishing when the pool is unavailable', () => {
    const publish = vi.fn();
    const service = createRelayPoolService({
      subscribe: vi.fn(() => ({ unsubscribe() { /* no-op */ } })),
      publish,
      selectRelayTier: vi.fn(() => []),
      isAvailable: () => false,
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'relay.publish', id: 'publish-offline', event } as NappletMessage,
      (message) => sent.push(message),
    );

    expect(publish).not.toHaveBeenCalled();
    expect(sent).toEqual([{
      type: 'relay.publish.result',
      id: 'publish-offline',
      ok: false,
      error: 'no relay pool available',
    }]);
  });
});

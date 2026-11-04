import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import { createCacheService } from './cache-service.js';

const event = { id: 'a'.repeat(64), pubkey: 'b'.repeat(64), created_at: 1, kind: 1, tags: [], content: '', sig: 'c'.repeat(128) } as NostrEvent;

describe('createCacheService', () => {
  it('only handles internal relay messages and has no cache wire surface', async () => {
    const query = vi.fn(async () => [event]);
    const service = createCacheService({ query, store: vi.fn(), isAvailable: () => true });
    const sent: NappletMessage[] = [];
    service.handleMessage('one', { type: 'cache.get', id: 'nope' } as NappletMessage, (message) => sent.push(message));
    service.handleMessage('one', { type: 'relay.subscribe', subId: 'sub', filters: [] } as NappletMessage, (message) => sent.push(message));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(query).toHaveBeenCalledTimes(1);
    expect(sent.map((message) => message.type)).toEqual(['relay.event', 'relay.eose']);
  });

  it('suppresses late cache events after revocation or subscription replacement', async () => {
    let resolve!: (events: NostrEvent[]) => void;
    const query = vi.fn(() => new Promise<NostrEvent[]>((done) => { resolve = done; }));
    const service = createCacheService({ query, store: vi.fn(), isAvailable: () => true });
    const sent: NappletMessage[] = [];
    service.handleMessage('one', { type: 'relay.subscribe', subId: 'same', filters: [] } as NappletMessage, (message) => sent.push(message));
    service.onPermissionRevoked?.('one');
    resolve([event]);
    await new Promise((done) => setTimeout(done, 0));
    expect(sent).toEqual([]);
  });
});

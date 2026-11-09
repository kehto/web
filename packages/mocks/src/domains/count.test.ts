import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { findMockAccount, MOCK_EVENTS, MOCK_RELAYS } from '../fixtures/nostr.js';
import { COUNT_MOCK_ENTRY, COUNT_SPEC_REF, createMockCountService, validateCountFilter } from './count.js';
import { createMockNostrStore } from './nostr-store.js';
import { createMockRelayService } from './relay.js';

const alice = findMockAccount('alice')!;
const bob = findMockAccount('bob')!;
const RELAYS = [MOCK_RELAYS.primary, MOCK_RELAYS.secondary];

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

function query(service: ReturnType<typeof createMockCountService>, id: string, filters: unknown, options?: unknown): NappletMessage {
  const { sent, send } = sink();
  service.handleMessage('w1', { type: 'count.query', id, filters, ...(options === undefined ? {} : { options }) } as NappletMessage, send);
  return sent[0]!;
}

describe('createMockCountService', () => {
  it('describes the service and spec ref', () => {
    const service = createMockCountService();
    expect(service.descriptor).toEqual({ name: 'count', version: '1.0.0', description: 'Mock NAP-COUNT: exact NIP-45 style counts over nostr fixtures' });
    expect(service.mock.routes).toEqual(['count.query']);
    expect(service.messageCapabilities).toBeUndefined();
    expect(COUNT_SPEC_REF).toEqual({ nap: 'NAP-COUNT', status: 'draft', source: 'pr', pr: 69, sha: '9353a0c6c02c', path: 'naps/NAP-COUNT.md' });
    expect(COUNT_MOCK_ENTRY).toMatchObject({ domain: 'count', kind: 'service', spec: COUNT_SPEC_REF });
  });

  it('count.query returns an exact CountSuccess over the fixture store', () => {
    const service = createMockCountService();
    expect(query(service, 'c1', [{ kinds: [1] }])).toEqual({ type: 'count.query.result', id: 'c1', ok: true, count: 36, relays: RELAYS });
    expect(query(service, 'c2', [{ kinds: [3], '#p': [bob.pubkey] }])).toEqual({ type: 'count.query.result', id: 'c2', ok: true, count: 5, relays: RELAYS });
    expect(query(service, 'c3', [{ kinds: [7], '#e': [MOCK_EVENTS[0]!.id] }])).toEqual({ type: 'count.query.result', id: 'c3', ok: true, count: 0, relays: RELAYS });
    expect(service.mock.state().queries).toBe(3);
  });

  it('applies NIP-45 OR semantics without double counting and ignores limit', () => {
    const service = createMockCountService();
    const result = query(service, 'c4', [{ kinds: [1], authors: [alice.pubkey], limit: 1 }, { kinds: [1], '#t': ['linux'] }]);
    expect(result).toEqual({ type: 'count.query.result', id: 'c4', ok: true, count: 36, relays: RELAYS });
  });

  it('accepts approximate/hll options but stays exact and omits hll', () => {
    const service = createMockCountService({ relays: [] });
    expect(query(service, 'c5', [{ kinds: [0] }], { approximate: true, hll: true })).toEqual({ type: 'count.query.result', id: 'c5', ok: true, count: 6 });
  });

  it('rejects malformed filters with invalid-filter and too many with too-expensive', () => {
    const service = createMockCountService({ maxFilters: 2 });
    expect(query(service, 'e1', [])).toEqual({ type: 'count.query.result', id: 'e1', ok: false, error: 'invalid-filter', reason: 'count.query requires a non-empty filters array' });
    expect(query(service, 'e2', [{ kinds: [] }])).toEqual({ type: 'count.query.result', id: 'e2', ok: false, error: 'invalid-filter', reason: 'filter 0: kinds must be a non-empty list' });
    expect(query(service, 'e3', [{ kinds: [1] }, { since: -1 }])).toEqual({ type: 'count.query.result', id: 'e3', ok: false, error: 'invalid-filter', reason: 'filter 1: since must be a non-negative integer' });
    expect(query(service, 'e4', [{ '#ee': ['x'] }])).toMatchObject({ ok: false, error: 'invalid-filter', reason: 'filter 0: unknown filter field #ee' });
    expect(query(service, 'e5', [{ kinds: [1] }, { kinds: [2] }, { kinds: [3] }])).toEqual({ type: 'count.query.result', id: 'e5', ok: false, error: 'too-expensive', reason: 'count.query accepts at most 2 filters' });
    expect(validateCountFilter([])).toBe('filter must be an object');
    expect(validateCountFilter({ '#p': [] })).toBe('#p must be a non-empty list');
    expect(validateCountFilter({ ids: [alice.pubkey], until: 5 })).toBeUndefined();
  });

  it('failNext() answers one CountFailure, then recovers', () => {
    const service = createMockCountService();
    service.failNext('relay-refused', 'COUNT disabled by policy');
    expect(query(service, 'f1', [{ kinds: [1] }])).toEqual({ type: 'count.query.result', id: 'f1', ok: false, error: 'relay-refused', reason: 'COUNT disabled by policy' });
    expect(query(service, 'f2', [{ kinds: [1] }])).toMatchObject({ ok: true, count: 36 });
  });

  it('counts events published through a shared store and resets with it', () => {
    const store = createMockNostrStore();
    const relay = createMockRelayService({ store });
    const service = createMockCountService({ store });
    relay.inject({ kind: 7, content: '+', tags: [['e', MOCK_EVENTS[0]!.id]] }, 'bob');
    expect(query(service, 'c6', [{ kinds: [7], '#e': [MOCK_EVENTS[0]!.id] }])).toMatchObject({ ok: true, count: 1 });
    service.failNext('timeout');
    service.mock.reset();
    expect(service.mock.state().pendingFailure).toBeUndefined();
    expect(service.mock.state().queries).toBe(0);
    // A shared store is owned by its creator: the mock's reset leaves it alone.
    expect(query(service, 'c7', [{ kinds: [7] }])).toMatchObject({ ok: true, count: 1 });
    store.reset();
    expect(query(service, 'c8', [{ kinds: [7] }])).toMatchObject({ ok: true, count: 0 });
    expect(createMockCountService().mock.state().store.events()).toHaveLength(MOCK_EVENTS.length + 5);
    service.onWindowDestroyed?.('w1');
    expect(service.mock.sent).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { mockEventId, mockPubkey } from '../core/rng.js';
import { findMockAccount, MOCK_EPOCH_SECONDS, MOCK_EVENTS, MOCK_RELAYS } from '../fixtures/nostr.js';
import { createMockNostrStore, MOCK_FALLBACK_RELAYS } from './nostr-store.js';
import { createMockOutboxService, isAllowedMockRelay, OUTBOX_MOCK_ENTRY, OUTBOX_SPEC_REF, resolveMockRelayPlan } from './outbox.js';
import { createMockRelayService } from './relay.js';

const alice = findMockAccount('alice')!;
const bob = findMockAccount('bob')!;
const carol = findMockAccount('carol')!;
const stranger = mockPubkey('stranger');
const clock = { now: () => (MOCK_EPOCH_SECONDS + 10_000) * 1000 };

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

const note = (label: string) => MOCK_EVENTS.find((event) => event.id === mockEventId(label))!;

describe('createMockOutboxService', () => {
  it('describes the service and spec ref', () => {
    const service = createMockOutboxService();
    expect(service.descriptor).toEqual({ name: 'outbox', version: '1.0.0', description: 'Mock NAP-OUTBOX: NIP-65 relay planning over nostr fixtures' });
    expect(service.mock.routes).toEqual(['outbox.getEvent', 'outbox.query', 'outbox.subscribe', 'outbox.close', 'outbox.publish', 'outbox.resolveRelays']);
    expect(OUTBOX_SPEC_REF).toEqual({ nap: 'NAP-OUTBOX', status: 'draft', source: 'pr', pr: 32, sha: '8865f73d52a4', path: 'naps/NAP-OUTBOX.md' });
    expect(OUTBOX_MOCK_ENTRY).toMatchObject({ domain: 'outbox', kind: 'service', spec: OUTBOX_SPEC_REF });
  });

  it('outbox.resolveRelays derives read and write plans from kind-10002 fixtures', () => {
    const service = createMockOutboxService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'outbox.resolveRelays', id: 'r1', target: { pubkey: bob.pubkey, direction: 'read' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.resolveRelays', id: 'r2', target: { authors: [bob.pubkey], direction: 'write' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.resolveRelays', id: 'r3', target: { pubkey: stranger } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.resolveRelays', id: 'r4', target: {} } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.resolveRelays', id: 'r5' } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'outbox.resolveRelays.result', id: 'r1', plan: { relays: [MOCK_RELAYS.secondary], source: 'nip65' } },
      { type: 'outbox.resolveRelays.result', id: 'r2', plan: { relays: [MOCK_RELAYS.secondary, MOCK_RELAYS.primary], source: 'nip65' } },
      { type: 'outbox.resolveRelays.result', id: 'r3', plan: { relays: [...MOCK_FALLBACK_RELAYS], source: 'fallback', missingAuthors: [stranger] } },
      { type: 'outbox.resolveRelays.result', id: 'r4', plan: { relays: [...MOCK_FALLBACK_RELAYS], source: 'fallback' }, error: 'no authors' },
      { type: 'outbox.resolveRelays.result', id: 'r5', plan: { relays: [...MOCK_FALLBACK_RELAYS], source: 'fallback' }, error: 'invalid filter' },
    ]);
    expect(resolveMockRelayPlan(service.mock.state().store, [alice.pubkey, stranger], 'read')).toEqual({
      relays: [MOCK_RELAYS.primary, MOCK_RELAYS.secondary],
      source: 'nip65',
      missingAuthors: [stranger],
    });
  });

  it('outbox.query returns deduplicated RelayEventResult records with hints and marks missing authors incomplete', () => {
    const service = createMockOutboxService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'outbox.query', id: 'q1', filters: [{ authors: [bob.pubkey], kinds: [1], limit: 2 }] } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.query', id: 'q2', filters: { authors: [stranger], kinds: [1] }, options: { limit: 1 } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.query', id: 'q3', filters: [{ kinds: [1] }], options: { authors: [carol.pubkey], limit: 1 } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.query', id: 'q4', filters: [] } as NappletMessage, send);
    expect(sent[0]).toEqual({
      type: 'outbox.query.result',
      id: 'q1',
      events: [
        { event: note('note:bob:5'), sidecar: { relayHints: [MOCK_RELAYS.secondary] } },
        { event: note('note:bob:4'), sidecar: { relayHints: [MOCK_RELAYS.secondary] } },
      ],
    });
    expect(sent[1]).toEqual({ type: 'outbox.query.result', id: 'q2', events: [], incomplete: true });
    expect(sent[2]).toEqual({ type: 'outbox.query.result', id: 'q3', events: [{ event: note('note:frank:5'), sidecar: { relayHints: [MOCK_RELAYS.secondary, MOCK_RELAYS.tertiary] } }] });
    expect(sent[3]).toEqual({ type: 'outbox.query.result', id: 'q4', events: [], error: 'invalid filter' });
  });

  it('outbox.getEvent fetches by id and reports not found / invalid ids', () => {
    const service = createMockOutboxService();
    const { sent, send } = sink();
    const target = note('note:carol:0');
    service.handleMessage('w1', { type: 'outbox.getEvent', id: 'g1', eventId: target.id, options: { author: carol.pubkey } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.getEvent', id: 'g2', eventId: target.id, options: { author: stranger } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.getEvent', id: 'g3', eventId: mockEventId('nope') } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.getEvent', id: 'g4', eventId: 'short' } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'outbox.getEvent.result', id: 'g1', result: { event: target, sidecar: { relayHints: [MOCK_RELAYS.tertiary] } } },
      { type: 'outbox.getEvent.result', id: 'g2', result: { event: target, sidecar: { relayHints: [MOCK_RELAYS.tertiary] } }, incomplete: true },
      { type: 'outbox.getEvent.result', id: 'g3', error: 'not found' },
      { type: 'outbox.getEvent.result', id: 'g4', error: 'invalid filter' },
    ]);
  });

  it('outbox.publish signs once and fans out to outbox, inbox, and validated explicit relays', () => {
    const service = createMockOutboxService({ clock });
    const { sent, send } = sink();
    service.handleMessage('w1', {
      type: 'outbox.publish',
      id: 'p1',
      event: { kind: 1111, content: 'reply from a napplet', tags: [['p', carol.pubkey]], created_at: MOCK_EPOCH_SECONDS + 9_900 },
      options: { toInboxes: [carol.pubkey], relays: ['wss://extra.example.net', 'ws://127.0.0.1:7777'] },
    } as NappletMessage, send);
    const event = {
      id: mockEventId('store:1'),
      pubkey: alice.pubkey,
      created_at: MOCK_EPOCH_SECONDS + 9_900,
      kind: 1111,
      tags: [['p', carol.pubkey]],
      content: 'reply from a napplet',
      sig: expect.stringMatching(/^[0-9a-f]{128}$/),
    };
    expect(sent[0]).toEqual({
      type: 'outbox.publish.result',
      id: 'p1',
      ok: true,
      event,
      eventId: mockEventId('store:1'),
      relays: {
        [MOCK_RELAYS.primary]: true,
        [MOCK_RELAYS.secondary]: true,
        [MOCK_RELAYS.tertiary]: true,
        'wss://extra.example.net': true,
        'ws://127.0.0.1:7777': false,
      },
    });
    expect(service.mock.state().store.get(mockEventId('store:1'))).toBeDefined();
    expect(service.mock.state().published).toHaveLength(1);

    service.handleMessage('w1', { type: 'outbox.publish', id: 'p2', event: { kind: 1059, content: '...' }, options: { toOutbox: false, relays: ['wss://dm.example.com'] } } as NappletMessage, send);
    expect((sent[1] as unknown as { relays: Record<string, boolean> }).relays).toEqual({ 'wss://dm.example.com': true });
    expect((sent[1] as unknown as { event: { created_at: number } }).event.created_at).toBe(MOCK_EPOCH_SECONDS + 10_000);
  });

  it('outbox.publish reports failures: missing inbox relay list, bad template, signed out', () => {
    const service = createMockOutboxService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'outbox.publish', id: 'p3', event: { kind: 1, content: 'x' }, options: { toInboxes: [stranger] } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.publish', id: 'p4', event: 'nope' } as NappletMessage, send);
    const signedOut = createMockOutboxService({ user: '' });
    signedOut.handleMessage('w1', { type: 'outbox.publish', id: 'p5', event: { kind: 1, content: 'x' } } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'outbox.publish.result', id: 'p3', ok: false, error: 'relay list unavailable' },
      { type: 'outbox.publish.result', id: 'p4', ok: false, error: 'invalid filter' },
      { type: 'outbox.publish.result', id: 'p5', ok: false, error: 'publish denied' },
    ]);
    expect(isAllowedMockRelay('https://relay.example.org')).toBe(false);
    expect(isAllowedMockRelay('wss://localhost')).toBe(false);
  });

  it('outbox.subscribe backfills, stays live for later publishes, and closes idempotently', () => {
    const service = createMockOutboxService({ clock });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'outbox.subscribe', id: 's1', subId: 'sub-1', filters: [{ authors: [bob.pubkey], kinds: [1] }], options: { limit: 1 } } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'outbox.event', subId: 'sub-1', result: { event: note('note:bob:5'), sidecar: { relayHints: [MOCK_RELAYS.secondary] } } }]);

    const injected = service.inject({ kind: 1, content: 'bob again' }, 'bob');
    expect(sent[1]).toEqual({ type: 'outbox.event', subId: 'sub-1', result: { event: injected, sidecar: { relayHints: [MOCK_RELAYS.secondary] } } });

    service.handleMessage('w1', { type: 'outbox.close', id: 'c1', subId: 'sub-1' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'outbox.close', id: 'c2', subId: 'sub-1' } as NappletMessage, send);
    expect(sent.slice(2)).toEqual([{ type: 'outbox.closed', subId: 'sub-1' }, { type: 'outbox.closed', subId: 'sub-1' }]);
    service.inject({ kind: 1, content: 'unseen' }, 'bob');
    expect(sent).toHaveLength(4);

    service.handleMessage('w1', { type: 'outbox.subscribe', id: 's2', subId: 'bad', filters: 42 } as NappletMessage, send);
    expect(sent[4]).toEqual({ type: 'outbox.closed', subId: 'bad', reason: 'invalid filter' });
  });

  it('a shared store lets outbox.publish reach relay subscriptions', () => {
    const store = createMockNostrStore({ clock });
    const relay = createMockRelayService({ store });
    const outbox = createMockOutboxService({ store });
    const relaySink = sink();
    relay.handleMessage('w1', { type: 'relay.subscribe', id: 'r1', subId: 'feed', filters: [{ kinds: [1], since: MOCK_EPOCH_SECONDS + 9_000 }] } as NappletMessage, relaySink.send);
    outbox.handleMessage('w2', { type: 'outbox.publish', id: 'p1', event: { kind: 1, content: 'cross-domain' } } as NappletMessage, () => {});
    expect(relaySink.sent).toHaveLength(2);
    expect((relaySink.sent[1] as unknown as { result: { event: { content: string } } }).result.event.content).toBe('cross-domain');
  });

  it('cleans subscriptions on window destroy, capability revoke, closeSubscription, and reset', () => {
    const service = createMockOutboxService({ clock });
    const a = sink();
    const b = sink();
    service.handleMessage('w1', { type: 'outbox.subscribe', id: 's1', subId: 'sub-1', filters: [{ kinds: [1], limit: 1 }] } as NappletMessage, a.send);
    service.handleMessage('w2', { type: 'outbox.subscribe', id: 's2', subId: 'sub-2', filters: [{ kinds: [1], limit: 1 }] } as NappletMessage, b.send);
    service.onWindowDestroyed?.('w2');
    expect([...service.mock.state().subscriptions.keys()]).toEqual(['w1:sub-1']);

    service.onCapabilityRevoked?.('w1', null);
    expect(a.sent.at(-1)).toEqual({ type: 'outbox.closed', subId: 'sub-1', reason: 'policy denied' });
    expect(service.mock.state().subscriptions.size).toBe(0);

    service.handleMessage('w1', { type: 'outbox.subscribe', id: 's3', subId: 'sub-3', filters: [{ kinds: [1], limit: 1 }] } as NappletMessage, a.send);
    expect(service.closeSubscription('w1', 'sub-3', 'relay timeout')).toBe(true);
    expect(a.sent.at(-1)).toEqual({ type: 'outbox.closed', subId: 'sub-3', reason: 'relay timeout' });
    expect(service.closeSubscription('w1', 'sub-3')).toBe(false);

    service.inject({ kind: 1, content: 'extra' }, 'bob');
    service.mock.reset();
    expect(service.mock.state().store.events()).toHaveLength(MOCK_EVENTS.length + 5);
    expect(service.mock.state().published).toEqual([]);
    expect(service.mock.sent).toEqual([]);
  });
});

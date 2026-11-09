import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';

import { mockEventId } from '../core/rng.js';
import { findMockAccount, MOCK_EPOCH_SECONDS, MOCK_EVENTS, MOCK_RELAYS } from '../fixtures/nostr.js';
import { createMockNostrStore, MOCK_FALLBACK_RELAYS } from './nostr-store.js';
import { createMockRelayService, RELAY_MOCK_ENTRY, RELAY_SPEC_REF } from './relay.js';

const alice = findMockAccount('alice')!;
const bob = findMockAccount('bob')!;
const carol = findMockAccount('carol')!;
const NOW_MS = (MOCK_EPOCH_SECONDS + 10_000) * 1000;
const clock = { now: () => NOW_MS };

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

function subscribe(service: ReturnType<typeof createMockRelayService>, windowId: string, subId: string, filters: unknown, relay?: string) {
  const { sent, send } = sink();
  service.handleMessage(windowId, { type: 'relay.subscribe', id: `req-${subId}`, subId, filters, ...(relay ? { relay } : {}) } as NappletMessage, send);
  return sent;
}

describe('createMockRelayService', () => {
  it('describes the service and spec ref', () => {
    const service = createMockRelayService();
    expect(service.descriptor.name).toBe('relay');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.messageCapabilities).toBeUndefined();
    expect(service.mock.routes).toEqual(['relay.subscribe', 'relay.close', 'relay.publish', 'relay.publishEncrypted', 'relay.query']);
    expect(RELAY_SPEC_REF).toEqual({ nap: 'NAP-RELAY', status: 'draft', source: 'pr', pr: 2, sha: '9f30b3505335', path: 'naps/NAP-RELAY.md' });
    expect(RELAY_MOCK_ENTRY.domain).toBe('relay');
    expect(RELAY_MOCK_ENTRY.kind).toBe('service');
    expect(RELAY_MOCK_ENTRY.create?.({})).toBeDefined();
  });

  it('relay.subscribe replays matching events newest-first with relay hints, then EOSE', () => {
    const service = createMockRelayService();
    const sent = subscribe(service, 'w1', 'sub-1', [{ kinds: [1], authors: [bob.pubkey], limit: 2 }]);
    expect(sent).toHaveLength(3);
    expect(sent[0]).toEqual({
      type: 'relay.event',
      subId: 'sub-1',
      result: {
        event: MOCK_EVENTS.find((event) => event.id === mockEventId('note:bob:5')),
        sidecar: { relayHints: [MOCK_RELAYS.secondary] },
      },
    });
    expect((sent[1] as unknown as { result: { event: { id: string } } }).result.event.id).toBe(mockEventId('note:bob:4'));
    expect(sent[2]).toEqual({ type: 'relay.eose', subId: 'sub-1' });
    expect(service.mock.state().subscriptions.get('w1:sub-1')).toEqual({ windowId: 'w1', subId: 'sub-1', filters: [{ kinds: [1], authors: [bob.pubkey], limit: 2 }], send: expect.any(Function) });
  });

  it('scopes a subscription to a single relay', () => {
    const service = createMockRelayService();
    const scoped = subscribe(service, 'w1', 'sub-scoped', [{ kinds: [1], authors: [carol.pubkey] }], MOCK_RELAYS.tertiary);
    expect(scoped).toHaveLength(7);
    expect((scoped[0] as unknown as { result: { sidecar: { relayHints: string[] } } }).result.sidecar.relayHints).toEqual([MOCK_RELAYS.tertiary]);
    const elsewhere = subscribe(service, 'w1', 'sub-none', [{ kinds: [1], authors: [carol.pubkey] }], MOCK_RELAYS.discovery);
    expect(elsewhere).toEqual([{ type: 'relay.eose', subId: 'sub-none' }]);
  });

  it('relay.subscribe with no usable filters closes the subscription', () => {
    const service = createMockRelayService();
    expect(subscribe(service, 'w1', 'bad', 'nope')).toEqual([{ type: 'relay.closed', subId: 'bad', reason: 'invalid filters' }]);
    expect(service.mock.state().subscriptions.size).toBe(0);
  });

  it('relay.publish signs a template as the shell user, stores it, and fans out to live subscriptions', () => {
    const service = createMockRelayService({ clock });
    const live = subscribe(service, 'w2', 'feed', [{ kinds: [1], authors: [alice.pubkey], since: MOCK_EPOCH_SECONDS + 9_000 }]);
    expect(live).toEqual([{ type: 'relay.eose', subId: 'feed' }]);

    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'relay.publish', id: 'p1', event: { kind: 1, content: 'hello from a napplet', tags: [['t', 'linux']], created_at: MOCK_EPOCH_SECONDS + 9_500 } } as NappletMessage, send);
    const event = {
      id: mockEventId('store:1'),
      pubkey: alice.pubkey,
      created_at: MOCK_EPOCH_SECONDS + 9_500,
      kind: 1,
      tags: [['t', 'linux']],
      content: 'hello from a napplet',
      sig: expect.stringMatching(/^[0-9a-f]{128}$/),
    };
    expect(sent).toEqual([{ type: 'relay.publish.result', id: 'p1', ok: true, event, eventId: mockEventId('store:1') }]);
    expect(live).toHaveLength(2);
    expect(live[1]).toEqual({ type: 'relay.event', subId: 'feed', result: { event, sidecar: { relayHints: [MOCK_RELAYS.primary, MOCK_RELAYS.secondary] } } });
    expect(service.mock.state().store.get(mockEventId('store:1'))).toBeDefined();
    expect(service.mock.state().published).toHaveLength(1);
  });

  it('relay.publish accepts an already signed event and defaults created_at from the clock', () => {
    const service = createMockRelayService({ clock });
    const { sent, send } = sink();
    const signed = MOCK_EVENTS.find((event) => event.id === mockEventId('note:bob:0'))!;
    service.handleMessage('w1', { type: 'relay.publish', id: 'p2', event: signed } as NappletMessage, send);
    expect(sent[0]).toEqual({ type: 'relay.publish.result', id: 'p2', ok: true, event: signed, eventId: signed.id });

    service.handleMessage('w1', { type: 'relay.publish', id: 'p3', event: { kind: 1, content: 'no timestamp' } } as NappletMessage, send);
    expect((sent[1] as unknown as { event: { created_at: number } }).event.created_at).toBe(MOCK_EPOCH_SECONDS + 10_000);
  });

  it('relay.publish rejects a malformed template and a signed-out user', () => {
    const service = createMockRelayService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'relay.publish', id: 'p4', event: { content: 'no kind' } } as NappletMessage, send);
    expect(sent[0]).toEqual({ type: 'relay.publish.result', id: 'p4', ok: false, error: 'invalid event template' });

    const signedOut = createMockRelayService({ user: '' });
    signedOut.handleMessage('w1', { type: 'relay.publish', id: 'p5', event: { kind: 1, content: 'x' } } as NappletMessage, send);
    expect(sent[1]).toEqual({ type: 'relay.publish.result', id: 'p5', ok: false, error: 'no signer configured' });
  });

  it('relay.publishEncrypted stores a placeholder ciphertext and delivers plaintext on read', () => {
    const service = createMockRelayService({ clock });
    const { sent, send } = sink();
    service.handleMessage('w1', {
      type: 'relay.publishEncrypted',
      id: 'e1',
      event: { kind: 4, content: 'secret', tags: [['p', bob.pubkey]], created_at: MOCK_EPOCH_SECONDS + 9_600 },
      recipient: bob.pubkey,
    } as NappletMessage, send);
    const result = sent[0] as unknown as { ok: boolean; event: { content: string; kind: number }; eventId: string };
    expect(result.ok).toBe(true);
    expect(result.event.content).toMatch(/^nip44:[0-9a-f]{64}$/);
    expect(result.eventId).toBe(mockEventId('store:1'));

    service.handleMessage('w1', { type: 'relay.query', id: 'q1', filters: [{ kinds: [4] }] } as NappletMessage, send);
    expect(sent[1]).toEqual({
      type: 'relay.query.result',
      id: 'q1',
      events: [{ event: { ...result.event, content: 'secret' }, sidecar: { relayHints: [MOCK_RELAYS.primary, MOCK_RELAYS.secondary] } }],
    });
  });

  it('relay.publishEncrypted validates recipient and scheme', () => {
    const service = createMockRelayService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'relay.publishEncrypted', id: 'e2', event: { kind: 4, content: 'x' } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'relay.publishEncrypted', id: 'e3', event: { kind: 4, content: 'x' }, recipient: bob.pubkey, encryption: 'rot13' } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'relay.publishEncrypted.result', id: 'e2', ok: false, error: 'missing recipient' },
      { type: 'relay.publishEncrypted.result', id: 'e3', ok: false, error: 'unsupported encryption scheme: rot13' },
    ]);
  });

  it('relay.query returns RelayEventResult records and reports invalid filters', () => {
    const service = createMockRelayService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'relay.query', id: 'q2', filters: [{ kinds: [0], authors: [alice.pubkey] }] } as NappletMessage, send);
    expect(sent[0]).toEqual({
      type: 'relay.query.result',
      id: 'q2',
      events: [{ event: MOCK_EVENTS.find((event) => event.id === mockEventId('profile:alice')), sidecar: { relayHints: [MOCK_RELAYS.primary, MOCK_RELAYS.secondary] } }],
    });
    service.handleMessage('w1', { type: 'relay.query', id: 'q3' } as NappletMessage, send);
    expect(sent[1]).toEqual({ type: 'relay.query.result', id: 'q3', events: [], error: 'invalid filters' });
  });

  it('relay.close tears down the subscription idempotently and stops fan-out', () => {
    const service = createMockRelayService({ clock });
    const live = subscribe(service, 'w1', 'sub-1', [{ kinds: [1], since: MOCK_EPOCH_SECONDS + 9_000 }]);
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'relay.close', id: 'c1', subId: 'sub-1' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'relay.close', id: 'c2', subId: 'sub-1' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'relay.closed', subId: 'sub-1' }, { type: 'relay.closed', subId: 'sub-1' }]);
    service.inject({ kind: 1, content: 'late' }, 'bob');
    expect(live).toEqual([{ type: 'relay.eose', subId: 'sub-1' }]);
  });

  it('inject() fans out network events and closeSubscription() emits relay.closed', () => {
    const service = createMockRelayService({ clock });
    const live = subscribe(service, 'w1', 'sub-1', [{ kinds: [1], authors: [bob.pubkey], since: MOCK_EPOCH_SECONDS + 9_000 }]);
    const event = service.inject({ kind: 1, content: 'from bob' }, 'bob');
    expect(event.pubkey).toBe(bob.pubkey);
    expect(live[1]).toEqual({ type: 'relay.event', subId: 'sub-1', result: { event, sidecar: { relayHints: [MOCK_RELAYS.secondary] } } });
    expect(service.closeSubscription('w1', 'sub-1', 'resource limit')).toBe(true);
    expect(live[2]).toEqual({ type: 'relay.closed', subId: 'sub-1', reason: 'resource limit' });
    expect(service.closeSubscription('w1', 'sub-1')).toBe(false);
  });

  it('shares a store across instances and falls back to MOCK_FALLBACK_RELAYS for unknown authors', () => {
    const store = createMockNostrStore({ clock });
    const first = createMockRelayService({ store });
    const second = createMockRelayService({ store });
    const live = subscribe(first, 'w1', 'sub-1', [{ kinds: [1], since: MOCK_EPOCH_SECONDS + 9_000 }]);
    const event = second.inject({ kind: 1, content: 'stranger' }, 'zed');
    expect(live[1]).toEqual({ type: 'relay.event', subId: 'sub-1', result: { event, sidecar: { relayHints: [...MOCK_FALLBACK_RELAYS] } } });
  });

  it('fans a publish out through each subscription\'s own send, publisher included, under a runtime', () => {
    // NAP-RELAY @ 9f30b3505335: the shell delivers matching events as relay.event to the
    // subscribing napplet; a relay echoes an accepted publish to every matching subscription.
    // `relay.event` has no recipient capability in the ACL map, so a runtime refuses it as a
    // push; the mock must deliver through the subscribe request's send instead.
    const service = createMockRelayService({ clock });
    const runtime: ServiceRuntimeContext = { resolveDTag: () => 'd', listWindowIds: () => ['w1', 'w2', 'w3'], hasCapability: () => true, sendToEligibleNapplet: vi.fn(() => false) };
    service.onRegistered?.(runtime);
    const since = MOCK_EPOCH_SECONDS + 9_000;
    const own = subscribe(service, 'w1', 'own', [{ kinds: [1], since }]);
    const other = subscribe(service, 'w2', 'other', [{ kinds: [1], since }]);
    const observed = subscribe(service, 'w2', 'scoped-hit', [{ kinds: [1], since }], MOCK_RELAYS.primary);
    const elsewhere = subscribe(service, 'w3', 'scoped-miss', [{ kinds: [1], since }], MOCK_RELAYS.tertiary);
    const unrelated = subscribe(service, 'w3', 'kinds', [{ kinds: [7], since }]);
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'relay.publish', id: 'p1', event: { kind: 1, content: 'mine' } } as NappletMessage, send);
    const event = (sent[0] as unknown as { event: unknown }).event;

    expect(runtime.sendToEligibleNapplet).not.toHaveBeenCalled();
    expect(own).toEqual([{ type: 'relay.eose', subId: 'own' }, { type: 'relay.event', subId: 'own', result: { event, sidecar: { relayHints: [MOCK_RELAYS.primary, MOCK_RELAYS.secondary] } } }]);
    expect(other).toEqual([{ type: 'relay.eose', subId: 'other' }, { type: 'relay.event', subId: 'other', result: { event, sidecar: { relayHints: [MOCK_RELAYS.primary, MOCK_RELAYS.secondary] } } }]);
    expect(observed).toEqual([{ type: 'relay.eose', subId: 'scoped-hit' }, { type: 'relay.event', subId: 'scoped-hit', result: { event, sidecar: { relayHints: [MOCK_RELAYS.primary] } } }]);
    expect(elsewhere).toEqual([{ type: 'relay.eose', subId: 'scoped-miss' }]);
    expect(unrelated).toEqual([{ type: 'relay.eose', subId: 'kinds' }]);
    expect(service.mock.sent.filter((entry) => entry.message.type === 'relay.event').map((entry) => entry.windowId)).toEqual(['w1', 'w2', 'w2']);
  });

  it('cleans subscriptions on window destroy, capability revoke, and reset', () => {
    const service = createMockRelayService({ clock });
    const live = subscribe(service, 'w1', 'sub-1', [{ kinds: [1] , limit: 1 }]);
    subscribe(service, 'w2', 'sub-2', [{ kinds: [1], limit: 1 }]);
    service.onWindowDestroyed?.('w2');
    expect([...service.mock.state().subscriptions.keys()]).toEqual(['w1:sub-1']);

    service.onCapabilityRevoked?.('w1', 'relay:read');
    expect(live.at(-1)).toEqual({ type: 'relay.closed', subId: 'sub-1', reason: 'denied: relay:read' });
    expect(service.mock.state().subscriptions.size).toBe(0);

    service.inject({ kind: 1, content: 'extra' }, 'bob');
    expect(service.mock.state().store.events().length).toBe(MOCK_EVENTS.length + 5 + 1);
    service.mock.reset();
    expect(service.mock.state().store.events().length).toBe(MOCK_EVENTS.length + 5);
    expect(service.mock.sent).toEqual([]);
    expect(service.mock.state().published).toEqual([]);
  });
});

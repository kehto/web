import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { mockEventId, mockPubkey } from '../core/rng.js';
import { findMockAccount, MOCK_EPOCH_SECONDS, MOCK_RELAYS } from '../fixtures/nostr.js';
import { createMockIdentityService } from './identity.js';
import { createMockListsService, LISTS_MOCK_ENTRY, LISTS_SPEC_REF, MOCK_LIST_SUPPORT } from './lists.js';
import { createMockNostrStore, MOCK_LIST_EVENTS, MOCK_SPAM_PUBKEY } from './nostr-store.js';

const alice = findMockAccount('alice')!;
const zed = mockPubkey('zed');
const clock = { now: () => (MOCK_EPOCH_SECONDS + 10_000) * 1000 };
const muteList = MOCK_LIST_EVENTS.find((event) => event.kind === 10000)!;
const followSet = MOCK_LIST_EVENTS.find((event) => event.kind === 30000)!;

type Result = NappletMessage & { ok: boolean; eventId?: string; event?: { kind: number; tags: string[][]; content: string }; added?: number; removed?: number; skipped?: number; error?: string; reason?: string; supported?: unknown[] };

function call(service: ReturnType<typeof createMockListsService>, type: string, extra: Record<string, unknown> = {}): Result {
  const sent: NappletMessage[] = [];
  service.handleMessage('w1', { type, id: 'req', ...extra } as NappletMessage, (msg) => { sent.push(msg); });
  return sent[0] as Result;
}

describe('createMockListsService', () => {
  it('describes the service and spec ref', () => {
    const service = createMockListsService();
    expect(service.descriptor).toEqual({ name: 'lists', version: '1.0.0', description: 'Mock NAP-LISTS: NIP-51/NIP-65 list mutations over nostr fixtures' });
    expect(service.mock.routes).toEqual(['lists.supported', 'lists.add', 'lists.remove']);
    expect(LISTS_SPEC_REF).toEqual({ nap: 'NAP-LISTS', status: 'draft', source: 'pr', pr: 68, sha: '7cf00cdb7bca', path: 'naps/NAP-LISTS.md' });
    expect(LISTS_MOCK_ENTRY).toMatchObject({ domain: 'lists', kind: 'service', spec: LISTS_SPEC_REF });
  });

  it('lists.supported returns the NIP-51/NIP-65 support table', () => {
    const service = createMockListsService();
    const result = call(service, 'lists.supported');
    expect(result).toEqual({ type: 'lists.supported.result', id: 'req', lists: [...MOCK_LIST_SUPPORT] });
    expect(MOCK_LIST_SUPPORT).toHaveLength(15);
    expect(MOCK_LIST_SUPPORT.find((row) => row.kind === 10002)).toEqual({ kind: 10002, type: 'relay-list-metadata', addressable: false, supportedItemTypes: ['relay'], privateItems: false });
  });

  it('lists.add appends new items after existing tags, deduplicates, and publishes once', () => {
    const service = createMockListsService({ clock });
    const result = call(service, 'lists.add', { list: { type: 'mute-list' }, items: [{ itemType: 'pubkey', value: zed }, { itemType: 'pubkey', value: MOCK_SPAM_PUBKEY }] });
    expect(result).toEqual({
      type: 'lists.add.result',
      id: 'req',
      ok: true,
      eventId: mockEventId('store:1'),
      event: {
        id: mockEventId('store:1'),
        pubkey: alice.pubkey,
        created_at: MOCK_EPOCH_SECONDS + 10_000,
        kind: 10000,
        tags: [...muteList.tags, ['p', zed]],
        content: '',
        sig: expect.stringMatching(/^[0-9a-f]{128}$/),
      },
      added: 1,
      skipped: 1,
    });
    expect(service.mock.state().store.latest(10000, alice.pubkey)?.id).toBe(mockEventId('store:1'));
    expect(service.mock.state().published).toHaveLength(1);

    const noop = call(service, 'lists.add', { list: { kind: 10000 }, items: [{ itemType: 'pubkey', value: zed }] });
    expect(noop).toMatchObject({ ok: true, eventId: mockEventId('store:1'), added: 0, skipped: 1 });
    expect(service.mock.state().published).toHaveLength(1);
  });

  it('maps item types to NIP-51 tags with relay hints', () => {
    const service = createMockListsService({ clock });
    const result = call(service, 'lists.add', {
      list: { kind: 10003 },
      items: [
        { itemType: 'event', value: mockEventId('note:dave:0'), relay: MOCK_RELAYS.primary },
        { itemType: 'url', value: 'https://example.org/debian-netinst' },
        { itemType: 'address', value: `30023:${alice.pubkey}:install-notes` },
      ],
    });
    expect(result.event?.tags.slice(-3)).toEqual([
      ['e', mockEventId('note:dave:0'), MOCK_RELAYS.primary],
      ['r', 'https://example.org/debian-netinst'],
      ['a', `30023:${alice.pubkey}:install-notes`],
    ]);
    expect(result.added).toBe(3);
  });

  it('handles addressable sets: identifier required, create on demand', () => {
    const service = createMockListsService({ clock });
    expect(call(service, 'lists.add', { list: { type: 'follow-sets' }, items: [{ itemType: 'pubkey', value: zed }] })).toMatchObject({ ok: false, error: 'missing-identifier' });
    const existing = call(service, 'lists.add', { list: { kind: 30000, identifier: 'distro-maintainers' }, items: [{ itemType: 'pubkey', value: zed }] });
    expect(existing.event?.tags).toEqual([...followSet.tags, ['p', zed]]);
    expect(call(service, 'lists.add', { list: { kind: 30000, identifier: 'new-set' }, items: [{ itemType: 'pubkey', value: zed }] })).toMatchObject({ ok: false, error: 'list-not-found' });
    const created = call(service, 'lists.add', { list: { kind: 30000, identifier: 'new-set' }, items: [{ itemType: 'pubkey', value: zed }], options: { create: true, title: 'New set' } });
    expect(created).toMatchObject({ ok: true, added: 1, skipped: 0 });
    expect(created.event?.tags).toEqual([['d', 'new-set'], ['title', 'New set'], ['p', zed]]);
    expect(service.mock.state().store.latest(30000, alice.pubkey, 'new-set')?.id).toBe(created.eventId);
    expect(service.mock.state().store.latest(30000, alice.pubkey, 'distro-maintainers')?.id).toBe(existing.eventId);
  });

  it('rejects unsupported, ambiguous, and malformed list references', () => {
    const service = createMockListsService();
    const items = [{ itemType: 'address', value: `30023:${alice.pubkey}:x` }];
    const ambiguous = call(service, 'lists.add', { list: { type: 'curation-sets', identifier: 'picks' }, items });
    expect(ambiguous).toMatchObject({ ok: false, error: 'ambiguous-list' });
    expect(ambiguous.supported).toEqual(MOCK_LIST_SUPPORT.filter((row) => row.type === 'curation-sets'));
    expect(call(service, 'lists.add', { list: { kind: 30004, identifier: 'picks' }, items, options: { create: true } })).toMatchObject({ ok: true, added: 1 });

    const unsupported = call(service, 'lists.add', { list: { kind: 10030 }, items });
    expect(unsupported).toMatchObject({ ok: false, error: 'unsupported-list', supported: [...MOCK_LIST_SUPPORT] });
    expect(call(service, 'lists.add', { list: { type: 'wishlist' }, items })).toMatchObject({ ok: false, error: 'unsupported-list' });
    expect(call(service, 'lists.add', { list: {}, items })).toMatchObject({ ok: false, error: 'invalid-list-ref' });
    expect(call(service, 'lists.add', { list: { kind: 10000, type: 'mute-list' }, items })).toMatchObject({ ok: false, error: 'invalid-list-ref' });
    expect(call(service, 'lists.remove', { list: 'mute-list', items })).toMatchObject({ ok: false, error: 'invalid-list-ref' });
  });

  it('validates items against the selected list', () => {
    const service = createMockListsService();
    expect(call(service, 'lists.add', { list: { type: 'mute-list' }, items: [{ itemType: 'relay', value: MOCK_RELAYS.primary }] })).toMatchObject({ ok: false, error: 'unsupported-item' });
    expect(call(service, 'lists.add', { list: { type: 'mute-list' }, items: [{ itemType: 'pubkey', value: '' }] })).toMatchObject({ ok: false, error: 'invalid-item' });
    expect(call(service, 'lists.add', { list: { type: 'mute-list' }, items: [] })).toMatchObject({ ok: false, error: 'invalid-item' });
    expect(call(service, 'lists.add', { list: { type: 'mute-list' }, items: [{ itemType: 'word', value: 'scam', visibility: 'private' }] })).toMatchObject({ ok: false, error: 'private-items-unsupported' });
    expect(call(service, 'lists.add', { list: { type: 'dm-relays' }, items: [{ itemType: 'relay', value: 'https://not-a-relay' }] })).toMatchObject({ ok: false, error: 'invalid-item' });
    expect(call(service, 'lists.add', { list: { type: 'mute-list' }, items: [{ itemType: 'pubkey', value: zed, marker: 'read' }] })).toMatchObject({ ok: false, error: 'invalid-item' });
    expect(call(service, 'lists.add', { list: { type: 'dm-relays' }, items: [{ itemType: 'relay', value: MOCK_RELAYS.primary }], options: { create: true } })).toMatchObject({ ok: true, added: 1 });
    expect(service.mock.state().store.latest(10050, alice.pubkey)?.tags).toEqual([['relay', MOCK_RELAYS.primary]]);
  });

  it('applies NIP-65 marker rules for relay-list-metadata', () => {
    const service = createMockListsService({ clock });
    const initial = service.mock.state().store.latest(10002, alice.pubkey)!;
    expect(initial.tags).toEqual([['r', MOCK_RELAYS.primary], ['r', MOCK_RELAYS.secondary, 'write'], ['r', MOCK_RELAYS.tertiary, 'read']]);

    const demote = call(service, 'lists.remove', { list: { type: 'read-write-relays' }, items: [{ itemType: 'relay', value: MOCK_RELAYS.primary, marker: 'read' }] });
    expect(demote).toMatchObject({ ok: true, removed: 1, skipped: 0 });
    expect(demote.event?.tags).toEqual([['r', MOCK_RELAYS.primary, 'write'], ['r', MOCK_RELAYS.secondary, 'write'], ['r', MOCK_RELAYS.tertiary, 'read']]);

    const skipped = call(service, 'lists.remove', { list: { kind: 10002 }, items: [{ itemType: 'relay', value: MOCK_RELAYS.secondary, marker: 'read' }] });
    expect(skipped).toMatchObject({ ok: true, removed: 0, skipped: 1, eventId: demote.eventId });

    const dropped = call(service, 'lists.remove', { list: { type: 'relay-list-metadata' }, items: [{ itemType: 'relay', value: MOCK_RELAYS.tertiary }] });
    expect(dropped.event?.tags).toEqual([['r', MOCK_RELAYS.primary, 'write'], ['r', MOCK_RELAYS.secondary, 'write']]);

    const added = call(service, 'lists.add', { list: { kind: 10002 }, items: [{ itemType: 'relay', value: MOCK_RELAYS.discovery, marker: 'read' }, { itemType: 'relay', value: 'wss://both.example.org', marker: 'read-write' }] });
    expect(added.event?.tags.slice(-2)).toEqual([['r', MOCK_RELAYS.discovery, 'read'], ['r', 'wss://both.example.org']]);
    expect(service.mock.state().published).toHaveLength(3);
  });

  it('lists.remove deletes matching items and reports list-not-found', () => {
    const service = createMockListsService({ clock });
    const result = call(service, 'lists.remove', { list: { type: 'bookmarks' }, items: [{ itemType: 'event', value: mockEventId('note:bob:1') }, { itemType: 'hashtag', value: 'rust' }] });
    expect(result).toMatchObject({ type: 'lists.remove.result', ok: true, eventId: mockEventId('store:1'), removed: 1, skipped: 1 });
    expect(result.event?.tags).toEqual([['e', mockEventId('note:carol:2'), MOCK_RELAYS.tertiary], ['t', 'linux']]);
    expect(call(service, 'lists.remove', { list: { type: 'search-relays' }, items: [{ itemType: 'relay', value: MOCK_RELAYS.primary }] })).toMatchObject({ ok: false, error: 'list-not-found' });
  });

  it('requires a signer and resets', () => {
    const service = createMockListsService({ user: '' });
    expect(call(service, 'lists.add', { list: { type: 'mute-list' }, items: [{ itemType: 'pubkey', value: zed }] })).toEqual({ type: 'lists.add.result', id: 'req', ok: false, error: 'not-signed-in', reason: 'no shell user is connected' });
    expect(call(service, 'lists.supported')).toMatchObject({ lists: [...MOCK_LIST_SUPPORT] });
    service.signIn('alice');
    expect(call(service, 'lists.add', { list: { type: 'mute-list' }, items: [{ itemType: 'pubkey', value: zed }] })).toMatchObject({ ok: true, added: 1 });
    service.signOut();
    expect(service.mock.state().user).toBe('');
    service.onWindowDestroyed?.('w1');
    service.mock.reset();
    expect(service.mock.state().user).toBe('');
    expect(service.mock.state().published).toEqual([]);
    expect(service.mock.state().store.latest(10000, alice.pubkey)?.id).toBe(muteList.id);
  });

  it('mutations are visible to an identity mock on the same store', () => {
    const store = createMockNostrStore({ clock });
    const lists = createMockListsService({ store });
    const identity = createMockIdentityService({ store });
    call(lists, 'lists.add', { list: { type: 'interests' }, items: [{ itemType: 'hashtag', value: 'alpine' }] });
    const sent: NappletMessage[] = [];
    identity.handleMessage('w1', { type: 'identity.getList', id: 'i1', listType: 'interests' } as NappletMessage, (msg) => { sent.push(msg); });
    expect(sent[0]).toEqual({ type: 'identity.getList.result', id: 'i1', entries: ['linux', 'nixos', 'alpine'] });
  });
});

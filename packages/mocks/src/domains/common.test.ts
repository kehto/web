import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { mockEventId, mockPubkey } from '../core/rng.js';
import { findMockAccount, MOCK_ACCOUNTS, MOCK_EPOCH_SECONDS, MOCK_EVENTS, MOCK_RELAYS } from '../fixtures/nostr.js';
import { bech32Encode, decodeNip19, encodeNip19, npubOf } from './common-nip19.js';
import { COMMON_MOCK_ENTRY, COMMON_SPEC_REF, createMockCommonService, parseCommonProfile } from './common.js';
import { createMockNostrStore, MOCK_SPAM_PUBKEY } from './nostr-store.js';

const alice = findMockAccount('alice')!;
const bob = findMockAccount('bob')!;
const zed = mockPubkey('zed');
const clock = { now: () => (MOCK_EPOCH_SECONDS + 10_000) * 1000 };
const NIP19_PUBKEY = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const NIP19_NPUB = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6';
const NIP19_NPROFILE = 'nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

function ask(service: ReturnType<typeof createMockCommonService>, type: string, extra: Record<string, unknown> = {}): NappletMessage {
  const { sent, send } = sink();
  service.handleMessage('w1', { type, id: 'req', ...extra } as NappletMessage, send);
  return sent[0]!;
}

const note = (label: string) => MOCK_EVENTS.find((event) => event.id === mockEventId(label))!;

describe('common-nip19', () => {
  it('matches the NIP-19 reference vectors', () => {
    expect(encodeNip19({ type: 'npub', hex: NIP19_PUBKEY })).toEqual({ ok: true, value: NIP19_NPUB, nip19Type: 'npub' });
    expect(decodeNip19(NIP19_NPUB)).toEqual({ ok: true, nip19Type: 'npub', hex: NIP19_PUBKEY });
    expect(decodeNip19(NIP19_NPROFILE)).toEqual({ ok: true, nip19Type: 'nprofile', pubkey: NIP19_PUBKEY, relays: ['wss://r.x.com', 'wss://djbas.sadkb.com'] });
    expect(encodeNip19({ type: 'nprofile', pubkey: NIP19_PUBKEY, relays: ['wss://r.x.com', 'wss://djbas.sadkb.com'] }).value).toBe(NIP19_NPROFILE);
  });

  it('round-trips nevent, naddr, nrelay, and note', () => {
    const nevent = encodeNip19({ type: 'nevent', eventId: mockEventId('note:bob:0'), relays: [MOCK_RELAYS.secondary], author: bob.pubkey, kind: 1 });
    expect(nevent.nip19Type).toBe('nevent');
    expect(decodeNip19(nevent.value!)).toEqual({ ok: true, nip19Type: 'nevent', eventId: mockEventId('note:bob:0'), relays: [MOCK_RELAYS.secondary], author: bob.pubkey, kind: 1 });
    const naddr = encodeNip19({ type: 'naddr', identifier: 'distro-maintainers', pubkey: alice.pubkey, kind: 30000 });
    expect(decodeNip19(naddr.value!)).toEqual({ ok: true, nip19Type: 'naddr', identifier: 'distro-maintainers', pubkey: alice.pubkey, kind: 30000 });
    const nrelay = encodeNip19({ type: 'nrelay', relay: MOCK_RELAYS.primary });
    expect(decodeNip19(nrelay.value!)).toEqual({ ok: true, nip19Type: 'nrelay', relay: MOCK_RELAYS.primary });
    const noteValue = encodeNip19({ type: 'note', hex: mockEventId('note:alice:0') }).value!;
    expect(noteValue.startsWith('note1')).toBe(true);
    expect(decodeNip19(noteValue)).toEqual({ ok: true, nip19Type: 'note', hex: mockEventId('note:alice:0') });
  });

  it('rejects nsec, unknown types, and malformed input', () => {
    expect(encodeNip19({ type: 'nsec', hex: NIP19_PUBKEY })).toEqual({ ok: false, error: 'unsupported-nip19-type' });
    expect(encodeNip19({ type: 'npub', hex: 'abc' })).toEqual({ ok: false, error: 'invalid-pubkey' });
    expect(encodeNip19({ type: 'naddr', identifier: 'x', pubkey: alice.pubkey })).toEqual({ ok: false, error: 'invalid-nip19' });
    expect(decodeNip19('nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5')).toEqual({ ok: false, error: 'unsupported-nip19-type' });
    expect(decodeNip19(`${NIP19_NPUB.slice(0, -1)}q`)).toEqual({ ok: false, error: 'invalid-nip19' });
    expect(decodeNip19(bech32Encode('lnurl', Uint8Array.from([1, 2, 3])))).toEqual({ ok: false, error: 'unsupported-nip19-type' });
    expect(decodeNip19('lnbc1qqq')).toEqual({ ok: false, error: 'invalid-nip19' });
    expect(decodeNip19('n'.repeat(5001))).toEqual({ ok: false, error: 'invalid-nip19' });
    expect(decodeNip19(42)).toEqual({ ok: false, error: 'invalid-nip19' });
  });
});

describe('createMockCommonService', () => {
  it('describes the service and spec ref', () => {
    const service = createMockCommonService();
    expect(service.descriptor).toEqual({ name: 'common', version: '1.0.0', description: 'Mock NAP-COMMON: NIP-19 helpers and social actions over nostr fixtures' });
    expect(service.mock.routes).toEqual(['common.encodeNip19', 'common.decodeNip19', 'common.getProfile', 'common.follows', 'common.follow', 'common.unfollow', 'common.react', 'common.report']);
    expect(COMMON_SPEC_REF).toEqual({ nap: 'NAP-COMMON', status: 'draft', source: 'pr', pr: 67, sha: '8cd0eae85505', path: 'naps/NAP-COMMON.md' });
    expect(COMMON_MOCK_ENTRY).toMatchObject({ domain: 'common', kind: 'service', spec: COMMON_SPEC_REF });
  });

  it('common.encodeNip19 / common.decodeNip19 answer the NAP result shapes', () => {
    const service = createMockCommonService();
    expect(ask(service, 'common.encodeNip19', { input: { type: 'npub', hex: NIP19_PUBKEY } })).toEqual({ type: 'common.encodeNip19.result', id: 'req', ok: true, value: NIP19_NPUB, nip19Type: 'npub' });
    expect(ask(service, 'common.decodeNip19', { value: NIP19_NPUB })).toEqual({ type: 'common.decodeNip19.result', id: 'req', ok: true, nip19Type: 'npub', hex: NIP19_PUBKEY });
    expect(ask(service, 'common.encodeNip19', {})).toEqual({ type: 'common.encodeNip19.result', id: 'req', ok: false, error: 'invalid-nip19' });
    expect(ask(service, 'common.decodeNip19', { value: 'nsec1qqq' })).toEqual({ type: 'common.decodeNip19.result', id: 'req', ok: false, error: 'unsupported-nip19-type' });
  });

  it('common.getProfile resolves hex, npub, and nprofile targets and returns the raw kind 0', () => {
    const service = createMockCommonService();
    const profileEvent = note('profile:bob');
    const expected = {
      type: 'common.getProfile.result',
      id: 'req',
      ok: true,
      pubkey: bob.pubkey,
      profile: { name: 'bob', displayName: 'Bob', about: 'Posts about kernel builds.', picture: 'https://avatars.example.org/bob.png' },
      result: { event: profileEvent, sidecar: { relayHints: [MOCK_RELAYS.secondary] } },
    };
    expect(ask(service, 'common.getProfile', { target: bob.pubkey })).toEqual(expected);
    expect(ask(service, 'common.getProfile', { target: npubOf(bob.pubkey) })).toEqual(expected);
    const nprofile = encodeNip19({ type: 'nprofile', pubkey: bob.pubkey, relays: ['wss://hostile.example'] }).value!;
    expect(ask(service, 'common.getProfile', { target: nprofile })).toEqual(expected);
    expect(ask(service, 'common.getProfile', { target: zed })).toEqual({ type: 'common.getProfile.result', id: 'req', ok: true, pubkey: zed, profile: null });
    expect(ask(service, 'common.getProfile', { target: 'note1abc' })).toEqual({ type: 'common.getProfile.result', id: 'req', ok: false, pubkey: '', error: 'invalid-profile-target' });
    expect(parseCommonProfile('[]')).toBeNull();
    expect(parseCommonProfile('{"display_name":"Zed","lud16":"zed@pay.example"}')).toEqual({ displayName: 'Zed', lud16: 'zed@pay.example' });
  });

  it('common.follows lists the kind 3 contacts and requires a signer', () => {
    const service = createMockCommonService();
    expect(ask(service, 'common.follows')).toEqual({ type: 'common.follows.result', id: 'req', ok: true, pubkeys: MOCK_ACCOUNTS.slice(1).map((account) => account.pubkey) });
    service.signOut();
    expect(ask(service, 'common.follows')).toEqual({ type: 'common.follows.result', id: 'req', ok: false, pubkeys: [], error: 'not-signed-in' });
  });

  it('common.follow merges npub targets into kind 3, preserving tags, idempotently', () => {
    const service = createMockCommonService({ clock });
    const before = note('contacts:alice');
    const result = ask(service, 'common.follow', { pubkeys: [npubOf(zed), npubOf(bob.pubkey)] }) as NappletMessage & { ok: boolean; event: { tags: string[][]; kind: number; pubkey: string; content: string }; eventId: string };
    expect(result.type).toBe('common.follow.result');
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe(mockEventId('store:1'));
    expect(result.event.kind).toBe(3);
    expect(result.event.pubkey).toBe(alice.pubkey);
    expect(result.event.tags).toEqual([...before.tags, ['p', zed]]);
    expect(service.mock.state().store.latest(3, alice.pubkey)?.id).toBe(mockEventId('store:1'));
    expect(service.mock.state().published).toHaveLength(1);

    const again = ask(service, 'common.follow', { pubkeys: [npubOf(zed)] });
    expect(again).toMatchObject({ ok: true, eventId: mockEventId('store:1') });
    expect(service.mock.state().published).toHaveLength(1);
    expect(ask(service, 'common.follow', { pubkeys: [zed] })).toEqual({ type: 'common.follow.result', id: 'req', ok: false, error: 'invalid-pubkey' });
    expect(ask(service, 'common.follow', { pubkeys: [] })).toMatchObject({ ok: false, error: 'invalid-pubkey' });
  });

  it('common.unfollow removes matching p tags and keeps the rest', () => {
    const service = createMockCommonService({ clock });
    const before = note('contacts:alice');
    const result = ask(service, 'common.unfollow', { pubkeys: [npubOf(bob.pubkey)] }) as NappletMessage & { event: { tags: string[][] } };
    expect(result).toMatchObject({ type: 'common.unfollow.result', ok: true, eventId: mockEventId('store:1') });
    expect(result.event.tags).toEqual(before.tags.filter((tag) => tag[1] !== bob.pubkey));
    expect(ask(service, 'common.follows')).toMatchObject({ pubkeys: MOCK_ACCOUNTS.slice(2).map((account) => account.pubkey) });
    expect(ask(service, 'common.unfollow', { pubkeys: [npubOf(zed)] })).toMatchObject({ ok: true, eventId: mockEventId('store:1') });
    expect(service.mock.state().published).toHaveLength(1);
  });

  it('common.react publishes NIP-25 kind 7 with e/p/k tags and optional NIP-30 emoji', () => {
    const service = createMockCommonService({ clock });
    const target = note('note:bob:0');
    const plus = ask(service, 'common.react', { targetEventId: target.id, reaction: '+' }) as NappletMessage & { event: { kind: number; content: string; tags: string[][]; created_at: number } };
    expect(plus).toMatchObject({ type: 'common.react.result', ok: true, eventId: mockEventId('store:1') });
    expect(plus.event).toMatchObject({ kind: 7, content: '+', pubkey: alice.pubkey, created_at: MOCK_EPOCH_SECONDS + 10_000, tags: [['e', target.id, MOCK_RELAYS.secondary], ['p', bob.pubkey], ['k', '1']] });

    const custom = ask(service, 'common.react', { targetEventId: target.id, reaction: ':tux:', customEmojiHref: 'https://emoji.example.org/tux.png' }) as NappletMessage & { event: { tags: string[][] } };
    expect(custom.event.tags.at(-1)).toEqual(['emoji', 'tux', 'https://emoji.example.org/tux.png']);
    expect(ask(service, 'common.react', { targetEventId: target.id, reaction: '🐧' })).toMatchObject({ ok: true });
    expect(ask(service, 'common.react', { targetEventId: target.id, reaction: 'nope' })).toEqual({ type: 'common.react.result', id: 'req', ok: false, error: 'invalid-reaction' });
    expect(ask(service, 'common.react', { targetEventId: target.id, reaction: '+', customEmojiHref: 'https://x' })).toMatchObject({ ok: false, error: 'invalid-reaction' });
    expect(ask(service, 'common.react', { targetEventId: mockEventId('missing'), reaction: '+' })).toEqual({ type: 'common.react.result', id: 'req', ok: false, error: 'invalid-target' });
  });

  it('common.report publishes NIP-56 kind 1984 for pubkey and event targets', () => {
    const service = createMockCommonService({ clock });
    const spam = ask(service, 'common.report', { target: { type: 'pubkey', pubkey: npubOf(MOCK_SPAM_PUBKEY) }, reason: 'spam', text: 'airdrop bot' }) as NappletMessage & { event: { kind: number; content: string; tags: string[][] } };
    expect(spam).toMatchObject({ type: 'common.report.result', ok: true, eventId: mockEventId('store:1') });
    expect(spam.event).toMatchObject({ kind: 1984, content: 'airdrop bot', tags: [['p', MOCK_SPAM_PUBKEY, 'spam']] });

    const target = note('note:carol:3');
    const event = ask(service, 'common.report', { target: { type: 'event', id: target.id }, reason: 'other', text: '' }) as NappletMessage & { event: { tags: string[][] } };
    expect(event.event.tags).toEqual([['e', target.id, 'other'], ['p', target.pubkey]]);
    expect(ask(service, 'common.report', { target: { type: 'event', id: mockEventId('missing') }, reason: 'spam', text: '' })).toMatchObject({ ok: false, error: 'author-unresolved' });
    expect(ask(service, 'common.report', { target: { type: 'event', id: target.id }, reason: 'rude', text: '' })).toEqual({ type: 'common.report.result', id: 'req', ok: false, error: 'invalid-report-reason' });
    expect(ask(service, 'common.report', { target: { type: 'pubkey', pubkey: 'nope' }, reason: 'spam', text: '' })).toMatchObject({ ok: false, error: 'invalid-pubkey' });
    expect(ask(service, 'common.report', { target: 'x', reason: 'spam', text: '' })).toMatchObject({ ok: false, error: 'invalid-target' });
  });

  it('rejects modifying actions when signed out and resumes after signIn', () => {
    const service = createMockCommonService({ user: '' });
    expect(ask(service, 'common.follow', { pubkeys: [npubOf(zed)] })).toMatchObject({ ok: false, error: 'not-signed-in' });
    expect(ask(service, 'common.react', { targetEventId: note('note:bob:0').id, reaction: '+' })).toMatchObject({ ok: false, error: 'not-signed-in' });
    expect(ask(service, 'common.report', { target: { type: 'pubkey', pubkey: zed }, reason: 'spam', text: '' })).toMatchObject({ ok: false, error: 'not-signed-in' });
    expect(ask(service, 'common.getProfile', { target: alice.pubkey })).toMatchObject({ ok: true, pubkey: alice.pubkey });
    service.signIn('bob');
    expect(ask(service, 'common.follows')).toMatchObject({ ok: true, pubkeys: MOCK_ACCOUNTS.filter((account) => account.name !== 'bob').map((account) => account.pubkey) });
  });

  it('publishes through a shared store and resets its own state', () => {
    const store = createMockNostrStore({ clock });
    const service = createMockCommonService({ store });
    ask(service, 'common.react', { targetEventId: note('note:bob:0').id, reaction: '+' });
    expect(store.query([{ kinds: [7] }])).toHaveLength(1);
    service.onWindowDestroyed?.('w1');
    service.mock.reset();
    expect(service.mock.state().published).toEqual([]);
    expect(service.mock.sent).toEqual([]);
    expect(createMockCommonService().mock.state().store.query([{ kinds: [7] }])).toHaveLength(0);
  });
});

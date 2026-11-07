import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';

import { mockEventId } from '../core/rng.js';
import { findMockAccount, MOCK_ACCOUNTS, MOCK_RELAYS } from '../fixtures/nostr.js';
import { createMockIdentityService, IDENTITY_MOCK_ENTRY, IDENTITY_SPEC_REF, parseMockProfile } from './identity.js';
import { createMockNostrStore, MOCK_SPAM_PUBKEY } from './nostr-store.js';

const alice = findMockAccount('alice')!;
const bob = findMockAccount('bob')!;
const carol = findMockAccount('carol')!;
const erin = findMockAccount('erin')!;
const others = (name: string) => MOCK_ACCOUNTS.filter((account) => account.name !== name).map((account) => account.pubkey);

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

function ask(service: ReturnType<typeof createMockIdentityService>, type: string, extra: Record<string, unknown> = {}, windowId = 'w1'): NappletMessage {
  const { sent, send } = sink();
  service.handleMessage(windowId, { type, id: `id-${type}`, ...extra } as NappletMessage, send);
  return sent[0]!;
}

describe('createMockIdentityService', () => {
  it('describes the service and spec ref', () => {
    const service = createMockIdentityService();
    expect(service.descriptor).toEqual({ name: 'identity', version: '1.0.0', description: 'Mock NAP-IDENTITY: read-only shell-user identity over nostr fixtures' });
    expect(service.mock.routes).toEqual([
      'identity.getPublicKey', 'identity.getRelays', 'identity.getProfile', 'identity.getFollows', 'identity.getList',
      'identity.getZaps', 'identity.getMutes', 'identity.getBlocked', 'identity.getBadges',
    ]);
    expect(IDENTITY_SPEC_REF).toEqual({ nap: 'NAP-IDENTITY', status: 'merged', source: 'master', sha: '43cb3a4e8555', path: 'naps/NAP-IDENTITY.md' });
    expect(IDENTITY_MOCK_ENTRY).toMatchObject({ domain: 'identity', kind: 'service', spec: IDENTITY_SPEC_REF });
  });

  it('identity.getPublicKey returns the shell user without error', () => {
    const service = createMockIdentityService();
    expect(ask(service, 'identity.getPublicKey')).toEqual({ type: 'identity.getPublicKey.result', id: 'id-identity.getPublicKey', pubkey: alice.pubkey });
  });

  it('identity.getRelays maps the NIP-65 fixture to RelayPermissions', () => {
    const service = createMockIdentityService();
    expect(ask(service, 'identity.getRelays')).toEqual({
      type: 'identity.getRelays.result',
      id: 'id-identity.getRelays',
      relays: {
        [MOCK_RELAYS.primary]: { read: true, write: true },
        [MOCK_RELAYS.secondary]: { read: false, write: true },
        [MOCK_RELAYS.tertiary]: { read: true, write: false },
      },
    });
  });

  it('identity.getProfile parses the kind-0 fixture', () => {
    const service = createMockIdentityService();
    expect(ask(service, 'identity.getProfile')).toEqual({
      type: 'identity.getProfile.result',
      id: 'id-identity.getProfile',
      profile: { name: 'alice', displayName: 'Alice', about: 'Shell user of the mock environment.', picture: 'https://avatars.example.org/alice.png' },
    });
    expect(parseMockProfile('not json')).toBeNull();
    expect(parseMockProfile('{"nip05":"alice@example.org","website":"https://example.org"}')).toEqual({ nip05: 'alice@example.org', website: 'https://example.org' });
  });

  it('identity.getFollows and identity.getMutes read kind 3 / kind 10000', () => {
    const service = createMockIdentityService();
    expect(ask(service, 'identity.getFollows')).toEqual({ type: 'identity.getFollows.result', id: 'id-identity.getFollows', pubkeys: others('alice') });
    expect(ask(service, 'identity.getMutes')).toEqual({ type: 'identity.getMutes.result', id: 'id-identity.getMutes', pubkeys: [MOCK_SPAM_PUBKEY] });
  });

  it('identity.getList maps list types to NIP-51 kinds and rejects unknown names', () => {
    const service = createMockIdentityService();
    expect(ask(service, 'identity.getList', { listType: 'bookmarks' })).toEqual({
      type: 'identity.getList.result',
      id: 'id-identity.getList',
      entries: [mockEventId('note:bob:1'), mockEventId('note:carol:2'), 'linux'],
    });
    expect(ask(service, 'identity.getList', { listType: 'interests' })).toMatchObject({ entries: ['linux', 'nixos'] });
    expect(ask(service, 'identity.getList', { listType: 'pins' })).toMatchObject({ entries: [mockEventId('note:alice:0')] });
    expect(ask(service, 'identity.getList', { listType: 'communities' })).toMatchObject({ entries: [] });
    expect(ask(service, 'identity.getList', { listType: 'wishlist' })).toEqual({ type: 'identity.getList.result', id: 'id-identity.getList', entries: [], error: 'unsupported list type' });
    expect(ask(service, 'identity.getList', { listType: 'toString' })).toMatchObject({ error: 'unsupported list type' });
  });

  it('identity.getZaps, getBlocked, and getBadges return fixture data', () => {
    const service = createMockIdentityService();
    expect(ask(service, 'identity.getZaps')).toEqual({
      type: 'identity.getZaps.result',
      id: 'id-identity.getZaps',
      zaps: [
        { eventId: mockEventId('zap:bob:alice:1'), sender: bob.pubkey, amount: 21_000, content: 'Great post!' },
        { eventId: mockEventId('zap:carol:alice:1'), sender: carol.pubkey, amount: 5_000 },
      ],
    });
    expect(ask(service, 'identity.getBlocked')).toEqual({ type: 'identity.getBlocked.result', id: 'id-identity.getBlocked', pubkeys: [] });
    expect(ask(service, 'identity.getBadges')).toEqual({
      type: 'identity.getBadges.result',
      id: 'id-identity.getBadges',
      badges: [{
        id: `30009:${erin.pubkey}:early-adopter`,
        name: 'Early Adopter',
        description: 'Joined the mock relay before launch.',
        image: 'https://badges.example.org/early-adopter.png',
        thumbs: ['https://badges.example.org/early-adopter-64.png'],
        awardedBy: erin.pubkey,
      }],
    });
  });

  it('signOut()/signIn() push identity.changed to known windows and change every answer', () => {
    const service = createMockIdentityService();
    const w1 = sink();
    service.handleMessage('w1', { type: 'identity.getPublicKey', id: 'q1' } as NappletMessage, w1.send);
    service.signOut();
    expect(w1.sent[1]).toEqual({ type: 'identity.changed', pubkey: '' });
    expect(ask(service, 'identity.getPublicKey', {}, 'w2')).toMatchObject({ pubkey: '' });
    expect(ask(service, 'identity.getProfile', {}, 'w2')).toEqual({ type: 'identity.getProfile.result', id: 'id-identity.getProfile', profile: null });
    expect(ask(service, 'identity.getFollows', {}, 'w2')).toMatchObject({ pubkeys: [] });
    expect(ask(service, 'identity.getRelays', {}, 'w2')).toMatchObject({ relays: {} });
    expect(ask(service, 'identity.getZaps', {}, 'w2')).toMatchObject({ zaps: [] });
    expect(ask(service, 'identity.getBadges', {}, 'w2')).toMatchObject({ badges: [] });

    service.signIn('bob');
    expect(w1.sent[2]).toEqual({ type: 'identity.changed', pubkey: bob.pubkey });
    expect(ask(service, 'identity.getFollows')).toMatchObject({ pubkeys: others('bob') });
    expect(ask(service, 'identity.getRelays')).toMatchObject({ relays: { [MOCK_RELAYS.secondary]: { read: true, write: true }, [MOCK_RELAYS.primary]: { read: true, write: false } } });
  });

  it('announces through the runtime when attached', () => {
    const service = createMockIdentityService();
    const runtime: ServiceRuntimeContext = { resolveDTag: () => 'd', listWindowIds: () => ['a', 'b'], hasCapability: () => true, sendToEligibleNapplet: vi.fn(() => true) };
    service.onRegistered?.(runtime);
    service.signOut();
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledTimes(2);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('b', { type: 'identity.changed', pubkey: '' });
  });

  it('starts signed out with user "" and reflects shared-store mutations', () => {
    const store = createMockNostrStore();
    const service = createMockIdentityService({ store, user: '' });
    expect(ask(service, 'identity.getPublicKey')).toMatchObject({ pubkey: '' });
    service.signIn(alice.pubkey);
    store.publish({ kind: 3, tags: [['p', bob.pubkey]] }, alice.pubkey);
    expect(ask(service, 'identity.getFollows')).toMatchObject({ pubkeys: [bob.pubkey] });
  });

  it('forgets destroyed windows and resets state', () => {
    const service = createMockIdentityService();
    ask(service, 'identity.getPublicKey', {}, 'w1');
    ask(service, 'identity.getPublicKey', {}, 'w2');
    expect([...service.mock.state().windows]).toEqual(['w1', 'w2']);
    service.onWindowDestroyed?.('w2');
    expect([...service.mock.state().windows]).toEqual(['w1']);
    service.signOut();
    service.mock.reset();
    expect(service.mock.state().user).toBe(alice.pubkey);
    expect(service.mock.state().windows.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { mockHex } from '../core/rng.js';
import { MOCK_ACCOUNTS, MOCK_EPOCH_SECONDS, findMockAccount, type MockAccount } from '../fixtures/nostr.js';
import { DM_MOCK_ENTRY, DM_SPEC_REF, createMockDmService } from './dm.js';

type Msg = NappletMessage & Record<string, unknown>;

const alice = MOCK_ACCOUNTS[0] as MockAccount;
const bob = findMockAccount('bob') as MockAccount;
const carol = findMockAccount('carol') as MockAccount;
const frank = findMockAccount('frank') as MockAccount;
const NOW_MS = 1_800_000_000_000;

function setup(options: Parameters<typeof createMockDmService>[0] = {}) {
  const service = createMockDmService({ clock: { now: () => NOW_MS }, ...options });
  const sent: Msg[] = [];
  const send = (msg: NappletMessage): void => { sent.push(msg as Msg); };
  const call = (message: Record<string, unknown>, windowId = 'w1') => service.handleMessage(windowId, message as unknown as NappletMessage, send);
  const last = (): Msg => sent.at(-1) as Msg;
  return { service, sent, call, last };
}

function peerOf(account: MockAccount) {
  return { pubkey: account.pubkey, label: account.displayName, avatar: `https://avatars.example.org/${account.name}.png` };
}

describe('createMockDmService', () => {
  it('exposes descriptor, routes, entry and spec ref', () => {
    const { service } = setup();
    expect(service.descriptor.name).toBe('dm');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.mock.routes).toEqual(['dm.status', 'dm.conversations', 'dm.messages', 'dm.send', 'dm.subscribe', 'dm.unsubscribe']);
    expect(service.messageCapabilities).toBeUndefined();
    expect(DM_MOCK_ENTRY).toMatchObject({ domain: 'dm', kind: 'service', spec: DM_SPEC_REF });
    expect(DM_SPEC_REF).toEqual({ nap: 'NAP-DM', status: 'draft', source: 'pr', pr: 74, sha: '2c4e4423f40e', path: 'naps/NAP-DM.md' });
  });

  it('dm.status reports availability and the owner; unavailable blocks the other routes', () => {
    const { service, call, last } = setup();
    call({ type: 'dm.status', id: 's1' });
    expect(last()).toEqual({
      type: 'dm.status.result',
      id: 's1',
      available: true,
      ownerPubkey: alice.pubkey,
      implementations: ['mock'],
      capabilities: ['direct', 'group', 'history', 'live'],
    });
    service.setAvailable(false);
    call({ type: 'dm.status', id: 's2' });
    expect(last()).toEqual({ type: 'dm.status.result', id: 's2', available: false, implementations: [], capabilities: [] });
    call({ type: 'dm.conversations', id: 'c1' });
    expect(last()).toEqual({ type: 'dm.conversations.result', id: 'c1', error: 'unavailable' });
    call({ type: 'dm.send', id: 'm1', recipients: [bob.pubkey], content: 'x' });
    expect(last().error).toBe('unavailable');
  });

  it('dm.conversations pages the seeded summaries newest first', () => {
    const { call, last } = setup();
    call({ type: 'dm.conversations', id: 'c1' });
    const page = last();
    expect(page.cursor).toBeUndefined();
    const conversations = page.conversations as Array<Record<string, unknown>>;
    expect(conversations.map((item) => item.id)).toEqual(['conv-mirror-ops', 'conv-dave', 'conv-carol', 'conv-bob']);
    expect(conversations[0]).toEqual({
      id: 'conv-mirror-ops',
      kind: 'group',
      participants: [peerOf(alice), peerOf(findMockAccount('erin') as MockAccount), peerOf(frank)],
      subject: 'Mirror ops',
      unread: 2,
      updatedAt: MOCK_EPOCH_SECONDS + 86_400 + 3 * 3_600 + 120,
    });
    expect(conversations[3]).toMatchObject({ id: 'conv-bob', kind: 'direct', participants: [peerOf(alice), peerOf(bob)], unread: 1, updatedAt: MOCK_EPOCH_SECONDS + 86_400 + 240 });
    call({ type: 'dm.conversations', id: 'c2', limit: 2 });
    expect((last().conversations as Array<{ id: string }>).map((item) => item.id)).toEqual(['conv-mirror-ops', 'conv-dave']);
    expect(last().cursor).toBe('2');
    call({ type: 'dm.conversations', id: 'c3', limit: 2, cursor: '2' });
    expect((last().conversations as Array<{ id: string }>).map((item) => item.id)).toEqual(['conv-carol', 'conv-bob']);
    expect(last().cursor).toBeUndefined();
    call({ type: 'dm.conversations', id: 'c4', limit: -1 });
    expect(last()).toEqual({ type: 'dm.conversations.result', id: 'c4', error: 'invalid request' });
  });

  it('dm.messages returns history newest first with cursors and not-found errors', () => {
    const { call, last } = setup();
    call({ type: 'dm.messages', id: 'h1', conversationId: 'conv-bob' });
    const base = MOCK_EPOCH_SECONDS + 86_400;
    expect(last()).toEqual({
      type: 'dm.messages.result',
      id: 'h1',
      messages: [
        { id: mockHex('dm:conv-bob:2', 32), conversationId: 'conv-bob', senderPubkey: bob.pubkey, createdAt: base + 240, content: 'Great, I will announce it tonight.', status: 'received' },
        { id: mockHex('dm:conv-bob:1', 32), conversationId: 'conv-bob', senderPubkey: alice.pubkey, createdAt: base + 120, content: 'Yes, checksums verified an hour ago.', status: 'sent' },
        { id: mockHex('dm:conv-bob:0', 32), conversationId: 'conv-bob', senderPubkey: bob.pubkey, createdAt: base, content: 'Did the Debian netinst mirror finish syncing?', status: 'received' },
      ],
    });
    call({ type: 'dm.messages', id: 'h2', conversationId: 'conv-bob', limit: 1 });
    expect((last().messages as Array<{ content: string }>).map((item) => item.content)).toEqual(['Great, I will announce it tonight.']);
    expect(last().cursor).toBe('1');
    call({ type: 'dm.messages', id: 'h3', conversationId: 'nope' });
    expect(last()).toEqual({ type: 'dm.messages.result', id: 'h3', error: 'not found' });
    call({ type: 'dm.messages', id: 'h4' });
    expect(last()).toEqual({ type: 'dm.messages.result', id: 'h4', error: 'invalid request' });
  });

  it('dm.send appends to an existing direct conversation or creates one, and fans out live', () => {
    const { service, call, last, sent } = setup();
    call({ type: 'dm.subscribe', id: 'sub1' });
    const subscriptionId = last().subscriptionId as string;
    call({ type: 'dm.send', id: 'm1', recipients: [bob.pubkey], content: 'hello bob' });
    const result = sent.at(-2) as Msg;
    expect(result.type).toBe('dm.send.result');
    expect(result.id).toBe('m1');
    expect(result.ok).toBe(true);
    const message = result.message as Record<string, unknown>;
    expect(message.id).toMatch(/^msg-[0-9a-f]{16}$/);
    expect(message).toMatchObject({ conversationId: 'conv-bob', senderPubkey: alice.pubkey, createdAt: NOW_MS / 1000, content: 'hello bob', status: 'sent' });
    expect(last()).toEqual({ type: 'dm.message', subscriptionId, message });
    const bobConversation = service.mock.state().conversations.find((item) => item.id === 'conv-bob');
    expect(bobConversation?.updatedAt).toBe(NOW_MS / 1000);
    expect(service.mock.state().messages.get('conv-bob')).toHaveLength(4);

    call({ type: 'dm.send', id: 'm2', recipients: [frank.pubkey], content: 'new thread' });
    const created = (sent.at(-2) as Msg).message as { conversationId: string };
    expect(created.conversationId).toMatch(/^conv-[0-9a-f]{8}$/);
    expect(service.mock.state().conversations.find((item) => item.id === created.conversationId)).toMatchObject({ kind: 'direct', participants: [peerOf(alice), peerOf(frank)], unread: 0 });

    call({ type: 'dm.send', id: 'm3', recipients: [bob.pubkey, carol.pubkey], content: 'group hello' });
    const group = (sent.at(-2) as Msg).message as { conversationId: string };
    expect(service.mock.state().conversations.find((item) => item.id === group.conversationId)?.kind).toBe('group');

    call({ type: 'dm.send', id: 'm4', recipients: [bob.pubkey], content: 'explicit', conversationId: 'conv-carol' });
    expect(((sent.at(-2) as Msg).message as { conversationId: string }).conversationId).toBe('conv-carol');

    call({ type: 'dm.send', id: 'e1', recipients: ['f'.repeat(64)], content: 'x' });
    expect(last()).toEqual({ type: 'dm.send.result', id: 'e1', error: 'invalid recipient' });
    call({ type: 'dm.send', id: 'e2', recipients: [alice.pubkey], content: 'x' });
    expect(last().error).toBe('invalid recipient');
    call({ type: 'dm.send', id: 'e3', recipients: [bob.pubkey], content: '' });
    expect(last().error).toBe('invalid request');
    call({ type: 'dm.send', id: 'e4', recipients: [], content: 'x' });
    expect(last().error).toBe('invalid request');
    call({ type: 'dm.send', id: 'e5', recipients: [bob.pubkey], content: 'x', conversationId: 'nope' });
    expect(last().error).toBe('not found');
  });

  it('subscriptions receive injected inbound messages; unsubscribe is scoped to the owner window', () => {
    const { service, call, last, sent } = setup();
    call({ type: 'dm.subscribe', id: 'sub1' });
    const all = last();
    expect(all.type).toBe('dm.subscribe.result');
    expect(all.subscriptionId).toMatch(/^live-[0-9a-f]{8}$/);
    call({ type: 'dm.subscribe', id: 'sub2', conversationId: 'conv-bob' }, 'w2');
    const bobOnly = last().subscriptionId as string;
    call({ type: 'dm.subscribe', id: 'sub3', conversationId: 'nope' });
    expect(last()).toEqual({ type: 'dm.subscribe.result', id: 'sub3', error: 'not found' });

    const received = service.receive('bob', 'are you there?');
    expect(received).toEqual({
      id: mockHex('dm:conv-bob:3', 32),
      conversationId: 'conv-bob',
      senderPubkey: bob.pubkey,
      createdAt: NOW_MS / 1000,
      content: 'are you there?',
      status: 'received',
    });
    expect(sent.slice(-2)).toEqual([
      { type: 'dm.message', subscriptionId: all.subscriptionId, message: received },
      { type: 'dm.message', subscriptionId: bobOnly, message: received },
    ]);
    expect(service.mock.sent.at(-1)?.windowId).toBe('w2');
    expect(service.mock.state().conversations.find((item) => item.id === 'conv-bob')?.unread).toBe(2);

    const fromCarol = service.receive('carol', 'mirror synced');
    expect(last()).toEqual({ type: 'dm.message', subscriptionId: all.subscriptionId, message: fromCarol });
    expect(service.receive('alice', 'self')).toBeUndefined();
    expect(service.receive('zed', 'who')).toBeUndefined();
    expect(service.receive('dave', 'into group', 'conv-mirror-ops')?.conversationId).toBe('conv-mirror-ops');

    call({ type: 'dm.unsubscribe', id: 'u1', subscriptionId: bobOnly });
    expect(last()).toEqual({ type: 'dm.unsubscribe.result', id: 'u1', error: 'not found' });
    call({ type: 'dm.unsubscribe', id: 'u2', subscriptionId: bobOnly }, 'w2');
    expect(last()).toEqual({ type: 'dm.unsubscribe.result', id: 'u2', ok: true });
    call({ type: 'dm.unsubscribe', id: 'u3', subscriptionId: bobOnly }, 'w2');
    expect(last().error).toBe('not found');
    service.receive('bob', 'only the all-subscription hears this');
    expect(sent.filter((msg) => msg.type === 'dm.message' && msg.subscriptionId === bobOnly)).toHaveLength(1);
  });

  it('reset, window destruction and capability revocation drop subscriptions', () => {
    const { service, call } = setup();
    call({ type: 'dm.subscribe', id: 'sub1' });
    call({ type: 'dm.subscribe', id: 'sub2' }, 'w2');
    service.onWindowDestroyed?.('w1');
    expect([...service.mock.state().subscriptions.values()].map((sub) => sub.windowId)).toEqual(['w2']);
    service.onCapabilityRevoked?.('w2', 'dm:read');
    expect(service.mock.state().subscriptions.size).toBe(0);
    call({ type: 'dm.send', id: 'm1', recipients: [frank.pubkey], content: 'x' });
    expect(service.mock.state().conversations).toHaveLength(5);
    service.mock.reset();
    expect(service.mock.state().conversations).toHaveLength(4);
    expect(service.mock.sent).toEqual([]);
  });
});

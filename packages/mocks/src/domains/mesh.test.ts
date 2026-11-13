import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_ACCOUNTS, MOCK_EVENTS, findMockAccount, type MockAccount } from '../fixtures/nostr.js';
import { MESH_MOCK_ENTRY, MESH_SPEC_REF, createMockMeshService } from './mesh.js';

type Msg = NappletMessage & Record<string, unknown>;

const alice = MOCK_ACCOUNTS[0] as MockAccount;
const bob = findMockAccount('bob') as MockAccount;
const dave = findMockAccount('dave') as MockAccount;
const frank = findMockAccount('frank') as MockAccount;
const NOW_MS = 1_800_000_000_000;
const notesBy = (account: MockAccount) => MOCK_EVENTS.filter((event) => event.kind === 1 && event.pubkey === account.pubkey);

function setup(options: Parameters<typeof createMockMeshService>[0] = {}) {
  const service = createMockMeshService({ clock: { now: () => NOW_MS }, ...options });
  const sent: Msg[] = [];
  const send = (msg: NappletMessage): void => { sent.push(msg as Msg); };
  const call = (message: Record<string, unknown>, windowId = 'w1') => service.handleMessage(windowId, message as unknown as NappletMessage, send);
  const last = (): Msg => sent.at(-1) as Msg;
  return { service, sent, call, last };
}

describe('createMockMeshService', () => {
  it('is an extension publishing every route with a null capability', () => {
    const { service } = setup();
    expect(service.descriptor.name).toBe('mesh');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.mock.routes).toEqual(['mesh.info', 'mesh.publish', 'mesh.subscribe', 'mesh.close', 'mesh.blobs']);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual([...service.mock.routes]);
    expect(Object.values(service.messageCapabilities ?? {})).toEqual([null, null, null, null, null]);
    expect(MESH_MOCK_ENTRY).toMatchObject({ domain: 'mesh', kind: 'extension', spec: MESH_SPEC_REF });
    expect(MESH_SPEC_REF).toEqual({ nap: 'NAP-MESH', status: 'draft', source: 'pr', pr: 122, sha: 'bf9a4722244e', path: 'naps/NAP-MESH.md' });
  });

  it('mesh.info reports reachable members and caps; offline is not an error', () => {
    const { service, call, last } = setup();
    call({ type: 'mesh.info', id: 'i1' });
    expect(last()).toEqual({ type: 'mesh.info.result', id: 'i1', online: true, peers: 2, limits: { publishTtl: 3, subscribeTtl: 2 } });
    service.setOnline(false);
    call({ type: 'mesh.info', id: 'i2' });
    expect(last()).toEqual({ type: 'mesh.info.result', id: 'i2', online: false, peers: 0, limits: { publishTtl: 3, subscribeTtl: 2 } });
  });

  it('mesh.publish signs as the user, clamps ttl and floods within the hop budget', () => {
    const { service, call, last } = setup();
    call({ type: 'mesh.publish', id: 'p1', event: { kind: 1, content: 'hello circle', tags: [['t', 'linux']] }, ttl: 2 });
    const result = last();
    expect(result.type).toBe('mesh.publish.result');
    expect(result.id).toBe('p1');
    expect(result.ok).toBe(true);
    expect(result.ttl).toBe(2);
    const event = result.event as Record<string, unknown>;
    expect(event).toMatchObject({ kind: 1, pubkey: alice.pubkey, content: 'hello circle', tags: [['t', 'linux']], created_at: NOW_MS / 1000 });
    expect(event.id).toMatch(/^[0-9a-f]{64}$/);
    expect(result.eventId).toBe(event.id);
    expect([...(service.mock.state().reach.get(event.id as string) ?? [])]).toEqual(['bob', 'carol', 'dave', 'erin']);
    expect(service.mock.state().kept.map((item) => item.id)).toEqual([event.id]);

    call({ type: 'mesh.publish', id: 'p2', event: { kind: 1, content: 'far' }, ttl: 10 });
    expect(last().ttl).toBe(3);
    expect(service.mock.state().reach.get(last().eventId as string)?.has('frank')).toBe(true);

    call({ type: 'mesh.publish', id: 'p3', event: { kind: 20666, content: 'ding' }, ttl: 0 });
    expect(last().ttl).toBe(0);
    expect(service.mock.state().reach.get(last().eventId as string)?.size).toBe(0);
    expect(service.mock.state().kept).toHaveLength(2);

    call({ type: 'mesh.publish', id: 'p4', event: { kind: 1, content: 'x' }, ttl: 256 });
    expect(last()).toEqual({ type: 'mesh.publish.result', id: 'p4', ok: false, error: 'invalid ttl' });
    call({ type: 'mesh.publish', id: 'p5', event: { kind: 'one', content: 'x' } });
    expect(last()).toEqual({ type: 'mesh.publish.result', id: 'p5', ok: false, error: 'invalid template' });
    service.setOnline(false);
    call({ type: 'mesh.publish', id: 'p6', event: { kind: 1, content: 'local only' } });
    expect(last().ok).toBe(true);
    expect(service.mock.state().reach.get(last().eventId as string)?.size).toBe(0);
  });

  it('mesh.subscribe delivers local backlog, eose, then member backlog within the clamped ttl', () => {
    const { call, sent } = setup();
    call({ type: 'mesh.subscribe', id: 's1', subId: 'bob-notes', filters: [{ kinds: [1], authors: [bob.pubkey] }], ttl: 1 });
    expect(sent[0]).toEqual({ type: 'mesh.eose', subId: 'bob-notes', ttl: 1 });
    const events = sent.slice(1);
    expect(events).toHaveLength(6);
    expect(events.map((msg) => msg.type)).toEqual(Array(6).fill('mesh.event'));
    expect(events.map((msg) => (msg.result as { event: { id: string } }).event)).toEqual(notesBy(bob));

    sent.length = 0;
    call({ type: 'mesh.subscribe', id: 's2', subId: 'dave-far', filters: { kinds: [1], authors: [dave.pubkey] }, ttl: 0 });
    expect(sent).toEqual([{ type: 'mesh.eose', subId: 'dave-far', ttl: 0 }]);
    sent.length = 0;
    call({ type: 'mesh.subscribe', id: 's3', subId: 'dave-near', filters: { kinds: [1], authors: [dave.pubkey] }, ttl: 2 });
    expect(sent.filter((msg) => msg.type === 'mesh.event')).toHaveLength(6);
    sent.length = 0;
    call({ type: 'mesh.subscribe', id: 's4', subId: 'frank-clamped', filters: { authors: [frank.pubkey] }, ttl: 3 });
    expect(sent).toEqual([{ type: 'mesh.eose', subId: 'frank-clamped', ttl: 2 }]);
  });

  it('delivers live publishes and injected member events to matching subscriptions once', () => {
    const { service, call, sent, last } = setup();
    call({ type: 'mesh.subscribe', id: 's1', subId: 'room', filters: [{ kinds: [9], '#h': ['kitchen'] }] });
    call({ type: 'mesh.subscribe', id: 's2', subId: 'room', filters: [{ kinds: [9], '#h': ['kitchen'] }] }, 'w2');
    sent.length = 0;
    call({ type: 'mesh.publish', id: 'p1', event: { kind: 9, content: 'dinner?', tags: [['h', 'kitchen']] } });
    const published = last().event ?? (sent[0] as Msg).event;
    expect(sent.map((msg) => msg.type)).toEqual(['mesh.publish.result', 'mesh.event', 'mesh.event']);
    expect(sent[1]).toEqual({ type: 'mesh.event', subId: 'room', result: { event: published } });
    expect(service.mock.sent.slice(-2).map((entry) => entry.windowId)).toEqual(['w1', 'w2']);

    sent.length = 0;
    const injected = service.inject('bob', { kind: 9, content: 'yes', tags: [['h', 'kitchen']] });
    expect(injected).toMatchObject({ kind: 9, pubkey: bob.pubkey, content: 'yes', created_at: NOW_MS / 1000 });
    expect(sent).toEqual([
      { type: 'mesh.event', subId: 'room', result: { event: injected } },
      { type: 'mesh.event', subId: 'room', result: { event: injected } },
    ]);
    expect(service.mock.state().kept.some((event) => event.id === injected?.id)).toBe(true);
    expect(service.inject('alice', { kind: 1, content: 'not a member' })).toBeUndefined();
    sent.length = 0;
    service.inject('carol', { kind: 1, content: 'no match' });
    expect(sent).toEqual([]);

    call({ type: 'mesh.close', subId: 'room' }, 'w2');
    expect(sent).toEqual([]);
    expect(service.mock.state().subscriptions.has('w2:room')).toBe(false);
    service.inject('bob', { kind: 9, content: 'again', tags: [['h', 'kitchen']] });
    expect(sent).toHaveLength(1);
    call({ type: 'mesh.close', subId: 'room' }, 'w2');
    expect(sent).toHaveLength(1);
  });

  it('refuses malformed subscriptions with mesh.subscribe.result and no closed delivery', () => {
    const { call, sent } = setup();
    call({ type: 'mesh.subscribe', id: 's1', filters: [{ kinds: [1] }] });
    expect(sent).toEqual([{ type: 'mesh.subscribe.result', id: 's1', error: 'missing subId' }]);
    call({ type: 'mesh.subscribe', id: 's2', subId: 'x', filters: 'kinds' });
    expect(sent.at(-1)).toEqual({ type: 'mesh.subscribe.result', id: 's2', error: 'invalid filters' });
    call({ type: 'mesh.subscribe', id: 's3', subId: 'x', filters: [{ kinds: [1] }], ttl: 1.5 });
    expect(sent.at(-1)).toEqual({ type: 'mesh.subscribe.result', id: 's3', error: 'invalid ttl' });
    expect(sent.some((msg) => msg.type === 'mesh.closed')).toBe(false);
  });

  it('mesh.blobs counts holders among reachable members only', () => {
    const { service, call, last } = setup();
    const debian = LINUX_DISTROS[0]?.sha256 as string;
    const fedora = LINUX_DISTROS[2]?.sha256 as string;
    const mint = LINUX_DISTROS[7]?.sha256 as string;
    const none = '0'.repeat(64);
    call({ type: 'mesh.blobs', id: 'b1', hashes: [debian, fedora, mint, none] });
    expect(last()).toEqual({ type: 'mesh.blobs.result', id: 'b1', peers: 2, blobs: { [debian]: 2, [fedora]: 1, [mint]: 1, [none]: 0 } });
    call({ type: 'mesh.blobs', id: 'b2', hashes: ['nothex'] });
    expect(last()).toEqual({ type: 'mesh.blobs.result', id: 'b2', error: 'invalid hashes' });
    call({ type: 'mesh.blobs', id: 'b3', hashes: Array.from({ length: 65 }, () => none) });
    expect(last()).toEqual({ type: 'mesh.blobs.result', id: 'b3', error: 'too many hashes' });
    call({ type: 'mesh.blobs', id: 'b4' });
    expect(last().error).toBe('invalid hashes');
    service.setOnline(false);
    call({ type: 'mesh.blobs', id: 'b5', hashes: [debian] });
    expect(last()).toEqual({ type: 'mesh.blobs.result', id: 'b5', peers: 0, blobs: { [debian]: 0 } });
  });

  it('cleans subscriptions on destroy, closes them on revoke, and resets', () => {
    const { service, call, sent } = setup();
    call({ type: 'mesh.subscribe', id: 's1', subId: 'a', filters: [{ kinds: [1] }], ttl: 0 });
    call({ type: 'mesh.subscribe', id: 's2', subId: 'b', filters: [{ kinds: [1] }], ttl: 0 }, 'w2');
    service.onWindowDestroyed?.('w1');
    expect([...service.mock.state().subscriptions.keys()]).toEqual(['w2:b']);
    sent.length = 0;
    service.onCapabilityRevoked?.('w2', null);
    expect(sent).toEqual([{ type: 'mesh.closed', subId: 'b', reason: 'mesh not granted' }]);
    expect(service.mock.state().subscriptions.size).toBe(0);
    call({ type: 'mesh.publish', id: 'p1', event: { kind: 1, content: 'x' } });
    service.mock.reset();
    expect(service.mock.state().kept).toEqual([]);
    expect(service.mock.state().reach.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});

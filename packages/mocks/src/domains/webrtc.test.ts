import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { MOCK_ACCOUNTS, findMockAccount, type MockAccount } from '../fixtures/nostr.js';
import { MOCK_WEBRTC_LOOPBACK_PUBKEY, WEBRTC_MOCK_ENTRY, WEBRTC_SPEC_REF, createMockWebrtcService } from './webrtc.js';

type Msg = NappletMessage & Record<string, unknown>;

const alice = MOCK_ACCOUNTS[0] as MockAccount;
const bob = findMockAccount('bob') as MockAccount;
const carol = findMockAccount('carol') as MockAccount;

function manualScheduler() {
  const queue: Array<() => void> = [];
  const scheduler: MockScheduler = {
    schedule: (_ms, fn) => {
      queue.push(fn);
      return () => { const index = queue.indexOf(fn); if (index >= 0) queue.splice(index, 1); };
    },
  };
  const drain = (): void => { while (queue.length > 0) (queue.shift() as () => void)(); };
  return { scheduler, queue, drain };
}

function setup(options: Parameters<typeof createMockWebrtcService>[0] = {}) {
  const timers = manualScheduler();
  const service = createMockWebrtcService({ scheduler: timers.scheduler, ...options });
  const sent: Msg[] = [];
  const send = (msg: NappletMessage): void => { sent.push(msg as Msg); };
  const call = (message: Record<string, unknown>, windowId = 'w1') => service.handleMessage(windowId, message as unknown as NappletMessage, send);
  const last = (): Msg => sent.at(-1) as Msg;
  const open = (windowId: string, scope: Record<string, unknown>, extra: Record<string, unknown> = {}): string => {
    const id = `open-${sent.length}`;
    call({ type: 'webrtc.open', id, request: { scope, ...extra } }, windowId);
    const result = sent.find((msg) => msg.type === 'webrtc.open.result' && msg.id === id) as Msg;
    return (result.session as { id: string }).id;
  };
  const events = (): Msg[] => sent.filter((msg) => msg.type === 'webrtc.event').map((msg) => msg.event as Msg);
  return { service, sent, call, last, open, events, ...timers };
}

describe('createMockWebrtcService', () => {
  it('exposes descriptor, routes, entry and spec ref', () => {
    const { service } = setup();
    expect(service.descriptor.name).toBe('webrtc');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.mock.routes).toEqual(['webrtc.open', 'webrtc.send', 'webrtc.close']);
    expect(service.messageCapabilities).toBeUndefined();
    expect(WEBRTC_MOCK_ENTRY).toMatchObject({ domain: 'webrtc', kind: 'service', spec: WEBRTC_SPEC_REF });
    expect(WEBRTC_SPEC_REF).toEqual({ nap: 'NAP-WEBRTC', status: 'draft', source: 'pr', pr: 59, sha: '69523e8cf44c', path: 'naps/NAP-WEBRTC.md' });
  });

  it('webrtc.open returns a connecting session; peerAnswer completes loopback signaling', () => {
    const { service, call, sent, last, events, queue } = setup({ autoAnswer: false });
    call({ type: 'webrtc.open', id: 'w1', request: { scope: { type: 'direct', pubkey: bob.pubkey }, channel: 'chat', protocol: 'chat:live' } });
    const result = last();
    expect(result.type).toBe('webrtc.open.result');
    expect(result.id).toBe('w1');
    const session = result.session as Record<string, unknown>;
    expect(session.id).toMatch(/^sess-[0-9a-f]{8}$/);
    expect(session).toMatchObject({ scope: { type: 'direct', pubkey: bob.pubkey }, channel: 'chat', protocol: 'chat:live', state: 'connecting' });
    expect(service.mock.state().identities.get('w1')).toBe(alice.pubkey);
    expect(queue).toHaveLength(0);
    const sessionId = session.id as string;

    expect(service.peerAnswer(sessionId)).toBe(true);
    expect(events()).toEqual([
      { type: 'state', sessionId, state: 'open' },
      { type: 'peer', sessionId, pubkey: bob.pubkey, state: 'joined' },
    ]);
    expect(service.mock.state().signals).toEqual([
      { kind: 'offer', sessionId, from: alice.pubkey, to: bob.pubkey },
      { kind: 'answer', sessionId, from: bob.pubkey, to: alice.pubkey },
      { kind: 'ice', sessionId, from: alice.pubkey, to: bob.pubkey },
    ]);
    expect(service.peerAnswer(sessionId)).toBe(false);
    expect(sent.every((msg) => !('sdp' in msg) && !('candidate' in msg))).toBe(true);

    call({ type: 'webrtc.send', id: 's1', sessionId, payload: { body: 'hello' } });
    expect(last()).toEqual({ type: 'webrtc.send.result', id: 's1' });
    expect(queue).toHaveLength(1);
    (queue.shift() as () => void)();
    expect(last()).toEqual({ type: 'webrtc.event', event: { type: 'message', sessionId, from: bob.pubkey, payload: { body: 'hello' } } });
  });

  it('autoAnswer connects a lone room session to the loopback peer after one tick', () => {
    const { open, events, drain } = setup();
    const sessionId = open('w1', { type: 'room', room: 'lab' });
    expect(events()).toEqual([]);
    drain();
    expect(events()).toEqual([
      { type: 'state', sessionId, state: 'open' },
      { type: 'peer', sessionId, pubkey: MOCK_WEBRTC_LOOPBACK_PUBKEY, state: 'joined' },
    ]);
  });

  it('pairs two windows opening direct sessions to each other and relays payloads', () => {
    const { service, call, sent, open, events, queue } = setup({ autoAnswer: false });
    const first = open('w1', { type: 'direct', pubkey: bob.pubkey });
    const second = open('w2', { type: 'direct', pubkey: alice.pubkey });
    expect(service.mock.state().identities.get('w2')).toBe(bob.pubkey);
    expect(events()).toEqual([
      { type: 'state', sessionId: first, state: 'open' },
      { type: 'peer', sessionId: first, pubkey: bob.pubkey, state: 'joined' },
      { type: 'state', sessionId: second, state: 'open' },
      { type: 'peer', sessionId: second, pubkey: alice.pubkey, state: 'joined' },
    ]);
    expect(service.mock.sent.slice(-4).map((entry) => entry.windowId)).toEqual(['w1', 'w1', 'w2', 'w2']);
    expect(service.mock.state().signals.map((signal) => signal.kind)).toEqual(['offer', 'answer', 'ice', 'ice']);

    sent.length = 0;
    call({ type: 'webrtc.send', id: 's1', sessionId: first, payload: { body: 'hi bob' } });
    expect(sent).toEqual([
      { type: 'webrtc.send.result', id: 's1' },
      { type: 'webrtc.event', event: { type: 'message', sessionId: second, from: alice.pubkey, payload: { body: 'hi bob' } } },
    ]);
    expect(service.mock.sent.at(-1)?.windowId).toBe('w2');
    expect(queue).toHaveLength(0);

    sent.length = 0;
    call({ type: 'webrtc.close', id: 'c1', sessionId: first, reason: 'done' });
    expect(sent).toEqual([
      { type: 'webrtc.event', event: { type: 'peer', sessionId: second, pubkey: alice.pubkey, state: 'left' } },
      { type: 'webrtc.event', event: { type: 'closed', sessionId: second, reason: 'peer disconnected' } },
      { type: 'webrtc.close.result', id: 'c1' },
    ]);
    expect(service.mock.state().sessions.get(second)?.session.state).toBe('closed');
    call({ type: 'webrtc.close', id: 'c2', sessionId: first });
    expect(sent.at(-1)).toEqual({ type: 'webrtc.close.result', id: 'c2' });
    call({ type: 'webrtc.send', id: 's2', sessionId: second, payload: 1 }, 'w2');
    expect(sent.at(-1)).toEqual({ type: 'webrtc.send.result', id: 's2', error: 'session closed' });
  });

  it('room sessions mesh every joined window; leaving removes only that peer', () => {
    const { service, call, sent, open, events } = setup({ autoAnswer: false });
    const a = open('w1', { type: 'room', room: 'lab' });
    const b = open('w2', { type: 'room', room: 'lab' });
    const c = open('w3', { type: 'room', room: 'lab' });
    expect(events().filter((event) => event.type === 'peer' && event.sessionId === c).map((event) => event.pubkey)).toEqual([alice.pubkey, bob.pubkey]);
    expect(service.mock.state().sessions.get(c)?.peers.size).toBe(2);
    sent.length = 0;
    call({ type: 'webrtc.send', id: 's1', sessionId: c, payload: 'all' }, 'w3');
    expect(sent.slice(1)).toEqual([
      { type: 'webrtc.event', event: { type: 'message', sessionId: a, from: carol.pubkey, payload: 'all' } },
      { type: 'webrtc.event', event: { type: 'message', sessionId: b, from: carol.pubkey, payload: 'all' } },
    ]);
    sent.length = 0;
    call({ type: 'webrtc.close', id: 'c1', sessionId: b }, 'w2');
    expect(sent).toEqual([
      { type: 'webrtc.event', event: { type: 'peer', sessionId: a, pubkey: bob.pubkey, state: 'left' } },
      { type: 'webrtc.event', event: { type: 'peer', sessionId: c, pubkey: bob.pubkey, state: 'left' } },
      { type: 'webrtc.close.result', id: 'c1' },
    ]);
    expect(service.mock.state().sessions.get(a)?.session.state).toBe('open');
    const d = open('w4', { type: 'room', room: 'lab', peers: [alice.pubkey] });
    expect(service.mock.state().sessions.get(d)?.peers).toEqual(new Set([alice.pubkey]));
  });

  it('rejects malformed opens and sends with the NAP error strings', () => {
    const { call, last, open } = setup({ autoAnswer: false, maxPayloadBytes: 10 });
    call({ type: 'webrtc.open', id: 'o1' });
    expect(last()).toEqual({ type: 'webrtc.open.result', id: 'o1', error: 'invalid request' });
    call({ type: 'webrtc.open', id: 'o2', request: { scope: { type: 'mesh', room: 'x' } } });
    expect(last()).toEqual({ type: 'webrtc.open.result', id: 'o2', error: 'unsupported scope' });
    call({ type: 'webrtc.open', id: 'o3', request: { scope: { type: 'room', room: 'x' }, channel: 5 } });
    expect(last().error).toBe('invalid request');
    call({ type: 'webrtc.send', id: 's1', sessionId: 'sess-00000000', payload: 1 });
    expect(last()).toEqual({ type: 'webrtc.send.result', id: 's1', error: 'session not found' });
    const sessionId = open('w1', { type: 'direct', pubkey: bob.pubkey });
    call({ type: 'webrtc.send', id: 's2', sessionId, payload: 1 });
    expect(last()).toEqual({ type: 'webrtc.send.result', id: 's2', error: 'session not open' });
    call({ type: 'webrtc.send', id: 's3', sessionId, payload: 1 }, 'w2');
    expect(last().error).toBe('session not found');
    call({ type: 'webrtc.close', id: 'c1', sessionId }, 'w2');
    expect(last()).toEqual({ type: 'webrtc.close.result', id: 'c1', error: 'session not found' });
  });

  it('bounds payload size and exposes peerMessage / peerLeave controls', () => {
    const { service, call, last, sent, open } = setup({ autoAnswer: false, maxPayloadBytes: 10 });
    const sessionId = open('w1', { type: 'direct', pubkey: bob.pubkey });
    service.peerAnswer(sessionId);
    call({ type: 'webrtc.send', id: 's1', sessionId, payload: 'this payload is far too long' });
    expect(last()).toEqual({ type: 'webrtc.send.result', id: 's1', error: 'payload too large' });
    call({ type: 'webrtc.send', id: 's2', sessionId });
    expect(last()).toEqual({ type: 'webrtc.send.result', id: 's2', error: 'invalid request' });
    expect(service.peerMessage(sessionId, { body: 'hi' })).toBe(true);
    expect(last()).toEqual({ type: 'webrtc.event', event: { type: 'message', sessionId, from: bob.pubkey, payload: { body: 'hi' } } });
    sent.length = 0;
    expect(service.peerLeave(sessionId)).toBe(true);
    expect(sent).toEqual([
      { type: 'webrtc.event', event: { type: 'peer', sessionId, pubkey: bob.pubkey, state: 'left' } },
      { type: 'webrtc.event', event: { type: 'closed', sessionId, reason: 'peer disconnected' } },
    ]);
    expect(service.peerLeave(sessionId)).toBe(false);
    expect(service.peerMessage(sessionId, 1)).toBe(false);
  });

  it('closes sessions on destroy and revoke, and resets pending timers', () => {
    const { service, call, sent, open, queue } = setup({ autoAnswer: false });
    const first = open('w1', { type: 'direct', pubkey: bob.pubkey });
    const second = open('w2', { type: 'direct', pubkey: alice.pubkey });
    sent.length = 0;
    service.onWindowDestroyed?.('w1');
    expect(sent).toEqual([
      { type: 'webrtc.event', event: { type: 'peer', sessionId: second, pubkey: alice.pubkey, state: 'left' } },
      { type: 'webrtc.event', event: { type: 'closed', sessionId: second, reason: 'peer disconnected' } },
    ]);
    expect(service.mock.state().sessions.has(first)).toBe(false);
    expect(service.mock.state().identities.has('w1')).toBe(false);

    const third = open('w3', { type: 'room', room: 'lab' });
    service.peerAnswer(third);
    sent.length = 0;
    service.onCapabilityRevoked?.('w3', null);
    expect(sent).toEqual([{ type: 'webrtc.event', event: { type: 'closed', sessionId: third, reason: 'policy denied' } }]);
    call({ type: 'webrtc.send', id: 's1', sessionId: third, payload: 1 }, 'w3');
    expect(sent.at(-1)).toEqual({ type: 'webrtc.send.result', id: 's1', error: 'session closed' });

    const auto = createMockWebrtcService({ scheduler: { schedule: (_ms, fn) => { queue.push(fn); return () => { queue.splice(queue.indexOf(fn), 1); }; } } });
    auto.handleMessage('w9', { type: 'webrtc.open', id: 'o', request: { scope: { type: 'room', room: 'r' } } } as unknown as NappletMessage, () => {});
    expect(queue).toHaveLength(1);
    auto.mock.reset();
    expect(queue).toHaveLength(0);
    expect(auto.mock.state().sessions.size).toBe(0);
    expect(auto.mock.sent).toEqual([]);
  });
});

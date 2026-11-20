/**
 * NAP-INC endpoint identity (kehto/web#331).
 *
 * Authority: napplet/naps master `377bf939c6c906817084b43dd21d424de646dbc2`,
 * `naps/NAP-INC.md` (last changed by `f4545b1f`, "Bind peers to authenticated
 * endpoints"). `target`, `sender`, and `peer` are runtime-assigned opaque
 * endpoint identifiers, never manifest `d` tags.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';

import { createRuntime, type Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';

type Wire = NappletMessage & Record<string, unknown>;

declare const console: { warn(message: string): void };

const TOPIC = 'probe';
const HASHES = { receiver: 'a'.repeat(64), first: 'b'.repeat(64), second: 'c'.repeat(64), root: 'd'.repeat(64) };

function sentTo(ctx: MockRuntimeContext, windowId: string, type: string): Wire[] {
  return ctx.sent
    .filter((sent) => sent.windowId === windowId && (sent.message as Wire).type === type)
    .map((sent) => sent.message as Wire);
}

function send(runtime: Runtime, windowId: string, message: Record<string, unknown>): void {
  runtime.handleMessage(windowId, message);
}

function register(runtime: Runtime, windowId: string, dTag: string, hash: string): void {
  runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, dTag, hash));
}

/** Learn a peer's endpoint identifier the way a napplet does: from an attested event. */
function learnSender(ctx: MockRuntimeContext, runtime: Runtime, listener: string, emitter: string): string {
  const topic = `learn:${listener}:${emitter}:${ctx.sent.length}`;
  send(runtime, listener, { type: 'inc.subscribe', id: topic, topic });
  send(runtime, emitter, { type: 'inc.emit', topic });
  send(runtime, listener, { type: 'inc.unsubscribe', topic });
  const event = sentTo(ctx, listener, 'inc.event').filter((message) => message.topic === topic).at(-1);
  if (typeof event?.sender !== 'string') throw new Error(`no attested sender for ${emitter}`);
  return event.sender;
}

describe('NAP-INC endpoint identifiers (kehto/web#331)', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;
  let uuidCalls: number;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    uuidCalls = 0;
    // Unordered fixture values: an identifier must not expose registration order.
    ctx.hooks.crypto.randomUUID = () => {
      uuidCalls += 1;
      const hex = ((uuidCalls * 0x9e3779b1) >>> 0).toString(16).padStart(8, '0');
      return `${hex}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(4, 7)}-${hex}${hex.slice(0, 4)}`;
    };
    runtime = createRuntime(ctx.hooks);
    register(runtime, 'receiver', 'receiver', HASHES.receiver);
    register(runtime, 'first', 'same-name', HASHES.first);
    register(runtime, 'second', 'same-name', HASHES.second);
    register(runtime, 'root', '', HASHES.root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    runtime.destroy();
  });

  it('reproduces the issue fixture: distinct senders, root emitters, and addressable shared-name peers', () => {
    send(runtime, 'receiver', { type: 'inc.subscribe', id: 's1', topic: TOPIC });
    ctx.sent.length = 0;
    for (const windowId of ['first', 'second', 'root']) {
      send(runtime, windowId, { type: 'inc.emit', topic: TOPIC, payload: { source: windowId } });
    }

    const events = sentTo(ctx, 'receiver', 'inc.event');
    expect(events.map((event) => (event.payload as { source: string }).source)).toEqual(['first', 'second', 'root']);
    const senders = events.map((event) => event.sender as string);
    expect(new Set(senders).size).toBe(3);

    send(runtime, 'receiver', { type: 'inc.channel.open', id: 'c1', target: senders[1] });
    const result = sentTo(ctx, 'receiver', 'inc.channel.open.result')[0];
    expect(result).toMatchObject({ id: 'c1', peer: senders[1] });
    expect(result).not.toHaveProperty('error');
    expect(sentTo(ctx, 'second', 'inc.channel.opened')).toHaveLength(1);
    expect(sentTo(ctx, 'first', 'inc.channel.opened')).toHaveLength(0);
  });

  it('keeps identifiers opaque: no d tag, artifact hash, window ID, instance ID, or pubkey', () => {
    const ids = ['receiver', 'first', 'second', 'root'].map((windowId) => runtime.getIncEndpointId(windowId)!);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{32}$/);
      for (const leak of ['receiver', 'first', 'second', 'root', 'same-name', 'guid-', ...Object.values(HASHES)]) {
        expect(id).not.toContain(leak);
      }
    }
  });

  it('is stable for one endpoint across emit, channel, list, and the host lookup', () => {
    const first = learnSender(ctx, runtime, 'receiver', 'first');
    expect(learnSender(ctx, runtime, 'receiver', 'first')).toBe(first);
    expect(runtime.getIncEndpointId('first')).toBe(first);
    const receiver = runtime.getIncEndpointId('receiver')!;

    send(runtime, 'receiver', { type: 'inc.channel.open', id: 'open', target: first, peer: 'forged', sender: 'forged' });
    const opened = sentTo(ctx, 'first', 'inc.channel.opened')[0];
    const result = sentTo(ctx, 'receiver', 'inc.channel.open.result')[0];
    expect(opened).toEqual({ type: 'inc.channel.opened', channelId: result.channelId, peer: receiver });
    expect(result).toEqual({ type: 'inc.channel.open.result', id: 'open', channelId: result.channelId, peer: first });

    send(runtime, 'first', { type: 'inc.channel.emit', channelId: result.channelId, sender: 'forged', payload: 1 });
    expect(sentTo(ctx, 'receiver', 'inc.channel.event')[0]).toEqual({
      type: 'inc.channel.event', channelId: result.channelId, sender: first, payload: 1,
    });
    send(runtime, 'receiver', { type: 'inc.channel.broadcast', payload: 2 });
    expect(sentTo(ctx, 'first', 'inc.channel.event')[0]).toEqual({
      type: 'inc.channel.event', channelId: result.channelId, sender: receiver, payload: 2,
    });

    send(runtime, 'receiver', { type: 'inc.channel.list', id: 'l1' });
    send(runtime, 'first', { type: 'inc.channel.list', id: 'l2' });
    expect(sentTo(ctx, 'receiver', 'inc.channel.list.result')[0].channels).toEqual([{ id: result.channelId, peer: first }]);
    expect(sentTo(ctx, 'first', 'inc.channel.list.result')[0].channels).toEqual([{ id: result.channelId, peer: receiver }]);
  });

  it('lets a root manifest without a d tag emit, subscribe, open, and accept channels', () => {
    const root = learnSender(ctx, runtime, 'receiver', 'root');
    const receiver = learnSender(ctx, runtime, 'root', 'receiver');

    send(runtime, 'receiver', { type: 'inc.channel.open', id: 'to-root', target: root });
    expect(sentTo(ctx, 'root', 'inc.channel.opened')[0]).toMatchObject({ peer: receiver });
    expect(sentTo(ctx, 'receiver', 'inc.channel.open.result')[0]).toMatchObject({ id: 'to-root', peer: root });

    send(runtime, 'root', { type: 'inc.channel.open', id: 'from-root', target: receiver });
    const fromRoot = sentTo(ctx, 'root', 'inc.channel.open.result')[0];
    expect(fromRoot).toMatchObject({ id: 'from-root', peer: receiver });
    send(runtime, 'root', { type: 'inc.channel.emit', channelId: fromRoot.channelId, payload: 'hi' });
    expect(sentTo(ctx, 'receiver', 'inc.channel.event').at(-1)).toMatchObject({ sender: root, payload: 'hi' });
  });

  it('never resolves a d tag, window ID, instance ID, or empty target (retired, KEHTO_INC_DTAG_TARGET_RETIRED)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    learnSender(ctx, runtime, 'first', 'receiver');
    for (const [id, target] of [
      ['unique-dtag', 'receiver'], ['shared-dtag', 'same-name'], ['empty', ''], ['window', 'second'],
      ['instance', 'guid-receiver'], ['hash', HASHES.receiver], ['unknown', 'f'.repeat(32)], ['non-text', 7],
    ] as const) {
      send(runtime, 'first', { type: 'inc.channel.open', id, target });
    }
    const results = sentTo(ctx, 'first', 'inc.channel.open.result');
    expect(results).toHaveLength(8);
    for (const result of results) {
      expect(result).toEqual({ type: 'inc.channel.open.result', id: result.id, error: 'target not found' });
    }
    expect(sentTo(ctx, 'receiver', 'inc.channel.opened')).toEqual([]);

    // Only a live d tag used as a target is diagnosed, once per runtime, without the value.
    const diagnostics = warn.mock.calls.map(([message]) => message).filter((text) => text.includes('KEHTO_INC_DTAG_TARGET_RETIRED'));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain('endpoint identifier');
    expect(diagnostics[0]).toContain('once per runtime');
    expect(diagnostics[0]).not.toContain('same-name');
    expect(diagnostics[0]).not.toContain('receiver');
  });

  it('stays quiet for endpoint identifier targets and unknown targets', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const receiver = learnSender(ctx, runtime, 'first', 'receiver');
    send(runtime, 'first', { type: 'inc.channel.open', id: 'ok', target: receiver });
    send(runtime, 'first', { type: 'inc.channel.open', id: 'missing', target: 'not-a-live-name' });
    expect(sentTo(ctx, 'first', 'inc.channel.open.result').map((result) => result.error)).toEqual([undefined, 'target not found']);
    expect(warn.mock.calls.filter(([message]) => message.includes('KEHTO_INC_DTAG_TARGET_RETIRED'))).toEqual([]);
  });

  it('does not reuse an identifier for a replacement registration and closes its channels', () => {
    const before = learnSender(ctx, runtime, 'receiver', 'first');
    send(runtime, 'first', { type: 'inc.subscribe', id: 'stale', topic: TOPIC });
    send(runtime, 'receiver', { type: 'inc.channel.open', id: 'open', target: before });
    const channelId = sentTo(ctx, 'receiver', 'inc.channel.open.result')[0].channelId;
    ctx.sent.length = 0;

    // Same window ID, same manifest and artifact: still a new endpoint.
    register(runtime, 'first', 'same-name', HASHES.first);

    expect(sentTo(ctx, 'receiver', 'inc.channel.closed')).toEqual([
      { type: 'inc.channel.closed', channelId, reason: 'peer destroyed' },
    ]);
    expect(sentTo(ctx, 'first', 'inc.channel.closed')).toEqual([]);
    send(runtime, 'receiver', { type: 'inc.emit', topic: TOPIC });
    expect(sentTo(ctx, 'first', 'inc.event')).toEqual([]);
    send(runtime, 'first', { type: 'inc.channel.emit', channelId, payload: 'stale' });
    expect(sentTo(ctx, 'receiver', 'inc.channel.event')).toEqual([]);

    send(runtime, 'receiver', { type: 'inc.channel.open', id: 'old', target: before });
    expect(sentTo(ctx, 'receiver', 'inc.channel.open.result')[0]).toMatchObject({ id: 'old', error: 'target not found' });

    const after = learnSender(ctx, runtime, 'receiver', 'first');
    expect(after).not.toBe(before);
    expect(runtime.getIncEndpointId('first')).toBe(after);
  });

  it('retires the identifier, subscriptions, and channels when the endpoint is unregistered', () => {
    const first = learnSender(ctx, runtime, 'receiver', 'first');
    send(runtime, 'first', { type: 'inc.subscribe', id: 'stale', topic: TOPIC });
    send(runtime, 'receiver', { type: 'inc.channel.open', id: 'open', target: first });
    const channelId = sentTo(ctx, 'receiver', 'inc.channel.open.result')[0].channelId;
    ctx.sent.length = 0;

    runtime.sessionRegistry.unregister('first');
    runtime.sessionRegistry.unregister('first');

    expect(sentTo(ctx, 'receiver', 'inc.channel.closed')).toEqual([
      { type: 'inc.channel.closed', channelId, reason: 'peer destroyed' },
    ]);
    expect(runtime.getIncEndpointId('first')).toBeUndefined();
    send(runtime, 'receiver', { type: 'inc.emit', topic: TOPIC });
    expect(sentTo(ctx, 'first', 'inc.event')).toEqual([]);
    send(runtime, 'receiver', { type: 'inc.channel.open', id: 'gone', target: first });
    expect(sentTo(ctx, 'receiver', 'inc.channel.open.result')[0]).toMatchObject({ error: 'target not found' });
  });

  it('keeps the identifier across destroyWindow and ACL revocation while the endpoint stays registered', () => {
    const first = learnSender(ctx, runtime, 'receiver', 'first');
    runtime.destroyWindow('first');
    expect(runtime.getIncEndpointId('first')).toBe(first);
    runtime.aclState.revoke('', 'same-name', HASHES.first, 'relay:read');
    runtime.aclState.grant('', 'same-name', HASHES.first, 'relay:read');
    expect(runtime.getIncEndpointId('first')).toBe(first);
  });

  it('fails closed instead of sharing an identifier when the host UUID source repeats', () => {
    const receiver = runtime.getIncEndpointId('receiver')!;
    const callsBefore = uuidCalls;
    ctx.hooks.crypto.randomUUID = () => { uuidCalls += 1; return receiver; };
    send(runtime, 'receiver', { type: 'inc.subscribe', id: 's1', topic: TOPIC });
    ctx.sent.length = 0;

    send(runtime, 'first', { type: 'inc.emit', topic: TOPIC });
    expect(sentTo(ctx, 'receiver', 'inc.event')).toEqual([]);
    expect(runtime.getIncEndpointId('first')).toBeUndefined();
    expect(uuidCalls - callsBefore).toBeLessThanOrEqual(8);
    send(runtime, 'first', { type: 'inc.channel.open', id: 'open', target: receiver });
    expect(sentTo(ctx, 'first', 'inc.channel.open.result')[0]).toEqual({
      type: 'inc.channel.open.result', id: 'open', error: 'endpoint unavailable',
    });
    expect(sentTo(ctx, 'receiver', 'inc.channel.opened')).toEqual([]);
  });

  it('assigns nothing to an unregistered window', () => {
    const callsBefore = uuidCalls;
    expect(runtime.getIncEndpointId('nobody')).toBeUndefined();
    expect(uuidCalls).toBe(callsBefore);
  });
});

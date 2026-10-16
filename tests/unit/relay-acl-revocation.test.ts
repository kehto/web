import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, verifyEvent } from 'nostr-tools';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import { createRuntime, type Runtime } from '@kehto/runtime';
import { createRelayPoolService } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

// Issue #304's disposable scalar-1 vector. No network or external identity.
const event = finalizeEvent({ kind: 1, created_at: 1700000000, tags: [], content: 'Disposable revocation probe' },
  Uint8Array.from([...Array(31).fill(0), 1]));
const hash = 'a'.repeat(64);
const runtimes: Runtime[] = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) {
    for (const entry of runtime.sessionRegistry.getAllEntries()) runtime.destroyWindow(entry.windowId);
    runtime.destroy();
  }
  vi.useRealTimers();
});

function setup(path: 'adapter' | 'service') {
  const context = createMockRuntimeAdapter();
  const listeners: Array<(item: NostrEvent | 'EOSE') => void> = [];
  const cleanups: number[] = [];
  const pool = context.hooks.relayPool!;
  pool.isAvailable = () => true;
  pool.subscribe = (_filters, callback) => {
    const index = listeners.length;
    listeners.push(callback);
    return { unsubscribe: () => { cleanups.push(index); callback(event); callback('EOSE'); } };
  };
  const hooks = path === 'service' ? { ...context.hooks, relayPool: undefined } : context.hooks;
  const runtime = createRuntime(hooks);
  runtimes.push(runtime);
  if (path === 'service') runtime.registerService('relay', createRelayPoolService(pool));
  const principals = [
    ['a', 'alpha', hash], ['a-second', 'alpha', hash],
    ['a:child', 'beta', 'b'.repeat(64)], ['other-version', 'alpha', 'c'.repeat(64)],
  ];
  for (const [windowId, dTag, aggregateHash] of principals) {
    runtime.sessionRegistry.register(windowId!, createNip5dSessionEntry(windowId!, dTag!, aggregateHash!));
    runtime.firewallState.setPolicy(dTag!, 'allow');
    runtime.handleMessage(windowId!, { type: 'relay.subscribe', subId: 'events', filters: [{ kinds: [1] }] } as NappletMessage);
  }
  return { ...context, hooks, pool, runtime, listeners, cleanups };
}

describe.each(['adapter', 'service'] as const)('relay ACL retirement via %s', (path) => {
  it.each(['revoke', 'block'] as const)('retires all matching windows on %s and rejects queued callbacks', (mutation) => {
    vi.useFakeTimers();
    const { runtime, sent, listeners, cleanups } = setup(path);
    expect(verifyEvent(event)).toBe(true);
    if (mutation === 'revoke') runtime.aclState.revoke('', 'alpha', hash, 'relay:read');
    else runtime.aclState.block('', 'alpha', hash);
    expect(cleanups).toEqual([0, 1]);
    expect(sent.filter(({ message }) => (message as NappletMessage).type === 'relay.event')).toEqual([]);
    sent.length = 0;
    for (const listener of listeners) { listener(event); listener('EOSE'); }
    vi.advanceTimersByTime(15_000);
    expect(sent.filter(({ message }) => (message as NappletMessage).type === 'relay.event').map(({ windowId }) => windowId))
      .toEqual(['a:child', 'other-version']);
    expect(sent.every(({ windowId }) => windowId !== 'a' && windowId !== 'a-second')).toBe(true);
    runtime.handleMessage('a', { type: 'relay.subscribe', subId: 'denied', filters: [] } as NappletMessage);
    expect(listeners).toHaveLength(4);

    // Regrant and reuse must not resurrect either retired callback generation.
    runtime.aclState.unblock('', 'alpha', hash);
    runtime.aclState.grant('', 'alpha', hash, 'relay:read');
    runtime.handleMessage('a', { type: 'relay.subscribe', subId: 'events', filters: [] } as NappletMessage);
    sent.length = 0;
    const nextEvent = finalizeEvent({ kind: 1, created_at: 1700000001, tags: [], content: 'After regrant' },
      Uint8Array.from([...Array(31).fill(0), 1]));
    listeners[0]!(nextEvent); listeners[0]!('EOSE'); listeners[1]!(nextEvent);
    expect(sent).toEqual([]);
    listeners[4]!(event);
    expect(sent.map(({ windowId }) => windowId)).toEqual(['a']);
  });

  it('keeps subscriptions when a different capability is revoked', () => {
    const { runtime, sent, listeners, cleanups } = setup(path);
    runtime.aclState.revoke('', 'alpha', hash, 'relay:write');
    listeners[0]!(event);
    expect(cleanups).toEqual([]);
    expect(sent.map(({ windowId }) => windowId)).toEqual(['a']);
  });

  it('cleans up when access is revoked during synchronous backend delivery', () => {
    const { runtime, hooks, pool, sent, cleanups } = setup(path);
    const subscribe = pool.subscribe;
    pool.subscribe = (filters, callback, urls) => {
      const handle = subscribe(filters, callback, urls);
      callback(event);
      return handle;
    };
    // The service captures the options object, so the override also covers it.
    const send = hooks.sendToNapplet;
    hooks.sendToNapplet = (windowId, message) => {
      send(windowId, message);
      if (windowId === 'sync' && (message as NappletMessage).type === 'relay.event') {
        runtime.aclState.revoke('', 'sync', hash, 'relay:read');
      }
    };
    runtime.sessionRegistry.register('sync', createNip5dSessionEntry('sync', 'sync', hash));
    runtime.firewallState.setPolicy('sync', 'allow');
    runtime.handleMessage('sync', { type: 'relay.subscribe', subId: 'events', filters: [] } as NappletMessage);
    expect(cleanups).toEqual([4]);
    expect(sent.filter(({ message }) => (message as NappletMessage).type === 'relay.event')).toHaveLength(1);
  });
});

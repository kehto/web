import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import { finalizeEvent } from 'nostr-tools/pure';
import { createOutboxService, type OutboxRouter } from './outbox-service.js';
import { createRelayPoolOutboxRouter } from './relay-pool-outbox-router.js';
import { defaultRelayAllowed, parseRelayUrl } from './relay-url-policy.js';
import type { ServiceRuntimeContext } from '@kehto/runtime';

describe('OUTBOX caller destination policy (issue #435)', () => {
  it.each(['getEvent', 'query', 'subscribe', 'publish'])('denies standalone %s relay hints before invoking a router', (operation) => {
    const router = {
      getEvent: vi.fn(), query: vi.fn(), subscribe: vi.fn(), publish: vi.fn(), resolveRelays: vi.fn(),
    } satisfies OutboxRouter;
    const send = vi.fn();
    createOutboxService({ router }).handleMessage('window', {
      type: `outbox.${operation}`, id: 'request', subId: 'stream', eventId: 'a'.repeat(64),
      filters: [{ kinds: [1] }], event: { kind: 1, content: '', tags: [], created_at: 1 },
      options: { relays: ['wss://attacker.example'] },
    } as NappletMessage, send);
    expect(Object.values(router).every((method) => method.mock.calls.length === 0)).toBe(true);
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(operation === 'subscribe'
      ? { type: 'outbox.closed', subId: 'stream', reason: expect.stringContaining('RuntimeAdapter.permissions') }
      : { type: `outbox.${operation}.result`, id: 'request', error: expect.stringContaining('RuntimeAdapter.permissions') }));
  });

  it.each([
    'wss://localhost', 'wss://router.local', 'wss://printer', 'ws://127.0.0.1',
    'wss://10.0.0.1', 'wss://172.16.0.1', 'wss://192.168.1.1', 'wss://169.254.169.254',
    'wss://2130706433', 'wss://0x7f000001', 'wss://[::1]', 'wss://[fc00::1]',
    'wss://[::ffff:192.168.1.1]', 'wss://[::192.168.1.1]', 'wss://[fe80::1]', 'wss://[fec0::1]', 'wss://user:secret@relay.example',
    'https://relay.example', 'wss://relay.example:invalid', 'wss://relay.example/#fragment', 'wss://relay.example/#',
  ])('rejects unconfigured private or malformed relay %s', async (relay) => {
    const subscribe = vi.fn();
    const publish = vi.fn();
    const router = createRelayPoolOutboxRouter({ relayPool: { subscribe, publish, isAvailable: () => true },
      loadRelayLists: () => new Map(), fallbackRelays: [] });
    expect((await router.planRead!([{ kinds: [1] }], { relays: [relay] })).relays).toEqual([]);
    expect(subscribe).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('allows an explicitly host-configured private development relay but not a sibling target', () => {
    expect(defaultRelayAllowed('ws://127.0.0.1:4848', ['ws://127.0.0.1:4848/'])).toBe(true);
    expect(defaultRelayAllowed('ws://127.0.0.1:4849', ['ws://127.0.0.1:4848/'])).toBe(false);
    expect(defaultRelayAllowed('wss://relay.example/group', [])).toBe(true);
    expect(defaultRelayAllowed('wss://[2606:4700:4700::1111]', [])).toBe(true);
  });

  it('does not let a custom policy permit malformed credential-bearing relay URLs', async () => {
    const router = createRelayPoolOutboxRouter({
      relayPool: { subscribe: vi.fn(), publish: vi.fn(), isAvailable: () => true },
      loadRelayLists: () => new Map(), fallbackRelays: [], isRelayAllowed: () => true,
    });
    expect((await router.planRead!([], { relays: ['wss://user:secret@relay.example'] })).relays).toEqual([]);
    expect(parseRelayUrl('wss://relay.example\\@attacker.example')).toBeUndefined();
  });

  it('does not publish a hinted destination after revocation while signing waits', async () => {
    const controller = new AbortController();
    const signed = finalizeEvent({ kind: 1, content: '', tags: [], created_at: 1 }, Uint8Array.from([...Array(31).fill(0), 7]));
    let finishSigning!: (value: NostrEvent) => void;
    const signEvent = vi.fn(() => new Promise<NostrEvent>((resolve) => { finishSigning = resolve; }));
    const publish = vi.fn();
    const router = createRelayPoolOutboxRouter({
      relayPool: { subscribe: vi.fn(), publish, isAvailable: () => true },
      loadRelayLists: () => new Map(), fallbackRelays: [], getSignerPubkey: () => signed.pubkey, signEvent,
    });
    const service = createOutboxService({ router });
    const authorizeOperation: NonNullable<ServiceRuntimeContext['authorizeOperation']> = async (_window, _operation, _requirements, execute) => ({
      status: 'executed', value: await execute(controller.signal),
    });
    service.onRegistered?.({ authorizeOperation } as ServiceRuntimeContext);
    const send = vi.fn();
    service.handleMessage('window', { type: 'outbox.publish', id: 'publish',
      event: { kind: 1, content: '', tags: [], created_at: 1 }, options: { toOutbox: false, relays: ['wss://hint.example'] },
    } as NappletMessage, send);
    await vi.waitFor(() => expect(signEvent).toHaveBeenCalledTimes(1));
    controller.abort();
    finishSigning(signed);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(publish).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'outbox.publish.result', id: 'publish', ok: false }));
  });
});

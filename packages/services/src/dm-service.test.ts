import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
  createCordnDmAdapter,
  createDmService,
  createNdrDmAdapter,
  createNip17DmAdapter,
  type DmRelayPool,
  type DmSubscription,
  type NdrRuntimeLike,
} from './index.js';

interface SubRecord {
  filters: NostrFilter[];
  relayUrls?: string[];
  callback(item: NostrEvent | 'EOSE'): void;
  closed: boolean;
}

function matches(event: NostrEvent, filter: NostrFilter): boolean {
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  for (const [key, value] of Object.entries(filter)) {
    if (!key.startsWith('#') || !Array.isArray(value)) continue;
    const tagName = key.slice(1);
    const eventValues = event.tags.filter((tag) => tag[0] === tagName).map((tag) => tag[1]);
    if (!value.some((candidate) => eventValues.includes(candidate))) return false;
  }
  return true;
}

function createRelay(): DmRelayPool & { published: NostrEvent[]; subs: SubRecord[] } {
  const published: NostrEvent[] = [];
  const subs: SubRecord[] = [];
  return {
    published,
    subs,
    subscribe(filters, callback, relayUrls) {
      const sub: SubRecord = { filters, callback, relayUrls, closed: false };
      subs.push(sub);
      queueMicrotask(() => callback('EOSE'));
      return {
        unsubscribe() {
          sub.closed = true;
        },
      };
    },
    publish(event) {
      published.push(event);
      for (const sub of subs) {
        if (!sub.closed && sub.filters.some((filter) => matches(event, filter))) {
          queueMicrotask(() => sub.callback(event));
        }
      }
    },
    selectRelayTier() {
      return ['ws://127.0.0.1:10547'];
    },
    isAvailable() {
      return true;
    },
  };
}

async function waitFor<T>(predicate: () => T | undefined, attempts = 20): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    const value = predicate();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('timed out');
}

describe('createDmService', () => {
  it('routes dm.status and dm.send through the adapter', async () => {
    const adapter = {
      status: vi.fn(() => ({ available: true, implementations: ['test'], capabilities: ['send'] })),
      conversations: vi.fn(() => ({ conversations: [] })),
      messages: vi.fn(() => ({ messages: [] })),
      send: vi.fn(async () => ({
        ok: true,
        message: {
          id: 'm1',
          conversationId: 'direct:a,b',
          senderPubkey: 'a',
          createdAt: 1,
          content: 'hi',
          status: 'sent' as const,
        },
      })),
      subscribe: vi.fn(() => ({ subscriptionId: 's1' })),
      unsubscribe: vi.fn(() => ({ ok: true })),
    };
    const service = createDmService({ adapter });
    const sent: NappletMessage[] = [];

    service.handleMessage('win', { type: 'dm.status', id: 'status-1' } as NappletMessage, (msg) => sent.push(msg));
    service.handleMessage(
      'win',
      { type: 'dm.send', id: 'send-1', recipients: ['b'], content: 'hi' } as NappletMessage,
      (msg) => sent.push(msg),
    );

    await waitFor(() => (sent.length === 2 ? sent : undefined));
    expect(sent).toContainEqual({
      type: 'dm.status.result',
      id: 'status-1',
      available: true,
      implementations: ['test'],
      capabilities: ['send'],
    });
    expect(sent).toContainEqual({
      type: 'dm.send.result',
      id: 'send-1',
      ok: true,
      message: {
        id: 'm1',
        conversationId: 'direct:a,b',
        senderPubkey: 'a',
        createdAt: 1,
        content: 'hi',
        status: 'sent',
      },
    });
  });
});

describe('createNip17DmAdapter', () => {
  it('round-trips NIP-17 over an in-memory relay with ephemeral keys', async () => {
    const relay = createRelay();
    const aliceSk = generateSecretKey();
    const bobSk = generateSecretKey();
    const alice = createNip17DmAdapter({ ownerSecretKey: aliceSk, relayPool: relay, relays: ['ws://127.0.0.1:10547'] });
    const bob = createNip17DmAdapter({ ownerSecretKey: bobSk, relayPool: relay, relays: ['ws://127.0.0.1:10547'] });
    const bobPubkey = getPublicKey(bobSk);
    const received: string[] = [];

    const sub = await bob.subscribe({}, (message) => received.push(message.content));
    await alice.send({ recipients: [bobPubkey], content: 'hello nip17', clientMessageId: 'client-a' });

    await waitFor(() => (received[0] ? received[0] : undefined));
    expect(received).toEqual(['hello nip17']);
    expect(relay.published).toHaveLength(2);
    expect(relay.published.every((event) => event.kind === 1059)).toBe(true);
    expect(relay.subs[0].relayUrls).toEqual(['ws://127.0.0.1:10547']);
    expect(bob.unsubscribe(sub.subscriptionId)).toEqual({ ok: true });
  });
});

describe('createNdrDmAdapter', () => {
  it('maps structural NdrRuntime send and pushed session events', async () => {
    let callback: Parameters<NdrRuntimeLike['onSessionEvent']>[0] | undefined;
    const peer = 'b'.repeat(64);
    const runtime: NdrRuntimeLike = {
      sendMessage: vi.fn(async () => ({ id: 'ndr-rumor-1', created_at: 7, content: 'encrypted elsewhere' })),
      onSessionEvent(cb) {
        callback = cb;
        return () => undefined;
      },
    };
    const adapter = createNdrDmAdapter({ runtime, ownerPubkey: 'a'.repeat(64) });
    const received: string[] = [];
    const sub = adapter.subscribe({}, (message) => received.push(message.content)) as DmSubscription;

    const sent = await adapter.send({ recipients: [peer], content: 'hello ndr' });
    callback?.({ id: 'ndr-rumor-2', created_at: 8, content: 'back' }, peer);

    expect(sent.message.status).toBe('sent');
    expect(received).toEqual(['back']);
    expect(adapter.unsubscribe(sub.subscriptionId)).toEqual({ ok: true });
  });
});

describe('createCordnDmAdapter', () => {
  it('delegates to a Cordn client while normalizing status', async () => {
    const client = {
      conversations: vi.fn(() => ({ conversations: [] })),
      messages: vi.fn(() => ({ messages: [] })),
      send: vi.fn(async () => ({
        ok: true,
        message: {
          id: 'cordn-1',
          conversationId: 'group:g',
          senderPubkey: 'a',
          createdAt: 1,
          content: 'hello cordn',
          status: 'sent' as const,
        },
      })),
      subscribe: vi.fn(() => ({ subscriptionId: 'cordn-sub' })),
      unsubscribe: vi.fn(() => ({ ok: true })),
    };
    const adapter = createCordnDmAdapter({ client, ownerPubkey: 'a'.repeat(64) });

    await expect(adapter.status()).resolves.toMatchObject({
      available: true,
      ownerPubkey: 'a'.repeat(64),
      implementations: ['cordn'],
    });
    await expect(adapter.send({ recipients: ['b'.repeat(64)], content: 'hello cordn' })).resolves.toMatchObject({ ok: true });
    expect(client.send).toHaveBeenCalledWith({ recipients: ['b'.repeat(64)], content: 'hello cordn' });
  });
});

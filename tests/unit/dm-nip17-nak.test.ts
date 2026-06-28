import { afterEach, describe, expect, it } from 'vitest';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
  createCordnDmAdapter,
  createCordnRelayCoordinatorClient,
  createDmService,
  createNdrDmAdapter,
  createNdrRelayTransport,
  createNip17DmAdapter,
  type DmRelayPool,
  type NdrRuntimeLike,
} from '@kehto/services';

interface WebSocketCtor {
  new (url: string): WebSocketLike;
}

interface WebSocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

const WS_OPEN = 1;

let relay: ChildProcessWithoutNullStreams | undefined;

afterEach(() => {
  relay?.kill();
  relay = undefined;
});

function hasNak(): boolean {
  const bin = process.env.NAK_BIN ?? 'nak';
  const result = spawnSync(bin, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) resolve(address.port);
        else reject(new Error('no port'));
      });
    });
  });
}

async function waitForRelay(url: string): Promise<void> {
  const WebSocketImpl = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  if (!WebSocketImpl) throw new Error('global WebSocket unavailable');
  const deadline = Date.now() + 5_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocketImpl(url);
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('relay connect timeout'));
        }, 300);
        ws.onopen = () => {
          clearTimeout(timer);
          ws.close();
          resolve();
        };
        ws.onerror = (error) => {
          clearTimeout(timer);
          reject(error);
        };
      });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('relay did not start');
}

async function startNakRelay(): Promise<string> {
  const port = await freePort();
  const bin = process.env.NAK_BIN ?? 'nak';
  relay = spawn(bin, ['serve', '--hostname', '127.0.0.1', '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  relay.once('exit', (code) => {
    if (code !== null && code !== 0) relay = undefined;
  });
  const url = `ws://127.0.0.1:${port}`;
  await waitForRelay(url);
  return url;
}

function createWebSocketRelayPool(url: string): DmRelayPool {
  const WebSocketImpl = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  if (!WebSocketImpl) throw new Error('global WebSocket unavailable');

  return {
    subscribe(filters: NostrFilter[], callback: (item: NostrEvent | 'EOSE') => void) {
      const ws = new WebSocketImpl(url);
      const subId = `dm-${Math.random().toString(36).slice(2)}`;
      ws.onopen = () => ws.send(JSON.stringify(['REQ', subId, ...filters]));
      ws.onmessage = (event) => {
        const payload = JSON.parse(String(event.data)) as unknown[];
        if (payload[0] === 'EVENT' && payload[1] === subId) callback(payload[2] as NostrEvent);
        if (payload[0] === 'EOSE' && payload[1] === subId) callback('EOSE');
      };
      return {
        unsubscribe() {
          if (ws.readyState === WS_OPEN) ws.send(JSON.stringify(['CLOSE', subId]));
          ws.close();
        },
      };
    },
    publish(event: NostrEvent): Promise<void> {
      return new Promise((resolve, reject) => {
        const ws = new WebSocketImpl(url);
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('publish timeout'));
        }, 2_000);
        ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]));
        ws.onerror = (error) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error('publish failed'));
        };
        ws.onmessage = (message) => {
          const payload = JSON.parse(String(message.data)) as unknown[];
          if (payload[0] !== 'OK') return;
          clearTimeout(timer);
          ws.close();
          if (payload[2] === true) resolve();
          else reject(new Error(typeof payload[3] === 'string' ? payload[3] : 'publish rejected'));
        };
      });
    },
    selectRelayTier() {
      return [url];
    },
    isAvailable() {
      return true;
    },
  };
}

function createRelayBackedNdrRuntime(ownerSecretKey: Uint8Array, relayUrl: string): NdrRuntimeLike {
  const ownerPubkey = getPublicKey(ownerSecretKey);
  const relayPool = createWebSocketRelayPool(relayUrl);
  const transport = createNdrRelayTransport({
    relayPool,
    publishSecretKey: ownerSecretKey,
    relays: [relayUrl],
    fetchTimeoutMs: 300,
  });
  const listeners = new Set<Parameters<NdrRuntimeLike['onSessionEvent']>[0]>();
  let unsubscribe: (() => void) | undefined;

  const feed = (event: NostrEvent) => {
    if (event.pubkey === ownerPubkey) return;
    const target = event.tags.find((tag) => tag[0] === 'p')?.[1];
    if (target !== ownerPubkey) return;
    for (const listener of listeners) {
      listener({ id: event.id, pubkey: event.pubkey, created_at: event.created_at, content: event.content }, event.pubkey);
    }
  };

  function ensureSubscribed() {
    if (unsubscribe) return;
    unsubscribe = transport.nostrSubscribe({ kinds: [1060], '#p': [ownerPubkey] } as NostrFilter, feed);
  }

  return {
    sendMessage: async (recipientPubkey, content) => {
      const event = await transport.nostrPublish({
        kind: 1060,
        tags: [['p', recipientPubkey]],
        content,
      });
      return { id: event.id, pubkey: event.pubkey, created_at: event.created_at, content };
    },
    onSessionEvent(callback) {
      listeners.add(callback);
      ensureSubscribed();
      return () => listeners.delete(callback);
    },
    close() {
      unsubscribe?.();
      listeners.clear();
    },
  };
}

function sentBy(service: ReturnType<typeof createDmService>) {
  const sent: NappletMessage[] = [];
  service.handleMessage('window', { type: 'dm.subscribe', id: 'sub' } as NappletMessage, (msg) => sent.push(msg));
  return sent;
}

describe('createNip17DmAdapter with nak relay', () => {
  it('delivers NAP-DM dm.send to dm.message over a local nak relay', async () => {
    if (!hasNak() || !(globalThis as { WebSocket?: WebSocketCtor }).WebSocket) return;

    const relayUrl = await startNakRelay();
    const aliceSk = generateSecretKey();
    const bobSk = generateSecretKey();
    const alice = createDmService({
      adapter: createNip17DmAdapter({ ownerSecretKey: aliceSk, relayPool: createWebSocketRelayPool(relayUrl), relays: [relayUrl] }),
    });
    const bob = createDmService({
      adapter: createNip17DmAdapter({ ownerSecretKey: bobSk, relayPool: createWebSocketRelayPool(relayUrl), relays: [relayUrl] }),
    });
    const bobSent = sentBy(bob);

    await expect.poll(() => bobSent.find((msg) => msg.type === 'dm.subscribe.result')).toBeTruthy();
    alice.handleMessage(
      'window',
      {
        type: 'dm.send',
        id: 'send',
        recipients: [getPublicKey(bobSk)],
        content: 'hello through nak',
      } as NappletMessage,
      () => undefined,
    );

    await expect.poll(() => bobSent.find((msg) => msg.type === 'dm.message'), { timeout: 5_000 }).toMatchObject({
      type: 'dm.message',
      message: {
        senderPubkey: getPublicKey(aliceSk),
        content: 'hello through nak',
        status: 'received',
      },
    });

    alice.dispose();
    bob.dispose();
  });
});

describe('createNdrDmAdapter with nak relay', () => {
  it('delivers NAP-DM dm.send through the NDR relay transport contract', async () => {
    if (!hasNak() || !(globalThis as { WebSocket?: WebSocketCtor }).WebSocket) return;

    const relayUrl = await startNakRelay();
    const aliceSk = generateSecretKey();
    const bobSk = generateSecretKey();
    const alice = createDmService({
      adapter: createNdrDmAdapter({
        ownerPubkey: getPublicKey(aliceSk),
        runtime: createRelayBackedNdrRuntime(aliceSk, relayUrl),
      }),
    });
    const bob = createDmService({
      adapter: createNdrDmAdapter({
        ownerPubkey: getPublicKey(bobSk),
        runtime: createRelayBackedNdrRuntime(bobSk, relayUrl),
      }),
    });
    const bobSent = sentBy(bob);

    await expect.poll(() => bobSent.find((msg) => msg.type === 'dm.subscribe.result')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 100));
    alice.handleMessage(
      'window',
      {
        type: 'dm.send',
        id: 'send',
        recipients: [getPublicKey(bobSk)],
        content: 'hello through ndr transport',
      } as NappletMessage,
      () => undefined,
    );

    await expect.poll(() => bobSent.find((msg) => msg.type === 'dm.message'), { timeout: 5_000 }).toMatchObject({
      type: 'dm.message',
      message: {
        senderPubkey: getPublicKey(aliceSk),
        content: 'hello through ndr transport',
        status: 'received',
      },
    });

    alice.dispose();
    bob.dispose();
  });
});

describe('createCordnDmAdapter with nak relay', () => {
  it('delivers NAP-DM dm.send through the Cordn coordinator relay bridge', async () => {
    if (!hasNak() || !(globalThis as { WebSocket?: WebSocketCtor }).WebSocket) return;

    const relayUrl = await startNakRelay();
    const aliceSk = generateSecretKey();
    const bobSk = generateSecretKey();
    const group = 'local-cordn-room';
    const alice = createDmService({
      adapter: createCordnDmAdapter({
        ownerPubkey: getPublicKey(aliceSk),
        defaultGroupId: group,
        coordinator: createCordnRelayCoordinatorClient({
          relayPool: createWebSocketRelayPool(relayUrl),
          ownerSecretKey: aliceSk,
          relays: [relayUrl],
          fetchTimeoutMs: 300,
        }),
      }),
    });
    const bob = createDmService({
      adapter: createCordnDmAdapter({
        ownerPubkey: getPublicKey(bobSk),
        defaultGroupId: group,
        coordinator: createCordnRelayCoordinatorClient({
          relayPool: createWebSocketRelayPool(relayUrl),
          ownerSecretKey: bobSk,
          relays: [relayUrl],
          fetchTimeoutMs: 300,
        }),
      }),
    });
    const bobSent = sentBy(bob);

    await expect.poll(() => bobSent.find((msg) => msg.type === 'dm.subscribe.result')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 100));
    alice.handleMessage(
      'window',
      {
        type: 'dm.send',
        id: 'send',
        conversationId: `group:${group}`,
        recipients: [getPublicKey(bobSk)],
        content: 'hello through cordn coordinator',
      } as NappletMessage,
      () => undefined,
    );

    await expect.poll(() => bobSent.find((msg) => msg.type === 'dm.message'), { timeout: 5_000 }).toMatchObject({
      type: 'dm.message',
      message: {
        conversationId: `group:${group}`,
        senderPubkey: getPublicKey(aliceSk),
        content: 'hello through cordn coordinator',
        status: 'received',
      },
    });

    alice.dispose();
    bob.dispose();
  });
});

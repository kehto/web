import { describe, expect, it, vi } from 'vitest';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import { createNip46Client, parseBunkerUri } from './browser-nip46-client.js';

/** Captured before any test stubs the global, so stubs can delegate real entropy. */
const nativeCrypto = globalThis.crypto;

/**
 * A spec-following bunker: `connect` answers "ack" (not the user pubkey), and
 * the real identity only arrives from `get_public_key`.
 */
function installFakeBunker(
  userPubkey: string,
  bunkerSecret: Uint8Array,
  clientSecret: Uint8Array,
  connectResult: string,
) {
  const bunkerPubkey = getPublicKey(bunkerSecret);
  const conversationKey = nip44.getConversationKey(clientSecret, bunkerPubkey);

  const methods: string[] = [];
  const requestIds: string[] = [];

  class FakeBunkerSocket {
    static readonly OPEN = 1;
    static readonly CLOSED = 3;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    private clientPubkey = '';
    private subId = '';

    constructor(readonly url: string) {
      queueMicrotask(() => {
        this.readyState = FakeBunkerSocket.OPEN;
        this.onopen?.();
      });
    }

    send(data: string): void {
      const message = JSON.parse(data) as unknown[];
      if (message[0] === 'REQ') {
        this.subId = String(message[1]);
        this.clientPubkey = (message[2] as { '#p': string[] })['#p'][0]!;
        return;
      }
      if (message[0] !== 'EVENT') return;
      const request = JSON.parse(nip44.decrypt(
        (message[1] as { content: string }).content,
        conversationKey,
      )) as { id: string; method: string };
      methods.push(request.method);
      requestIds.push(request.id);
      const result = request.method === 'connect' ? connectResult : userPubkey;
      const response = finalizeEvent({
        kind: 24_133,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', this.clientPubkey]],
        content: nip44.encrypt(
          JSON.stringify({ id: request.id, result }),
          nip44.getConversationKey(bunkerSecret, this.clientPubkey),
        ),
      }, bunkerSecret);
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(['EVENT', this.subId, response]) }));
    }

    close(): void {
      this.readyState = FakeBunkerSocket.CLOSED;
      this.onclose?.();
    }
  }

  return { FakeBunkerSocket, bunkerPubkey, methods, requestIds };
}

/** Non-localhost HTTP: getRandomValues exists, randomUUID and subtle do not. */
function stubInsecureContextCrypto() {
  const provider = {
    getRandomValues: vi.fn(function (this: unknown, bytes: Uint8Array) {
      if (this !== provider) throw new TypeError('Illegal invocation');
      return nativeCrypto.getRandomValues(bytes);
    }),
  };
  vi.stubGlobal('crypto', provider);
  return provider;
}
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('parseBunkerUri', () => {
  it('parses bunker URIs with relay and secret parameters', () => {
    const pubkey = 'a'.repeat(64);
    expect(parseBunkerUri(`bunker://${pubkey}?relay=wss%3A%2F%2Frelay.example&secret=token`)).toEqual({
      pubkey,
      relay: 'wss://relay.example',
      secret: 'token',
    });
  });

  it('parses nostrconnect URIs without a secret', () => {
    const pubkey = 'b'.repeat(64);
    expect(parseBunkerUri(`nostrconnect://${pubkey}?relay=wss%3A%2F%2Frelay.example`)).toEqual({
      pubkey,
      relay: 'wss://relay.example',
      secret: undefined,
    });
  });

  it('rejects missing relays and non-hex pubkeys', () => {
    expect(parseBunkerUri(`bunker://${'c'.repeat(64)}`)).toBeNull();
    expect(parseBunkerUri(`bunker://${'z'.repeat(64)}?relay=wss%3A%2F%2Frelay.example`)).toBeNull();
  });
});

describe('createNip46Client', () => {
  it('resolves the user pubkey when connect returns "ack" from a spec-compliant bunker', async () => {
    const bunkerSecret = generateSecretKey();
    const userPubkey = getPublicKey(generateSecretKey());
    const clientSecret = generateSecretKey();
    const { FakeBunkerSocket, bunkerPubkey } = installFakeBunker(userPubkey, bunkerSecret, clientSecret, 'ack');
    vi.stubGlobal('WebSocket', FakeBunkerSocket);
    try {
      const client = createNip46Client({ relayUrl: 'wss://relay.example', bunkerPubkey, localSecretKey: clientSecret });
      await expect(client.connect()).resolves.toBe(userPubkey);
      await expect(client.getSigner().getPublicKey!()).resolves.toBe(userPubkey);
      client.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('correlates every request with a distinct secure id when crypto.randomUUID is missing (kehto/web#351)', async () => {
    const bunkerSecret = generateSecretKey();
    const userPubkey = getPublicKey(generateSecretKey());
    const clientSecret = generateSecretKey();
    const { FakeBunkerSocket, bunkerPubkey, methods, requestIds } = installFakeBunker(userPubkey, bunkerSecret, clientSecret, 'ack');
    vi.stubGlobal('WebSocket', FakeBunkerSocket);
    stubInsecureContextCrypto();
    try {
      const client = createNip46Client({ relayUrl: 'wss://relay.example', bunkerPubkey, localSecretKey: clientSecret });
      await expect(client.connect()).resolves.toBe(userPubkey);
      await client.getSigner().nip44!.encrypt(userPubkey, 'hello');
      expect(methods).toEqual(['connect', 'get_public_key', 'nip44_encrypt']);
      expect(requestIds).toHaveLength(3);
      expect(new Set(requestIds).size).toBe(3);
      for (const id of requestIds) expect(id).toMatch(UUID_V4);
      client.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('refuses to send a request without secure randomness', async () => {
    const bunkerSecret = generateSecretKey();
    const clientSecret = generateSecretKey();
    const { FakeBunkerSocket, bunkerPubkey, methods } = installFakeBunker('a'.repeat(64), bunkerSecret, clientSecret, 'ack');
    vi.stubGlobal('WebSocket', FakeBunkerSocket);
    vi.stubGlobal('crypto', {});
    try {
      const client = createNip46Client({ relayUrl: 'wss://relay.example', bunkerPubkey, localSecretKey: clientSecret });
      await expect(client.connect()).rejects.toThrow('@kehto/shell requires crypto.randomUUID or crypto.getRandomValues');
      expect(methods).toEqual([]);
      client.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(['inline user key', 'hex secret', 'transport key'])('fetches canonical identity after connect returns %s', async (reply) => {
    const bunkerSecret = generateSecretKey();
    const userPubkey = getPublicKey(generateSecretKey());
    const clientSecret = generateSecretKey();
    const connectResult = reply === 'inline user key' ? userPubkey
      : reply === 'transport key' ? getPublicKey(bunkerSecret)
      : 'ab'.repeat(32);
    const { FakeBunkerSocket, bunkerPubkey, methods } = installFakeBunker(userPubkey, bunkerSecret, clientSecret, connectResult);
    vi.stubGlobal('WebSocket', FakeBunkerSocket);
    try {
      const client = createNip46Client({ relayUrl: 'wss://relay.example', bunkerPubkey, localSecretKey: clientSecret });
      await expect(client.connect()).resolves.toBe(userPubkey);
      await expect(client.getSigner().getPublicKey!()).resolves.toBe(userPubkey);
      expect(methods).toEqual(['connect', 'get_public_key']);
      client.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(['ack', 'ab'.repeat(32)])('rejects invalid get_public_key even after connect returns %s', async (connectResult) => {
    const bunkerSecret = generateSecretKey();
    const clientSecret = generateSecretKey();
    const { FakeBunkerSocket, bunkerPubkey } = installFakeBunker('not-a-pubkey', bunkerSecret, clientSecret, connectResult);
    vi.stubGlobal('WebSocket', FakeBunkerSocket);
    try {
      const client = createNip46Client({ relayUrl: 'wss://relay.example', bunkerPubkey, localSecretKey: clientSecret });
      await expect(client.connect()).rejects.toThrow('invalid public key');
      client.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

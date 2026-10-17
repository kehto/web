import { describe, expect, it, vi } from 'vitest';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import { createNip46Client, parseBunkerUri } from './browser-nip46-client.js';

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

  return { FakeBunkerSocket, bunkerPubkey };
}

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

  it('accepts a signer that returns its user pubkey directly from connect', async () => {
    const bunkerSecret = generateSecretKey();
    const userPubkey = getPublicKey(generateSecretKey());
    const clientSecret = generateSecretKey();
    const { FakeBunkerSocket, bunkerPubkey } = installFakeBunker(userPubkey, bunkerSecret, clientSecret, userPubkey);
    vi.stubGlobal('WebSocket', FakeBunkerSocket);
    try {
      const client = createNip46Client({ relayUrl: 'wss://relay.example', bunkerPubkey, localSecretKey: clientSecret });
      await expect(client.connect()).resolves.toBe(userPubkey);
      client.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects an invalid get_public_key response instead of exposing it as identity', async () => {
    const bunkerSecret = generateSecretKey();
    const clientSecret = generateSecretKey();
    const { FakeBunkerSocket, bunkerPubkey } = installFakeBunker('not-a-pubkey', bunkerSecret, clientSecret, 'ack');
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

import { describe, expect, it } from 'vitest';

import { parseBunkerUri } from './browser-nip46-client.js';

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

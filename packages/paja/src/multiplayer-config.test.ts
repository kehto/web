import { describe, expect, it } from 'vitest';
import { normalizePajaMultiplayer } from './multiplayer-config.js';

describe('explicit multiplayer configuration', () => {
  const base = { profile: 'soy-rtc/1', relays: ['wss://relay.example'], registry: [
    { family: 'rooms', server: { pubkey: 'a'.repeat(64), relays: ['wss://provider.example'] }, tools: [{ name: 'join', schemaHash: 'b'.repeat(64) }] },
  ] };
  it('detaches valid settings and leaves the default unconfigured', () => {
    expect(normalizePajaMultiplayer(undefined)).toBeUndefined();
    const actual = normalizePajaMultiplayer(base)!;
    expect(actual).toEqual(base);
    expect(actual.registry![0]!.server).not.toBe(base.registry[0]!.server);
  });
  it('treats the deprecated registry as optional and drops an empty one', () => {
    const signaling = { profile: 'soy-rtc/1', relays: ['wss://relay.example'] };
    expect(normalizePajaMultiplayer(signaling)).toEqual(signaling);
    expect(normalizePajaMultiplayer({ ...signaling, registry: [] })).toEqual(signaling);
    expect(() => normalizePajaMultiplayer({ ...signaling, registry: 'rooms' })).toThrow('multiplayer.registry');
  });
  it('requires explicit profiles, providers, and schema pins', () => {
    expect(() => normalizePajaMultiplayer({ ...base, profile: 'https://provider.example' })).toThrow('profile');
    expect(() => normalizePajaMultiplayer({ ...base, registry: [{ ...base.registry[0], tools: [{ name: 'join' }] }] })).toThrow('hash');
    for (const relay of ['https://relay.example', 'wss://user:password@relay.example', 'wss://relay.example/#secret']) {
      expect(() => normalizePajaMultiplayer({ ...base, relays: [relay] })).toThrow();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { naddrEncode } from 'nostr-tools/nip19';

import {
  PAJA_INTENT_LINK_MAX_BYTES,
  createPajaIntentLink,
  parsePajaIntentLink,
} from './intent-link.js';

const BASE = 'https://paja.example/workshop/?old=value#ignored';
const PUBKEY = 'ab'.repeat(32);

function namedHint(kind = 35129): string {
  return naddrEncode({
    identifier: 'viewer',
    pubkey: PUBKEY,
    kind,
    relays: ['wss://relay.example'],
  });
}

describe('Paja intent links', () => {
  it('round-trips independent outer and inner encodings with text query values', () => {
    const uri = 'napplet:profile/open?name=A%2BB&label=%E2%9C%93';
    const href = createPajaIntentLink({ uri, pointer: 'nevent1example' }, BASE);

    expect(href).toContain('intent=napplet%3Aprofile%2Fopen%3Fname%3DA%252BB%26label%3D%25E2%259C%2593');
    expect(parsePajaIntentLink(href)).toEqual({
      uri,
      pointer: 'nevent1example',
      request: {
        archetype: 'profile',
        action: 'open',
        convention: 'napplet:profile/open',
        payload: { name: 'A+B', label: '✓' },
      },
    });
  });

  it('keeps JSON payload mode distinct and preserves primitive and null values', () => {
    for (const payload of [null, false, ['one', 2], { nested: { value: '✓', constructor: 'opaque', prototype: '__proto__' } }]) {
      const href = createPajaIntentLink({ uri: 'napplet:note/open', payload }, BASE);
      const parsed = parsePajaIntentLink(href);
      expect(parsed?.payload).toEqual(payload);
      expect(parsed?.request.payload).toEqual(payload);
    }
    expect(() => createPajaIntentLink({
      uri: 'napplet:note/open?id=one',
      payload: { id: 'two' },
    }, BASE)).toThrow(/query cannot accompany options\.payload/);
  });

  it('leaves pointer-only links to the existing runtime-pointer flow', () => {
    expect(parsePajaIntentLink('https://paja.example/workshop/?naddr=naddr1target')).toBeNull();
    expect(parsePajaIntentLink('https://paja.example/workshop/?pointer=custom')).toBeNull();
    expect(parsePajaIntentLink('https://paja.example/workshop/?pointer=custom&naddr=naddr1target&legacy=value#retained')).toBeNull();
    expect(parsePajaIntentLink('https://paja.example/workshop/?unrelated=%E0%A4%A#retained')).toBeNull();
  });

  it('rejects malformed outer encoding, duplicate decoded names, and invalid targeting combinations', () => {
    expect(() => parsePajaIntentLink('https://paja.example/?intent=%E0%A4%A')).toThrow(/malformed percent-encoding/);
    expect(() => parsePajaIntentLink('https://paja.example/?intent=napplet%3Aprofile%2Fopen&%69ntent=napplet%3Aprofile%2Fopen'))
      .toThrow(/unique after decoding/);
    expect(parsePajaIntentLink('https://paja.example/?%69ntent=napplet%3Aprofile%2Fopen')).toMatchObject({
      uri: 'napplet:profile/open',
    });
    expect(() => parsePajaIntentLink('https://paja.example/?intent=napplet%3Aprofile%2Fopen&pointer=one&naddr=two'))
      .toThrow(/multiple pointer aliases/);
    expect(() => parsePajaIntentLink(`https://paja.example/?intent=${encodeURIComponent(`napplet:profile/open#${namedHint()}`)}&pointer=nevent1target`))
      .toThrow(/target pointer with a URI recommendation/);
    expect(() => parsePajaIntentLink(`https://paja.example/?intent=${encodeURIComponent(`napplet:profile/open#${namedHint(30023)}`)}`))
      .toThrow(/named 35129/);
  });

  it('requires a fully encoded inner URI and enforces its size limit', () => {
    expect(() => parsePajaIntentLink('https://paja.example/?intent=napplet:profile/open')).toThrow(/completely percent-encoded/);
    const opaquePayload = parsePajaIntentLink(`https://paja.example/?intent=${encodeURIComponent('napplet:profile/open')}&payload=${encodeURIComponent('{"__proto__":{"constructor":"opaque"}}')}`)?.payload as Record<string, unknown>;
    expect(Object.hasOwn(opaquePayload, '__proto__')).toBe(true);
    expect(opaquePayload.__proto__).toEqual({ constructor: 'opaque' });
    expect(() => createPajaIntentLink({
      uri: 'napplet:note/open',
      payload: 'x'.repeat(PAJA_INTENT_LINK_MAX_BYTES),
    }, BASE)).toThrow(/must not exceed/);
  });
});

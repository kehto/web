import { describe, expect, it } from 'vitest';
import { nprofileEncode, npubEncode } from 'nostr-tools/nip19';

import {
  formatPajaNpub,
  parsePajaIdentityInput,
  PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY,
  readPajaViewOnlyPubkey,
  shortenPajaIdentity,
  writePajaViewOnlyPubkey,
  type PajaPreferenceStorage,
} from './browser-identity-input.js';

const HEX = '7'.repeat(64);
const NPUB = npubEncode(HEX);

function memoryStorage(initial: Record<string, string> = {}): PajaPreferenceStorage & {
  readonly values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function throwingStorage(): PajaPreferenceStorage {
  return {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
}

describe('Paja view-only identity input', () => {
  it('accepts a bare hex pubkey and normalizes case and whitespace', () => {
    expect(parsePajaIdentityInput(`  ${HEX.toUpperCase()}\n`)).toEqual({
      ok: true,
      pubkey: HEX,
      relays: [],
    });
  });

  it('accepts an npub and resolves the hex pubkey', () => {
    expect(parsePajaIdentityInput(NPUB)).toEqual({ ok: true, pubkey: HEX, relays: [] });
  });

  it('accepts an nprofile and keeps only its ws and wss relay hints', () => {
    const nprofile = nprofileEncode({
      pubkey: HEX,
      relays: [
        'wss://relay.one/',
        'https://not-a-relay.example',
        'wss://relay.one/',
        'ws://localhost:7777/',
      ],
    });

    expect(parsePajaIdentityInput(nprofile)).toEqual({
      ok: true,
      pubkey: HEX,
      relays: ['wss://relay.one/', 'ws://localhost:7777/'],
    });
  });

  it('rejects an empty field', () => {
    expect(parsePajaIdentityInput('   ')).toEqual({
      ok: false,
      error: 'paste a view-only npub1…, nprofile1…, or 64-character hex pubkey',
    });
  });

  it('rejects a secret key without repeating it back', () => {
    const nsec = 'nsec1qy352euf40x77qfrg4ncn27daau6jy8e3q4n3h4ns9m3p4v5vqs5t0w0z';
    const result = parsePajaIdentityInput(nsec);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.error).toBe('that is a secret key, not a view-only identity — paste the npub instead');
    expect(result.error).not.toContain(nsec);
    expect(result.error).not.toContain('nsec1');
  });

  it('rejects an encrypted secret key before decoding it', () => {
    const result = parsePajaIdentityInput('ncryptsec1qy352euf40x77qfrg4ncn27daau6jy8');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.error).toContain('secret key');
  });

  it.each([
    'not-an-identity',
    'note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', // bad checksum
    '6'.repeat(63),
  ])('rejects %s', (value) => {
    const result = parsePajaIdentityInput(value);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.error).toBe('not an npub, nprofile, or 64-character hex pubkey');
    expect(result.error).not.toContain(value);
  });

  it('formats and shortens an identity pubkey for display', () => {
    expect(formatPajaNpub(HEX)).toBe(NPUB);
    expect(formatPajaNpub('not-hex')).toBe('not-hex');
    expect(shortenPajaIdentity(NPUB)).toBe(`${NPUB.slice(0, 13)}…${NPUB.slice(-6)}`);
    expect(shortenPajaIdentity('short')).toBe('short');
  });

  it('round-trips a persisted view-only pubkey and clears it', () => {
    const storage = memoryStorage();
    writePajaViewOnlyPubkey(storage, HEX.toUpperCase());
    expect(storage.values.get(PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY)).toBe(HEX);
    expect(readPajaViewOnlyPubkey(storage)).toBe(HEX);

    writePajaViewOnlyPubkey(storage, null);
    expect(storage.values.has(PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY)).toBe(false);
    expect(readPajaViewOnlyPubkey(storage)).toBeNull();
  });

  it('ignores malformed stored values', () => {
    expect(readPajaViewOnlyPubkey(memoryStorage({ [PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY]: 'nsec1nope' }))).toBeNull();
    expect(readPajaViewOnlyPubkey(memoryStorage({ [PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY]: '' }))).toBeNull();
  });

  it('survives unavailable or throwing storage', () => {
    const storage = throwingStorage();

    expect(readPajaViewOnlyPubkey(storage)).toBeNull();
    expect(() => writePajaViewOnlyPubkey(storage, HEX)).not.toThrow();
    expect(readPajaViewOnlyPubkey(null)).toBeNull();
    expect(() => writePajaViewOnlyPubkey(undefined, null)).not.toThrow();
  });
});

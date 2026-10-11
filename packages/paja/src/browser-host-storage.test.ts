import { afterEach, describe, expect, it, vi } from 'vitest';
import { naddrEncode } from 'nostr-tools/nip19';
import { readPajaIntentCatalogPointers, writePajaIntentCatalogPointers } from './browser-host-storage.js';

afterEach(() => vi.unstubAllGlobals());

describe('installed app pointer persistence', () => {
  it('retains discovery pointers independently of tab snapshots without treating them as verified authority', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
    const pointer = naddrEncode({ kind: 35129, pubkey: 'a'.repeat(64), identifier: 'reader', relays: [] });
    writePajaIntentCatalogPointers([pointer, pointer]);
    expect(readPajaIntentCatalogPointers()).toEqual([pointer]);
    values.set('kehto.paja.intent-catalog.v1', JSON.stringify([pointer, false, null, '', { id: 'forged' }]));
    expect(readPajaIntentCatalogPointers()).toEqual([pointer]);
    values.set('kehto.paja.intent-catalog.v1', '{');
    expect(readPajaIntentCatalogPointers()).toEqual([]);
  });

  it('keeps navigation functional when persistent storage is unavailable', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); } });
    expect(readPajaIntentCatalogPointers()).toEqual([]);
    expect(() => writePajaIntentCatalogPointers(['untrusted discovery pointer'])).not.toThrow();
  });
});

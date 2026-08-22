import { describe, expect, it } from 'vitest';

import {
  createPajaSignerConsentStore,
  PAJA_SIGNER_CONSENT_STORAGE_KEY,
  type PajaSignerRequestContext,
} from './browser-signer-consent.js';

class FakeStorage implements Storage {
  readonly records = new Map<string, string>();

  get length(): number { return this.records.size; }
  clear(): void { this.records.clear(); }
  getItem(key: string): string | null { return this.records.get(key) ?? null; }
  key(index: number): string | null { return [...this.records.keys()][index] ?? null; }
  removeItem(key: string): void { this.records.delete(key); }
  setItem(key: string, value: string): void { this.records.set(key, value); }
}

function context(overrides: Partial<{
  signerPubkey: string;
  windowId: string;
  dTag: string;
  aggregateHash: string;
  runtimeScope: string;
}> = {}): PajaSignerRequestContext {
  return {
    signerPubkey: overrides.signerPubkey ?? 'a'.repeat(64),
    windowId: overrides.windowId ?? 'window-a',
    runtimeScope: overrides.runtimeScope ?? 'target-url:http://127.0.0.1:5173/',
    napplet: {
      dTag: overrides.dTag ?? 'profile-viewer',
      aggregateHash: overrides.aggregateHash ?? 'aggregate-a',
    },
  };
}

describe('Paja signer consent', () => {
  it('remembers one kind only for the exact signer and napplet artifact', () => {
    const store = createPajaSignerConsentStore(new FakeStorage());
    const subject = context();

    expect(store.rememberKind(subject, 1)).toBe(true);
    expect(store.match(subject, 1)).toBe('kind');
    expect(store.match(context({ windowId: 'window-b' }), 1)).toBe('kind');
    expect(store.match(subject, 0)).toBeNull();
    expect(store.match(context({ signerPubkey: 'b'.repeat(64) }), 1)).toBeNull();
    expect(store.match(context({ dTag: 'composer' }), 1)).toBeNull();
    expect(store.match(context({ aggregateHash: 'aggregate-b' }), 1)).toBeNull();
    expect(store.match(context({ runtimeScope: 'target-url:http://127.0.0.1:4173/' }), 1)).toBeNull();
    expect(store.count()).toBe(1);
  });

  it('trusts every kind only for the exact signer and napplet artifact', () => {
    const store = createPajaSignerConsentStore(new FakeStorage());
    const subject = context();
    store.rememberKind(subject, 1);

    expect(store.trustNapplet(subject)).toBe(true);
    expect(store.match(subject, 0)).toBe('napplet');
    expect(store.match(subject, 65_535)).toBe('napplet');
    expect(store.match(context({ aggregateHash: 'updated-artifact' }), 0)).toBeNull();
    expect(store.count()).toBe(1);
  });

  it('persists versioned grants and clears them explicitly', () => {
    const storage = new FakeStorage();
    const subject = context();
    createPajaSignerConsentStore(storage).rememberKind(subject, 30_023);

    const restored = createPajaSignerConsentStore(storage);
    expect(restored.match(subject, 30_023)).toBe('kind');
    expect(storage.getItem(PAJA_SIGNER_CONSENT_STORAGE_KEY)).toContain('"version":1');

    expect(restored.clear()).toBe(true);
    expect(restored.count()).toBe(0);
    expect(storage.getItem(PAJA_SIGNER_CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('does not claim revocation when durable storage refuses both removal paths', () => {
    const storage = new FakeStorage();
    const store = createPajaSignerConsentStore(storage);
    store.rememberKind(context(), 1);
    storage.removeItem = () => { throw new Error('remove denied'); };
    storage.setItem = () => { throw new Error('write denied'); };

    expect(store.clear()).toBe(false);
    expect(store.count()).toBe(1);
  });

  it('ignores malformed, invalid-kind, and invalid-signer records', () => {
    const storage = new FakeStorage();
    storage.setItem(PAJA_SIGNER_CONSENT_STORAGE_KEY, JSON.stringify({
      version: 1,
      grants: [
        {
          signerPubkey: 'not-a-pubkey',
          dTag: 'profile-viewer',
          aggregateHash: 'aggregate-a',
          trusted: true,
          kinds: [],
        },
      ],
    }));
    const store = createPajaSignerConsentStore(storage);

    expect(store.count()).toBe(0);
    expect(store.rememberKind(context(), -1)).toBe(false);
    expect(store.rememberKind(context(), 65_536)).toBe(false);
    expect(store.rememberKind(context({ signerPubkey: 'bad' }), 1)).toBe(false);
  });
});

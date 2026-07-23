/**
 * types.test.ts — Unit tests for NIP-5D type contract changes in @kehto/runtime.
 *
 * Tests:
 *  - SessionEntry with provenance 'nip-5d' is valid
 *  - SessionEntry with provenance 'legacy-auth' is valid
 *  - getEntryByWindowId returns entry without pubkey lookup
 *  - register with empty-string pubkey and provenance 'nip-5d' succeeds
 *  - isRegistered returns true for NIP-5D sessions (pubkey='')
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { SessionEntry } from './types.js';
import { createSessionRegistry } from './session-registry.js';
import type { SessionRegistry } from './session-registry.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    pubkey: 'a'.repeat(64),
    windowId: 'win-1',
    origin: 'https://example.com',
    type: 'napplet',
    dTag: 'test-napp',
    aggregateHash: 'b'.repeat(64),
    registeredAt: Date.now(),
    instanceId: 'guid-1',
    provenance: 'legacy-auth',
    ...overrides,
  };
}

// ─── SessionEntry provenance field ────────────────────────────────────────────

describe('SessionEntry.provenance', () => {
  it('accepts provenance "legacy-auth" (legacy AUTH handshake)', () => {
    const entry: SessionEntry = makeEntry({ provenance: 'legacy-auth' });
    expect(entry.provenance).toBe('legacy-auth');
  });

  it('accepts provenance "nip-5d" (NIP-5D originRegistry)', () => {
    const entry: SessionEntry = makeEntry({ provenance: 'nip-5d' });
    expect(entry.provenance).toBe('nip-5d');
  });

  it('allows pubkey="" with provenance "nip-5d" (NIP-5D session)', () => {
    const entry: SessionEntry = makeEntry({ pubkey: '', provenance: 'nip-5d' });
    expect(entry.pubkey).toBe('');
    expect(entry.provenance).toBe('nip-5d');
  });
});

// ─── SessionRegistry.getEntryByWindowId ───────────────────────────────────────

describe('SessionRegistry.getEntryByWindowId', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = createSessionRegistry();
  });

  it('returns undefined for unregistered windowId', () => {
    expect(registry.getEntryByWindowId('win-unknown')).toBeUndefined();
  });

  it('returns entry registered with a real pubkey', () => {
    const entry = makeEntry({ windowId: 'win-1', pubkey: 'a'.repeat(64), provenance: 'legacy-auth' });
    registry.register('win-1', entry);
    const result = registry.getEntryByWindowId('win-1');
    expect(result).toEqual(entry);
  });

  it('returns entry for NIP-5D session with empty pubkey', () => {
    const entry = makeEntry({ windowId: 'win-5d', pubkey: '', provenance: 'nip-5d' });
    registry.register('win-5d', entry);
    const result = registry.getEntryByWindowId('win-5d');
    expect(result).toEqual(entry);
  });

  it('returns undefined after unregister', () => {
    const entry = makeEntry({ windowId: 'win-1', provenance: 'legacy-auth' });
    registry.register('win-1', entry);
    registry.unregister('win-1');
    expect(registry.getEntryByWindowId('win-1')).toBeUndefined();
  });

  it('clears after clear()', () => {
    const entry = makeEntry({ windowId: 'win-1', provenance: 'legacy-auth' });
    registry.register('win-1', entry);
    registry.clear();
    expect(registry.getEntryByWindowId('win-1')).toBeUndefined();
  });
});

// ─── SessionRegistry.getWindowIdByDTag ───────────────────────────────────────

describe('SessionRegistry.getWindowIdByDTag', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = createSessionRegistry();
  });

  it('resolves exactly one live dTag owner to its internal window ID', () => {
    registry.register('win-unique', makeEntry({ windowId: 'win-unique', dTag: 'unique-napp' }));

    expect(registry.getWindowIdByDTag('unique-napp')).toBe('win-unique');
  });

  it('fails closed for missing, window-ID, and legacy pubkey inputs', () => {
    const pubkey = 'c'.repeat(64);
    registry.register('win-unique', makeEntry({ windowId: 'win-unique', dTag: 'unique-napp', pubkey }));

    expect(registry.getWindowIdByDTag('missing-napp')).toBeUndefined();
    expect(registry.getWindowIdByDTag('win-unique')).toBeUndefined();
    expect(registry.getWindowIdByDTag(pubkey)).toBeUndefined();
  });

  it('fails closed when multiple live sessions share a dTag', () => {
    registry.register('win-one', makeEntry({ windowId: 'win-one', dTag: 'shared-napp', pubkey: '1'.repeat(64) }));
    registry.register('win-two', makeEntry({ windowId: 'win-two', dTag: 'shared-napp', pubkey: '2'.repeat(64) }));

    expect(registry.getWindowIdByDTag('shared-napp')).toBeUndefined();
  });

  it('stops resolving a dTag as soon as its owner is unregistered or the registry clears', () => {
    registry.register('win-unique', makeEntry({ windowId: 'win-unique', dTag: 'unique-napp' }));
    registry.unregister('win-unique');
    expect(registry.getWindowIdByDTag('unique-napp')).toBeUndefined();

    registry.register('win-unique', makeEntry({ windowId: 'win-unique', dTag: 'unique-napp' }));
    registry.clear();
    expect(registry.getWindowIdByDTag('unique-napp')).toBeUndefined();
  });
});

// ─── NIP-5D sessions are registered (isRegistered with pubkey='') ─────────────

describe('isRegistered for NIP-5D sessions', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = createSessionRegistry();
  });

  it('returns true after registering NIP-5D session with pubkey=""', () => {
    const entry = makeEntry({ windowId: 'win-5d', pubkey: '', provenance: 'nip-5d' });
    registry.register('win-5d', entry);
    expect(registry.isRegistered('win-5d')).toBe(true);
  });
});

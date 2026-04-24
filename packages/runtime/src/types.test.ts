/**
 * types.test.ts — Unit tests for NIP-5D type contract changes in @kehto/runtime.
 *
 * Tests:
 *  - SessionEntry with identitySource 'source' is valid
 *  - SessionEntry with identitySource 'auth' is valid
 *  - getEntryByWindowId returns entry without pubkey lookup
 *  - register with empty-string pubkey and identitySource 'source' succeeds
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
    identitySource: 'auth',
    class: null, // CLASS-02: permissive default for test fixtures
    ...overrides,
  };
}

// ─── SessionEntry identitySource field ────────────────────────────────────────

describe('SessionEntry.identitySource', () => {
  it('accepts identitySource "auth" (legacy AUTH handshake)', () => {
    const entry: SessionEntry = makeEntry({ identitySource: 'auth' });
    expect(entry.identitySource).toBe('auth');
  });

  it('accepts identitySource "source" (NIP-5D originRegistry)', () => {
    const entry: SessionEntry = makeEntry({ identitySource: 'source' });
    expect(entry.identitySource).toBe('source');
  });

  it('allows pubkey="" with identitySource "source" (NIP-5D session)', () => {
    const entry: SessionEntry = makeEntry({ pubkey: '', identitySource: 'source' });
    expect(entry.pubkey).toBe('');
    expect(entry.identitySource).toBe('source');
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
    const entry = makeEntry({ windowId: 'win-1', pubkey: 'a'.repeat(64), identitySource: 'auth' });
    registry.register('win-1', entry);
    const result = registry.getEntryByWindowId('win-1');
    expect(result).toEqual(entry);
  });

  it('returns entry for NIP-5D session with empty pubkey', () => {
    const entry = makeEntry({ windowId: 'win-5d', pubkey: '', identitySource: 'source' });
    registry.register('win-5d', entry);
    const result = registry.getEntryByWindowId('win-5d');
    expect(result).toEqual(entry);
  });

  it('returns undefined after unregister', () => {
    const entry = makeEntry({ windowId: 'win-1', identitySource: 'auth' });
    registry.register('win-1', entry);
    registry.unregister('win-1');
    expect(registry.getEntryByWindowId('win-1')).toBeUndefined();
  });

  it('clears after clear()', () => {
    const entry = makeEntry({ windowId: 'win-1', identitySource: 'auth' });
    registry.register('win-1', entry);
    registry.clear();
    expect(registry.getEntryByWindowId('win-1')).toBeUndefined();
  });
});

// ─── NIP-5D sessions are registered (isRegistered with pubkey='') ─────────────

describe('isRegistered for NIP-5D sessions', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = createSessionRegistry();
  });

  it('returns true after registering NIP-5D session with pubkey=""', () => {
    const entry = makeEntry({ windowId: 'win-5d', pubkey: '', identitySource: 'source' });
    registry.register('win-5d', entry);
    expect(registry.isRegistered('win-5d')).toBe(true);
  });
});

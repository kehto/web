import { describe, it, expect } from 'vitest';
import { toKey, check } from './check.js';
import { CAP_RELAY_READ, CAP_SIGN_EVENT, CAP_ALL } from './types.js';
import type { AclState, Identity } from './types.js';

describe('toKey', () => {
  it('returns dTag:hash (2-segment) for identity without pubkey', () => {
    const id: Identity = { dTag: 'chat', hash: 'ff00' };
    expect(toKey(id)).toBe('chat:ff00');
  });

  it('returns dTag:hash (2-segment) when pubkey is provided — pubkey is ignored', () => {
    const id: Identity = { pubkey: 'ignored', dTag: 'chat', hash: 'ff00' };
    expect(toKey(id)).toBe('chat:ff00');
  });

  it('handles empty dTag and hash — edge case', () => {
    const id: Identity = { dTag: '', hash: '' };
    expect(toKey(id)).toBe(':');
  });

  it('handles long hex hash values', () => {
    const id: Identity = { dTag: 'notes', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' };
    expect(toKey(id)).toBe('notes:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('different dTag and hash produce different keys', () => {
    const id1: Identity = { dTag: 'chat', hash: 'ff00' };
    const id2: Identity = { dTag: 'notes', hash: 'ff00' };
    expect(toKey(id1)).not.toBe(toKey(id2));
  });

  it('never produces a 3-segment key', () => {
    const id: Identity = { pubkey: 'abc', dTag: 'chat', hash: 'ff00' };
    expect(toKey(id).split(':').length).toBe(2);
  });
});

describe('check', () => {
  const permissiveState: AclState = {
    defaultPolicy: 'permissive',
    entries: {},
  };

  const restrictiveState: AclState = {
    defaultPolicy: 'restrictive',
    entries: {},
  };

  const id: Identity = { dTag: 'chat', hash: 'ff00' };

  it('returns true for unknown identity in permissive state', () => {
    expect(check(permissiveState, id, CAP_RELAY_READ)).toBe(true);
  });

  it('returns false for unknown identity in restrictive state', () => {
    expect(check(restrictiveState, id, CAP_RELAY_READ)).toBe(false);
  });

  it('returns true for granted capability in restrictive state', () => {
    const state: AclState = {
      defaultPolicy: 'restrictive',
      entries: {
        'chat:ff00': { caps: CAP_RELAY_READ, blocked: false, quota: 512 * 1024 },
      },
    };
    expect(check(state, id, CAP_RELAY_READ)).toBe(true);
  });

  it('returns false for non-granted capability', () => {
    const state: AclState = {
      defaultPolicy: 'restrictive',
      entries: {
        'chat:ff00': { caps: CAP_RELAY_READ, blocked: false, quota: 512 * 1024 },
      },
    };
    expect(check(state, id, CAP_SIGN_EVENT)).toBe(false);
  });

  it('returns false for blocked identity even with granted caps', () => {
    const state: AclState = {
      defaultPolicy: 'permissive',
      entries: {
        'chat:ff00': { caps: CAP_ALL, blocked: true, quota: 512 * 1024 },
      },
    };
    expect(check(state, id, CAP_RELAY_READ)).toBe(false);
  });

  it('looks up entry by 2-segment dTag:hash key', () => {
    const state: AclState = {
      defaultPolicy: 'restrictive',
      entries: {
        'chat:ff00': { caps: CAP_RELAY_READ, blocked: false, quota: 512 * 1024 },
        // Old format key should NOT match
        'pubkey123:chat:ff00': { caps: CAP_ALL, blocked: false, quota: 512 * 1024 },
      },
    };
    // Should find 'chat:ff00' entry (CAP_RELAY_READ), not the old-format one (CAP_ALL)
    expect(check(state, id, CAP_RELAY_READ)).toBe(true);
    expect(check(state, id, CAP_SIGN_EVENT)).toBe(false);
  });
});

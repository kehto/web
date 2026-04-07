import { describe, it, expect } from 'vitest';
import { createState, grant, revoke, block, unblock, setQuota, getQuota, serialize, deserialize } from './mutations.js';
import { toKey, check } from './check.js';
import { CAP_RELAY_READ, CAP_RELAY_WRITE, CAP_SIGN_EVENT, CAP_ALL, DEFAULT_QUOTA } from './types.js';
import type { Identity } from './types.js';

const id: Identity = { dTag: 'chat', hash: 'ff00' };
const id2: Identity = { dTag: 'notes', hash: 'ab12' };

describe('createState', () => {
  it('creates permissive state with empty entries', () => {
    const state = createState('permissive');
    expect(state.defaultPolicy).toBe('permissive');
    expect(state.entries).toEqual({});
  });

  it('creates restrictive state with empty entries', () => {
    const state = createState('restrictive');
    expect(state.defaultPolicy).toBe('restrictive');
    expect(state.entries).toEqual({});
  });

  it('defaults to permissive when no policy given', () => {
    const state = createState();
    expect(state.defaultPolicy).toBe('permissive');
  });
});

describe('grant', () => {
  it('stores entry under dTag:hash key (2-segment, not 3-segment)', () => {
    const state = createState('restrictive');
    const state2 = grant(state, id, CAP_RELAY_READ);
    const key = toKey(id);
    expect(key).toBe('chat:ff00');
    expect(state2.entries['chat:ff00']).toBeDefined();
    // Ensure no 3-segment keys exist
    const keys = Object.keys(state2.entries);
    expect(keys.every(k => k.split(':').length === 2)).toBe(true);
  });

  it('grants capability — check returns true', () => {
    const state = createState('restrictive');
    const state2 = grant(state, id, CAP_RELAY_READ);
    expect(check(state2, id, CAP_RELAY_READ)).toBe(true);
  });

  it('does not grant other capabilities', () => {
    const state = createState('restrictive');
    const state2 = grant(state, id, CAP_RELAY_READ);
    expect(check(state2, id, CAP_SIGN_EVENT)).toBe(false);
  });

  it('grants multiple capabilities via bitfield OR', () => {
    const state = createState('restrictive');
    const state2 = grant(state, id, CAP_RELAY_READ);
    const state3 = grant(state2, id, CAP_RELAY_WRITE);
    expect(check(state3, id, CAP_RELAY_READ)).toBe(true);
    expect(check(state3, id, CAP_RELAY_WRITE)).toBe(true);
  });

  it('does not modify original state', () => {
    const state = createState('restrictive');
    grant(state, id, CAP_RELAY_READ);
    expect(state.entries).toEqual({});
  });
});

describe('revoke', () => {
  it('removes capability from dTag:hash key', () => {
    const state = createState('permissive');
    const state2 = grant(state, id, CAP_ALL);
    const state3 = revoke(state2, id, CAP_RELAY_WRITE);
    expect(check(state3, id, CAP_RELAY_WRITE)).toBe(false);
    expect(check(state3, id, CAP_RELAY_READ)).toBe(true);
  });

  it('entry key remains 2-segment after revoke', () => {
    const state = createState('permissive');
    const state2 = grant(state, id, CAP_ALL);
    const state3 = revoke(state2, id, CAP_RELAY_WRITE);
    const keys = Object.keys(state3.entries);
    expect(keys.every(k => k.split(':').length === 2)).toBe(true);
  });
});

describe('block / unblock', () => {
  it('block sets blocked flag — check returns false regardless of caps', () => {
    const state = createState('permissive');
    const state2 = grant(state, id, CAP_ALL);
    const state3 = block(state2, id);
    expect(check(state3, id, CAP_RELAY_READ)).toBe(false);
    expect(check(state3, id, CAP_SIGN_EVENT)).toBe(false);
  });

  it('unblock clears blocked flag — caps are restored', () => {
    const state = createState('restrictive');
    const state2 = grant(state, id, CAP_RELAY_READ);
    const state3 = block(state2, id);
    const state4 = unblock(state3, id);
    expect(check(state4, id, CAP_RELAY_READ)).toBe(true);
  });

  it('block and unblock operate on correct dTag:hash key', () => {
    const state = createState('permissive');
    const state2 = block(state, id);
    // id2 should still be accessible
    expect(check(state2, id2, CAP_RELAY_READ)).toBe(true);
    // id should be blocked
    expect(check(state2, id, CAP_RELAY_READ)).toBe(false);
  });
});

describe('setQuota / getQuota', () => {
  it('setQuota stores quota under dTag:hash key', () => {
    const state = createState('permissive');
    const state2 = setQuota(state, id, 1024 * 1024);
    expect(getQuota(state2, id)).toBe(1024 * 1024);
  });

  it('getQuota returns DEFAULT_QUOTA for unknown identity', () => {
    const state = createState('restrictive');
    expect(getQuota(state, id)).toBe(DEFAULT_QUOTA);
  });

  it('setQuota entry key is 2-segment', () => {
    const state = createState('permissive');
    const state2 = setQuota(state, id, 1024);
    const keys = Object.keys(state2.entries);
    expect(keys.every(k => k.split(':').length === 2)).toBe(true);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips state with new dTag:hash key format', () => {
    const state = createState('restrictive');
    const state2 = grant(state, id, CAP_RELAY_READ);
    const json = serialize(state2);
    const restored = deserialize(json);
    expect(restored.defaultPolicy).toBe('restrictive');
    expect(restored.entries['chat:ff00']).toBeDefined();
    expect(check(restored, id, CAP_RELAY_READ)).toBe(true);
  });

  it('no 3-segment keys in serialized output after grant', () => {
    const state = createState('restrictive');
    const state2 = grant(state, id, CAP_RELAY_READ);
    const json = serialize(state2);
    const parsed = JSON.parse(json);
    const keys = Object.keys(parsed.entries);
    expect(keys.every((k: string) => k.split(':').length === 2)).toBe(true);
  });

  it('deserialize returns permissive state for invalid JSON', () => {
    const state = deserialize('not-json');
    expect(state.defaultPolicy).toBe('permissive');
    expect(state.entries).toEqual({});
  });

  it('deserialize returns permissive state for empty string', () => {
    const state = deserialize('');
    expect(state.defaultPolicy).toBe('permissive');
    expect(state.entries).toEqual({});
  });

  it('serialize preserves multiple entries under correct keys', () => {
    const state = createState('restrictive');
    const state2 = grant(state, id, CAP_RELAY_READ);
    const state3 = grant(state2, id2, CAP_SIGN_EVENT);
    const json = serialize(state3);
    const restored = deserialize(json);
    expect(check(restored, id, CAP_RELAY_READ)).toBe(true);
    expect(check(restored, id2, CAP_SIGN_EVENT)).toBe(true);
  });
});

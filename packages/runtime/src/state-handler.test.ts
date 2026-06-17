/**
 * state-handler.test.ts — Unit tests for handleStorageNub (Plan 12-09).
 *
 * Asserts canonical @napplet/nap/storage envelope shapes for the 4 canonical
 * actions (get, set, remove, keys) and explicit rejection of storage.clear
 * (not in the canonical union — kehto extension removed per DRIFT-ACL-08).
 *
 * Direct-dispatch tests call handleStorageNub() to bypass runtime ACL — the
 * ACL-denial test goes through createRuntime().handleMessage() to exercise
 * the full enforce gate path.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleStorageNub } from './state-handler.js';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createSessionRegistry } from './session-registry.js';
import { createAclState } from './acl-state.js';
import type { AclStateContainer } from './acl-state.js';
import type { SendToNapplet, StatePersistence, AclPersistence } from './types.js';
import type { NappletMessage } from '@napplet/core';
import {
  createMockRuntimeAdapter,
  createNip5dSessionEntry,
  findEnvelopeResponse,
} from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-storage-1';
const TEST_DTAG = 'storage-napp';
const TEST_HASH = 'd'.repeat(64);
const PREFIX = `napplet-state:${TEST_DTAG}:${TEST_HASH}:`;

// ─── Direct-dispatch harness ────────────────────────────────────────────────

/** Memoized capture of every NappletMessage handleStorageNub dispatches. */
interface DirectHarness {
  sent: NappletMessage[];
  sendToNapplet: SendToNapplet;
  statePersistence: StatePersistence;
  aclState: AclStateContainer;
  sessionRegistry: ReturnType<typeof createSessionRegistry>;
  stateStore: Map<string, string>;
}

function makeAclPersistence(): AclPersistence {
  let data: string | null = null;
  return {
    persist(d: string) { data = d; },
    load() { return data; },
  };
}

function createDirectHarness(options?: { quota?: number }): DirectHarness {
  const sent: NappletMessage[] = [];
  const stateStore = new Map<string, string>();

  const statePersistence: StatePersistence = {
    get(key: string) { return stateStore.get(key) ?? null; },
    set(key: string, value: string) { stateStore.set(key, value); return true; },
    remove(key: string) { stateStore.delete(key); },
    clear(prefix: string) {
      for (const k of stateStore.keys()) {
        if (k.startsWith(prefix)) stateStore.delete(k);
      }
    },
    keys(prefix: string) {
      return [...stateStore.keys()].filter(k => k.startsWith(prefix));
    },
    calculateBytes(prefix: string) {
      let bytes = 0;
      for (const [k, v] of stateStore.entries()) {
        if (k.startsWith(prefix)) bytes += k.length + v.length;
      }
      return bytes;
    },
  };

  const sessionRegistry = createSessionRegistry();
  sessionRegistry.register(
    WINDOW_ID,
    createNip5dSessionEntry(WINDOW_ID, TEST_DTAG, TEST_HASH),
  );

  // Real AclStateContainer wrapping the quota-aware check path. We override
  // getStateQuota to return the test quota so quota-exceeded flows can fire.
  const aclBase = createAclState(makeAclPersistence(), 'permissive');
  const quota = options?.quota ?? 1024 * 1024;
  const aclState: AclStateContainer = {
    ...aclBase,
    getStateQuota: () => quota,
  } as AclStateContainer;

  const sendToNapplet: SendToNapplet = (_windowId, msg) => {
    // handleStorageNub only sends NappletMessage envelopes (not arrays), but
    // guard defensively against the overload.
    if (!Array.isArray(msg)) sent.push(msg);
  };

  return { sent, sendToNapplet, statePersistence, aclState, sessionRegistry, stateStore };
}

function dispatch(h: DirectHarness, msg: NappletMessage): void {
  handleStorageNub(
    WINDOW_ID,
    msg,
    h.sendToNapplet,
    h.sessionRegistry,
    h.aclState,
    h.statePersistence,
  );
}

function lastOfType(h: DirectHarness, type: string): NappletMessage | undefined {
  for (let i = h.sent.length - 1; i >= 0; i--) {
    if (h.sent[i]?.type === type) return h.sent[i];
  }
  return undefined;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('handleStorageNub — canonical @napplet/nap/storage envelope shapes', () => {
  let h: DirectHarness;

  beforeEach(() => {
    h = createDirectHarness();
  });

  // Test 1 — storage.get (key exists) → canonical { value: <stored> }, no `found` field.
  it('storage.get returns { value: <stored> } when key exists (no found field)', () => {
    // Seed the persistence with a value using the canonical scoped key.
    h.stateStore.set(`${PREFIX}foo`, 'bar');

    dispatch(h, { type: 'storage.get', id: 'g1', key: 'foo' } as NappletMessage);

    const reply = lastOfType(h, 'storage.get.result');
    expect(reply).toBeDefined();
    expect((reply as any).id).toBe('g1');
    expect((reply as any).value).toBe('bar');
    // Canonical nub-storage drops `found` — null ⇔ missing.
    expect((reply as any).found).toBeUndefined();
  });

  // Test 2 — storage.get (missing key) → canonical { value: null }.
  it('storage.get returns { value: null } when key missing', () => {
    dispatch(h, { type: 'storage.get', id: 'g2', key: 'missing' } as NappletMessage);

    const reply = lastOfType(h, 'storage.get.result');
    expect(reply).toBeDefined();
    expect((reply as any).id).toBe('g2');
    expect((reply as any).value).toBeNull();
    expect((reply as any).found).toBeUndefined();
  });

  // Test 3a — storage.set happy path → { ok: true }.
  it('storage.set returns { ok: true } on success', () => {
    dispatch(h, { type: 'storage.set', id: 's1', key: 'k1', value: 'v1' } as NappletMessage);

    const reply = lastOfType(h, 'storage.set.result');
    expect(reply).toBeDefined();
    expect((reply as any).id).toBe('s1');
    expect((reply as any).ok).toBe(true);
    // Successful set carries no error field.
    expect((reply as any).error).toBeUndefined();
  });

  // Test 3b — storage.set with quota exceeded → .result envelope carrying error field.
  // Canonical @napplet/nap/storage has no *.error type; errors are delivered as
  // storage.<action>.result with the optional `error` field populated.
  it('storage.set emits .result envelope with error field when quota exceeded', () => {
    // Tiny 8-byte quota ensures a 100-byte value blows through it.
    const tiny = createDirectHarness({ quota: 8 });
    const bigValue = 'x'.repeat(100);

    dispatch(tiny, {
      type: 'storage.set',
      id: 's-quota',
      key: 'k-quota',
      value: bigValue,
    } as NappletMessage);

    const result = lastOfType(tiny, 'storage.set.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('s-quota');
    expect((result as any).error).toMatch(/quota/i);
    // Quota-exceeded result must NOT carry ok:true or a value payload.
    expect((result as any).ok).toBeUndefined();
    // No non-canonical storage.set.error envelope was emitted.
    expect(lastOfType(tiny, 'storage.set.error')).toBeUndefined();
  });

  // Test 4 — storage.remove → { ok: true }.
  it('storage.remove returns { ok: true }', () => {
    // Seed the store so the remove has something to delete.
    h.stateStore.set(`${PREFIX}to-remove`, 'x');

    dispatch(h, { type: 'storage.remove', id: 'r1', key: 'to-remove' } as NappletMessage);

    const reply = lastOfType(h, 'storage.remove.result');
    expect(reply).toBeDefined();
    expect((reply as any).id).toBe('r1');
    expect((reply as any).ok).toBe(true);
    expect((reply as any).error).toBeUndefined();
    // Confirm persistence side-effect actually happened.
    expect(h.stateStore.has(`${PREFIX}to-remove`)).toBe(false);
  });

  // Test 5 — storage.keys → { keys: [...] }.
  it('storage.keys returns { keys: [<k1>, <k2>] } (user-facing names)', () => {
    h.stateStore.set(`${PREFIX}key-a`, 'va');
    h.stateStore.set(`${PREFIX}key-b`, 'vb');

    dispatch(h, { type: 'storage.keys', id: 'k1' } as NappletMessage);

    const reply = lastOfType(h, 'storage.keys.result');
    expect(reply).toBeDefined();
    expect((reply as any).id).toBe('k1');
    const keys = ((reply as any).keys as string[]).slice().sort();
    expect(keys).toEqual(['key-a', 'key-b']);
  });

  // Test 6 — storage.clear rejected with .result envelope carrying error field.
  // storage.clear is NOT in @napplet/nap/storage; per spec only *.result envelopes
  // exist, errors are signalled via the optional `error` field.
  it('storage.clear produces .result envelope with error field — action not supported by @napplet/nap/storage', () => {
    dispatch(h, { type: 'storage.clear', id: 'c1' } as NappletMessage);

    const result = lastOfType(h, 'storage.clear.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('c1');
    // Accept either the explicit "not in @napplet/nap/storage" message or the
    // generic "unknown storage action: clear" fallback.
    expect((result as any).error).toMatch(/not (in )?@napplet\/nap\/storage|unknown storage action: clear/i);
    // No non-canonical storage.clear.error envelope was emitted.
    expect(lastOfType(h, 'storage.clear.error')).toBeUndefined();
  });

  // Test 7 — unknown storage sub-action also produces .result envelope with error field.
  it('unknown storage.bogus produces .result envelope with error field', () => {
    dispatch(h, { type: 'storage.bogus', id: 'b1' } as NappletMessage);

    const result = lastOfType(h, 'storage.bogus.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('b1');
    expect((result as any).error).toMatch(/unknown storage action/i);
    // No non-canonical storage.bogus.error envelope was emitted.
    expect(lastOfType(h, 'storage.bogus.error')).toBeUndefined();
  });
});

// ─── ACL Denial Test (routes through full runtime dispatch) ─────────────────

describe('storage nub — ACL denial emits canonical result envelope', () => {
  let mock: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    mock = createMockRuntimeAdapter();
    runtime = createRuntime(mock.hooks);
    runtime.sessionRegistry.register(
      WINDOW_ID,
      createNip5dSessionEntry(WINDOW_ID, TEST_DTAG, TEST_HASH),
    );
  });

  // Test 8 — storage.get denied by ACL → canonical .result envelope with error.
  // resolveCapabilitiesNub('storage.get') => { senderCap: 'state:read' }. Blocking
  // the napplet identity makes the cap check return false; the runtime then emits
  // a `{ type: 'storage.get.result', error: 'denied: state:read' }` envelope.
  it('storage.get denied by ACL produces storage.get.result error envelope', () => {
    // Block the napplet's identity so any cap check fails.
    runtime.aclState.block('', TEST_DTAG, TEST_HASH);

    runtime.handleMessage(WINDOW_ID, {
      type: 'storage.get',
      id: 'g-deny',
      key: 'foo',
    } as NappletMessage);

    const err = findEnvelopeResponse(mock.sent, 'storage.get.result');
    expect(err).toBeDefined();
    expect((err as any).id).toBe('g-deny');
    // Denial reason must reference state:read OR the canonical 'denied:' prefix.
    expect((err as any).error).toMatch(/capability_missing|denied|state:read/i);
    // When ACL denies, no non-canonical storage.get.error envelope is emitted.
    expect(findEnvelopeResponse(mock.sent, 'storage.get.error')).toBeUndefined();
  });
});

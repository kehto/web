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

// ─── Per-instance scope (NAP-STORAGE / napplet/naps#3) ──────────────────────
//
// `scope: "shared" | "instance"` is a per-call wire field (default "shared").
// "instance" isolates a key to the calling window's sub-namespace; "shared"
// (or absent) stays common to every window of the napplet. The napplet never
// sees an instance id — the shell folds `windowId` into the key. These tests
// exercise both scopes across two windows of the *same* `(dTag, hash)` identity.

/** Multi-window harness: many windowIds, one napplet identity, shared store. */
interface MultiHarness {
  sent: NappletMessage[];
  stateStore: Map<string, string>;
  dispatchAs(windowId: string, msg: NappletMessage): void;
  lastOfType(type: string): NappletMessage | undefined;
}

function createMultiHarness(windowIds: string[], quota = 1024 * 1024): MultiHarness {
  const sent: NappletMessage[] = [];
  const stateStore = new Map<string, string>();

  const statePersistence: StatePersistence = {
    get(key: string) { return stateStore.get(key) ?? null; },
    set(key: string, value: string) { stateStore.set(key, value); return true; },
    remove(key: string) { stateStore.delete(key); },
    clear(prefix: string) {
      for (const k of stateStore.keys()) { if (k.startsWith(prefix)) stateStore.delete(k); }
    },
    keys(prefix: string) { return [...stateStore.keys()].filter(k => k.startsWith(prefix)); },
    calculateBytes(prefix: string) {
      let bytes = 0;
      for (const [k, v] of stateStore.entries()) {
        if (k.startsWith(prefix)) bytes += k.length + v.length;
      }
      return bytes;
    },
  };

  const sessionRegistry = createSessionRegistry();
  // Every window shares the same (dTag, aggregateHash) identity — distinct only
  // by windowId, which is exactly the instance discriminator under test.
  for (const w of windowIds) {
    sessionRegistry.register(w, createNip5dSessionEntry(w, TEST_DTAG, TEST_HASH));
  }

  const aclBase = createAclState(makeAclPersistence(), 'permissive');
  const aclState: AclStateContainer = {
    ...aclBase,
    getStateQuota: () => quota,
  } as AclStateContainer;

  const sendToNapplet: SendToNapplet = (_windowId, msg) => {
    if (!Array.isArray(msg)) sent.push(msg);
  };

  return {
    sent,
    stateStore,
    dispatchAs(windowId, msg) {
      handleStorageNub(windowId, msg, sendToNapplet, sessionRegistry, aclState, statePersistence);
    },
    lastOfType(type) {
      for (let i = sent.length - 1; i >= 0; i--) {
        if (sent[i]?.type === type) return sent[i];
      }
      return undefined;
    },
  };
}

const WIN_A = 'win-A';
const WIN_B = 'win-B';

describe('handleStorageNub — per-call scope (shared | instance)', () => {
  let h: MultiHarness;

  beforeEach(() => {
    h = createMultiHarness([WIN_A, WIN_B]);
  });

  // Shared scope (default) is byte-identical to history — stored under the bare
  // `(dTag, hash)` prefix with no instance segment.
  it('shared scope (default) writes to the napplet-wide key with no instance segment', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's1', key: 'theme', value: 'dark' } as NappletMessage);
    expect((h.lastOfType('storage.set.result') as any).ok).toBe(true);
    // Stored under the historical key, no `@i/` segment.
    expect(h.stateStore.get(`${PREFIX}theme`)).toBe('dark');
    expect([...h.stateStore.keys()].some(k => k.includes('@i/'))).toBe(false);
  });

  it('explicit scope "shared" behaves the same as omitting scope', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's1', key: 'k', value: 'v', scope: 'shared' } as unknown as NappletMessage);
    expect(h.stateStore.get(`${PREFIX}k`)).toBe('v');
  });

  // Instance scope round-trips and folds windowId into the stored key.
  it('instance scope set/get round-trips and folds windowId into the key', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's1', key: 'criteria', value: 'authors', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.set.result') as any).ok).toBe(true);
    // Persisted under the per-window sub-namespace.
    expect(h.stateStore.get(`${PREFIX}@i/${WIN_A}:criteria`)).toBe('authors');

    h.dispatchAs(WIN_A, { type: 'storage.get', id: 'g1', key: 'criteria', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('authors');
  });

  // Unique guarantee — two windows of the same napplet never collide on instance keys.
  it('instance scope isolates the same key across two windows (Unique guarantee)', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a', key: 'feed', value: 'A-feed', scope: 'instance' } as unknown as NappletMessage);
    h.dispatchAs(WIN_B, { type: 'storage.set', id: 'b', key: 'feed', value: 'B-feed', scope: 'instance' } as unknown as NappletMessage);

    h.dispatchAs(WIN_A, { type: 'storage.get', id: 'ga', key: 'feed', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('A-feed');
    h.dispatchAs(WIN_B, { type: 'storage.get', id: 'gb', key: 'feed', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('B-feed');
  });

  // Stable guarantee — the same windowId resolves to the same namespace, so a
  // later read (simulating a reload that restores the window) sees prior data.
  it('instance storage is stable per window across re-dispatch (Stable guarantee)', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's', key: 'scroll', value: '42', scope: 'instance' } as unknown as NappletMessage);
    // A fresh handler invocation with the same windowId (reload) still resolves it.
    h.dispatchAs(WIN_A, { type: 'storage.get', id: 'g', key: 'scroll', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('42');
  });

  // Shared state is common to every window.
  it('shared scope is common across windows', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's', key: 'theme', value: 'dark', scope: 'shared' } as unknown as NappletMessage);
    h.dispatchAs(WIN_B, { type: 'storage.get', id: 'g', key: 'theme', scope: 'shared' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('dark');
  });

  // Shared and instance namespaces are independent for the same key name.
  it('shared and instance keys with the same name do not collide', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's1', key: 'k', value: 'shared-val', scope: 'shared' } as unknown as NappletMessage);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's2', key: 'k', value: 'instance-val', scope: 'instance' } as unknown as NappletMessage);

    h.dispatchAs(WIN_A, { type: 'storage.get', id: 'g1', key: 'k', scope: 'shared' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('shared-val');
    h.dispatchAs(WIN_A, { type: 'storage.get', id: 'g2', key: 'k', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('instance-val');
  });

  // keys(): shared listing never leaks per-instance sub-keys.
  it('shared keys() excludes instance sub-keys; instance keys() is window-scoped', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's1', key: 'shared-key', value: '1', scope: 'shared' } as unknown as NappletMessage);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's2', key: 'inst-key', value: '2', scope: 'instance' } as unknown as NappletMessage);

    h.dispatchAs(WIN_A, { type: 'storage.keys', id: 'k1', scope: 'shared' } as unknown as NappletMessage);
    const sharedKeys = ((h.lastOfType('storage.keys.result') as any).keys as string[]).slice().sort();
    expect(sharedKeys).toEqual(['shared-key']);
    // The reserved `@i/` marker must never appear in a user-facing listing.
    expect(sharedKeys.some(k => k.includes('@i/'))).toBe(false);

    h.dispatchAs(WIN_A, { type: 'storage.keys', id: 'k2', scope: 'instance' } as unknown as NappletMessage);
    const instKeys = ((h.lastOfType('storage.keys.result') as any).keys as string[]).slice().sort();
    expect(instKeys).toEqual(['inst-key']);
  });

  // keys() instance scope is isolated per window.
  it('instance keys() returns only the calling window\'s keys', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a', key: 'ka', value: '1', scope: 'instance' } as unknown as NappletMessage);
    h.dispatchAs(WIN_B, { type: 'storage.set', id: 'b', key: 'kb', value: '2', scope: 'instance' } as unknown as NappletMessage);

    h.dispatchAs(WIN_A, { type: 'storage.keys', id: 'ka', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.keys.result') as any).keys).toEqual(['ka']);
    h.dispatchAs(WIN_B, { type: 'storage.keys', id: 'kb', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.keys.result') as any).keys).toEqual(['kb']);
  });

  // remove() under instance scope only affects the calling window.
  it('instance remove only deletes the calling window\'s key', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a', key: 'x', value: 'A', scope: 'instance' } as unknown as NappletMessage);
    h.dispatchAs(WIN_B, { type: 'storage.set', id: 'b', key: 'x', value: 'B', scope: 'instance' } as unknown as NappletMessage);

    h.dispatchAs(WIN_A, { type: 'storage.remove', id: 'ra', key: 'x', scope: 'instance' } as unknown as NappletMessage);

    h.dispatchAs(WIN_A, { type: 'storage.get', id: 'ga', key: 'x', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBeNull();
    // WIN_B's instance key is untouched.
    h.dispatchAs(WIN_B, { type: 'storage.get', id: 'gb', key: 'x', scope: 'instance' } as unknown as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('B');
  });

  // Invalid scope value is rejected with a canonical .result error envelope.
  it('invalid scope value produces a .result envelope with an error field', () => {
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's', key: 'k', value: 'v', scope: 'bogus' } as unknown as NappletMessage);
    const result = h.lastOfType('storage.set.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('s');
    expect((result as any).error).toMatch(/invalid scope/i);
    // Nothing was written.
    expect(h.stateStore.size).toBe(0);
  });
});

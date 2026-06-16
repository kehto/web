/**
 * state-handler.test.ts — Unit tests for handleStorageNub (Plan 12-09).
 *
 * Asserts canonical @napplet/nub/storage envelope shapes for the 4 canonical
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

describe('handleStorageNub — canonical @napplet/nub/storage envelope shapes', () => {
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
  // Canonical @napplet/nub/storage has no *.error type; errors are delivered as
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
  // storage.clear is NOT in @napplet/nub/storage; per spec only *.result envelopes
  // exist, errors are signalled via the optional `error` field.
  it('storage.clear produces .result envelope with error field — action not supported by @napplet/nub/storage', () => {
    dispatch(h, { type: 'storage.clear', id: 'c1' } as NappletMessage);

    const result = lastOfType(h, 'storage.clear.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('c1');
    // Accept either the explicit "not in @napplet/nub/storage" message or the
    // generic "unknown storage action: clear" fallback.
    expect((result as any).error).toMatch(/not (in )?@napplet\/nub\/storage|unknown storage action: clear/i);
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

// ─── Instanceable napplets — per-window storage scoping (kehto/web#35) ──────

/**
 * Build a harness whose session registry holds two instanceable windows of the
 * *same* napplet identity (distinct windowIds), sharing one state store. Models
 * two open windows of an instanceable napplet (e.g. the feed tab bar).
 */
function createInstanceHarness(windowIds: string[], options?: { instanceable?: boolean; quota?: number }): {
  sent: NappletMessage[];
  statePersistence: StatePersistence;
  aclState: AclStateContainer;
  sessionRegistry: ReturnType<typeof createSessionRegistry>;
  stateStore: Map<string, string>;
  dispatchAs(windowId: string, msg: NappletMessage): void;
  lastOfType(type: string): NappletMessage | undefined;
} {
  const base = createDirectHarness({ quota: options?.quota });
  const instanceable = options?.instanceable ?? true;
  // Re-register each window as the same napplet identity with the instanceable flag.
  for (const wid of windowIds) {
    base.sessionRegistry.register(wid, createNip5dSessionEntry(wid, TEST_DTAG, TEST_HASH, { instanceable }));
  }
  return {
    sent: base.sent,
    statePersistence: base.statePersistence,
    aclState: base.aclState,
    sessionRegistry: base.sessionRegistry,
    stateStore: base.stateStore,
    dispatchAs(windowId, msg) {
      handleStorageNub(windowId, msg, base.sendToNapplet, base.sessionRegistry, base.aclState, base.statePersistence);
    },
    lastOfType(type) {
      for (let i = base.sent.length - 1; i >= 0; i--) {
        if (base.sent[i]?.type === type) return base.sent[i];
      }
      return undefined;
    },
  };
}

describe('handleStorageNub — instanceable per-window storage scoping', () => {
  const WIN_A = 'win-A';
  const WIN_B = 'win-B';
  const instanceKey = (windowId: string, userKey: string) => `${PREFIX}@i/${windowId}:${userKey}`;

  // Criterion: non-instanceable byte-identical — a shared napplet writes the plain key.
  it('non-instanceable napplet writes the plain (non-instance) scoped key', () => {
    const h = createDirectHarness(); // default entry: instanceable = false
    dispatch(h, { type: 'storage.set', id: 's', key: 'tabs', value: 'v' } as NappletMessage);
    expect(h.stateStore.has(`${PREFIX}tabs`)).toBe(true);
    // No instance sub-key was created.
    expect([...h.stateStore.keys()].some(k => k.includes('@i/'))).toBe(false);
  });

  // Criterion: instanceable set writes under the per-window sub-namespace.
  it('instanceable set writes under @i/<windowId>: and never the plain key', () => {
    const h = createInstanceHarness([WIN_A]);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's', key: 'tabs', value: 'feed-1' } as NappletMessage);
    expect(h.stateStore.get(instanceKey(WIN_A, 'tabs'))).toBe('feed-1');
    expect(h.stateStore.has(`${PREFIX}tabs`)).toBe(false);
  });

  // Criterion: two windows (distinct windowId) get isolated, independent storage.
  it('two windows of the same napplet read/write isolated values', () => {
    const h = createInstanceHarness([WIN_A, WIN_B]);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a', key: 'tabs', value: 'A-tabs' } as NappletMessage);
    h.dispatchAs(WIN_B, { type: 'storage.set', id: 'b', key: 'tabs', value: 'B-tabs' } as NappletMessage);

    h.dispatchAs(WIN_A, { type: 'storage.get', id: 'ga', key: 'tabs' } as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('A-tabs');
    h.dispatchAs(WIN_B, { type: 'storage.get', id: 'gb', key: 'tabs' } as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBe('B-tabs');

    // A freshly opened window (no writes) starts empty.
    h.sessionRegistry.register('win-C', createNip5dSessionEntry('win-C', TEST_DTAG, TEST_HASH, { instanceable: true }));
    h.dispatchAs('win-C', { type: 'storage.get', id: 'gc', key: 'tabs' } as NappletMessage);
    expect((h.lastOfType('storage.get.result') as any).value).toBeNull();
  });

  // Criterion: instance data persists across reload / workspace restore (stable windowId).
  it('instance values persist across reload (same stable windowId → same key)', () => {
    const h = createInstanceHarness([WIN_A]);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 's', key: 'tabs', value: 'persisted' } as NappletMessage);
    // Simulate reload: a brand-new registry entry for the same windowId over the
    // same persistence store (hyprgate restores windowId verbatim).
    const reloaded = createSessionRegistry();
    reloaded.register(WIN_A, createNip5dSessionEntry(WIN_A, TEST_DTAG, TEST_HASH, { instanceable: true }));
    handleStorageNub(
      WIN_A,
      { type: 'storage.get', id: 'g', key: 'tabs' } as NappletMessage,
      (_w, msg) => { if (!Array.isArray(msg)) h.sent.push(msg); },
      reloaded,
      h.aclState,
      h.statePersistence,
    );
    expect((h.lastOfType('storage.get.result') as any).value).toBe('persisted');
  });

  // Criterion: runtime declines to instance → graceful shared fallback, napplet unchanged.
  it('runtime declining to instance falls back to shared storage transparently', () => {
    const shared = createInstanceHarness([WIN_A, WIN_B], { instanceable: false });
    shared.dispatchAs(WIN_A, { type: 'storage.set', id: 'a', key: 'tabs', value: 'shared-val' } as NappletMessage);
    // Different window, same identity → sees the shared value (no isolation).
    shared.dispatchAs(WIN_B, { type: 'storage.get', id: 'b', key: 'tabs' } as NappletMessage);
    expect((shared.lastOfType('storage.get.result') as any).value).toBe('shared-val');
    expect(shared.stateStore.has(`${PREFIX}tabs`)).toBe(true);
  });

  // Criterion: keys() is window-scoped for instanceable napplets.
  it('storage.keys returns only the calling window\'s keys for instanceable napplets', () => {
    const h = createInstanceHarness([WIN_A, WIN_B]);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a1', key: 'k-a1', value: '1' } as NappletMessage);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a2', key: 'k-a2', value: '2' } as NappletMessage);
    h.dispatchAs(WIN_B, { type: 'storage.set', id: 'b1', key: 'k-b1', value: '3' } as NappletMessage);

    h.dispatchAs(WIN_A, { type: 'storage.keys', id: 'ka' } as NappletMessage);
    expect(((h.lastOfType('storage.keys.result') as any).keys as string[]).slice().sort()).toEqual(['k-a1', 'k-a2']);
    h.dispatchAs(WIN_B, { type: 'storage.keys', id: 'kb' } as NappletMessage);
    expect((h.lastOfType('storage.keys.result') as any).keys).toEqual(['k-b1']);
  });

  // Criterion: shared keys() never leaks instance sub-keys (reserved @i/ marker).
  it('shared keys() excludes instance sub-keys left under the same prefix', () => {
    const h = createDirectHarness();
    h.stateStore.set(`${PREFIX}plain`, 'v');
    h.stateStore.set(instanceKey(WIN_A, 'leaked'), 'v'); // stray instance key under same prefix
    dispatch(h, { type: 'storage.keys', id: 'k' } as NappletMessage);
    expect((h.sent.find(m => m.type === 'storage.keys.result') as any).keys).toEqual(['plain']);
  });

  // Criterion: remove targets the per-window sub-key.
  it('instanceable remove deletes only the calling window\'s sub-key', () => {
    const h = createInstanceHarness([WIN_A, WIN_B]);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a', key: 'tabs', value: 'A' } as NappletMessage);
    h.dispatchAs(WIN_B, { type: 'storage.set', id: 'b', key: 'tabs', value: 'B' } as NappletMessage);
    h.dispatchAs(WIN_A, { type: 'storage.remove', id: 'ra', key: 'tabs' } as NappletMessage);
    expect(h.stateStore.has(instanceKey(WIN_A, 'tabs'))).toBe(false);
    expect(h.stateStore.get(instanceKey(WIN_B, 'tabs'))).toBe('B'); // B untouched
  });

  // Criterion: cleanupNappState removes instance sub-keys on teardown.
  it('cleanupNappState clears instance sub-keys via the shared identity prefix', async () => {
    const { cleanupNappState } = await import('./state-handler.js');
    const h = createInstanceHarness([WIN_A, WIN_B]);
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a', key: 'tabs', value: 'A' } as NappletMessage);
    h.dispatchAs(WIN_B, { type: 'storage.set', id: 'b', key: 'tabs', value: 'B' } as NappletMessage);
    expect([...h.stateStore.keys()].filter(k => k.includes('@i/'))).toHaveLength(2);

    cleanupNappState('', TEST_DTAG, TEST_HASH, h.statePersistence);
    expect([...h.stateStore.keys()].filter(k => k.startsWith(PREFIX))).toHaveLength(0);
  });

  // Criterion: quota accounting covers instance sub-keys (summed under the napplet quota).
  it('quota sums instance sub-keys across windows under the napplet identity limit', () => {
    // Shared per-napplet quota spans every instance sub-key. The scoped key is
    // ~105 bytes (64-char hash); a 50-byte value makes each write ~155 bytes, so
    // a 250-byte quota fits one window's write but not two.
    const h = createInstanceHarness([WIN_A, WIN_B], { quota: 250 });
    const big = 'x'.repeat(50);
    // First window's write fits.
    h.dispatchAs(WIN_A, { type: 'storage.set', id: 'a', key: 'tabs', value: big } as NappletMessage);
    expect((h.lastOfType('storage.set.result') as any).ok).toBe(true);
    // Second window's write pushes the napplet total past the shared 200-byte quota.
    h.dispatchAs(WIN_B, { type: 'storage.set', id: 'b', key: 'tabs', value: big } as NappletMessage);
    expect((h.lastOfType('storage.set.result') as any).error).toMatch(/quota/i);
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

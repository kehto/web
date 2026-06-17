/**
 * state-handler.ts — Storage NUB request handler using persistence hooks.
 *
 * Handles napplet storage operations (get, set, remove, keys) via the
 * canonical `@napplet/nap/storage` NIP-5D envelope surface. Delegates
 * storage to StatePersistence. No localStorage, no legacy NIP-01 dispatch.
 *
 * Per-instance scope (NAP-STORAGE, napplet/naps#3): every request carries an
 * optional `scope: "shared" | "instance"` (default `"shared"`). `"instance"`
 * folds a stable per-window discriminator (`@i/<windowId>:`) into the key so
 * that multiple open windows of the *same* napplet keep isolated, independently
 * persisted state. Instancing is a property of the data (per call), not the
 * napplet — there is no napplet-wide mode. The napplet never sees or names an
 * instance identifier; it sets `scope` and trusts the shell's Unique + Stable
 * guarantees. `"shared"` (or absent) addresses the napplet-wide namespace,
 * byte-identical to the historical behavior.
 */

import type { NappletMessage } from '@napplet/core';
import type { StorageMessage } from '@napplet/nap/storage/types';
import type { SendToNapplet, StatePersistence } from './types.js';
import type { SessionRegistry } from './session-registry.js';
import type { AclStateContainer } from './acl-state.js';

/** Canonical NAP-STORAGE scope values. `scope` absent ⇔ `"shared"`. */
type StorageScope = 'shared' | 'instance';

/**
 * Reserved key segment that marks the per-instance sub-namespace inside a
 * napplet's `(dTag, aggregateHash)` bucket. Server-side only — napplets never
 * see it. Used for `scope: "instance"` requests (NAP-STORAGE per-instance scope).
 */
const INSTANCE_MARKER = '@i/';

/**
 * Build the per-window instance sub-namespace segment: `@i/<windowId>:`.
 *
 * The discriminator is derived from the runtime's `windowId`, which the shell
 * keeps stable across reload / workspace restore, so per-instance storage
 * persists across sessions (the spec's "Stable" guarantee). Two distinct
 * windows of the same napplet get distinct segments (the "Unique" guarantee).
 * This format is internal and never exposed to the napplet.
 */
function instanceSegment(windowId: string): string {
  return `${INSTANCE_MARKER}${windowId}:`;
}

/**
 * Build the storage key for a napplet user key.
 *
 * For `scope: "shared"` (default) this is byte-identical to the historical key.
 * For `scope: "instance"` the runtime folds in the opaque per-window segment —
 * transparently, with no napplet involvement (the napplet only sets the wire
 * field; it never sees the resulting key shape).
 */
function scopedKey(
  dTag: string,
  aggregateHash: string,
  userKey: string,
  instance = false,
  windowId = '',
): string {
  const segment = instance ? instanceSegment(windowId) : '';
  return `napplet-state:${dTag}:${aggregateHash}:${segment}${userKey}`;
}

/** Build a legacy scoped key that includes pubkey (for migration reads). */
function legacyScopedKey(pubkey: string, dTag: string, aggregateHash: string, userKey: string): string {
  return `napplet-state:${pubkey}:${dTag}:${aggregateHash}:${userKey}`;
}

/** Compute byte length of a UTF-8 string without TextEncoder (ES2022-safe). */
function byteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c < 0xd800 || c >= 0xe000) bytes += 3;
    else { i++; bytes += 4; } // surrogate pair
  }
  return bytes;
}

/**
 * Handle a NIP-5D NUB storage message from a napplet.
 * Routes to the canonical four `@napplet/nap/storage` actions:
 *   - `storage.get`    → `storage.get.result`    `{ value: string | null }`
 *   - `storage.set`    → `storage.set.result`    `{ ok: boolean }` (canonical only checks `error`)
 *   - `storage.remove` → `storage.remove.result` `{ ok: boolean }`
 *   - `storage.keys`   → `storage.keys.result`   `{ keys: string[] }`
 *
 * `storage.clear` is NOT in the canonical `@napplet/nap/storage` union (it was a
 * kehto unilateral extension); attempts produce a `storage.clear.result` envelope
 * with an `error` field set. Internal lifecycle cleanup still uses the
 * `cleanupNappState()` helper below — it is not napplet-reachable.
 *
 * **Per-instance scope (NAP-STORAGE / napplet/naps#3):** each request MAY carry
 * `scope: "shared" | "instance"` (default `"shared"`). `"instance"` addresses a
 * per-window sub-namespace keyed by `windowId`, so multiple windows of the same
 * napplet keep isolated state; `"shared"` (or absent) addresses the napplet-wide
 * namespace, byte-identical to historical behavior. An unrecognized `scope` value
 * is an invalid request and produces a `.result` envelope with `error` set.
 *
 * **Deviation note (Phase 15 to decide):** Set/remove results emit both `ok`
 * (legacy compat) and an `error` field on failure. Canonical `@napplet/nap/storage`
 * only specifies the optional `error`; napplets check `!result.error` for success.
 * Emitting `ok` preserves backward compatibility with existing in-tree callers.
 * Phase 15 (v1.2 release prep) decides whether to drop `ok` pre-release.
 *
 * @param windowId - The window identifier of the requesting napplet
 * @param msg - The NappletMessage containing the storage request
 * @param sendToNapplet - Transport function to send responses
 * @param sessionRegistry - Identity registry for looking up napplet session identity
 * @param aclState - ACL state for quota checks
 * @param statePersistence - State storage backend
 *
 * @example
 * ```ts
 * import { handleStorageNub } from '@kehto/runtime';
 *
 * handleStorageNub(windowId, { type: 'storage.get', id: 'q1', key: 'draft' },
 *   sendToNapplet, sessionRegistry, aclState, statePersistence);
 * ```
 */
export function handleStorageNub(
  windowId: string,
  msg: NappletMessage,
  sendToNapplet: SendToNapplet,
  sessionRegistry: SessionRegistry,
  aclState: AclStateContainer,
  statePersistence: StatePersistence,
): void {
  const m = msg as StorageMessage & {
    id?: string;
    key?: string;
    value?: string;
    scope?: string;
  };
  const id = m.id ?? '';
  const action = msg.type.split('.')[1];

  function sendResult(payload: Record<string, unknown>): void {
    sendToNapplet(windowId, { type: `${msg.type}.result`, id, ...payload } as NappletMessage);
  }
  function sendErrorNub(error: string): void {
    sendToNapplet(windowId, { type: `${msg.type}.result`, id, error } as NappletMessage);
  }

  // Identity lookup via windowId (NIP-5D path)
  const entry = sessionRegistry.getEntryByWindowId(windowId);
  if (!entry) { sendErrorNub('not registered'); return; }

  const { dTag, aggregateHash, pubkey } = entry;
  const prefix = `napplet-state:${dTag}:${aggregateHash}:`;
  const legacyPrefix = pubkey ? `napplet-state:${pubkey}:${dTag}:${aggregateHash}:` : '';

  // NAP-STORAGE per-call scope. Absent ⇔ "shared" (byte-identical to history).
  // An unrecognized value is an invalid request — the shell MUST return an error.
  if (m.scope !== undefined && m.scope !== 'shared' && m.scope !== 'instance') {
    sendErrorNub(`invalid scope: ${String(m.scope)} (expected "shared" or "instance")`);
    return;
  }
  const scope: StorageScope = m.scope === 'instance' ? 'instance' : 'shared';
  const isInstance = scope === 'instance';
  // The per-window sub-namespace for this request, when instance-scoped.
  const instancePrefix = `${prefix}${instanceSegment(windowId)}`;
  const keyFor = (userKey: string): string =>
    scopedKey(dTag, aggregateHash, userKey, isInstance, windowId);

  switch (action) {
    case 'get': {
      const key = m.key as string;
      if (!key) { sendErrorNub('missing key'); return; }
      // Instance scope addresses a fresh per-window namespace with no legacy data —
      // read only the instance key. Shared scope keeps the triple-read migration.
      if (isInstance) {
        sendResult({ value: statePersistence.get(keyFor(key)) });
        break;
      }
      const newKey = scopedKey(dTag, aggregateHash, key);
      // Triple-read for migration: new format, legacy-with-pubkey, old prefix
      let result = statePersistence.get(newKey);
      if (result === null && pubkey) {
        result = statePersistence.get(legacyScopedKey(pubkey, dTag, aggregateHash, key));
      }
      if (result === null && pubkey) {
        result = statePersistence.get(`napp-state:${pubkey}:${dTag}:${aggregateHash}:${key}`);
      }
      // Canonical @napplet/nap/storage: `value: string | null` — null ⇔ missing.
      sendResult({ value: result });
      break;
    }
    case 'set': {
      const key = m.key as string;
      const value = (m.value as string) ?? '';
      if (!key) { sendErrorNub('missing key'); return; }
      const quota = aclState.getStateQuota(pubkey ?? '', dTag, aggregateHash);
      const sk = keyFor(key);
      const newWriteBytes = byteLength(sk + value);
      // Quota is per napplet identity: `prefix` spans both the shared namespace and
      // every per-instance sub-key, so instance writes draw from the same budget.
      const existingBytes = statePersistence.calculateBytes(prefix, key);
      if (existingBytes + newWriteBytes > quota) {
        sendErrorNub(`quota exceeded: napplet state limit is ${quota} bytes`);
        return;
      }
      const success = statePersistence.set(sk, value);
      sendResult({ ok: success });
      break;
    }
    case 'remove': {
      const key = m.key as string;
      if (!key) { sendErrorNub('missing key'); return; }
      statePersistence.remove(keyFor(key));
      // legacyPrefix exists only while `pubkey` is non-empty (legacy AUTH sessions).
      // Suppress "unused binding" warnings: we intentionally retain the computation
      // so future migration lands at call sites, not here.
      void legacyPrefix;
      sendResult({ ok: true });
      break;
    }
    case 'clear': {
      // storage.clear was a kehto unilateral extension; it is NOT in the canonical
      // @napplet/nap/storage union. Napplets hitting this branch receive a
      // storage.clear.result envelope with the error field set. Internal lifecycle
      // cleanup uses cleanupNappState() below (not napplet-reachable).
      sendErrorNub('storage.clear is not in @napplet/nap/storage; action not supported');
      break;
    }
    case 'keys': {
      // Instance scope sees only this window's sub-namespace.
      if (isInstance) {
        const instKeys = statePersistence.keys(instancePrefix);
        const instanceKeySet = new Set<string>();
        for (const k of instKeys) {
          instanceKeySet.add(k.startsWith(instancePrefix) ? k.slice(instancePrefix.length) : k);
        }
        sendResult({ keys: Array.from(instanceKeySet) });
        break;
      }
      const newKeys = statePersistence.keys(prefix);
      const legacyKeys = legacyPrefix ? statePersistence.keys(legacyPrefix) : [];
      const userKeySet = new Set<string>();
      // Shared scope excludes per-instance sub-keys (reserved `@i/` marker) so an
      // instance-scoped napplet's per-window data never leaks into a shared listing.
      for (const k of newKeys) {
        if (!k.startsWith(prefix)) { userKeySet.add(k); continue; }
        const userKey = k.slice(prefix.length);
        if (userKey.startsWith(INSTANCE_MARKER)) continue;
        userKeySet.add(userKey);
      }
      for (const k of legacyKeys) userKeySet.add(k.startsWith(legacyPrefix) ? k.slice(legacyPrefix.length) : k);
      sendResult({ keys: Array.from(userKeySet) });
      break;
    }
    default:
      sendErrorNub(`unknown storage action: ${action}`);
      break;
  }
}

/**
 * Remove all state entries for a napplet identity.
 * Clears both new-format and legacy-format keys for completeness.
 * Used during napplet cleanup when a window is closed.
 *
 * @param pubkey - The napplet's pubkey (needed for legacy key cleanup)
 * @param dTag - The napplet's dTag
 * @param aggregateHash - The napplet's build hash
 * @param statePersistence - State storage backend
 *
 * @example
 * ```ts
 * import { cleanupNappState } from '@kehto/runtime';
 *
 * cleanupNappState(pubkey, dTag, aggregateHash, statePersistence);
 * ```
 */
export function cleanupNappState(
  pubkey: string,
  dTag: string,
  aggregateHash: string,
  statePersistence: StatePersistence,
): void {
  // Clear new format
  const prefix = `napplet-state:${dTag}:${aggregateHash}:`;
  statePersistence.clear(prefix);
  // Clear legacy format (includes pubkey)
  const legacyPrefix = `napplet-state:${pubkey}:${dTag}:${aggregateHash}:`;
  statePersistence.clear(legacyPrefix);
}

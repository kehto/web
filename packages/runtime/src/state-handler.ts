/**
 * state-handler.ts — Storage NUB request handler using persistence hooks.
 *
 * Handles napplet storage operations (get, set, remove, keys) via the
 * canonical `@napplet/nub/storage` NIP-5D envelope surface. Delegates
 * storage to StatePersistence. No localStorage, no legacy NIP-01 dispatch.
 */

import type { NappletMessage } from '@napplet/core';
import type { StorageMessage } from '@napplet/nub/storage/types';
import type { SendToNapplet, StatePersistence } from './types.js';
import type { SessionRegistry } from './session-registry.js';
import type { AclStateContainer } from './acl-state.js';

function scopedKey(dTag: string, aggregateHash: string, userKey: string): string {
  return `napplet-state:${dTag}:${aggregateHash}:${userKey}`;
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
 * Routes to the canonical four `@napplet/nub/storage` actions:
 *   - `storage.get`    → `storage.get.result`    `{ value: string | null }`
 *   - `storage.set`    → `storage.set.result`    `{ ok: boolean }` (canonical only checks `error`)
 *   - `storage.remove` → `storage.remove.result` `{ ok: boolean }`
 *   - `storage.keys`   → `storage.keys.result`   `{ keys: string[] }`
 *
 * `storage.clear` is NOT in the canonical `@napplet/nub/storage` union (it was a
 * kehto unilateral extension); attempts produce a `storage.clear.result` envelope
 * with an `error` field set. Internal lifecycle cleanup still uses the
 * `cleanupNappState()` helper below — it is not napplet-reachable.
 *
 * **Deviation note (Phase 15 to decide):** Set/remove results emit both `ok`
 * (legacy compat) and an `error` field on failure. Canonical `@napplet/nub/storage`
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

  switch (action) {
    case 'get': {
      const key = m.key as string;
      if (!key) { sendErrorNub('missing key'); return; }
      const newKey = scopedKey(dTag, aggregateHash, key);
      // Triple-read for migration: new format, legacy-with-pubkey, old prefix
      let result = statePersistence.get(newKey);
      if (result === null && pubkey) {
        result = statePersistence.get(legacyScopedKey(pubkey, dTag, aggregateHash, key));
      }
      if (result === null && pubkey) {
        result = statePersistence.get(`napp-state:${pubkey}:${dTag}:${aggregateHash}:${key}`);
      }
      // Canonical @napplet/nub/storage: `value: string | null` — null ⇔ missing.
      sendResult({ value: result });
      break;
    }
    case 'set': {
      const key = m.key as string;
      const value = (m.value as string) ?? '';
      if (!key) { sendErrorNub('missing key'); return; }
      const quota = aclState.getStateQuota(pubkey ?? '', dTag, aggregateHash);
      const sk = scopedKey(dTag, aggregateHash, key);
      const newWriteBytes = byteLength(sk + value);
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
      statePersistence.remove(scopedKey(dTag, aggregateHash, key));
      // legacyPrefix exists only while `pubkey` is non-empty (legacy AUTH sessions).
      // Suppress "unused binding" warnings: we intentionally retain the computation
      // so future migration lands at call sites, not here.
      void legacyPrefix;
      sendResult({ ok: true });
      break;
    }
    case 'clear': {
      // storage.clear was a kehto unilateral extension; it is NOT in the canonical
      // @napplet/nub/storage union. Napplets hitting this branch receive a
      // storage.clear.result envelope with the error field set. Internal lifecycle
      // cleanup uses cleanupNappState() below (not napplet-reachable).
      sendErrorNub('storage.clear is not in @napplet/nub/storage; action not supported');
      break;
    }
    case 'keys': {
      const newKeys = statePersistence.keys(prefix);
      const legacyKeys = legacyPrefix ? statePersistence.keys(legacyPrefix) : [];
      const userKeySet = new Set<string>();
      for (const k of newKeys) userKeySet.add(k.startsWith(prefix) ? k.slice(prefix.length) : k);
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

/**
 * Runtime persistence + cache data types.
 *
 * Host-implemented persistence adapters (ACL, firewall, manifest, shell-secret,
 * GUID, napplet state) plus the cached-entry shapes they store. Extracted from
 * types.ts to keep that file under the size budget; re-exported from types.ts so
 * the public @kehto/runtime API is unchanged.
 */

import type { Decision, Action } from "@kehto/firewall";
import type { NappletMessage } from "@napplet/core";

/**
 * ACL persistence — runtime calls these to save/load ACL state.
 * Implementor decides storage backend (localStorage, file, DB, etc.).
 */
export interface AclPersistence {
  persist(data: string): void;
  load(): string | null;
}

/**
 * Firewall persistence — runtime calls these to save/load firewall config.
 * Implementor decides storage backend (localStorage, file, DB, etc.).
 * Only the firewall config is persisted; ephemeral counters are never stored.
 *
 * @param persist - Store serialized config data; called after each policy mutation.
 * @param load    - Retrieve previously stored config, or null on first boot.
 */
export interface FirewallPersistence {
  persist(data: string): void;
  load(): string | null;
}

/**
 * Event emitted on every firewall evaluation that results in an audit-level
 * decision (flag, block, or prompt).
 *
 * @param windowId        - The napplet window that sent the message.
 * @param napplet         - The napplet dTag (version-agnostic identity key).
 * @param opClass         - Operation class string (e.g. 'relay:write', 'outbox:publish').
 * @param decision        - Primary disposition: 'pass', 'reject', or 'prompt'.
 * @param action          - The matched rule's exceed-action: 'flag', 'block', or 'ignore'.
 * @param ruleId          - Identifier of the rule that made the decision.
 * @param reason          - Human-readable reason string for logging/audit.
 * @param message         - The triggering NappletMessage, if available.
 */
export interface FirewallEvent {
  /** The napplet window that sent the message. */
  windowId: string;
  /** The napplet dTag (version-agnostic identity key). */
  napplet: string;
  /** Operation class string (e.g. 'relay:write', 'outbox:publish', 'intent:invoke'). */
  opClass: string;
  /** Primary disposition for the caller. */
  decision: Decision;
  /** The matched rule's exceed-action. */
  action: Action;
  /** Identifier of the rule that made the decision (e.g. 'rate:default', 'burst', 'policy:deny'). */
  ruleId: string;
  /** Human-readable reason string for logging and audit. */
  reason: string;
  /** The triggering message, if available. */
  message?: NappletMessage;
}

/**
 * Manifest persistence — runtime calls these to save/load manifest cache.
 * Implementor decides storage backend.
 */
export interface ManifestPersistence {
  persist(data: string): void;
  load(): string | null;
}

/**
 * Shell secret persistence — runtime calls these to save/load the per-shell secret
 * used for deterministic keypair derivation. The secret is a 32-byte random value
 * generated once on first use.
 */
export interface ShellSecretPersistence {
  /** Get the stored shell secret, or null if not yet generated. */
  get(): Uint8Array | null;
  /** Store the shell secret. */
  set(secret: Uint8Array): void;
}

/**
 * GUID persistence — runtime calls these to save/load per-iframe instance GUIDs.
 * GUIDs survive page reloads: same iframe slot gets the same GUID.
 * Implementor decides storage backend and keying strategy
 * (e.g., localStorage keyed by iframe src or slot index).
 */
export interface GuidPersistence {
  /** Get a stored GUID for a window identifier, or null if none exists. */
  get(windowId: string): string | null;
  /** Store a GUID for a window identifier. */
  set(windowId: string, guid: string): void;
  /** Remove a stored GUID. */
  remove(windowId: string): void;
}

/**
 * State storage — runtime calls these for napplet-scoped key-value storage.
 * All keys are pre-scoped by the runtime (dTag:hash:userKey).
 */
export interface StatePersistence {
  get(scopedKey: string): string | null;
  set(scopedKey: string, value: string): boolean;
  remove(scopedKey: string): void;
  clear(prefix: string): void;
  keys(prefix: string): string[];
  calculateBytes(prefix: string, excludeKey?: string): number;
}

/**
 * A cached manifest entry for a verified napplet build.
 * Optionally stores the napplet's declared service requirements from its manifest.
 */
export interface ManifestCacheEntry {
  pubkey: string;
  dTag: string;
  aggregateHash: string;
  verifiedAt: number;
  /** Service names declared in the napplet's manifest requires tags. */
  requires?: string[];
}

/**
 * Cached verification result for an aggregate hash.
 * Keyed by manifest event ID — immutable Nostr events mean same ID = same content.
 */
export interface VerificationCacheEntry {
  /** The computed aggregate hash. */
  aggregateHash: string;
  /** Whether the computed hash matched the declared hash. */
  valid: boolean;
  /** Timestamp when verification was performed. */
  verifiedAt: number;
}

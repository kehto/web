/**
 * enforce.ts — Single ACL enforcement gate for the NIP-5D runtime.
 *
 * All NIP-5D NappletMessage envelopes pass through createNubEnforceGate()
 * before any handler acts. resolveCapabilitiesNub() (re-exported from
 * @kehto/acl) maps NUB message types to required capabilities. No NIP-01
 * dispatch path remains — v1.4 Phase 24 DRIFT-02 deleted the legacy
 * capability-resolution function along with its dead kind + topic
 * dispatch table.
 */

import type { Capability } from '@kehto/acl/capabilities';
import type { NubMessage } from '@kehto/acl';
import type { AclCheckEvent } from './types.js';

// Re-export NUB capability resolution for consumers who import through enforce.ts
export { resolveCapabilitiesNub } from '@kehto/acl';
export type { NubMessage } from '@kehto/acl';

// ─── Enforcement ──────────────────────────────────────────────────────────────

/**
 * Result of an enforcement check.
 *
 * @param allowed - Whether the capability check passed
 * @param capability - The capability that was checked (human-readable string)
 */
export interface EnforceResult {
  allowed: boolean;
  capability: Capability;
}

/**
 * Identity lookup function type — resolves a pubkey to its full identity.
 * Provided by sessionRegistry at runtime.
 */
export type IdentityResolver = (pubkey: string) => { dTag: string; aggregateHash: string } | undefined;

/**
 * ACL check function type — performs the actual capability check.
 * Provided by @kehto/acl's check() at runtime, or by the legacy aclStore.check().
 */
export type AclChecker = (pubkey: string, dTag: string, aggregateHash: string, capability: Capability) => boolean;

/**
 * Enforcement gate configuration.
 *
 * @param checkAcl - The ACL check function (wraps @kehto/acl or legacy aclStore)
 * @param resolveIdentity - Maps pubkey to full identity (dTag, aggregateHash)
 * @param onAclCheck - Optional audit callback. Called on every enforce() check
 *   with the identity, capability, and decision.
 */
export interface EnforceConfig {
  checkAcl: AclChecker;
  resolveIdentity: IdentityResolver;
  onAclCheck?: (event: AclCheckEvent) => void;
}

/**
 * Create an enforcement gate with the given configuration.
 *
 * Returns a function that checks a single capability for a given pubkey.
 * Every call is logged to the audit callback.
 *
 * @param config - Enforcement configuration with ACL checker, identity resolver, and audit hooks
 * @returns An enforce function that checks capabilities and logs decisions
 *
 * @example
 * ```ts
 * const gate = createEnforceGate({
 *   checkAcl: aclStore.check,
 *   resolveIdentity: (pk) => nappKeyRegistry.getEntry(pk),
 *   onAclCheck: hooks.onAclCheck,
 * });
 * const result = gate('abc123...', 'relay:write');
 * // result.allowed === true | false
 * ```
 */
export function createEnforceGate(config: EnforceConfig): (pubkey: string, capability: Capability, message?: unknown[]) => EnforceResult {
  const { checkAcl, resolveIdentity, onAclCheck } = config;

  return function enforce(pubkey: string, capability: Capability, message?: unknown[]): EnforceResult {
    const entry = resolveIdentity(pubkey);
    const dTag = entry?.dTag ?? '';
    const aggregateHash = entry?.aggregateHash ?? '';

    const allowed = checkAcl(pubkey, dTag, aggregateHash, capability);

    // Audit logging — every check, both allows and denials
    const identity = { pubkey, dTag, hash: aggregateHash };
    const decision = allowed ? 'allow' as const : 'deny' as const;

    if (onAclCheck) {
      onAclCheck({ identity, capability, decision, message });
    }

    return { allowed, capability };
  };
}

// ─── NUB Enforcement Gate (NIP-5D) ───────────────────────────────────────────

/**
 * Enforcement gate configuration for NIP-5D NUB handlers.
 * Uses windowId for identity resolution instead of pubkey (which is '' in NIP-5D sessions).
 *
 * @param checkAcl - The ACL check function
 * @param resolveIdentityByWindowId - Maps windowId to identity (dTag, aggregateHash)
 * @param onAclCheck - Optional audit callback, called on every enforceNub() check
 */
export interface NubEnforceConfig {
  checkAcl: AclChecker;
  resolveIdentityByWindowId: (windowId: string) => { dTag: string; aggregateHash: string } | undefined;
  onAclCheck?: (event: AclCheckEvent) => void;
}

/**
 * Create an enforcement gate for NIP-5D NUB message handlers.
 *
 * Unlike createEnforceGate (which resolves identity by pubkey), this factory
 * resolves identity by windowId — necessary for NIP-5D sessions where pubkey is ''.
 *
 * @param config - NUB enforcement configuration
 * @returns An enforceNub function that resolves identity by windowId
 *
 * @example
 * ```ts
 * const gate = createNubEnforceGate({
 *   checkAcl: aclStore.check,
 *   resolveIdentityByWindowId: (wid) => sessionRegistry.getEntryByWindowId(wid),
 *   onAclCheck: hooks.onAclCheck,
 * });
 * const result = gate('win-1', 'relay:write', { type: 'relay.publish' });
 * // result.allowed === true | false
 * ```
 */
export function createNubEnforceGate(config: NubEnforceConfig): (windowId: string, capability: Capability, message?: NubMessage) => EnforceResult {
  const { checkAcl, resolveIdentityByWindowId, onAclCheck } = config;

  return function enforceNub(windowId: string, capability: Capability, message?: NubMessage): EnforceResult {
    const entry = resolveIdentityByWindowId(windowId);
    const dTag = entry?.dTag ?? '';
    const aggregateHash = entry?.aggregateHash ?? '';

    // NIP-5D: pass empty string for pubkey — toKey() ignores it (uses dTag:hash)
    const allowed = checkAcl('', dTag, aggregateHash, capability);

    const identity = { pubkey: '', dTag, hash: aggregateHash };
    const decision = allowed ? 'allow' as const : 'deny' as const;

    if (onAclCheck) {
      onAclCheck({ identity, capability, decision, message });
    }

    return { allowed, capability };
  };
}

// ─── Denial Response Helpers ──────────────────────────────────────────────────

/**
 * Format a denial reason string with the standard 'denied:' prefix.
 *
 * @param capability - The denied capability name
 * @returns Formatted denial string, e.g., 'denied: relay:write'
 *
 * @example
 * ```ts
 * formatDenialReason('relay:write')
 * // => 'denied: relay:write'
 * ```
 */
export function formatDenialReason(capability: Capability): string {
  return `denied: ${capability}`;
}

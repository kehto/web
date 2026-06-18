
import type { Capability } from '@kehto/acl/capabilities';
import type { NapMessage } from '@kehto/acl';
import type { AclCheckEvent } from './types.js';

// Re-export NAP capability resolution for consumers who import through enforce.ts
export { resolveCapabilitiesNap } from '@kehto/acl';
export type { NapMessage } from '@kehto/acl';

/**
 * Result of an enforcement check.
 *
 * @param allowed - Whether the capability check passed
 * @param capability - The capability that was checked (human-readable string)
 * @param reason - Why the decision was reached (v1.7 CLASS-03 / D7). Always set on return.
 */
export interface EnforceResult {
  allowed: boolean;
  capability: Capability;
  /**
   * Why the decision was reached. Always set on the return path.
   * Distinct from AclCheckEvent.reason (which is optional for backwards compat).
   */
  reason: 'allowed' | 'capability-missing';
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
    const reason = allowed ? 'allowed' as const : 'capability-missing' as const;

    if (onAclCheck) {
      onAclCheck({ identity, capability, decision, message, reason });
    }

    return { allowed, capability, reason };
  };
}

/**
 * Enforcement gate configuration for NIP-5D NAP handlers.
 * Uses windowId for identity resolution instead of pubkey (which is '' in NIP-5D sessions).
 *
 * @param checkAcl - The ACL check function
 * @param resolveIdentityByWindowId - Maps windowId to identity (dTag, aggregateHash).
 * @param onAclCheck - Optional audit callback, called on every enforceNap() check
 */
export interface NapEnforceConfig {
  checkAcl: AclChecker;
  resolveIdentityByWindowId: (windowId: string) => { dTag: string; aggregateHash: string } | undefined;
  onAclCheck?: (event: AclCheckEvent) => void;
}

/**
 * Create an enforcement gate for NIP-5D NAP message handlers.
 *
 * Unlike createEnforceGate (which resolves identity by pubkey), this factory
 * resolves identity by windowId — necessary for NIP-5D sessions where pubkey is ''.
 *
 * @param config - NAP enforcement configuration
 * @returns An enforceNap function that resolves identity by windowId and
 *   delegates to the ACL check.
 *
 * @example
 * ```ts
 * const gate = createNapEnforceGate({
 *   checkAcl: aclStore.check,
 *   resolveIdentityByWindowId: (wid) => sessionRegistry.getEntryByWindowId(wid),
 *   onAclCheck: hooks.onAclCheck,
 * });
 * const result = gate('win-1', 'relay:write', { type: 'relay.publish' });
 * // result.allowed === true | false
 * ```
 */
export function createNapEnforceGate(config: NapEnforceConfig): (windowId: string, capability: Capability, message?: NapMessage) => EnforceResult {
  const { checkAcl, resolveIdentityByWindowId, onAclCheck } = config;

  return function enforceNap(windowId: string, capability: Capability, message?: NapMessage): EnforceResult {
    const entry = resolveIdentityByWindowId(windowId);
    const dTag = entry?.dTag ?? '';
    const aggregateHash = entry?.aggregateHash ?? '';

    // NIP-5D: pass empty string for pubkey - toKey() ignores it (uses dTag:hash).
    const allowed = checkAcl('', dTag, aggregateHash, capability);

    const identity = { pubkey: '', dTag, hash: aggregateHash };
    const decision = allowed ? 'allow' as const : 'deny' as const;
    const reason = allowed ? 'allowed' as const : 'capability-missing' as const;

    if (onAclCheck) {
      onAclCheck({ identity, capability, decision, message, reason });
    }

    return { allowed, capability, reason };
  };
}

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

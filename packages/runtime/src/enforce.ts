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
import { ALL_CAPABILITIES } from '@kehto/acl/capabilities';
import type { NubMessage } from '@kehto/acl';
import type { AclCheckEvent, NappletClass } from './types.js';

// Re-export NUB capability resolution for consumers who import through enforce.ts
export { resolveCapabilitiesNub } from '@kehto/acl';
export type { NubMessage } from '@kehto/acl';

// ─── Class posture policy (NUB-CLASS, v1.7 Phase 38, D8) ──────────────────────

/**
 * Hardcoded per-class capability allowlist. The permissive default
 * (class === null) bypasses this map entirely - see enforceNub. Additional
 * classes are added when NUB specs publish new class tokens.
 *
 * - 'class-1': all 15 v1.2-era capabilities (permissive full surface).
 * - 'class-2': all capabilities EXCEPT relay:write - the sample restrictive
 *   class Plan 38-03's class-invariant.spec.ts exercises.
 *
 * Unknown class tokens fall through enforceNub's "treat as maximally
 * restrictive" branch (deny all) - defensive failsafe, not policy.
 */
const CLASS_CAPABILITY_ALLOWLIST: Readonly<Record<string, ReadonlySet<Capability>>> = Object.freeze({
  'class-1': new Set<Capability>(ALL_CAPABILITIES),
  'class-2': new Set<Capability>(ALL_CAPABILITIES.filter((c) => c !== 'relay:write')),
});

// ─── Enforcement ──────────────────────────────────────────────────────────────

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
   * Why the decision was reached (v1.7 CLASS-03 / D7). Always set on the
   * return path. Distinct from AclCheckEvent.reason (which is optional for
   * backwards compat on the audit surface).
   */
  reason: 'allowed' | 'capability-missing' | 'class-forbidden';
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

// ─── NUB Enforcement Gate (NIP-5D) ───────────────────────────────────────────

/**
 * Enforcement gate configuration for NIP-5D NUB handlers.
 * Uses windowId for identity resolution instead of pubkey (which is '' in NIP-5D sessions).
 *
 * @param checkAcl - The ACL check function
 * @param resolveIdentityByWindowId - Maps windowId to identity (dTag, aggregateHash, class). Returns
 *   class posture inline (v1.7 CLASS-03) so the NUB gate can pre-filter class-forbidden capabilities
 *   before consulting the ACL check. null class = permissive default (D2).
 * @param onAclCheck - Optional audit callback, called on every enforceNub() check
 */
export interface NubEnforceConfig {
  checkAcl: AclChecker;
  resolveIdentityByWindowId: (windowId: string) => { dTag: string; aggregateHash: string; class: NappletClass } | undefined;
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
    const nappletClass: NappletClass = entry?.class ?? null;

    // CLASS-03 / D6: class check BEFORE capability check. Class-forbidden
    // short-circuits the gate - capability is not consulted. null is the
    // permissive default (D2): no class restriction applies.
    if (nappletClass !== null) {
      const allowlist = CLASS_CAPABILITY_ALLOWLIST[nappletClass];
      // Unknown class token -> treat as maximally restrictive (deny all).
      if (!allowlist || !allowlist.has(capability)) {
        const identity = { pubkey: '', dTag, hash: aggregateHash };
        if (onAclCheck) {
          onAclCheck({
            identity,
            capability,
            decision: 'deny',
            message,
            reason: 'class-forbidden',
          });
        }
        return { allowed: false, capability, reason: 'class-forbidden' };
      }
    }

    // Capability check (unchanged from pre-v1.7 except for propagating reason).
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

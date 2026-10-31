/**
 * @kehto/acl — Experimental (out-of-tree) NAP extension namespace.
 *
 * Spec gap: napplet/naps master `43cb3a4` defines domains through its registry
 * (`README.md`) and discovery through presence in the web projection, but no
 * experimental-domain naming or extension capability vocabulary. Kehto reserves
 * a bounded local policy until an upstream convention exists:
 *
 * - Experimental domains use the `x-` prefix: `x-echo`, `x-weather-feed`.
 * - Extension capabilities are scoped to their own domain: `x-echo:send`.
 * - An extension can never shadow, alias, or redefine a registry NAP domain,
 *   an in-tree Kehto domain, or any built-in capability string.
 *
 * Extension grants are stored as explicit per-identity decisions in
 * {@link AclEntry.ext}, never as bits, so the built-in bitfield (through
 * `1 << 27`, `llm:generate`) keeps its persisted meaning.
 *
 * Pure and dependency-free, like the rest of `@kehto/acl`.
 *
 * @module
 */

import { ALL_CAPABILITIES } from './capabilities.js';
import { toKey } from './check.js';
import { CAP_ALL, DEFAULT_QUOTA, type AclEntry, type AclState, type Identity } from './types.js';

/** Prefix reserved for experimental NAP domains hosted by Kehto. */
export const EXTENSION_DOMAIN_PREFIX = 'x-' as const;

/** An experimental extension capability string, `x-<name>:<action>`. */
export type ExtensionCapability = `x-${string}:${string}`;

/**
 * Domains an extension can never claim, alias (`x-<name>`), or shadow.
 *
 * Contains every domain in the napplet/naps registry at master `43cb3a4`,
 * every Kehto in-tree domain (including draft NAP-LLM), and retired or
 * adapter-owned names (`signer`, `perm`).
 */
export const RESERVED_NAP_DOMAINS: readonly string[] = Object.freeze([
  // napplet/naps registry (README.md at 43cb3a4)
  'shell', 'intent', 'inc', 'theme', 'relay', 'identity', 'storage', 'keys', 'media',
  'notify', 'resource', 'config', 'upload', 'value', 'outbox', 'cvm', 'link', 'pow', 'display',
  // Kehto in-tree domains (draft or proposal NAPs)
  'common', 'lists', 'serial', 'ble', 'webrtc', 'dm', 'count', 'fs', 'gamepad', 'llm',
  // Retired or adapter-owned names
  'signer', 'perm', 'napplet', 'x',
]);

const DOMAIN_PATTERN = /^x-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ACTION_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const BUILT_IN_CAPABILITIES: ReadonlySet<string> = new Set(ALL_CAPABILITIES);

/**
 * Explain why a proposed extension domain is not acceptable.
 *
 * @param domain - Proposed bare domain, e.g. `x-echo`.
 * @returns `null` when the domain is acceptable, otherwise a reason.
 * @example
 * ```ts
 * validateExtensionDomain('x-echo'); // null
 * validateExtensionDomain('llm');    // 'llm is a reserved NAP domain; …'
 * ```
 */
export function validateExtensionDomain(domain: string): string | null {
  if (typeof domain !== 'string' || domain.length === 0) return 'extension domain must be a non-empty string';
  if (RESERVED_NAP_DOMAINS.includes(domain)) {
    return `${domain} is a reserved NAP domain; experimental domains must use the ${EXTENSION_DOMAIN_PREFIX} prefix`;
  }
  if (!domain.startsWith(EXTENSION_DOMAIN_PREFIX)) {
    return `${domain} must use the reserved ${EXTENSION_DOMAIN_PREFIX} prefix for experimental domains`;
  }
  if (!DOMAIN_PATTERN.test(domain) || domain.length > 64) {
    return `${domain} must match x-<lowercase-name> (a-z, 0-9 and single hyphens, at most 64 characters)`;
  }
  const aliased = domain.slice(EXTENSION_DOMAIN_PREFIX.length);
  if (RESERVED_NAP_DOMAINS.includes(aliased)) {
    return `${domain} aliases the reserved NAP domain ${aliased}`;
  }
  return null;
}

/**
 * Test whether a string is an acceptable experimental extension domain.
 *
 * @param domain - Candidate bare domain.
 * @returns `true` for an `x-` domain that collides with nothing reserved.
 * @example
 * ```ts
 * isExtensionDomain('x-echo'); // true
 * isExtensionDomain('x-llm');  // false (alias of llm)
 * ```
 */
export function isExtensionDomain(domain: string): boolean {
  return validateExtensionDomain(domain) === null;
}

/**
 * Explain why a proposed extension capability is not acceptable.
 *
 * @param capability - Proposed capability, e.g. `x-echo:send`.
 * @param domain - When given, the capability must belong to this domain.
 * @returns `null` when acceptable, otherwise a reason.
 * @example
 * ```ts
 * validateExtensionCapability('x-echo:send', 'x-echo'); // null
 * validateExtensionCapability('llm:generate');          // built-in, rejected
 * ```
 */
export function validateExtensionCapability(capability: string, domain?: string): string | null {
  if (typeof capability !== 'string') return 'extension capability must be a string';
  if (BUILT_IN_CAPABILITIES.has(capability)) {
    return `${capability} is a built-in capability and cannot be redefined by an extension`;
  }
  const separator = capability.indexOf(':');
  if (separator <= 0 || capability.indexOf(':', separator + 1) !== -1) {
    return `${capability} must have the form x-<domain>:<action>`;
  }
  const owner = capability.slice(0, separator);
  const action = capability.slice(separator + 1);
  const domainProblem = validateExtensionDomain(owner);
  if (domainProblem) return `${capability}: ${domainProblem}`;
  if (!ACTION_PATTERN.test(action) || action.length > 64) {
    return `${capability} action must match <lowercase-name>`;
  }
  if (domain !== undefined && owner !== domain) {
    return `${capability} belongs to ${owner}, not ${domain}; extensions cannot borrow other domains' capabilities`;
  }
  return null;
}

/**
 * Test whether a string is a valid experimental extension capability.
 *
 * @param capability - Candidate capability string.
 * @returns `true` for `x-<domain>:<action>` with an acceptable domain.
 * @example
 * ```ts
 * isExtensionCapability('x-echo:send'); // true
 * isExtensionCapability('relay:read');  // false
 * ```
 */
export function isExtensionCapability(capability: string): capability is ExtensionCapability {
  return validateExtensionCapability(capability) === null;
}

function entryFor(state: AclState, key: string): AclEntry {
  return state.entries[key] ?? {
    caps: state.defaultPolicy === 'permissive' ? CAP_ALL : 0,
    blocked: false,
    quota: DEFAULT_QUOTA,
  };
}

function withDecision(state: AclState, identity: Identity, capability: string, granted: boolean): AclState {
  if (!isExtensionCapability(capability)) return state;
  const key = toKey(identity);
  const entry = entryFor(state, key);
  return {
    ...state,
    entries: {
      ...state.entries,
      [key]: { ...entry, ext: { ...entry.ext, [capability]: granted } },
    },
  };
}

/**
 * Check an extension capability for an identity.
 *
 * Decision: a blocked entry denies; an explicit decision in `entry.ext` wins;
 * otherwise the default policy applies (permissive allows, restrictive denies).
 * Invalid or built-in capability strings are always denied here.
 *
 * @param state - Current ACL state.
 * @param identity - Napplet identity.
 * @param capability - Extension capability, `x-<domain>:<action>`.
 * @returns `true` when the identity holds the extension capability.
 * @example
 * ```ts
 * let state = createState('restrictive');
 * state = grantExtension(state, id, 'x-echo:send');
 * checkExtension(state, id, 'x-echo:send'); // true
 * ```
 */
export function checkExtension(state: AclState, identity: Identity, capability: string): boolean {
  if (!isExtensionCapability(capability)) return false;
  const entry = state.entries[toKey(identity)];
  if (!entry) return state.defaultPolicy === 'permissive';
  if (entry.blocked) return false;
  const decision = entry.ext && Object.hasOwn(entry.ext, capability) ? entry.ext[capability] : undefined;
  return decision === undefined ? state.defaultPolicy === 'permissive' : decision === true;
}

/**
 * Grant an extension capability to an identity.
 *
 * @param state - Current ACL state.
 * @param identity - Napplet identity.
 * @param capability - Extension capability; invalid strings leave state unchanged.
 * @returns New AclState with the explicit grant recorded.
 * @example
 * ```ts
 * const next = grantExtension(state, id, 'x-echo:send');
 * ```
 */
export function grantExtension(state: AclState, identity: Identity, capability: string): AclState {
  return withDecision(state, identity, capability, true);
}

/**
 * Revoke an extension capability from an identity.
 *
 * @param state - Current ACL state.
 * @param identity - Napplet identity.
 * @param capability - Extension capability; invalid strings leave state unchanged.
 * @returns New AclState with the explicit denial recorded.
 * @example
 * ```ts
 * const next = revokeExtension(state, id, 'x-echo:send');
 * ```
 */
export function revokeExtension(state: AclState, identity: Identity, capability: string): AclState {
  return withDecision(state, identity, capability, false);
}

/**
 * Keep only well-formed extension decisions from untrusted persisted data.
 *
 * @param value - Raw `ext` value from storage.
 * @returns A frozen decision record, or `undefined` when empty or invalid.
 * @example
 * ```ts
 * sanitizeExtensionDecisions({ 'x-echo:send': true, 'relay:read': true });
 * // { 'x-echo:send': true }
 * ```
 */
export function sanitizeExtensionDecisions(value: unknown): Readonly<Record<string, boolean>> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const result: Record<string, boolean> = {};
  for (const [capability, decision] of Object.entries(value)) {
    if (typeof decision === 'boolean' && isExtensionCapability(capability)) result[capability] = decision;
  }
  return Object.keys(result).length > 0 ? Object.freeze(result) : undefined;
}

/**
 * Merge two extension decision records (used when migrating entries).
 *
 * Deny wins: an explicit revocation (`false`) on either side records user
 * intent, so it wins over a grant whatever the order. This differs from the
 * built-in bitfield, which migration merges as a union. A decision recorded on
 * only one side is kept.
 *
 * @param a - First record.
 * @param b - Second record.
 * @returns Merged record, or `undefined` when both are empty.
 * @example
 * ```ts
 * mergeExtensionDecisions({ 'x-a:b': false }, { 'x-a:b': true }); // { 'x-a:b': false }
 * mergeExtensionDecisions({ 'x-a:b': true }, { 'x-a:c': true });  // { 'x-a:b': true, 'x-a:c': true }
 * ```
 */
export function mergeExtensionDecisions(
  a: Readonly<Record<string, boolean>> | undefined,
  b: Readonly<Record<string, boolean>> | undefined,
): Readonly<Record<string, boolean>> | undefined {
  if (!a) return b;
  if (!b) return a;
  const merged: Record<string, boolean> = { ...a };
  for (const [capability, decision] of Object.entries(b)) {
    merged[capability] = Object.hasOwn(merged, capability) ? merged[capability] === true && decision : decision;
  }
  return merged;
}

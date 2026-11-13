/**
 * Kehto experimental namespace: opt-in, opinionated host policies that are not
 * part of the NIP-5D baseline.
 *
 * Each policy is a named flag, **off by default**, so enabling one is a
 * deliberate host choice and downstream consumers are never forced into an
 * opinion. Experimental flags may change behavior or be removed without a major
 * version bump; treat them as unstable. Enabling one can change the napplet
 * execution contract — each flag documents its cost.
 *
 * This is distinct from the NAP `x-` extensions, which are experimental
 * *protocol domains* a napplet speaks to (`ShellAdapter.extensions`). The
 * experimental namespace is for host hardening and behavior policies that a
 * napplet does not negotiate.
 *
 * @see docs/policies/EXPERIMENTAL.md — the convention
 */
export interface NappletExperimentalOptions {
  /**
   * Lock nested-browsing-context creation in the napplet realm. A Trusted Types
   * `default` policy and pinned element factories (`createElement`,
   * `createElementNS`, `createDocument`) reject frame elements before any
   * napplet script runs, and the host rejects static frame markup before load.
   *
   * Opinionated and off by default: it adds `require-trusted-types-for 'script';
   * trusted-types default` to the napplet CSP, so it changes the napplet
   * execution contract and is incompatible with frameworks that register their
   * own Trusted Types policy (e.g. Angular). Canonical string-sink use is
   * unaffected (the default policy passes non-frame HTML through), but a string
   * sink carrying a literal frame-tag token is rejected even in text or an
   * attribute.
   *
   * @see docs/policies/NIP-5D-CONFORMANCE.md — "Nested browsing contexts"
   */
  readonly nestedContextLock?: boolean;
}

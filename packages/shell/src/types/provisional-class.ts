// provisional — pending @napplet/nub/class publish
/**
 * @file provisional-class.ts
 *
 * TODO: swap import to @napplet/nub/class when published at ^0.3.0
 *
 * NUB-CLASS wire types. Canonical source does not yet exist in any published
 * form (neither npm @napplet/nub@0.2.1 nor napplet/napplet main branch contain
 * a class subpath as of 2026-04-24). These shapes are derived from:
 *   - NIP-5D class-posture delegation paragraph (Security Considerations §)
 *   - kehto v1.7 Phase 38 requirements (CLASS-01..CLASS-06)
 *
 * Downstream consumers (Phase 38 `shell-bridge.ts`, `enforce.ts`, demo
 * `shell-host.ts`) import from this module. When upstream publishes
 * `@napplet/nub/class` at ^0.3.0, this file is deleted and imports swap to
 * the canonical subpath (single atomic bump per v1.7 milestone close policy).
 */

/**
 * A napplet class identifier. `null` represents the permissive default (no
 * class assigned). Class strings are NUB-defined tokens such as `'class-1'`,
 * `'class-2'`, etc. — NIP-5D delegates taxonomy to NUB specs.
 */
export type NappletClass = string | null;

/**
 * Payload attached to `shell.init` (inline, not a separate envelope) carrying
 * the shell-resolved class posture. The resolved value is stored on the
 * session entry BEFORE `shell.init` is sent, per CLASS-02 (no async
 * `class.assigned` envelope).
 */
export interface ClassAssignmentPayload {
  /** The resolved class, or `null` for the permissive default. */
  class: NappletClass;
}

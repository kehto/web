/**
 * @file internal-class.ts
 *
 * Kehto-internal shell-side class-posture model. Per PROJECT.md Decision #31,
 * this is NOT a staging-ground duplicate of upstream `@napplet/nub/class`:
 * upstream's `NappletClass` is a napplet-side accessor interface
 * (`{ class: number | undefined }`), whereas kehto's `NappletClass` here is
 * a shell-side session-label string union (`'class-1' | 'class-2' | null`)
 * used by `enforce.ts` for the capability allowlist and by `shell-host.ts`
 * for the per-dTag class map.
 *
 * The two models serve different roles and intentionally diverge. Upstream's
 * accessor type is consumed via `@napplet/nub/class` when kehto's SDK wires
 * the napplet-side mount point. This file owns the shell-side enforcement
 * label and is not slated for retirement.
 *
 * Downstream consumers (Phase 38 `shell-bridge.ts`, `enforce.ts`, demo
 * `shell-host.ts`) import from this module.
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

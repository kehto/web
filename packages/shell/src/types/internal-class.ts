/**
 * @file internal-class.ts
 *
 * Kehto-internal shell-side class-posture export. Per PROJECT.md Decision #31,
 * this is NOT a staging-ground duplicate of upstream `@napplet/nub/class`:
 * upstream's `NappletClass` is a napplet-side accessor interface, whereas
 * kehto's runtime `NappletClass` is the shell-side session-label string type
 * used by enforcement and host demo code.
 *
 * The upstream and kehto models serve different roles and intentionally
 * diverge. This module preserves the shell import path while re-exporting the
 * canonical runtime-owned type.
 *
 * Downstream consumers (Phase 38 `shell-bridge.ts`, `enforce.ts`, demo
 * `shell-host.ts`) import from this module.
 */

import type { NappletClass } from '@kehto/runtime';

export type { NappletClass };

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

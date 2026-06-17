---
"@kehto/shell": patch
---

fix(shell): NAP-SHELL handshake correctness (shell.init exactly-once + class number|null)

Two surgical conformance corrections to the `shell.init` / `shell.ready`
handshake, both isolated to the shell-side `shell.init` build path in
`shell-ready.ts`:

- **SHELL-01 (gap G1) — `shell.init` exactly-once.** `handleShellReady`
  previously posted `shell.init` on every `shell.ready`, so a duplicate
  `shell.ready` from the same window resent `shell.init` (a NAP-SHELL MUST
  violation). A per-`windowId` `initSent` guard now makes a duplicate
  `shell.ready` idempotent: no resend, no duplicate session.

- **SHELL-02 (gap G2) — `class` wire type.** The `class` field in the
  `shell.init` wire payload is now `number | null` (an opaque integer posture
  code, or `null` for the permissive default), per the NAP-SHELL contract,
  instead of the internal string label. A wire-only `classToWireCode` mapping
  (`'class-1' -> 1`, `'class-2' -> 2`, `null -> null`) is applied solely at the
  `shell.init` build site.

The internal `NappletClass` label type and all `enforce.ts` / ACL class logic
are unchanged — enforcement still keys on the internal label stored on the
session entry. The `{naps, nubs, sandbox}` capability shape and the naps+nubs
dual-emit are untouched. This is a conformance correction of a wire value no
released shim relied on (installed shim 0.5.0 stores `class` opaquely; no test
asserted a string class on the wire), hence `patch`.

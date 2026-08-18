# Phase 86: NAP-SHELL Handshake Correctness - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped; spec derived from REQUIREMENTS.md + audit)

<domain>
## Phase Boundary

Bring the `shell.init` / `shell.ready` handshake into conformance with the merged **NAP-SHELL** spec (the mandatory bootstrap NAP). Two corrections only:
- **SHELL-01 (gap G1):** `shell.init` MUST be sent exactly once per napplet lifecycle. A duplicate `shell.ready` from the same window must be idempotent — no second session, no `shell.init` resend.
- **SHELL-02 (gap G2):** the `class` field carried in `shell.init` must conform to the NAP-SHELL wire contract `number | null` (opaque integer class code, or `null` for the permissive default).

Out of scope: capability payload shape (`{naps,nubs,sandbox}` is non-normative and conformant), terminology migration (Phase 88), archetypes (Phase 87).
</domain>

<decisions>
## Implementation Decisions

### G1 — shell.init exactly-once (SHELL-01)
- Current bug: `packages/shell/src/shell-ready.ts` `handleShellReady` calls `postShellInit(...)` unconditionally on every `shell.ready`. Session registration IS guarded (`registerNip5dSessionIfNeeded` early-returns when a session exists) but the init post is not.
- Fix: track per-windowId "init already sent" and skip `postShellInit` on subsequent `shell.ready` for the same window. A `Set<string>` in the bridge/handler closure or a flag on the session entry are both acceptable — Claude's discretion, but prefer the least-invasive option that the existing tests can exercise.
- Regression test: assert exactly one `shell.init` postMessage across two `shell.ready` deliveries from one window.

### G2 — class number|null (SHELL-02)
- Current: `NappletClass = string | null` (`packages/runtime/src/types.ts:20`); the resolved class (string label e.g. `'class-1'`/`'class-2'`) is emitted directly in `shell.init` (`shell-ready.ts:104-113`).
- NAP-SHELL contract: `class: number | null` — an opaque integer the runtime assigns; `null` = permissive default.
- Fix (Claude's discretion on mechanism): map the internal class label to a numeric wire code when building the `shell.init` payload, while preserving the internal `NappletClass` label type used by ACL/enforce. e.g. `'class-1' → 1`, `'class-2' → 2`, `null → null`. Keep ACL/enforce.ts class logic untouched (it keys on the internal label). Only the wire value emitted in `shell.init` changes to `number | null`. Add a test asserting the emitted `class` is `number | null`.
- Verify the napplet-side consumer (shim 0.5.0) tolerates a numeric class (it stores it opaquely; confirm no test asserts a string class on the wire — if one does, update it).

### Constraints
- Keep `naps`+`nubs` dual-emit (installed shim 0.5.0). Do NOT touch capability arrays.
- Full unit + e2e suite stays green; add a changeset for `@kehto/shell` (and `@kehto/runtime` if the class mapping touches it).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/NIP-5D-2303-DELTA-AUDIT.md` — gaps G1 (NAP-SHELL §1 audit, file:line) and G2 (class type), with exact current-state evidence.
- `.planning/REQUIREMENTS.md` — SHELL-01, SHELL-02 acceptance.
- `packages/shell/src/shell-ready.ts` — `handleShellReady`, `registerNip5dSessionIfNeeded`, `postShellInit` (the resend bug + class emission).
- `packages/shell/src/shell-init.ts` — `buildShellCapabilities` (capabilities payload — do not change shape).
- `packages/shell/src/shell-bridge.ts` — inbound `shell.ready` dispatch (line ~241).
- `packages/runtime/src/types.ts` — `NappletClass = string | null` (line 20).
- `packages/shell/src/types/internal-class.ts` — shell-side class export.
- `packages/runtime/src/enforce.ts` — class enforcement (keys on internal label; do not change semantics).
- `packages/shell/src/shell-ready.test.ts`, `packages/shell/src/shell-bridge.test.ts`, `packages/shell/src/shell-init.test.ts` — existing handshake tests to extend.
</canonical_refs>

<specifics>
## Specific Ideas

- SHELL-01 regression test belongs alongside the existing `shell-bridge.test.ts` "does not overwrite an existing session entry" test (~line 536) — add a sibling asserting one `shell.init` across two `shell.ready`.
- SHELL-02: a focused unit test on the `shell.init` payload `class` field type (`typeof === 'number' || === null`).
</specifics>

<deferred>
## Deferred Ideas

None — terminology, archetypes, and docs are separate phases (88, 87, 89).
</deferred>

---

*Phase: 86-nap-shell-handshake-correctness*
*Context gathered: 2026-06-17 (discuss skipped; spec from requirements + audit)*

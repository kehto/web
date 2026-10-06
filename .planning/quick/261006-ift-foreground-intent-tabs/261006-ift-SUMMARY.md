---
quick_id: 261006-ift
status: complete
completed: 2026-10-06
code_commit: e99451be
docs_commit: bc5b7385
---

# Quick Task 261006-ift Summary

An intent dispatch in Paja now always selects the handler's tab. The reuse
gate that made `behavior.focus: false` mean "deliver into the tab behind this
one" is gone, so a caller that clicks through to another napplet sees that
napplet instead of a delivered payload it cannot see.

## What was wrong

PR #275 fixed the invisible-delivery case for callers that omitted `focus` or
set it `true`, but kept an opt-out: an explicit `behavior.focus: false`
preserved the active tab and delivered anyway. In a single-stage tab workspace
that opt-out has no visible form — the handler receives the convention and
reports `handled: true` while the user's stage still shows the caller. Napplets
that read `focus: false` the window-manager way ("show the target, do not
replace my window") hit it on every click, which is how the report arrived.

## What changed

- `browser-intent-host.ts` foregrounds the reused handler and persists the
  selection unconditionally, matching the cold/new-tab path. No readiness,
  generation, source-binding, or retry policy moved.
- Reused targets keep the caller's tab open. Paja tabs never replace one
  another, so the "do not replace the caller" half of a `focus: false` hint is
  still honored; only the invisible-delivery reading is dropped.
- `behavior.focus` is now documented as a hint that Paja's workspace policy
  overrides, in the source comment, `docs/packages/paja.md`, the package
  README, and the `@kehto/paja` patch changeset.
- The Playground reuse seam states and guards the same rule, so both Kehto
  hosts select a live target regardless of the focus hint.

## Specification check

Owning spec: `napplet/naps` `NAP-INTENT.md`.

- Merged master `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2` (blob
  `3bddd41697d02d825d45191d0122292f7bcaaac6`) — `focus` = "Focus the target
  surface"; `invoke` "creates or focuses its window"; dispatch is "a navigation
  and focus-stealing action".
- Draft `nap-intent` `a718915ddefa2f03a0126579601f59d8bd86f7c4` — "`behavior`
  fields are hints. Runtime workspace and lifecycle policy remain
  authoritative."

Result: conformant under the draft's hints-versus-policy rule. `focus: false`
is not ignored as a protocol field; it is bounded by the host's workspace
policy, exactly as the spec allows, and the bounded choice is documented at the
call site, in the package docs, and in the changeset. No upstream correction is
requested: the spec already assigns this decision to the runtime.

## Verification

- `pnpm vitest run packages/paja/src/browser-host.test.ts` — 19 passed
- `pnpm test:unit` — 149 files, 1,797 tests passed
- `pnpm type-check` — 17 tasks passed
- PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=… npx playwright test
  tests/e2e/paja-runtime-pointer.spec.ts tests/e2e/paja-single-window.spec.ts
  — 12 passed (the reused-tab case reproduced the bug before the fix: handler
  iframe still hidden on the `focus: false` iteration)
- `pnpm docs:check` — 9 package docs, TypeDoc targets, VitePress routes passed
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json` — 100/100,
  zero findings

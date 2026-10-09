---
quick_id: 261006-ift
status: complete
completed: 2026-10-06
code_commit: e99451be
refactor_commit: 4ebf3604
docs_commit: da8dc309
regression_commit: 99c7488c
rebased_onto: bbbca649 (origin/main, "feat(paja): add a collapsible development console (#274)")
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
- `recordInstalledIntentSurface()` now owns the `paja.pointer.resolved` entry
  and the missing-INC warning. `browser-host.ts` is already over the 700-line
  reviewability limit, so the install diagnostics no longer grow it (755 lines,
  down from 758 on main); the changed-file slop gate is back to 100/100.
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

Rebased onto `origin/main` `bbbca649` (the merged collapsible-console PR #274
landed in `browser-host.ts`, `browser-host.test.ts`, the package docs, and the
README, so the rebase was required before CI could run at all).

- `pnpm vitest run packages/paja/src/browser-host.test.ts` — 19 passed
- `pnpm test:unit` — 150 files, 1,808 tests passed
- `pnpm build` — 32 tasks passed
- `pnpm type-check` — 17 tasks passed
- PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=… npx playwright test
  tests/e2e/paja-runtime-pointer.spec.ts tests/e2e/paja-single-window.spec.ts
  — 14 passed (the reused-tab case reproduced the bug before the fix: handler
  iframe still hidden on the `focus: false` iteration)
- `pnpm docs:check` — 9 package docs, TypeDoc targets, VitePress routes passed
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json` — 100/100,
  zero findings

## Review follow-up: intent-surface warning regression (99c7488c)

PR review flagged that the missing-INC warning branch in
`recordInstalledIntentSurface()` had no coverage: the Playwright spec only
loaded manifests with no archetypes (`intentEligible: false` via the empty
archetype list) or archetypes plus `inc` (eligible), so the
archetypes-without-`inc` shape — the only path that fires the warning — was
never exercised, and no unit test referenced the function or the warning
string.

- `packages/paja/src/browser-intent-host.test.ts` (new) covers all three
  manifest shapes against `recordInstalledIntentSurface()`: archetypes
  without `inc` warns once and logs `intentEligible: false`; archetypes with
  `inc` logs `intentEligible: true` without warning; no archetypes never
  warns. The wrong-manifest cases are pinned by `not.toHaveBeenCalled()`.
- `tests/e2e/paja-runtime-pointer.spec.ts` loads a third fixture,
  `unroutable-target` (`note` archetype, `requires: ["theme"]`), in the
  reused-handler spec and asserts its `paja.pointer.resolved` row plus the
  browser console warning. The fixture declares a distinct archetype so it
  never competes with `profile-target` for the delivered intent.

Verification: `pnpm build` (32 tasks), `pnpm type-check` (17 tasks),
`pnpm test:unit` (151 files, 1,811 tests), the pointer Playwright spec (4
passed), and the changed-file slop gate (100/100) all green.

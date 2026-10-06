---
quick_id: 261006-ift
status: complete
description: Foreground a reused intent handler tab for every behavior.focus hint
---

# Quick Task 261006-ift Plan

Reported behavior: clicking an intent that targets a *different, already-open*
napplet delivers the payload but leaves the handler's tab in the background, so
nothing visibly happens. The reuse path added by PR #275 foregrounded the
handler only when the caller omitted `behavior.focus` or set it `true`; an
explicit `false` kept the current tab selected and delivered into a hidden tab.

## Task 1: Establish the spec position

- Read the owning NAP: `napplet/naps` `NAP-INTENT.md`, merged master
  `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2` (blob
  `3bddd41697d02d825d45191d0122292f7bcaaac6`) and the draft `nap-intent`
  branch `a718915ddefa2f03a0126579601f59d8bd86f7c4`.
- Confirm `behavior` fields are hints that "runtime workspace and lifecycle
  policy remain authoritative", that `invoke` "creates or focuses its window",
  and that dispatch is a navigation.
- Conclusion: a single-stage tab workspace has no visible-but-unselected
  surface, so honoring `focus: false` as hidden delivery contradicts the
  runtime policy the spec defers to. Record it as a documented workspace-policy
  decision, not new protocol behavior.

## Task 2: Reproduce in the browser

- Flip the existing reused-tab Playwright case to require the handler tab for
  `undefined`, `false`, and `true`, and watch it fail on the `false` iteration
  with the handler iframe still hidden. That is the reported bug.

## Task 3: Fix the reuse path

- Remove the `focus !== false` gate in `browser-intent-host.ts` so the reuse
  path always calls `activateRuntimeTab()` and persists the selection, matching
  the new-tab path. The caller's tab stays open, so nothing is replaced.
- Keep the existing readiness, generation, source-binding, and retry policy
  untouched.

## Task 4: Guards, docs, and parity

- Unit-test `focus: false`, `focus: true`, and unset on the reuse path:
  caller hidden, handler visible, live window swapped, delivery sent once.
- Extend the browser spec to all three hints with iframe visibility, active tab,
  stable tab identity, and persisted `activeIndex`.
- Document the workspace policy in `docs/packages/paja.md`, the package README,
  and the changeset, and state the same policy at the Playground reuse seam with
  a unit guard.

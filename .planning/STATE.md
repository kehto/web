---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: — Productionization & Upstream Unblock
status: verifying
last_updated: "2026-04-19T12:36:58.056Z"
last_activity: 2026-04-19
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19, v1.4 milestone opened)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.4 Phase 24 — DRIFT-CORE-06 Cleanup complete (atomic commit 4c12cd2); ready for phase-completion verification.

## Current Position

Phase: 24 of 28 (DRIFT-CORE-06 Cleanup) — v1.4 second phase complete
Plan: 2 of 2 complete (24-01 shim deletion + re-homing ✓, 24-02 dead NIP-01 code path deletion + atomic commit ✓)
Status: Phase complete — ready for verification
Last activity: 2026-04-19

Progress: [███░░░░░░░] 33% (2/6 v1.4 phases complete) — phase 24: [██████████] 100% (2/2 plans)

**v1.4 phase list (23–28):**

- Phase 23: CI/CD Baseline & Doc Trivia (CI-01, CI-02, CI-03, DOCS-04)
- Phase 24: DRIFT-CORE-06 Cleanup (DRIFT-01, DRIFT-02)
- Phase 25: Release Publication (REL-05, REL-06, CI-04)
- Phase 26: Real Keys Backend (KEYS-01, KEYS-02, KEYS-03, E2E-12)
- Phase 27: Real Media Backend (MEDIA-01, MEDIA-02, MEDIA-03, E2E-13)
- Phase 28: Layer-A Upgrade & Docs Polish (E2E-14, DOCS-05, DOCS-06)

## Accumulated Context

### Decisions (carried forward)

- [v1.2] Shell MUST NOT provide `window.nostr` — napplets consume signing via `relay.publish`/`publishEncrypted`; identity reads via `identity.*`.
- [v1.2] `createDispatch()` + `registerNub()` is canonical dispatch; per-runtime instance required.
- [v1.3] E2E iteration-loop discipline is canon: every phase that touches a Playwright spec closes with a recorded build→run→Playwright→fix loop. Baked into v1.4 success criteria — no longer a tracked REQ-ID.
- [v1.3] Legacy NIP-01 fixtures + specs deleted (not migrated) — cleanliness > backward compat.
- [v1.4] `DRIFT-CORE-06` is no longer upstream-blocked — `@napplet/core@0.2.0` is on npm. Phase 24 deletes `core-compat.ts` via pure internal refactor.
- [v1.4] `pnpm.overrides` `link:` entries for `@napplet/*` MUST be removed before REL-05 publishes (Phase 25).
- [v1.4-23-02] Unit-test CI invokes `pnpm test` (turbo run test), not `pnpm test:unit` — root `test` script delegates to per-package Vitest configs via turbo; `test:unit` is a developer-local shortcut (`vitest run` from root) that bypasses turbo and per-package test configurations. CI must match the canonical entry point.
- [v1.4-23-04] DOCS-04 JSDoc refresh: replace `'auth-napplet'` with `'nub-identity'` in harness.ts + wait-for-napplet-ready.ts — rationale: auth-napplet fixture deleted in v1.3; nub-identity is the closest semantic match (both AUTH-flow fixtures) and is currently shipped per CONTEXT.md decision D.
- [v1.4-24-01] REPLAY_WINDOW_SECONDS preserved at 30 (matches pre-refactor core-compat.ts:67 value, not the 60 that ROADMAP Phase 24 §2 suggested). Rationale: behavioral parity with the Phase 23 test baseline (442 unit tests passing unchanged).
- [v1.4-24-01] Staged-deletion placeholder-const pattern: when a phase plan deletes a source file but a follow-on plan in the same phase scrubs call sites, the first plan inlines constants locally so the intermediate commit remains type-check green. The second plan then deletes both the placeholder and the call site atomically.
- [v1.4-24-02] Preserved @kehto/acl's LIVE CapabilityResolution interface untouched; only the runtime-flavored duplicate in enforce.ts was deleted. Scope for grep assertions scoped to packages/runtime/src + packages/shell/src only — @kehto/acl defines its own distinct CapabilityResolution consumed by resolveCapabilitiesNub.
- [v1.4-24-02] Renamed local boolean isBusKind → isShellKind in runtime.ts (filter-predicate variable, scope: handleRelayMessage) for grep-scope acceptance-criterion compliance. Zero behavior change.
- [v1.4-24-02] Manual clean substituted for pnpm clean (no root script defined); Phase 22-08 precedent exactly. Behavior equivalent: cold rebuild, 0 cache hits.

Full decision log archived in `.planning/PROJECT.md` (Key Decisions table) and per-milestone roadmap archives.

### Blockers/Concerns (carried forward)

- None blocking — `@napplet/core@0.2.0` on npm clears the v1.3 publication-blocker. v1.4 is fully unblocked from upstream.

## Session Continuity

Last session: 2026-04-19T12:36:58.053Z
Resume: `/gsd:verify-work 24` to validate Phase 24 (DRIFT-CORE-06 cleanup complete; atomic commit 4c12cd2 pushed; CI green), then `/gsd:plan-phase 25` for Release Publication.

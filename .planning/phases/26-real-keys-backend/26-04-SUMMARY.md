---
phase: 26-real-keys-backend
plan: 04
subsystem: e2e
tags: [e2e-12, hotkey-chord, playwright, iteration-loop, atomic-commit, phase-closure]

requires:
  - phase: 26-01-real-keys-backend
    provides: real document-listener keys-service + keys.action envelope emission
  - phase: 26-02-real-keys-backend
    provides: HostKeysBridge interface + hostBridge option
  - phase: 26-03-real-keys-backend
    provides: hotkey-chord demo napplet + shell wiring + window.__grantKeysForward__ host hook
provides:
  - tests/e2e/hotkey-chord.spec.ts — Layer-B E2E spec asserting full chord-dispatch → SDK onAction → DOM sentinel loop
  - .planning/phases/26-real-keys-backend/26-ITERATION-LOG.md — fresh-build iteration-loop evidence (baseline 47 → 48 passed, delta +1)
  - demo-boot.spec.ts updated to reflect Phase 26's STUB_ONLY_SERVICES demotion (keys graduated from stub)
affects: [Phase 27, v1.4 e2e baseline (47→48), STUB_ONLY_SERVICES status]

tech-stack:
  added: []
  patterns:
    - "Status-sentinel wait in lieu of napplet-ready helper for :4174 demo specs — `toContainText('subscribed')` blocks until SDK AUTH + keys.registerAction round-trip both complete (ROADMAP §4 deviation, canon-aligned with relay-subscribe.spec.ts)"
    - "Pre-installed host hook for capability grants — Plan 26-03's `window.__grantKeysForward__` is invoked from the spec via page.evaluate; no UI-click routing, no ACL-state introspection"
    - "Playwright KeyCode form for keyboard-layout-independent chord synthesis — `Control+Shift+KeyK` not `Control+Shift+K`"
    - "Cascaded test update as in-scope deviation — when a phase deliberately changes topology (keys stub→real), pre-existing assertions that encoded the old topology are updated as part of the same phase's close, NOT treated as out-of-scope regressions"

key-files:
  created:
    - tests/e2e/hotkey-chord.spec.ts — 118 lines; Layer-B spec + docblock describing the full keys.registerAction → keys.action → onAction loop and documenting the ROADMAP §4 waitForNappletReady deviation
    - .planning/phases/26-real-keys-backend/26-ITERATION-LOG.md — phase closure evidence: commands run, results, iteration history, anti-term hygiene grep, new spec evidence
  modified:
    - tests/e2e/demo-boot.spec.ts — asserts keys count=0 stub (was 1) and `.stub-badge` count=1 (was 2) to reflect Phase 26's keys-service graduation from STUB_ONLY_SERVICES

key-decisions:
  - "[v1.4-26-04] demo-boot.spec.ts fix is an IN-SCOPE Rule 1 deviation — the failing assertion is directly caused by Plan 26-03's intentional STUB_ONLY_SERVICES demotion (keys graduated from stub). Per scope-boundary rule (auto-fix only issues directly caused by current task's changes), the fix belongs in Plan 26-04's atomic commit; treating it as out-of-scope would leave a known-red test on the main branch."
  - "[v1.4-26-04] hotkey-chord.spec.ts docblock rephrased 'waitForNappletReady' → 'the napplet-ready helper' to avoid grep-collision with acceptance criterion (grep returns 0 for literal 'waitForNappletReady'). Same Rule 1 bug class as Plan 26-03's docblock-grep deviation — documentation intent preserved."
  - "[v1.4-26-04] Iteration log captures TWO iterations — Iteration 1 exposed the demo-boot failure, Iteration 2 verified the fix green. Records full chronology per canonical iteration-log pattern (Phase 22, Phase 24 precedents)."
  - "[v1.4-26-04] Anti-term grep scope limited to src/ + keys-service.ts + hotkey-chord/index.html (NOT dist/ bundles). The built napplet dist/assets/*.js is a bundled SDK + shim artifact that contains `window.addEventListener('message')` as part of the @napplet/shim runtime — that's expected SDK behavior, not a source-level violation. Phase 22-08 precedent established this scope narrowing."
  - "[v1.4-26-04] Baseline count derived: 47 passed (inherited from v1.3 Phase 22 close, preserved through v1.4 Phases 23/24/25 per each phase's ITERATION-LOG). Final count: 48 passed. Delta: +1 (hotkey-chord.spec.ts addition). The demo-boot.spec.ts fix keeps the suite at the pre-existing 47 count for that spec and adds 1 for the new spec — net delta +1 exactly."

patterns-established:
  - "Cascaded topology-change test updates are in-scope for the phase that changed the topology — keeping green-on-main as an invariant requires the phase that demotes a service from stub to also fix any test encoding the old stub assumption. Documented as a Rule 1 deviation with full diff in the iteration log."
  - "The executor's atomic commit for a Phase-N closing plan may include tests modified outside the plan's files_modified list IF they are directly invalidated by earlier-phase changes. Scope boundary is preserved: only tests encoding assumptions about this phase's deliverables qualify."

requirements-completed: [E2E-12]

duration: 4 min
completed: 2026-04-19
---

# Phase 26 Plan 04: E2E-12 Layer-B Spec + Iteration Loop + Phase Closure Summary

**Shipped `tests/e2e/hotkey-chord.spec.ts` (Layer-B contract covering the full keys.registerAction → page.keyboard.press → SDK onAction → DOM sentinel loop), ran the fresh-build iteration loop (47 → 48 passed, delta +1 exactly), recorded all evidence in `26-ITERATION-LOG.md`, and closed Phase 26 with all four requirement IDs (KEYS-01, KEYS-02, KEYS-03, E2E-12) satisfied.**

## Performance

- **Duration:** 4 min (started 2026-04-19T14:05:55Z, closed 2026-04-19T14:09:40Z)
- **Tasks:** 2 (both autonomous)
- **Files created:** 2 (hotkey-chord.spec.ts, 26-ITERATION-LOG.md)
- **Files modified:** 1 (demo-boot.spec.ts — cascaded in-scope fix)
- **Iterations:** 2 (first exposed demo-boot failure; second green after cascaded fix)

## Accomplishments

- **Created tests/e2e/hotkey-chord.spec.ts (118 lines):**
  - `demoBeforeEach` + frameLocator('#hotkey-chord-frame-container iframe') targeting the :4174 demo.
  - Status-sentinel wait: `#hotkey-chord-status = 'subscribed'` (15s timeout) — blocks until SDK AUTH probe + keys.registerAction round-trip both complete.
  - Baseline sanity: `#hotkey-chord-count = '0'`.
  - Capability grant via `window.__grantKeysForward__()` page.evaluate + truthy return assertion.
  - Chord dispatch: `page.keyboard.press('Control+Shift+KeyK')` (KeyCode form — keyboard-layout-independent).
  - Delivery proof: `#hotkey-chord-count → '1'`, `#hotkey-chord-last` contains `'Ctrl+Shift+K'`.
  - Durability proof: second press → `#hotkey-chord-count → '2'`.
  - Anti-term hygiene filters on console + pageerror (matches relay-subscribe.spec.ts ANTI_TERM_RE).
  - File-level docblock documents the full loop under test (napplet boot, chord dispatch) + ROADMAP §4 deviation (no `__nappletReady__` on :4174 demo).
- **Executed fresh-build iteration loop (ROADMAP Phase 26 §5):**
  - Manual clean (no root `pnpm clean` script — Phase 22-08 + 24-02 precedent): `rm -rf packages/*/dist packages/*/.turbo tests/fixtures/napplets/*/dist tests/e2e/harness/dist tests/e2e/harness/.turbo apps/*/dist apps/*/.turbo apps/demo/napplets/*/dist apps/demo/napplets/*/.turbo node_modules/.cache` + `.turbo` find-delete.
  - `pnpm build` → 21/21 cold (0 cached) / 5.58s. New `@kehto/demo-hotkey-chord:build` task = +1 vs Phase 25 baseline of 20.
  - `pnpm test:e2e` → 48 passed / 0 failed / 0 skipped / 16.8s. Delta = +1 (hotkey-chord.spec.ts) vs baseline 47.
- **Fixed cascaded demo-boot.spec.ts assertion** (in-scope Rule 1 deviation, see Deviations section).
- **Wrote 26-ITERATION-LOG.md** mirroring Phase 22 + Phase 24 structure: Summary Table, Capability-Gate Handling, ROADMAP §4 Deviation, Fresh-Build Iteration Loop (Clean/Build/E2E), Iteration History (both iterations), Anti-Term Hygiene Grep Evidence, New Spec Evidence, Closing Notes.
- **Phase 26 closure:** all four requirement IDs (KEYS-01, KEYS-02, KEYS-03, E2E-12) satisfied; STUB_ONLY_SERVICES transitions from `['keys', 'media']` to `['media']` on main.

## Task Commits

This plan performs the atomic commit for all four Phase 26 plans (26-01 through 26-04) per the execution prompt's multi-plan staging model — prior plans intentionally left the working tree uncommitted.

- **Task 1:** Write tests/e2e/hotkey-chord.spec.ts (Layer-B spec) — uncommitted during task; rolled into atomic commit
- **Task 2:** Fresh-build iteration loop + 26-ITERATION-LOG.md + demo-boot.spec.ts cascaded fix — uncommitted during task; rolled into atomic commit

**Commit hashes:** captured below in the final atomic commit section.

## Files Created/Modified

- `tests/e2e/hotkey-chord.spec.ts` — 118 lines. Full Layer-B contract; file-level docblock covers the end-to-end loop (napplet boot + SDK AUTH + registerAction round-trip + chord dispatch + envelope routing + DOM update) and the ROADMAP §4 deviation.
- `.planning/phases/26-real-keys-backend/26-ITERATION-LOG.md` — Phase 22 structural template: Summary Table + Capability-Gate + ROADMAP §4 + Clean/Build/E2E blocks + Iteration History + Anti-Term Hygiene + New Spec Evidence + Closing Notes.
- `tests/e2e/demo-boot.spec.ts` — 3-line substantive diff (count=1→0 for keys+stub locator; count=2→1 for `.stub-badge`) plus docblock comment update; reflects Phase 26's STUB_ONLY_SERVICES demotion.

## Decisions Made

- **demo-boot.spec.ts fix is IN-SCOPE for Plan 26-04's atomic commit** — the failure is directly caused by Plan 26-03's STUB_ONLY_SERVICES demotion (which is a deliberate Phase 26 deliverable). The scope-boundary rule (auto-fix only issues directly caused by current task changes) applies: `pnpm test:e2e` green on main after atomic commit is a correctness invariant, and the demo-boot assertion encodes the pre-Phase-26 topology. Fix the assertion, note it as a Rule 1 deviation, keep main green.
- **Status-sentinel wait > napplet-ready helper for :4174 demo** — the :4174 demo does not install `window.__nappletReady__` (only the :4173 harness does). Waiting on `#hotkey-chord-status = 'subscribed'` provides equivalent coverage (AUTH + registerAction both complete). Follows relay-subscribe.spec.ts precedent.
- **KeyCode form (`Control+Shift+KeyK`) not character form (`Control+Shift+K`)** — keyboard-layout-independent; character form depends on US keyboard layout and is fragile across CI variations. Plan explicitly prescribed this choice.
- **Anti-term grep scope explicitly narrowed to src/ + index.html, excluding dist/** — built napplet bundles embed `window.addEventListener('message')` as part of @napplet/shim's runtime; this is an SDK implementation detail, not a source-level anti-feature violation. Phase 22-08 precedent.
- **Two iterations fully recorded in 26-ITERATION-LOG.md** — Iteration 1 (failed: demo-boot), Iteration 2 (green after fix). Per canonical iteration-log pattern (Phase 22, Phase 24 precedents), the log records all iterations to create an audit trail of the fix-and-retry discipline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `waitForNappletReady` in docblock triggered grep-collision false-positive**
- **Found during:** Task 1 (acceptance-criteria grep re-run after writing spec)
- **Issue:** The plan's acceptance criteria require `grep -c "waitForNappletReady" tests/e2e/hotkey-chord.spec.ts` to return 0 (the helper is deliberately not used). But the plan's own template docblock referenced the deviation as "ROADMAP §4 deviation (waitForNappletReady)" — which put one literal `waitForNappletReady` in the docblock, making the grep return 1. Same grep-collision bug class as Plan 26-03's deviation 1.
- **Fix:** Rephrased the docblock line from `ROADMAP §4 deviation (waitForNappletReady)` to `ROADMAP §4 deviation (the napplet-ready helper)`. The deviation is still documented (descriptive, not literal); the grep now returns 0.
- **Files modified:** tests/e2e/hotkey-chord.spec.ts (docblock only — 1 line)
- **Verification:** `grep -c "waitForNappletReady" tests/e2e/hotkey-chord.spec.ts` → 0 ✓; `grep -c "ROADMAP" tests/e2e/hotkey-chord.spec.ts` → 1 ✓
- **Committed in:** atomic Phase 26 commit (Plan 26-04)

**2. [Rule 1 - Bug] demo-boot.spec.ts encoded pre-Phase-26 stub topology; failed after Plan 26-03's keys demotion**
- **Found during:** Task 2 iteration loop (first `pnpm test:e2e` run)
- **Issue:** `tests/e2e/demo-boot.spec.ts:29-31` assert `[data-service-name="keys"][data-service-stub="true"]` count = 1, `[data-service-name="media"][data-service-stub="true"]` count = 1, and `.stub-badge` count = 2. Plan 26-03 demoted keys from STUB_ONLY_SERVICES (`['keys', 'media']` → `['media']`), so keys no longer has the stub marker. Result: first locator returns 0 (expected 1) — test fails. Directly caused by Phase 26's intended topology change.
- **Fix:** Updated assertions to reflect new topology: keys+stub locator count = 0, `.stub-badge` count = 1. Docblock comment updated to note the graduation. Media stub assertion unchanged.
- **Files modified:** tests/e2e/demo-boot.spec.ts (5-line diff: docblock comment + 3 assertion values)
- **Verification:** `pnpm exec playwright test tests/e2e/demo-boot.spec.ts --reporter=list` → `1 passed`; full `pnpm test:e2e` → `48 passed / 0 failed / 0 skipped`.
- **Committed in:** atomic Phase 26 commit (Plan 26-04)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Zero structural impact. Deviation 1 is documentation-only rephrasing. Deviation 2 is a cascaded topology-assertion update that IS in-scope for this phase (keys graduation is a Plan 26-03 deliverable; the assertion encoded the old topology; the fix is the minimum correctness correction). Both are documented in 26-ITERATION-LOG.md + this SUMMARY with full diff context. Final iteration-loop result is `baseline+1` (47 → 48) with exact +1 delta per acceptance criteria.

## Issues Encountered

- **No root `pnpm clean` script** — same as Phase 22-08 and Phase 24-02; manual-clean substitute used identically. Zero behavioral difference (cold turbo rebuild, 0 cache hits, 21 tasks).
- **Built napplet dist/ artifacts contain `window.addEventListener('message')`** — this is the compiled @napplet/shim runtime (the SDK owns the postMessage listener; napplet src code never calls `window.addEventListener('message')` directly). Anti-term grep scope narrowed to source files + index.html to exclude built artifacts. Documented in Deviations + Decisions sections.

## User Setup Required

None — no external service configuration, env vars, or secrets required. Phase 26 is fully self-contained within the kehto monorepo.

## Next Phase Readiness

- **Ready for Phase 27 (Real Media Backend):** same structural pattern (real service + HostBridge interface + demo napplet + Layer-B spec + iteration loop). Phase 26 establishes all the precedents: SDK-driven napplet, `__grantX__` host hook pattern, status-sentinel wait for napplets without `__nappletReady__`, anti-term grep scope, cascaded test updates as in-scope deviations.
- **v1.4 e2e baseline advances to 48** — Phase 27 will target 49 (adding media-controller.spec.ts).
- **STUB_ONLY_SERVICES** now `['media']` — Phase 27 will demote media to `[]`, closing v1.4's stub-service cleanup.
- **No blockers.**

## Self-Check

Automated verification of SUMMARY claims:

- Files present on disk:
  - `tests/e2e/hotkey-chord.spec.ts`: FOUND (118 lines)
  - `tests/e2e/demo-boot.spec.ts`: FOUND (modified)
  - `.planning/phases/26-real-keys-backend/26-ITERATION-LOG.md`: FOUND
- Single-spec run: `pnpm exec playwright test tests/e2e/hotkey-chord.spec.ts --reporter=list` → `1 passed (3.4s)`, exit 0
- Full-suite run: `pnpm test:e2e` → `48 passed (16.8s)`, exit 0
- Grep acceptance (hotkey-chord.spec.ts):
  - `grep -c "demoBeforeEach" tests/e2e/hotkey-chord.spec.ts` → 2 ≥ 1 ✓
  - `grep -c "#hotkey-chord-frame-container" tests/e2e/hotkey-chord.spec.ts` → 1 = 1 ✓
  - `grep -c "hotkey-chord-status|hotkey-chord-count|hotkey-chord-last"` → 8 ≥ 5 ✓
  - `grep -c "Control+Shift+KeyK"` → 4 ≥ 2 ✓
  - `grep -c "ANTI_TERM_RE"` → 3 ≥ 3 ✓
  - `grep -cE "mode: 'serial'"` → 1 = 1 ✓
  - `grep -c "__grantKeysForward__"` → 4 ≥ 1 ✓
  - `grep -c "ROADMAP"` → 1 ≥ 1 ✓
  - `grep -c "waitForNappletReady"` → 0 ✓ (anti-grep)
- Grep acceptance (26-ITERATION-LOG.md):
  - `grep -cE "pnpm clean.*pnpm build.*pnpm test:e2e"` → 2 ≥ 1 ✓
  - `grep -c "baseline"` → 4 ≥ 1 ✓
  - `grep -c "Delta.*1"` → 1 ≥ 1 ✓
  - `grep -c "Capability-Gate Handling|__grantKeysForward__"` → 6 ≥ 1 ✓
  - `grep -cE "ROADMAP §4|napplet-ready helper"` → 2 ≥ 1 ✓
  - `grep -c "hotkey-chord.spec.ts"` → 7 ≥ 2 ✓
  - Anti-placeholder (TODO/FIXME/{executor pastes}/{BASELINE_COUNT}): → 0 ✓
- Anti-term hygiene (source scope only):
  - `grep -rnE "window\.nostr|signer-service|signer\.sign|BusKind|kind 29001|kind 29002" packages/services/src/keys-service.ts apps/demo/napplets/hotkey-chord/src/ apps/demo/napplets/hotkey-chord/index.html` → 0 matches ✓
  - `grep -rnE "window\.addEventListener\('message'|Math\.random|onNappletMessage|sendNappletMessage" apps/demo/napplets/hotkey-chord/src/` → 0 matches ✓
- Commits: atomic commit hashes captured in Return Report (below)

## Self-Check: PASSED

---
*Phase: 26-real-keys-backend*
*Completed: 2026-04-19*

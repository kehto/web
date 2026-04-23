---
phase: 35-wm-skeleton-readme-cleanup
verified: 2026-04-23T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 35: WM Skeleton + README Cleanup Verification Report

**Phase Goal:** Downstream shells can declare `@kehto/wm` as a dep today and start pinning the canonical type vocabulary / factory signature — without waiting on a real WM implementation (deferred to v1.7+). Root README's stale `pnpm.overrides link:` consumer story and "core not on npm" claim are removed; integration example matches what hyprgate v2.0 actually pins.
**Verified:** 2026-04-23
**Status:** passed
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths (mapped from ROADMAP Success Criteria)

| #   | Truth | Status     | Evidence |
| --- | ----- | ---------- | -------- |
| 1   | PR #7's `@kehto/wm` skeleton lands on `main` as `packages/wm/` with the 4 skeleton files; registered in pnpm-workspace + turbo build graph | ✓ VERIFIED | `gh pr view 7 --json state` → `MERGED`. Directory + all 4 files present with expected line counts (package.json 43, tsconfig.json 9, src/index.ts 88, README.md 35; total 175 — matches PR #7 diff exactly). `pnpm build` picks up `@kehto/wm` in turbo graph (24 successful / 24 total; `@kehto/wm#build` ran). |
| 2   | `packages/wm/src/index.ts` exports generic type vocabulary (`WindowId`, `WorkspaceId`, `Rect`, `Layout`), `WmHostHooks` contract, `WmService` interface, and throwing `createWmService` factory stub — JSDoc-annotated with forward pointer | ✓ VERIFIED | All 7 top-level exports present (`grep -c` returns 1 each for `^export type WindowId/WorkspaceId/Rect/Layout`, `^export interface WmHostHooks/WmService`, `^export function createWmService`). Factory body contains `throw new Error(...)` (1 match) with hyprgate design-note URL (1 match). 15 JSDoc block starts (`/**`) across the 88-line file. Forward pointer is to `https://github.com/hyprgate/gui/blob/master/specs/wm-package-design.md` + "Implementation in this package lands after upstream PR merges" — satisfies "pointer to the future implementation milestone" intent. |
| 3   | Root `README.md` no longer contains `pnpm.overrides link:` block or "core not yet on npm" claim; Quick-Integration Example matches what hyprgate v2.0 actually pins (registry-install compatible) | ✓ VERIFIED | `grep -c 'is not yet on npm' README.md` → 0 (stale claim gone). `grep -c 'pnpm.overrides.*link:' README.md` → 0 (stale prose gone). `grep -c '/home/sandwich/Develop/napplet' README.md` → 0 (user-path gone). Replacement prose present: `Registry install` (1), `@napplet/nub>@napplet/core` (1), `Phase 32 Decision` (1). Quick-Integration Example uses `@kehto/shell`, `@kehto/runtime`, `@kehto/services` imports — registry-install compatible; type-checks against current barrels. |
| 4   | `turbo run build` + `turbo run type-check` succeed across full workspace (including new `@kehto/wm`) with no regressions | ✓ VERIFIED | Live `pnpm build` run: `Tasks: 24 successful, 24 total` (FULL TURBO cached replay). Plan 35-01 + 35-02 iteration logs show fresh-install run at 24/24 build (5.222s, 0 cached) and 10/10 type-check (1.3s, 4 cached). +1 delta for @kehto/wm in both pipelines vs Phase 34 close (23/9). |
| 5   | Iteration loop recorded at **54 passed / 0 failed / 0 skipped** (same as Phase 33/34 close); anti-term sweep clean | ✓ VERIFIED | `35-ITERATION-LOG.md` exists (262 lines); `grep -c '54 passed'` → 7; `grep -c 'delta 0'` → 2; explicit baseline comparison to Phase 34 close preserved at 54/0/0. Playwright summary captured: `54 passed (18.1s)`. Anti-term sweep 10-pattern table documented; 2 grep-positives (`window.nostr`, `allow-same-origin`) both on README line 94 NIP-5D anti-features bullet — classified as enforcement-prose (asserts ABSENCE) per Phase 33 Decision precedent. |

**Score:** 5/5 truths verified

### Required Artifacts (from PLAN frontmatter must_haves)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/wm/package.json` | `@kehto/wm@0.0.0` manifest, ESM-only, zero runtime deps, publish-ready; min 40 lines | ✓ VERIFIED | 43 lines; `"name": "@kehto/wm"` and `"version": "0.0.0"` present; `type: module`, `sideEffects: false`, `publishConfig.access: public`; scripts.build/type-check = `tsc --noEmit`; zero `dependencies` block; only `typescript@^5.9.3` devDep (hoisted). |
| `packages/wm/tsconfig.json` | Extends monorepo base, noEmit, src rootDir; min 5 lines | ✓ VERIFIED | 9 lines; extends `../../tsconfig.json`; rootDir=src, noEmit=true. |
| `packages/wm/src/index.ts` | 4 types + WmHostHooks + WmService + `createWmService` throwing stub; min 80 lines | ✓ VERIFIED | 88 lines; all 7 top-level exports grepped at count 1; `grep -c '^import '` → 0 (zero runtime imports); JSDoc on all public exports (15 block starts). |
| `packages/wm/README.md` | Skeleton status + hyprgate design cross-link; min 30 lines | ✓ VERIFIED | 35 lines; file exists post-squash. |
| `README.md` (root) | Corrected Architecture Notes; contains `@napplet/nub>@napplet/core`; min 95 lines | ✓ VERIFIED | File updated (commit `063abd7`); all 6 DOCS-04 grep deltas verified; Packages table extended with @kehto/nip66 + @kehto/wm rows. |
| `35-ITERATION-LOG.md` | 54/0/0 evidence + anti-term sweep + stale-claim grep verification; min 80 lines | ✓ VERIFIED | 262 lines; contains `54 passed`, `delta 0`, `DOCS-04`, `DOCS-05`, `24 successful` all present; anti-term table + DOCS-04 pre/post table + DOCS-05 export-presence table all recorded. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `createWmService` factory | hyprgate design note URL | throw-error message verbatim | ✓ WIRED | `grep -c 'hyprgate/gui/blob/master/specs/wm-package-design' packages/wm/src/index.ts` → 1; factory body contains `throw new Error(...)` with full URL + prose about upstream implementation. |
| `packages/wm/` workspace | `pnpm-workspace.yaml` `packages/*` glob | Auto-pickup on `pnpm install` | ✓ WIRED | `pnpm install` iteration logs report 25 workspace projects (Phase 34 baseline 24 + 1). turbo task count rose 23→24 build / 9→10 type-check, confirming auto-registration. |
| `packages/wm/package.json` build + type-check scripts | `turbo.json` `build` + `type-check` tasks | Turbo script-name auto-discovery | ✓ WIRED | `Tasks: 24 successful` confirms @kehto/wm#build ran; iteration log shows `@kehto/wm:build:` prefix 5× and `@kehto/wm:type-check:` prefix 5×. |
| README.md Architecture Notes §Registry install | `package.json` `pnpm.overrides` block | Documented pin explanation | ✓ WIRED | README bullet now cites exact override key `@napplet/nub>@napplet/core: ^0.2.1` matching the one present in root `package.json`; cross-reference to Phase 32 Decision added. |
| README.md Quick-Integration Example §imports | `packages/{shell,runtime,services}/package.json` (v0.2.0+) | Example imports resolve against v1.6 dep surface | ✓ WIRED | DOCS-05 verification: all 5 imports (`createShellBridge`, `createRuntime`, `createIdentityService`, `createNotificationService`, `createRelayPoolService`) present in respective package barrels (3 export matches each in src + dist + .d.ts). Root `pnpm type-check` 10/10 successful confirms type-resolution. |
| `35-ITERATION-LOG.md` §evidence | Phase 34 ITERATION-LOG.md 54/0/0 baseline | Explicit delta-0 comparison | ✓ WIRED | Log contains "baseline delta 54 → 54 (docs/types-only phase contract satisfied)" + explicit Phase 34 close reference. |

### Data-Flow Trace (Level 4)

Not applicable — this phase ships a package skeleton (signature-only, throwing stub by design) and doc/README edits. No dynamic data rendering surface exists in Phase 35 deliverables. The WM skeleton is an intentional stub per WM-01/02/03 scope (documented stub classification in 35-01 SUMMARY).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| WM skeleton factory throws with forward pointer | Static check — grep for `throw new Error` + URL | Both present (1 + 1) | ✓ PASS |
| WM package participates in build graph | `pnpm build` → count lines | `24 successful, 24 total` (includes `@kehto/wm#build`) | ✓ PASS |
| PR #7 state on GitHub | `gh pr view 7 --json state --jq .state` | `MERGED` | ✓ PASS |
| README has no stale claims | `grep -c 'is not yet on npm' README.md` | `0` | ✓ PASS |
| README has new registry prose | `grep -c '@napplet/nub>@napplet/core' README.md` | `1` | ✓ PASS |
| Iteration log captures 54/0/0 | `grep -c '54 passed' iteration log` | `7` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| WM-01 | 35-01-PLAN.md | PR #7 skeleton lands on `main` (4 files: package.json, tsconfig.json, src/index.ts, README.md) | ✓ SATISFIED | PR #7 MERGED (squash commit `d7df669`); 4 files present at expected line counts (43+9+88+35=175). REQUIREMENTS.md line 55 marked [x]. |
| WM-02 | 35-01-PLAN.md | Exports generic type vocab + WmHostHooks + WmService + throwing createWmService factory stub | ✓ SATISFIED | All 7 exports verified via grep; throwing factory with design-note URL; JSDoc on all exports. REQUIREMENTS.md line 56 marked [x]. |
| WM-03 | 35-01-PLAN.md | `turbo run build` + `type-check` pass with no regressions to 53-spec E2E baseline | ✓ SATISFIED | Iteration log: build 24/24, type-check 10/10, e2e 54/0/0 (delta 0 from Phase 34 close which raised baseline to 54). REQUIREMENTS.md line 57 marked [x]. |
| DOCS-04 | 35-02-PLAN.md | Root `README.md` removes "core not on npm" claim + `pnpm.overrides link:` recommendation | ✓ SATISFIED | 6 DOCS-04 grep deltas all verified (3×0, 3×1); commit `063abd7`. Packages table extended with nip66 + wm rows. REQUIREMENTS.md line 85 marked [x]. |
| DOCS-05 | 35-02-PLAN.md | Quick-Integration Example verified against clean-install smoke or equivalent | ✓ SATISFIED | Verified via root `pnpm type-check` 10/10 successful (CONTEXT.md Claude's Discretion authorized this lower-cost alternative over throwaway-dir `pnpm add` smoke); all 5 example imports resolve against current package barrels (3 exports each). REQUIREMENTS.md line 86 marked [x]. |

No ORPHANED requirements — all 5 REQ-IDs declared in plan frontmatter match REQUIREMENTS.md assignments for Phase 35.

### Anti-Patterns Found

None. 35-ITERATION-LOG.md records the full anti-term sweep on Plan 35 touch paths (`packages/wm/**` + `README.md`):

| Pattern | Count | Classification |
| ------- | ----- | -------------- |
| `window.nostr` | 1 | Enforcement-prose (README line 94 NIP-5D anti-features bullet documenting ABSENCE) — NOT a violation per Phase 33 Decision precedent |
| `signer-service`, `signer.`, raw `window.addEventListener('message'`, `BusKind`, `29001`, `29002`, `core-compat`, `@napplet/nub-` | 0 each | Clean |
| `allow-same-origin` | 1 | Enforcement-prose (same bullet) — NOT a violation |

Additional source-level checks performed during this verification:
- `grep -c '^import ' packages/wm/src/index.ts` → 0 (zero runtime imports confirming "zero runtime deps" contract)
- `grep -c 'throw new Error' packages/wm/src/index.ts` → 1 (single intentional throwing-stub, documented scope)

### Human Verification Required

None. All automated checks pass and the phase is docs/types only — no visual/UX surface, no external service integration, no real-time behavior to sample. The 35-ITERATION-LOG.md already captured the E2E baseline preservation (54/0/0), which is the closest thing to user-facing behavior in scope.

### Gaps Summary

No gaps. Phase 35 goal fully achieved:

- Downstream shells can now `pnpm add @kehto/wm` (after first publish) and pin the canonical type vocabulary + factory signature. Package skeleton is in `main` with locked API surface (WindowId, WorkspaceId, Rect, Layout, WmHostHooks, WmService, throwing createWmService).
- Root `README.md` stale `pnpm.overrides link:` + "core not on npm" claims are removed; replacement prose accurately documents the single current transitive pin (`@napplet/nub>@napplet/core: ^0.2.1`, Phase 32 Decision cross-reference).
- Turbo pipeline rose 23→24 build / 9→10 type-check with zero regressions. E2E suite preserved at 54/0/0 (docs/types-only contract satisfied).
- All 5 Phase 35 REQ-IDs (WM-01..03, DOCS-04..05) closed with evidence trails.

One nuance worth noting (not a gap): ROADMAP Success Criterion 3 mentions the Quick-Integration Example should show a `pnpm add @kehto/runtime @napplet/shim @napplet/nub` command. The README Quick-Integration Example block (lines 30-57) shows `import` statements but not an explicit `pnpm add` line. Plan 35-02 elected (per CONTEXT.md Claude's Discretion) to leave the example unchanged because all imports are registry-install compatible and verified via `pnpm type-check` at 10/10 successful. The semantic intent of Criterion 3 (registry install, not link: workarounds) is fully satisfied — the literal wording about a shell command is not quoted verbatim. Plan 35-02 SUMMARY documents this decision.

---

_Verified: 2026-04-23_
_Verifier: Claude (gsd-verifier)_

---
phase: quick-260802-lpw
verified: 2026-08-02T16:04:59Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260802-lpw: Published NAP-INTENT Package Adoption — Verification Report

**Task Goal:** Adopt the published NAP-INTENT package fixes in Kehto by updating applicable `@napplet` pins and the frozen lock, proving immutable npm/JSR artifacts, preserving the independent #229 host-parser work, passing release gates, and shipping a PR.

**Verified:** 2026-08-02T16:04:59Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every active exact-pin playground and fixture consumer resolves the published patch matrix where applicable. | ✓ VERIFIED | The dynamic matrix guard discovers all active manifests, importers, snapshots, and installed metadata; focused guard run passed (62 assertions). Direct manifest scan shows only core `0.31.1`, nap `0.31.2`, shim `0.29.2`, SDK `0.27.2`, and Vite plugin `0.14.1` where declared. |
| 2 | The frozen lock has one coherent official matrix, including nap → core `^0.31.1`, without superseded exact snapshots. | ✓ VERIFIED | `pnpm install --frozen-lockfile` passed with pnpm 10.8.0. The alignment guard passed and `rg` found no superseded exact package snapshots; live npm metadata confirms nap `0.31.2` depends on core `^0.31.1`, while shim/SDK depend on exact core/nap patches. |
| 3 | npm SRI and JSR manifest checksums prove the six audited packages are official immutable artifacts with no `postinstall`. | ✓ VERIFIED | Fresh `npm view` data matched every audited SRI, `git+https://github.com/sandwichfarm/napplet.git` repository, and matching `packages/*` directory, with no `postinstall`. Fresh JSR `%40napplet/..._meta.json` queries matched all six recorded `/jsr.json` checksums. |
| 4 | The installed contract enforces `id` plus structured invoke results and accepts an orthogonal role/convention pair. | ✓ VERIFIED | Installed nap `types.d.ts` declares `id: string` and `result: IntentResult`; installed Vite code validates a queryless convention but no longer compares `slug` to the convention archetype. `nip5aManifest({ slug: 'profile', convention: 'napplet:note/open' })` returned a plugin. Focused guard and real feed/profile builds passed; full E2E includes passing published-profile delivery tests. |
| 5 | Existing public peer/development ranges and JSR maps remain compatible and unchanged; no changeset is needed. | ✓ VERIFIED | Branch diff changes no public package source, export, peer range, or JSR map. Shell retains public `>=0.31.0 <0.32.0` ranges while only its development shim changes to `0.29.2`. No non-template changeset file exists. `pnpm changeset status` correctly reports changed packages without a changeset; that is appropriate because shipped `@kehto/*` output is unchanged. |
| 6 | No #229-owned Kehto parser, shared Vite wrapper validation, or protocol behavior changed. | ✓ VERIFIED | `git diff origin/main...HEAD` has no `packages/nip/src/5d/*`, `apps/playground/napplets/shared-vite-config.ts`, parser, or shared-Vite file changes. The only conformance-guard edit updates provenance constants, not host behavior. |
| 7 | The debug note remains untracked/unstaged; release gates pass; PR is open, green, and points at local HEAD. | ✓ VERIFIED | `git status --porcelain` reports exactly `?? .planning/debug/jsr-release-scope-auth.md` and no staged path. Fresh full gates passed. PR [#232](https://github.com/kehto/web/pull/232) is open at `32b629b30ad883b88c1a82c9b6d2611d6c30ac1b`, equal to local HEAD, with six successful and zero non-successful check runs. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `pnpm-lock.yaml` | Frozen patch matrix | ✓ VERIFIED | Artifact query passed; frozen install and dynamic importer/snapshot checks passed. |
| `tests/unit/napplet-package-alignment.test.ts` | Active-consumer and lock alignment guard | ✓ VERIFIED | Substantive dynamic discovery covers manifests, lock importers/snapshots, installed metadata, public ranges, and JSR maps; run passed. |
| `tests/unit/published-napplet-contract.test.ts` | Upstream provenance and installed contract guard | ✓ VERIFIED | Substantive installed declaration/distribution inspection; run passed and direct installed-code inspection corroborates it. |
| `RUNTIME-SPEC.md` | Current matrix and provenance | ✓ VERIFIED | Contains patch-line and NAP/source/release refs; docs gate passed. |
| `packages/shell/package.json` | Exact development shim while preserving public range | ✓ VERIFIED | Development shim is `0.29.2`; public core/nap ranges remain `>=0.31.0 <0.32.0`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Active exact pins | `pnpm-lock.yaml` | Frozen materialization | ✓ WIRED | Every discovered active manifest's lock importer and final package snapshot are asserted by the passing dynamic guard. |
| Alignment guard | Manifests, ranges, JSR maps, importers, installed metadata | Repository discovery | ✓ WIRED | Guard recursively discovers active manifests/maps and reads the frozen lock plus `.pnpm` metadata. |
| Contract guard | Installed nap/Vite artifacts | Generated pnpm paths and declaration/distribution inspection | ✓ WIRED | Passing guard imports/read-checks installed artifacts; direct commands confirmed the key declarations and behavior. |
| Current guidance | NAP authority and upstream release refs | Documentation and tests | ✓ WIRED | Current guidance/guards contain `5ac0490…`, #199 source/merge, and #198 release-source refs; docs gate passed. |
| Local HEAD | PR head | GitHub metadata | ✓ WIRED | Fresh `gh pr view` head OID equals local `git rev-parse HEAD`. |

### Data-Flow Trace (Level 4)

Not applicable: this is dependency/configuration, guard, and documentation work rather than a newly rendered dynamic-data artifact. The dependency flow is nevertheless exercised by the feed → profile builds and passing browser E2E delivery tests.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Published contract and matrix guards | `pnpm exec vitest run …five focused guards…` | 5 files, 62 tests passed | ✓ PASS |
| Frozen dependency materialization | `pnpm install --frozen-lockfile` | Lock up to date; completed with pnpm 10.8.0 | ✓ PASS |
| Feed/profile consumer slice | `pnpm --filter @kehto/demo-feed build` and `…demo-profile-viewer build` | Both Vite builds succeeded | ✓ PASS |
| Full release gates | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e && pnpm docs:check && pnpm audit:csp && npx --yes aislop@0.12.0 scan -d` | Command succeeded; E2E: 81 passed, 1 skipped; AI-slop: 100/100 Healthy | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `QUICK-260802-LPW` | `260802-lpw-PLAN.md` | Bump every applicable exact `@napplet` pin and frozen lock | ✓ SATISFIED | Dynamic alignment guard, frozen materialization, live registry checks, and consumer builds pass. |

`QUICK-260802-LPW` is a quick-task requirement declared by the plan; it has no separate central `REQUIREMENTS.md` row to orphan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `pnpm-lock.yaml` | various | Incidental `XXX` substring in base64 integrity values | ℹ️ Info | Not a debt marker or executable stub. |
| `packages/services/README.md` | example callbacks | Empty callbacks / `console.log` in documentation examples | ℹ️ Info | Pre-existing illustrative documentation, not a task-owned implementation stub. |

No task-owned `TBD`, `FIXME`, or unresolved `XXX` debt markers were found.

## Disconfirmation Notes

- The summary's “82 Playwright tests passed” is not exact: fresh verification observed **81 passed and 1 skipped**. The command exits successfully; the skipped Good Morning Protocol external-resolution case is unrelated to this package-adoption truth.
- `gh pr checks --required` exits with “no required checks reported.” This shows repository governance does not currently mark any checks as required; it does **not** negate the verified task contract that PR #232 is open, at local HEAD, and has six successful / zero failed-or-pending check runs. This is an informational release-governance observation, not a missing deliverable.

## Gaps Summary

No gaps found. The phase goal is achieved by actual manifest/lock resolution, installed artifact behavior, live registry provenance, passing release gates, protected-file state, and live PR metadata.

---

_Verified: 2026-08-02T16:04:59Z_
_Verifier: gsd-verifier_

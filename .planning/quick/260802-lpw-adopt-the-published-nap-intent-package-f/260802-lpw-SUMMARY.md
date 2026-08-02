---
phase: quick-260802-lpw
plan: 01
subsystem: dependencies
tags: [napplet, nap-intent, pnpm, vite, provenance]
requires:
  - phase: v1.29
    provides: "Current NAP-INTENT conformance and active-package guards"
provides:
  - "Official NAP-INTENT patch matrix in every active exact consumer and frozen pnpm lock"
  - "Installed-artifact guards for structured intent results and orthogonal Vite metadata"
  - "Current package guidance and immutable registry provenance"
affects: [playground, fixtures, shell, dependency-updates]
tech-stack:
  added: []
  patterns: ["Dynamic manifest/importer/snapshot matrix guard", "Installed package declaration/distribution provenance guard"]
key-files:
  created: []
  modified:
    - pnpm-lock.yaml
    - tests/unit/published-napplet-contract.test.ts
    - tests/unit/napplet-package-alignment.test.ts
    - RUNTIME-SPEC.md
key-decisions:
  - "Consume the audited upstream patch artifacts without changing public Kehto peer windows or JSR maps."
  - "Do not add a changeset because the diff changes no shipped @kehto runtime contract."
  - "Keep kehto/web#229 host-parser/shared-Vite work independent."
patterns-established:
  - "Exact private package pins must converge with all public-range lock importers on one published artifact matrix."
requirements-completed: [QUICK-260802-LPW]
coverage:
  - id: D1
    description: "All active exact consumers and the frozen lock use the published Napplet patch matrix."
    requirement: QUICK-260802-LPW
    verification:
      - kind: unit
        ref: "tests/unit/napplet-package-alignment.test.ts"
        status: pass
      - kind: other
        ref: "pnpm install --frozen-lockfile"
        status: pass
    human_judgment: false
  - id: D2
    description: "Installed upstream declarations prove required structured intent results and orthogonal Vite role/convention validation."
    requirement: QUICK-260802-LPW
    verification:
      - kind: unit
        ref: "tests/unit/published-napplet-contract.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Published PR is green at the exact local head."
    requirement: QUICK-260802-LPW
    verification:
      - kind: other
        ref: "https://github.com/kehto/web/actions/runs/30753583301"
        status: pass
    human_judgment: false
metrics:
  duration: "61 min"
  completed: "2026-08-02"
status: complete
---

# Quick Task 260802-lpw: Adopt the published NAP-INTENT package fixes Summary

**Kehto now consumes the audited NAP-INTENT patch line—core 0.31.1, nap 0.31.2, shim 0.29.2, SDK 0.27.2, and Vite plugin 0.14.1—with a single frozen graph and installed-contract proof.**

## Performance

- **Duration:** 61 min
- **Started:** 2026-08-02T14:56:19Z
- **Completed:** 2026-08-02T15:57:43Z
- **Tasks:** 3/3 complete
- **Files modified:** 51

## Accomplishments

- Updated all active playground, fixture, and shell development-only exact pins; public `>=0.31.0 <0.32.0` peer/development ranges and `jsr:@napplet/*@^0.31.0` maps remain unchanged.
- Regenerated the pnpm 10.8.0 lock so all active importers resolve the single audited package matrix and no superseded exact snapshots remain.
- Added guards that inspect installed declarations/distributions for required `IntentInvokeResultMessage.result` and valid orthogonal role `profile` / convention `napplet:note/open` metadata.
- Updated current package guidance with `napplet/naps@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, napplet/web#199, and Version Packages #198 provenance while leaving #229 parser/shared-config work untouched.

## Immutable Registry Evidence

| Package | Version | npm SRI | JSR `/jsr.json` checksum |
| --- | --- | --- | --- |
| `@napplet/core` | 0.31.1 | `sha512-+bwkrQbJ+EHeGzgZqiKKlXNfaSSDboMEujf155Pltru3y8LTHvUL4nu4vyoxvO5cexIqm2qgPUgmB0yrPpVA9g==` | `sha256-8105d15b988cd67e148ad164a906dc879664ec1f224717692658aa0bea33a1bd` |
| `@napplet/nap` | 0.31.2 | `sha512-o07TkB/h+JP3nrF69DLdvhmYKarjgZ7vDz22GZaFgPzxjvEizrAa88KBG1mjbLsuutmTj7VJz69xJHkoBFHZcQ==` | `sha256-439a42c451fefdc6bc34b585ff41892890a9afbc83a38b3bf9a7c96d486255bf` |
| `@napplet/shim` | 0.29.2 | `sha512-g8tsoEOlA6mqjwfj8wldE4+uhb15+IKOs52sU/C/nyDESG2QId7tfKACBVGFkxBJgjjvl4TOQuLrQWEwzDKB4Q==` | `sha256-a57ff0d655f059db8595239e474b9d44eb575b6bcd906d216abd702578840edb` |
| `@napplet/sdk` | 0.27.2 | `sha512-/5j2SrAc+mNoEFCGeRE+vZtCmzCZE6tvcWCXi2sokVKedvcl8Pj+2/+xwlJY5qWrkYwK/v7d49jThyr2xypH4w==` | `sha256-4e400490d65214411a4ea0fc4a20d61b2ea44ddb83318b6fd71c68684651f694` |
| `@napplet/vite-plugin` | 0.14.1 | `sha512-WIs5CP9+lWOOuuItlO39tjvlWxuFJmb1xLyXcuM6BlV9LTmbO2bAkU1mXcz9G0mPSRQnxzTRf4RckP9J0O6Yug==` | `sha256-82b8274d5ffa8f7a39591328a73b3a95e4b1207a1a7215b9bb9377fb1e06c9ae` |
| `@napplet/conformance` (registry-only) | 0.16.2 | `sha512-Km/UNz4t6td3Rnpx04kJhQ7fetsl45Wx9OaOVUmgO/Fx5e+Qwgxi4kBp8uGDgZT1WcJ711XbC2ssps3pODi/mg==` | `sha256-0bc8284e803a8ef6a9b4bd87df2776b511b5e6bb8668a3042c4bed7465f75ede` |

All six final registry checks passed. npm metadata identifies `git+https://github.com/sandwichfarm/napplet.git` with the matching `packages/<name>` directory and no `postinstall`; `@napplet/nap@0.31.2` depends on `@napplet/core@^0.31.1`, while shim and SDK depend on the exact core/nap pair.

## Task Commits

1. **Task 1: Prove immutable release and run the feed → profile tracer slice**
   - `7f741af` — `test(intent): add failing published package contract` (RED)
   - `bc6321a` — `feat(intent): adopt the published tracer package matrix` (GREEN)
2. **Task 2: Expand the exact matrix and fail closed on mixed locks**
   - `cf10810` — `chore(deps): adopt the NAP-INTENT package release`
3. **Task 3: Synchronize guidance, release evidence, and ship the PR**
   - `46a90d6` — `docs(protocol): record the NAP-INTENT patch line`
   - `32b629b` — `test(protocol): align published provenance guard`

## Verification

- `pnpm install --frozen-lockfile` — passed.
- Focused package guards — 46 assertions passed.
- `pnpm build` and `pnpm type-check` — passed.
- `pnpm test:unit` — 128 files / 1,566 tests passed.
- `pnpm test:e2e` — 81 Playwright tests passed; 1 unrelated external-resolution test was skipped.
- `pnpm docs:check` and `pnpm audit:csp` — passed.
- `npx --yes aislop@0.12.0 scan -d` — **100/100 Healthy**.
- `git diff --check` — passed.
- GitHub CI — scope, Vitest, Build & Type-Check, and Playwright all passed: <https://github.com/kehto/web/actions/runs/30753583301>.

## Release Accounting

No `.changeset` was added. This is a private consumer/development dependency, lockfile, guard, comment, and documentation update; it changes no shipped `@kehto/*` runtime source, export, npm peer range, JSR import map, or compatibility contract. `pnpm changeset status` therefore intentionally exits 1 with its “no changesets were found” notice; this is recorded evidence, not a release gate failure.

## PR

- **URL:** <https://github.com/kehto/web/pull/232>
- **State:** OPEN and green
- **Head:** `chore/bump-napplet-intent-packages` / `32b629b30ad883b88c1a82c9b6d2611d6c30ac1b`
- **Scope statement:** kehto/web#229 remains independent; no changes were made to `packages/nip/src/5d/index.ts`, its tests, `apps/playground/napplets/shared-vite-config.ts`, or local host-parser behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale provenance expected by the NIP-5D conformance guard**
- **Found during:** Task 3 full unit suite.
- **Issue:** `tests/unit/nip5d-conformance-guard.test.ts` still required superseded published source/release refs and failed after the installed-contract guard moved to the audited #199/#198 artifacts.
- **Fix:** Aligned its positive provenance evidence with the source, merge, Version Packages head, and release-source refs used by the new contract guard.
- **Files modified:** `tests/unit/nip5d-conformance-guard.test.ts`
- **Verification:** Focused guard passed; full unit suite passed.
- **Committed in:** `32b629b`

**2. [Rule 3 - Blocking] Updated the resource-demo package-line comment with its static sentinel**
- **Found during:** Task 2 guard update.
- **Issue:** Updating the planned package-line assertion alone would make the focused guard fail until the referenced source comment matched the published matrix.
- **Fix:** Updated the comment from shim/core `0.29.0`/`0.31.0` to `0.29.2`/`0.31.1` in the same dependency commit.
- **Files modified:** `apps/playground/napplets/resource-demo/src/main.ts`
- **Verification:** Focused and full guard suites passed.
- **Committed in:** `cf10810`

**Total deviations:** 2 auto-fixed (Rule 1: 1, Rule 3: 1). Both were directly required for the planned guards to remain truthful; no production scope expanded.

## Warnings

- Existing peer-dependency and ignored-build-script notices appeared during pnpm installation; frozen materialization, full build, type-check, unit, and E2E gates all passed.
- Build tooling retained pre-existing chunk-size and Paja side-effect warnings; no task-owned change introduced them.
- The protected `.planning/debug/jsr-release-scope-auth.md` remains exactly untracked and unstaged.

## Next Phase Readiness

The package-adoption branch is pushed and green. Future host parser work must continue independently on kehto/web#229; no follow-up is required for this dependency-only adoption PR.

## Self-Check: PASSED

- Required summary exists with `status: complete`.
- All five task commits exist locally and on `origin/chore/bump-napplet-intent-packages`.
- PR #232 head equals local `32b629b30ad883b88c1a82c9b6d2611d6c30ac1b`; CI run `30753583301` completed successfully.

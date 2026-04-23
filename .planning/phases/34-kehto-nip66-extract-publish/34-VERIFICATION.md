---
phase: 34-kehto-nip66-extract-publish
verified: 2026-04-23T12:11:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 34: @kehto/nip66 Extract & Publish Verification Report

**Phase Goal:** `@kehto/nip66` ships as a standalone publishable package at `0.1.0` — community shells can add one dep and get a ready-made kind-30166 relay-discovery aggregator without re-inventing per-shell. Publish-only; no demo wiring.

**Verified:** 2026-04-23T12:11:00Z
**Status:** passed
**Re-verification:** No — initial verification
**Scope contract:** Publish-only phase. No user-observable demo surface. Verification is automated: package existence, build green, unit tests green, changeset present, E2E baseline 54/0/0 preserved.

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                               | Status     | Evidence                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/nip66/` workspace exists + buildable (`@kehto/nip66@0.1.0`, ESM-only, tsup)                                               | ✓ VERIFIED | `package.json` declares `"name": "@kehto/nip66"`, `"version": "0.1.0"`, `"type": "module"`; `pnpm --filter @kehto/nip66 build` exit 0; `dist/index.js` + `dist/index.d.ts` emitted |
| 2   | Public API exports exactly 5 symbols: `createNip66Aggregator`, `Nip66RelayPool`, `Nip66Filter`, `Nip66AggregatorOptions`, `Nip66Aggregator` | ✓ VERIFIED | `grep -c` of the 5-pattern alternation in `src/index.ts` returns 5; all 5 surface in `dist/index.d.ts` barrel export                                        |
| 3   | Peer deps: `nostr-tools` only (`>=2.23.3 <3.0.0`); ZERO `@napplet/*` footprint                                                      | ✓ VERIFIED | `peerDependencies` block contains only `nostr-tools`; `grep -c '@napplet' package.json` = 0                                                                |
| 4   | Closure-scoped state (no module-level globals) — multi-instance safe                                                                | ✓ VERIFIED | `grep -cE '^const nip66RelaySet\|^const relaySupportedNips'` = 0 (no module globals); `grep -cE 'const relaySet = new Set\|const relaySupportedNips = new Map'` = 2 (inside factory); Test 9 (multi-instance isolation) passes |
| 5   | `createNip66Aggregator` factory is fully implemented — no stub throws, no `setTimeout`, no hyprgate-only symbols                    | ✓ VERIFIED | `grep -c 'not implemented'` = 0; `grep -c 'setTimeout\|syncDataset\|getWorkerRelay\|getEnabledNetworks'` = 0; factory body is 65 lines of real logic        |
| 6   | Unit tests: 9/9 passing covering event processing, d-tag extraction, N-tag parsing, resync, idempotent start, multi-instance        | ✓ VERIFIED | `npx vitest run --config vitest.config.ts packages/nip66/src/index.test.ts` → `Test Files 1 passed (1) / Tests 9 passed (9)` in 121ms                      |
| 7   | Changeset authored for initial publish (`@kehto/nip66@0.1.0` minor bump, NIP66-01..05 + kehto#2 cited, no `@napplet/*` refs)        | ✓ VERIFIED | `.changeset/v1-6-nip66.md` frontmatter `'@kehto/nip66': minor`; body cites `kehto#2` and `NIP66-01..05`; `grep -c '@napplet'` = 0                           |
| 8   | Zero demo-shell wiring (publish-only contract); E2E baseline 54/0/0 preserved; iteration loop recorded                              | ✓ VERIFIED | `grep -rn '@kehto/nip66' apps/demo/ tests/e2e/` = 0 matches; `34-ITERATION-LOG.md` records `54 passed / 0 failed / 0 skipped`                              |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact                                                                                 | Expected                                                                          | Status     | Details                                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/nip66/package.json`                                                            | `@kehto/nip66@0.1.0` manifest, ESM, tsup build, nostr-tools peer dep              | ✓ VERIFIED | Exists; name/version/type correct; peer `nostr-tools >=2.23.3 <3.0.0`; scripts `build`, `type-check`, `test:unit`, `test`; zero `@napplet/*`            |
| `packages/nip66/tsconfig.json`                                                           | Extends root, strict, ES2022, DOM libs                                            | ✓ VERIFIED | Exists (178 bytes); mirrors `packages/services/tsconfig.json`                                                                                           |
| `packages/nip66/tsup.config.ts`                                                          | ESM-only, dts true, sourcemap true                                                | ✓ VERIFIED | Exists (165 bytes); mirrors `packages/services/tsup.config.ts`                                                                                          |
| `packages/nip66/src/index.ts`                                                            | Full implementation — 5 exports, closure-scoped state, real logic                 | ✓ VERIFIED | 206 lines; 5 public API exports; factory body with processEvent/buildFilter/start/resync/getRelaySet/getRelaysSupportingNip/relaySupportsNip; JSDoc on every export |
| `packages/nip66/src/index.test.ts`                                                       | 8+ vitest tests covering event processing, d-tag, N-tag, resync, multi-instance   | ✓ VERIFIED | 291 lines; 9 tests (Test 1-9); no `vi.mock`, no `useFakeTimers`; all 9 pass                                                                             |
| `packages/nip66/dist/index.js`                                                           | ESM bundle emitted                                                                | ✓ VERIFIED | 1.70 KB; produced by tsup with clean + sourcemap                                                                                                        |
| `packages/nip66/dist/index.d.ts`                                                         | Type declarations for all 5 exports                                               | ✓ VERIFIED | 5.44 KB; all 5 symbols present in final `export { ... }` barrel                                                                                         |
| `packages/nip66/README.md`                                                               | 120+ lines, H1 + 7 H2 sections, all 5 API exports, integration with ShellAdapter  | ✓ VERIFIED | 194 lines; 7 `## ` sections; all 5 public exports mentioned; `getNip66Suggestions` integration example with `Array.from(aggregator.getRelaySet())`      |
| `.changeset/v1-6-nip66.md`                                                               | `'@kehto/nip66': minor` + body citing NIP66-01..05 + kehto#2                      | ✓ VERIFIED | 21 lines; frontmatter correct; all 5 REQ-IDs cited; `kehto#2` referenced; no `@napplet/*` anywhere                                                      |
| `.planning/phases/34-kehto-nip66-extract-publish/34-ITERATION-LOG.md`                    | Clean → install → build → test:e2e → anti-term sweep; 54/0/0 captured             | ✓ VERIFIED | 248 lines; six `54 passed` references; records turbo delta 22→23; anti-term sweep clean; demo-wiring guard clean (0/0)                                  |

### Key Link Verification

| From                                                 | To                                                    | Via                                        | Status     | Details                                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml` (`packages/*`)                 | `packages/nip66/package.json`                         | pnpm install auto-registration             | ✓ WIRED    | `pnpm-lock.yaml` contains `packages/nip66:` importer block (grep = 1 match); `packages/*` glob matches            |
| `packages/nip66/src/index.ts` factory                | `options.pool.subscribe`                              | `start()` → `subscribe(bootstrap, filter, processEvent)` | ✓ WIRED    | `grep -c 'options\.pool\.subscribe'` = 2 (in `start()` + `resync()`); Test 1 verifies call signature              |
| `packages/nip66/src/index.ts` processEvent           | closure `relaySet` + `relaySupportedNips`             | per-event d-tag extraction + N-tag parsing | ✓ WIRED    | `relaySet.add(relayUrl)` at line 161; `relaySupportedNips.set(relayUrl, nips)` at line 170; Tests 4-6 verify      |
| `packages/nip66/src/index.ts` resync                 | stored unsubscribe + clear + re-subscribe             | teardown + state reset + re-subscribe      | ✓ WIRED    | Lines 179-187: unsubscribe(), .clear() x2, re-subscribe; Test 7 verifies full sequence                             |
| `packages/nip66/README.md` `@example`                | `packages/nip66/dist/index.d.ts` (5 exports)          | example imports resolve against built barrel | ✓ WIRED    | `createNip66Aggregator`, `Nip66Aggregator`, `Nip66RelayPool`, `Nip66Filter`, `Nip66AggregatorOptions` all in dist |
| `packages/nip66/README.md` Integration section       | `packages/shell/src/types.ts:131` `getNip66Suggestions()` | documented ShellAdapter wiring pattern     | ✓ WIRED    | README references `getNip66Suggestions` and `Array.from(aggregator.getRelaySet())`; shell hook exists at line 131 |
| `.changeset/v1-6-nip66.md`                           | `packages/nip66/package.json` name + version          | changeset-cli semver bump                  | ✓ WIRED    | Frontmatter `'@kehto/nip66': minor` will compute `0.0.0 + minor = 0.1.0` matching package.json                    |
| Turbo pipeline                                       | `@kehto/nip66#build` task                             | workspace auto-discovery                   | ✓ WIRED    | `pnpm build` output reports `Tasks: 23 successful, 23 total` (+1 from Phase 33 baseline of 22)                    |

### Data-Flow Trace (Level 4)

This phase is a library package with no UI surface; data-flow verification applies to the aggregator contract rather than a rendered artifact.

| Artifact                        | Data Variable         | Source                                                        | Produces Real Data | Status     |
| ------------------------------- | --------------------- | ------------------------------------------------------------- | ------------------ | ---------- |
| `createNip66Aggregator`         | `relaySet`            | `processEvent` populates from `event.tags.find(t => t[0] === 'd')` | Yes (Test 4 verifies real event produces real URL) | ✓ FLOWING  |
| `createNip66Aggregator`         | `relaySupportedNips`  | `processEvent` parses `N`-tags with `parseInt` + `Number.isNaN` guard | Yes (Test 5 verifies numeric N-tags flow; Test 6 verifies lowercase `n` ignored) | ✓ FLOWING  |
| `createNip66Aggregator` filter  | `filter['#n']`        | `buildFilter()` reads `options.networks`                      | Yes (Tests 1-3 verify presence/absence based on networks option) | ✓ FLOWING  |

No hollow props, no disconnected sources. State flows from injected `pool.subscribe` callback through `processEvent` into the closure-scoped `Set` + `Map` and out through the 5 public accessors. Verified by 9 unit tests covering every branch.

### Behavioral Spot-Checks

| Behavior                                                       | Command                                                                   | Result                                        | Status    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------- | --------- |
| Package builds                                                 | `pnpm --filter @kehto/nip66 build`                                        | Build success 5ms + DTS 377ms; dist emitted  | ✓ PASS    |
| Package type-checks                                            | `pnpm --filter @kehto/nip66 type-check`                                   | Exit 0 (tsc --noEmit clean)                   | ✓ PASS    |
| Unit tests pass (root-cwd vitest)                              | `npx vitest run --config vitest.config.ts packages/nip66/src/index.test.ts` | 9 passed (9); 121ms                           | ✓ PASS    |
| Full-repo turbo build                                          | `pnpm build`                                                              | `Tasks: 23 successful, 23 total`; FULL TURBO | ✓ PASS    |
| Module export surface                                          | `grep 'export ' dist/index.d.ts \| tail -1`                               | All 5 exports in final barrel                 | ✓ PASS    |
| Demo-wiring guard                                              | `grep -rn '@kehto/nip66' apps/demo/ tests/e2e/ \| wc -l`                  | 0                                             | ✓ PASS    |

Note on `pnpm --filter @kehto/nip66 test` exit code: when invoked as a filtered command, vitest resolves the `packages/*/src/**/*.test.ts` include glob relative to the package cwd (`packages/nip66`), yielding "No test files found". This is a pre-existing monorepo quirk documented in `34-02-SUMMARY.md` (§Deviations) and the iteration log — the sibling `@kehto/acl` package exhibits the same behavior. Tests are successfully invoked via `pnpm test:unit` from the repo root or `npx vitest run --config vitest.config.ts <path>` — both approaches confirm all 9 tests pass. Not a regression introduced by Phase 34.

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                                 | Status      | Evidence                                                                                                       |
| ----------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| NIP66-01    | 34-01       | `packages/nip66` workspace exists, `@kehto/nip66`, ESM-only, buildable via tsup with `turbo run build`                      | ✓ SATISFIED | Workspace exists; `"type": "module"`; tsup emits `dist/index.js` (1.70 KB) + `dist/index.d.ts` (5.44 KB); turbo graph has `@kehto/nip66#build` |
| NIP66-02    | 34-02       | Exports `createNip66Aggregator(options)` factory subscribing to kind-30166 events via injected relay pool                   | ✓ SATISFIED | Factory at `src/index.ts:142`; `options.pool.subscribe(bootstrap, filter, processEvent)` called in `start()` and `resync()`; 9 tests verify behavior |
| NIP66-03    | 34-01       | `nostr-tools` as peer dep (matches @kehto/shell range); `@napplet/core` NOT required                                        | ✓ SATISFIED | `peerDependencies: { "nostr-tools": ">=2.23.3 <3.0.0" }`; `grep -c '@napplet' package.json` = 0                |
| NIP66-04    | 34-03       | README documents public API + integration example against `ShellAdapter` (`relayConfig.getNip66Suggestions`)                | ✓ SATISFIED | README 194 lines, 7 H2 sections including `## Integration with @kehto/shell` with 4-step wiring example referencing `getNip66Suggestions` and `Array.from(aggregator.getRelaySet())` |
| NIP66-05    | 34-03       | Changeset authored for `@kehto/nip66@0.1.0` initial publish; buildable but NOT yet wired into demo shell (deferred to v1.7+) | ✓ SATISFIED | `.changeset/v1-6-nip66.md` with `'@kehto/nip66': minor` frontmatter; demo-wiring guard returns 0; iteration log records 54/0/0 preservation |

All 5 requirements declared in the phase plans (`34-01-PLAN.md` → NIP66-01, NIP66-03; `34-02-PLAN.md` → NIP66-02; `34-03-PLAN.md` → NIP66-04, NIP66-05) are satisfied. REQUIREMENTS.md also lists all 5 as `Complete` under Phase 34 (lines 146-150). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |

None. Targeted scans on `packages/nip66/src/index.ts` and `packages/nip66/src/index.test.ts`:

- TODO/FIXME/XXX/HACK/PLACEHOLDER: 0 matches
- "not implemented" / "coming soon" / stub sentinels: 0 matches
- setTimeout / syncDataset / getWorkerRelay / getEnabledNetworks (hyprgate-only leaks): 0 matches
- Module-level state globals (`^const nip66RelaySet|^const relaySupportedNips`): 0 matches
- `vi.mock` / `useFakeTimers` in tests (forbidden for closure-scoped design): 0 matches
- `@napplet/core` / `@napplet/nub` refs in README or changeset: 0 / 0

Anti-term sweep (v1.6 patterns) on Plan 34 touch paths — captured in `34-ITERATION-LOG.md` §Step 7; all 6 patterns return 0 matches.

### Human Verification Required

None. This is a publish-only phase with no user-observable surface by contract (`NIP66-05`: "demo wiring deferred to v1.7+"). All goal criteria are programmatically verifiable (package metadata, build output, unit tests, changeset frontmatter, E2E baseline preservation). The phase explicitly excludes demo-shell integration, so there is no visual/UX surface to verify.

### Gaps Summary

No gaps. Phase 34 shipped exactly what its goal promised: `@kehto/nip66@0.1.0` is a standalone publishable package with a closure-scoped aggregator implementation, 9 passing unit tests, a 194-line README with ShellAdapter integration example, and an authored-but-deferred changeset. The E2E baseline of 54/0/0 is preserved (zero demo wiring), confirming the publish-only contract was honored. The package is ready for `changeset publish` at milestone close (Phase 36 per CONTEXT.md `<deferred>`).

Key strengths:

- **Structural correctness** — the closure-scoped design fixes hyprgate's module-global pitfall (Test 9 pins multi-instance isolation)
- **Dependency hygiene** — zero `@napplet/*` footprint; nostr-tools is the only peer dep (matches `@kehto/shell` range verbatim)
- **Scope discipline** — zero edits to `apps/demo/` or `tests/e2e/`; iteration log captures exactly the Phase 33 baseline (54 E2E specs, +1 turbo task)
- **Documentation completeness** — README cites every public symbol from `dist/index.d.ts`; changeset cites all 5 REQ-IDs + kehto#2

---

_Verified: 2026-04-23T12:11:00Z_
_Verifier: Claude (gsd-verifier)_

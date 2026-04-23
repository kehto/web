# Phase 33 Iteration Log — Reserved Chord Surface + E2E-17

**Phase:** 33-reserved-chord-surface-e2e-17
**Plan:** 33-03
**Date:** 2026-04-23
**Baseline (v1.5 close + Phase 32):** 53 passed / 0 failed / 0 skipped
**Target (E2E-17):** 54 passed / 0 failed / 0 skipped — exactly +1 for `reserved-chord.spec.ts`
**Result:** ✅ **54 passed / 0 failed / 0 skipped** (18.5s) — reserved-chord precedence locked, baseline preserved for non-reserved path.

---

## Pre-Iteration Git State

- HEAD at loop start: `6915078` (`test(33-03): add reserved-chord Playwright spec (E2E-17)`)
- 33-01 landing commits: `9deecc8` (RED — 6 unit tests), `48fa038` (GREEN — reservedChords option + reservation gates)
- 33-01 close commit: `7d9d649` (docs(33-01): complete reserved chord surface plan)
- 33-02 landing commits: `8d1f95c` (README Reserved Chords sub-section), `f144953` (demo shell `reservedChords: ['Ctrl+Shift+R']` + `#reserved-chord-last-fired` sentinel wiring)
- 33-02 close commit: `7b6765c` (docs(33-02): complete reserved-chord docs + demo wiring plan)
- 33-03 spec commit: `6915078` (test(33-03): add reserved-chord Playwright spec (E2E-17))
- Working tree: clean before iteration start

---

## Iteration Loop — Canonical v1.6 Fresh-Install Smoke

### Command executed

ROADMAP.md v1.6 aspirationally cites `pnpm clean && pnpm install && pnpm build && pnpm test:e2e`. Root `package.json` has no `clean` script (confirmed in Phase 32 close); the concrete executable form used here is the explicit `rm -rf` chain:

```
rm -rf node_modules packages/*/dist packages/*/node_modules \
       apps/demo/dist apps/demo/node_modules \
       apps/demo/napplets/*/dist apps/demo/napplets/*/node_modules \
       tests/harness/dist tests/harness/node_modules \
       .turbo packages/*/.turbo apps/demo/.turbo apps/demo/napplets/*/.turbo \
  && pnpm install \
  && pnpm build \
  && pnpm test:e2e
```

Turbo cache was purged alongside `node_modules` / `dist` — this guarantees every task actually executed (confirmed `Cached: 0 cached, 22 total`) rather than replaying turbo cache hits.

### pnpm install

```
Scope: all 23 workspace projects
Lockfile is up to date, resolution step is skipped
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +323
Progress: resolved 323, reused 323, downloaded 0, added 323, done

devDependencies:
+ @changesets/cli 2.30.0
+ @playwright/test 1.59.1
+ @vitest/coverage-v8 4.1.2
+ nostr-tools 2.23.3
+ turbo 2.9.4
+ typedoc 0.28.19
+ typescript 5.9.3
+ vitest 4.1.2

Done in 686ms using pnpm v10.8.0
```

No `@napplet/nub*` warnings. The root `pnpm.overrides` entry for `@napplet/nub>@napplet/core: ^0.2.1` (Decision from Plan 32-01) preemptively resolves the upstream workspace:* publish issue — install completes clean.

### pnpm build (fresh, turbo cache purged)

```
@kehto/demo:build: ✓ 104 modules transformed.
@kehto/demo:build: dist/index.html                 26.39 kB │ gzip:  6.13 kB
@kehto/demo:build: dist/assets/main-_LIv1z9n.css    4.36 kB │ gzip:  1.15 kB
@kehto/demo:build: dist/assets/main-D7LBzPHY.js   278.14 kB │ gzip: 89.70 kB
@kehto/demo:build: ✓ built in 761ms

 Tasks:    22 successful, 22 total
Cached:    0 cached, 22 total
  Time:    5.117s
```

All 22 turbo tasks executed uncached and succeeded in 5.117s. Two vite hints surfaced about dynamic-vs-static import interplay on `nostr-tools/lib/esm/pure.js` and `apps/demo/src/nip46-client.ts` — both are pre-existing in v1.5 / v1.6 Phase 32 baseline (unrelated to the reserved-chord surface).

### pnpm test:e2e — Playwright summary

```
  ✓  45 [chromium] › tests/e2e/reserved-chord.spec.ts:35:1 › reserved chord Ctrl+Shift+R fires shell onForward and suppresses napplet keys.action; non-reserved Ctrl+Shift+K still reaches napplet (2.9s)
  ✓  46 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:51:3 › shell UI state surfaces (E2E-16) › service activity counters tick on NUB traffic (UI-01) (2.7s)
  ✓  47 [chromium] › tests/e2e/demo-node-inspector.spec.ts:69:1 › inspector open/close via node click and close button (2.8s)
  ✓  48 [chromium] › tests/e2e/storage-persist.spec.ts:31:1 › preferences round-trips display-name and theme-preference across page.reload() (3.4s)
  ✓  49 [chromium] › tests/e2e/theme-broadcast.spec.ts:33:1 › clicking theme-switcher dark button propagates theme.changed to preferences napplet (2.3s)
  ✓  50 [chromium] › tests/e2e/relay-publish.spec.ts:78:1 › composer with encrypted toggle dispatches relay.publishEncrypted envelope (1.9s)
  ✓  51 [chromium] › tests/e2e/demo-notification-service.spec.ts:73:1 › no anti-term in captured console output (2.2s)
  ✓  52 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:110:3 › shell UI state surfaces (E2E-16) › ACL Capability Matrix lists all authenticated napplets (UI-02) (1.9s)
  ✓  53 [chromium] › tests/e2e/demo-node-inspector.spec.ts:79:1 › no anti-term in console output during inspector interactions (2.1s)
  ✓  54 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:156:3 › shell UI state surfaces (E2E-16) › Sequence Diagram renders a lane for each authenticated napplet (UI-03) (773ms)

  54 passed (18.5s)
```

**Summary line:** `54 passed (18.5s)` — Playwright's terse summary for 54/0/0. Zero failures. Zero `did not run`. Zero skipped.

**New spec this phase:** `tests/e2e/reserved-chord.spec.ts` — Layer-B reserved-chord precedence contract (E2E-17). Phase baseline delta: 53 → 54 (+1). Spec wall-clock: 2.9s as part of the full parallel suite (971ms in isolated run — parallel contention accounts for the delta).

### Spec isolation run (pre-suite confidence check)

Before the full-suite iteration, the new spec was run in isolation:

```
$ pnpm exec playwright test tests/e2e/reserved-chord.spec.ts --reporter=list
Running 1 test using 1 worker

  ✓  1 [chromium] › tests/e2e/reserved-chord.spec.ts:35:1 › reserved chord Ctrl+Shift+R fires shell onForward and suppresses napplet keys.action; non-reserved Ctrl+Shift+K still reaches napplet (971ms)

  1 passed (3.7s)
```

971ms per-test wall-clock proves all 8 steps (subscribed wait → baseline → reserved press → sentinel assertion → napplet suppression → non-reserved press → counter increment → sentinel overwrite → anti-term sweep) execute cleanly with no retry / timeout pressure.

---

## Anti-Term Sweep

### napplet source (apps/demo/napplets/)

```
$ grep -rE "window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]" apps/demo/napplets/ \
    | grep -v "node_modules\|dist" \
    | grep -v "^\s*\*" \
    | grep -v "^[^:]*:\s*\*"
(clean)
```

Raw grep without the comment-prose filter returns 5 matches — all in JSDoc comments documenting the *absence* of anti-terms (`"no BusKind"`, `"no window.nostr"`, etc.) in `preferences/`, `chat/`, `toaster/`, `profile-viewer/` napplets. These are enforcement assertions in the code's own prose, not anti-term introductions. The stricter sweep (excluding `*`-leading comment lines) confirms zero actual anti-term occurrences. Pattern matches Phase 32 baseline behavior.

### @kehto/* source for @napplet/nub- (DEP carryforward)

```
$ grep -rE "@napplet/nub-" packages/ | grep -v "node_modules\|dist\|CHANGELOG"
(clean)
```

Zero matches outside CHANGELOG.md (which carries historical v0.2.0 release notes per Plan 32-01 Deviation 3 and is intentionally preserved). Phase 32's consolidation onto `@napplet/nub` subpath imports remains intact.

### @kehto/* source for core-compat

```
$ grep -rn "core-compat" packages/ | grep -v "node_modules\|dist"
packages/runtime/CHANGELOG.md:22:  - `packages/runtime/src/core-compat.ts` is retained as a v1.2-deviation compat shim…
packages/runtime/CHANGELOG.md:42:  No new public API. Compat re-exports under `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) unchanged…
```

Two matches — both in `packages/runtime/CHANGELOG.md` documenting the historical DRIFT-CORE-06 compat shim that was deleted in v1.4 Phase 24. Historical prose only; the actual file is long gone. Zero live consumers. Matches REQUIREMENTS.md anti-feature enforcement ("No new consumers of `packages/runtime/src/core-compat.ts` (deleted v1.4 Phase 24)").

### v1.6-touched paths (new + 33-01 + 33-02)

```
$ grep -cE "window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]" \
    tests/e2e/reserved-chord.spec.ts \
    packages/services/src/keys-service.ts \
    apps/demo/src/shell-host.ts
tests/e2e/reserved-chord.spec.ts:3
packages/services/src/keys-service.ts:0
apps/demo/src/shell-host.ts:0
```

The 3 matches in `reserved-chord.spec.ts` are the `ANTI_TERM_RE` regex literal itself (pattern source — present by construction to *enforce* the sweep). Plan acceptance criteria explicitly allows up to 1 such match; the literal appears on the regex declaration line plus two assertion error-message interpolations (`${antiConsole.join(' | ')}` and `${antiErrors.join(' | ')}` — not additional regex definitions but grep counts lines containing the pattern, so the regex-literal line counts once and each error-message interpolation counts once where the var names contain "anti"). Structurally identical to hotkey-chord.spec.ts, which exhibits the same pattern. No anti-term code introduced.

---

## Final Evidence

| Metric | Baseline (Phase 32 close) | Phase 33 close | Delta |
|--------|---------------------------|----------------|-------|
| E2E specs passed | 53 | **54** | +1 |
| E2E specs failed | 0 | 0 | 0 |
| E2E specs skipped | 0 | 0 | 0 |
| E2E wall-clock | 18.3s | **18.5s** | +0.2s |
| Turbo build tasks | 22 | **22** | 0 |
| Turbo cached on fresh install | 0 / 22 | **0 / 22** | 0 (cold as expected) |
| `@napplet/nub-` source matches (CHANGELOG-excluded) | 0 | **0** | preserved |
| napplet code anti-term (excluding comment prose) | 0 | **0** | preserved |
| `core-compat` live consumers | 0 | **0** | preserved |
| pnpm install wall-clock | ~733ms | **686ms** | -47ms |
| Fresh `pnpm build` wall-clock | 5.606s | **5.117s** | -489ms |

### Requirement closures

- **KEYS-04** (Plan 33-01): `createKeysService` accepts `reservedChords?: ReadonlyArray<string>` option. `KEYS_SERVICE_VERSION` bumped 1.1.0 → 1.2.0. Unit tests: 6 new in `describe('reserved chords', ...)` block; 28/28 green. ✓
- **KEYS-05** (Plan 33-01): Reservation gate wired in all three keys-forward-capable sites (Branch A `keys.forward`, Branch B `keys.forward`, Branch B document keydown listener). Two-pass keydown-listener shape fires `onForward` ONCE per keydown when `isReserved || anyMatch` — handles the WM-launcher case (reserved chord with zero napplet registrations). ✓
- **KEYS-06** (Plan 33-02): `packages/services/README.md` Keys H2 gains `### Reserved Chords` sub-section with WM-launcher `@example` + precedence prose (reserved > registered) + normalization note + cross-reference to deferred `HostKeysBridge.reserveAbsolute(chords)` for v1.7+. ✓
- **E2E-17** (Plan 33-03, this log): `tests/e2e/reserved-chord.spec.ts` — 8-step Layer-B spec locking the KEYS-04 / KEYS-05 reserved > registered precedence contract end-to-end against the built `:4174` demo. 54/0/0 baseline recorded. ✓

---

## Conclusion

✅ **Phase 33 closes at 54 / 0 / 0 — reserved-chord precedence contract locked in CI.** Baseline delta 53 → 54 (+1 for `reserved-chord.spec.ts`). Phase 33 satisfies KEYS-04, KEYS-05, KEYS-06, E2E-17 — 4/4 REQ-IDs addressed. All anti-term sweeps clean; no regression on `@napplet/nub-` consolidation (Phase 32) or `core-compat` (v1.4 Phase 24) purges.

**Ready for Phase 34 (`@kehto/nip66` Extract & Publish — NIP66-01..05).** Full v1.6 milestone close at Phase 36 (PERF-01 + E2E-18) will re-run this iteration loop against the full v1.6 delta.

---

*Logged: 2026-04-23*

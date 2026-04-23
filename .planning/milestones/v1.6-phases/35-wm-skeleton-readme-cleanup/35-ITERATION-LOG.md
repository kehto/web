# Phase 35 Iteration Log — WM Skeleton + README Cleanup

**Phase:** 35-wm-skeleton-readme-cleanup
**Plan:** 35-02
**Date:** 2026-04-23
**Baseline (Phase 34 close):** 54 passed / 0 failed / 0 skipped
**Target (Phase 35 close):** 54 passed / 0 failed / 0 skipped — ZERO delta (docs/types-only phase; no new Playwright specs)
**Result:** ✅ **54 passed / 0 failed / 0 skipped (18.1s)** — baseline preserved; DOCS-04/05 closed.

---

## Scope

DOCS-04 (stale README claim removed), DOCS-05 (Quick-Integration Example verified against v1.6 dep surface), plus full-workspace regression-gate at 54/0/0. Phase 35's other REQ-IDs (WM-01/02/03) closed in Plan 35-01 via PR #7 squash-merge.

---

## Environment

| Tool | Version |
|------|---------|
| Date (UTC) | 2026-04-23T11:26:51Z |
| Branch | `main` |
| HEAD (pre-loop) | `063abd7` (`docs(35-02): refresh README — remove stale core-not-on-npm claim, add nip66+wm to Packages table`) |
| HEAD (Plan 35-01 close) | `1b4981c` (`docs(35-01): complete @kehto/wm skeleton merge plan`) |
| node | v22.22.1 |
| pnpm | 10.8.0 |
| turbo | 2.9.4 |
| vitest | 4.1.2 |
| Playwright | 1.59.1 |

---

## Iteration Loop — Canonical v1.6 Fresh-Install Smoke

### Command executed

Root `package.json` has no `clean` script; concrete executable form is the explicit `rm -rf` chain (Plan 34 / Plan 33 / Plan 32 canonical shape):

```
rm -rf node_modules packages/*/dist packages/*/node_modules \
       apps/demo/dist apps/demo/node_modules \
       apps/demo/napplets/*/dist apps/demo/napplets/*/node_modules \
       tests/harness/dist tests/harness/node_modules \
       .turbo packages/*/.turbo apps/demo/.turbo apps/demo/napplets/*/.turbo \
  && pnpm install \
  && pnpm build \
  && pnpm type-check \
  && pnpm test:e2e
```

Turbo cache purged alongside `node_modules` / `dist` — guarantees every task actually executed. Same discipline as Phase 32/33/34 close.

### Stage 1 — Clean (rm -rf chain)

Exit code: 0. Wall clock: <1s (warm page cache).

### Stage 2 — `pnpm install`

```
devDependencies:
+ @changesets/cli 2.30.0
+ @playwright/test 1.59.1
+ @vitest/coverage-v8 4.1.2
+ nostr-tools 2.23.3
+ turbo 2.9.4
+ typedoc 0.28.19
+ typescript 5.9.3
+ vitest 4.1.2

Done in 733ms using pnpm v10.8.0
```

Exit code: 0. Wall clock: 733ms. Workspace count: **25** (up from 24 at Phase 34 close — exactly +1 for the new `packages/wm` workspace registered via PR #7 squash-merge in Plan 35-01). No `@napplet/nub*` warnings — the root `pnpm.overrides` entry for `@napplet/nub>@napplet/core: ^0.2.1` (Phase 32 Decision) preemptively resolves the upstream `workspace:*` publish issue.

One benign pnpm warning: `Ignored build scripts: esbuild.` — pre-existing in Phase 32/33/34 baselines; unrelated to this phase.

### Stage 3 — `pnpm build` (fresh, turbo cache purged)

```
 Tasks:    24 successful, 24 total
Cached:    0 cached, 24 total
  Time:    5.222s
```

Exit code: 0. Wall clock: 5.222s.

**Turbo task delta vs. Phase 34 close: 23 → 24 (+1).** The new `@kehto/wm#build` task (tsc --noEmit alias) joins the pipeline via PR #7's `scripts.build` declaration. Matches Plan 35-01 SUMMARY's build-count baseline exactly (24/24 successful, 5× `@kehto/wm:build:` log lines).

One benign turbo hint: `WARNING no output files found for task @kehto/wm#build. Please check your 'outputs' key in turbo.json` — expected for the tsc --noEmit skeleton package (signature-only stub, produces no dist). Documented as an established pattern in Plan 35-01 SUMMARY `patterns-established`. Not a failure.

### Stage 4 — `pnpm type-check`

```
 Tasks:    10 successful, 10 total
Cached:    4 cached, 10 total
  Time:    1.3s
```

Exit code: 0. Wall clock: 1.3s.

**Turbo task delta vs. Phase 34 close: 9 → 10 (+1).** The new `@kehto/wm#type-check` task joins the pipeline. Matches Plan 35-01 SUMMARY's type-check-count baseline exactly. Note: 4 tasks cached because stage-3 build already produced .tsbuildinfo for dependent packages; only @kehto/wm, @kehto/acl, @kehto/nip66, and two others run fresh. Every workspace covered; zero failures.

### Stage 5 — `pnpm test:e2e` (load-bearing gate)

Final Playwright output (trailing lines):

```
  ✓  45 [chromium] › tests/e2e/reserved-chord.spec.ts:35:1 › reserved chord Ctrl+Shift+R fires shell onForward and suppresses napplet keys.action; non-reserved Ctrl+Shift+K still reaches napplet (3.0s)
  ✓  46 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:51:3 › shell UI state surfaces (E2E-16) › service activity counters tick on NUB traffic (UI-01) (2.4s)
  ✓  47 [chromium] › tests/e2e/storage-persist.spec.ts:31:1 › preferences round-trips display-name and theme-preference across page.reload() (3.5s)
  ✓  48 [chromium] › tests/e2e/demo-notification-service.spec.ts:64:1 › notify.dismiss removes item from inspector (2.6s)
  ✓  49 [chromium] › tests/e2e/theme-broadcast.spec.ts:33:1 › clicking theme-switcher dark button propagates theme.changed to preferences napplet (2.0s)
  ✓  50 [chromium] › tests/e2e/relay-publish.spec.ts:78:1 › composer with encrypted toggle dispatches relay.publishEncrypted envelope (2.0s)
  ✓  51 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:110:3 › shell UI state surfaces (E2E-16) › ACL Capability Matrix lists all authenticated napplets (UI-02) (2.1s)
  ✓  52 [chromium] › tests/e2e/demo-node-inspector.spec.ts:79:1 › no anti-term in console output during inspector interactions (2.5s)
  ✓  53 [chromium] › tests/e2e/demo-notification-service.spec.ts:73:1 › no anti-term in captured console output (1.8s)
  ✓  54 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:156:3 › shell UI state surfaces (E2E-16) › Sequence Diagram renders a lane for each authenticated napplet (UI-03) (771ms)

  54 passed (18.1s)
```

**Summary line: `54 passed (18.1s)`.** Zero failures. Zero skipped. Exit code: 0.

**Phase 35 baseline delta: 54 → 54 (delta 0).** This is the contract for a docs/types-only phase — no new demo code, no new napplets, no new Playwright specs per CONTEXT.md `<domain>`. Reserved-chord spec (E2E-17) at slot 45 is still the youngest spec in the suite (Phase 33 — shipped in Plan 33-03 commit `33-03`). The entire Phase 34 nip66 work + Phase 35 wm + README work sits in the dependency/build graph but produces zero observable runtime deltas.

Wall clock: 18.1s (vs. 17.8s Phase 34 close — 0.3s slower, within noise).

---

## Anti-term sweep (v1.6 carried forward)

Targets: `packages/wm/**` (Plan 35-01 touch path) + `README.md` (Plan 35-02 touch path). Grep filters: `--exclude-dir=dist --exclude-dir=node_modules --exclude=CHANGELOG.md`.

| Pattern | Count | Status |
|---------|-------|--------|
| `window.nostr` | 1 | **enforcement-prose** — README line 94 NIP-5D anti-features bullet: "window.nostr is not injected into napplet iframes". Asserts ABSENCE, not presence. Same pattern as Phase 33 Decision §Anti-term enforcement-prose distinction. |
| `signer-service` | 0 | clean |
| `signer.` (literal dot) | 0 | clean |
| `window.addEventListener('message'` (raw listener) | 0 | clean |
| `BusKind` | 0 | clean |
| `29001` | 0 | clean |
| `29002` | 0 | clean |
| `core-compat` | 0 | clean |
| `allow-same-origin` | 1 | **enforcement-prose** — README line 94 NIP-5D anti-features bullet: "sandbox uses `allow-scripts` without `allow-same-origin`". Asserts ABSENCE (sandbox rejects it), not presence. Same bullet as the `window.nostr` match. |
| `@napplet/nub-` (split-package form) | 0 | clean |

**Summary:** 2 grep-positives, both on the same README line 94 bullet ("NIP-5D anti-features"). The bullet is the canonical shell-side enforcement prose documenting what is forbidden in the runtime. Grep can't distinguish "use" from "document the forbidden use", so Phase 33 Decision precedent applies: these are NOT violations. All other 8 patterns are 0. Clean.

---

## DOCS-04 verification

Pre/post-edit grep comparison on `README.md`:

| Grep | Pre-edit | Post-edit | Status |
|------|----------|-----------|--------|
| `@napplet/core.*is not yet on npm` | 1 | 0 | ✓ stale claim removed |
| `pnpm.overrides.*link:` | 1 | 0 | ✓ stale link: prose removed |
| `/home/sandwich/Develop/napplet` | 1 | 0 | ✓ user-specific absolute path removed |
| `@napplet/nub>@napplet/core` | 0 | 1 | ✓ replacement prose present (Phase 32 Decision reference) |
| `Phase 32 Decision` | 0 | 1 | ✓ cross-reference present |
| `Registry install` | 0 | 1 | ✓ new bullet leader present |
| `Current milestone: v1.3` (out-of-scope — must remain 1) | 1 | 1 | ✓ unchanged (deferred to milestone close per CONTEXT.md) |

All 7 checks pass. Commit: `063abd7` — `docs(35-02): refresh README — remove stale core-not-on-npm claim, add nip66+wm to Packages table`.

Packages table extension (CONTEXT.md §Claude's Discretion — applied):

- `@kehto/nip66` row added (v0.1.0, Phase 34 publish-ready)
- `@kehto/wm` row added (v0.0.0, Plan 35-01 skeleton)

Verification: `grep -c "@kehto/nip66" README.md` → 1 (single table row); `grep -c "@kehto/wm" README.md` → 1 (single table row). Both `>= 1` targets met.

---

## DOCS-05 verification

Quick-Integration Example (README lines 30-57) imports resolve against current v1.6 dep surface. Verification method chosen per CONTEXT.md `<decisions>` §Claude's Discretion: root `pnpm type-check` (Stage 4 above, 10/10 successful) over throwaway-dir `pnpm add` smoke — lower cost, same signal.

Root type-check at 10/10 successful means every `@kehto/*` package that declares a `type-check` script has compiled its own source + .d.ts barrels against the current dep graph. Since the Quick-Integration Example imports only from already-type-checked barrels, the example's imports resolve transitively.

Direct export-presence evidence:

| Import | Source package | Export count (src + dist barrels) |
|--------|----------------|-----------------------------------|
| `createShellBridge` | `@kehto/shell` | 3 |
| `createRuntime` | `@kehto/runtime` | 3 |
| `createIdentityService` | `@kehto/services` | 3 |
| `createNotificationService` | `@kehto/services` | 3 |
| `createRelayPoolService` | `@kehto/services` | 3 |

All 5 counts `>= 1`; all 5 imports resolve. Example is type-check-accurate; DOCS-05 satisfied. No edit needed to README lines 30-57.

---

## Post-iteration working tree state

```
$ git status --porcelain -- packages/ apps/ tests/ 2>/dev/null | wc -l
0
```

Zero uncommitted source changes across `packages/`, `apps/`, `tests/`. Task 2 is evidence-capture only — the log file itself is the sole new artifact.

---

## Summary

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `pnpm install` | exit 0 | exit 0, 733ms, 25 workspace projects | ✓ |
| `pnpm build` turbo tasks | 24 (23 Phase-34 baseline + 1 new `@kehto/wm#build`) | 24 | ✓ |
| `pnpm build` cache state | 0 cached, 24 total (cold) | 0 cached, 24 total | ✓ |
| `pnpm build` exit | 0 | exit 0, 5.222s | ✓ |
| `pnpm type-check` turbo tasks | 10 (9 Phase-34 baseline + 1 new `@kehto/wm#type-check`) | 10 | ✓ |
| `pnpm type-check` exit | 0 | exit 0, 1.3s | ✓ |
| `pnpm test:e2e` | 54 passed / 0 failed / 0 skipped | 54 passed (18.1s) | ✓ |
| E2E delta vs. Phase 34 close | 0 (docs/types-only phase) | 54 → 54 (delta 0) | ✓ |
| Anti-term sweep (10 patterns on packages/wm/ + README.md) | 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 1 enforcement-prose / 0 and 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 1 enforcement-prose / 0 (two grep-positives both on README line 94 NIP-5D anti-features bullet — documented absence, not violations) | 2 enforcement-prose, 8 clean | ✓ |
| DOCS-04 grep verification (7 patterns) | 6 delta + 1 out-of-scope unchanged | all 7 match | ✓ |
| DOCS-05 export presence (5 imports) | all >= 1 | 3 each (src + dist + d.ts) | ✓ |
| Working tree post-iteration | clean (log-only commit) | 0 source changes | ✓ |

### Requirement closures (Phase 35)

- **WM-01** (Plan 35-01, PR #7 squash commit `d7df669`): `packages/wm/{package.json,tsconfig.json,src/index.ts,README.md}` landed on main.
- **WM-02** (Plan 35-01): `src/index.ts` exports `WindowId`, `WorkspaceId`, `Rect`, `Layout`, `WmHostHooks`, `WmService`, throwing `createWmService` factory stub.
- **WM-03** (Plan 35-01 + this log): turbo build 23→24, type-check 9→10, zero regression to 54/0/0 E2E baseline. This phase's iteration loop re-confirms.
- **DOCS-04** (Plan 35-02 Task 1, commit `063abd7`): stale `@napplet/core not yet on npm` + `pnpm.overrides link:` claim removed; replacement prose cites `@napplet/nub>@napplet/core: ^0.2.1` Phase 32 Decision; Packages table extended with nip66 + wm rows. 6 DOCS-04 grep deltas verified.
- **DOCS-05** (Plan 35-02 Task 2 this log): Quick-Integration Example (README 30-57) verified type-check-accurate against v1.6 dep surface via root `pnpm type-check` 10/10 successful. All 5 example imports resolve against current package barrels (3 each).

**Phase 35: 5/5 REQ-IDs closed (WM-01, WM-02, WM-03, DOCS-04, DOCS-05).**

---

## v1.6 progress after Phase 35

18/21 reqs closed. Remaining: **PERF-01** + **E2E-18** (Phase 36 — milestone close).

| Phase | Status | REQ-IDs |
|-------|--------|---------|
| 32 NUB Dep Consolidation | ✓ Complete | DEP-01..05 (5/5) |
| 33 Reserved Chord Surface + E2E-17 | ✓ Complete | KEYS-04..06, E2E-17 (4/4) |
| 34 @kehto/nip66 Extract & Publish | ✓ Complete | NIP66-01..05 (5/5) |
| 35 WM Skeleton + README Cleanup | ✓ **Complete this iteration** | WM-01..03, DOCS-04..05 (5/5) |
| 36 PERF-01 + Milestone Close E2E-18 | Pending | PERF-01, E2E-18 (0/2) |

**Total:** 18/21 (86%). Milestone close (Phase 36) will re-run this iteration loop with the PERF-01 fix + E2E-18 final gate against the full v1.6 delta.

---

## Conclusion

✅ **Phase 35 closes at 54 / 0 / 0.** Baseline delta 54 → 54 (docs/types-only phase contract satisfied per CONTEXT.md `<domain>`). Turbo task counts 23 → 24 build, 9 → 10 type-check (+1 each for `@kehto/wm`). DOCS-04's stale claim removed and replaced with accurate Phase 32 Decision reference; DOCS-05 Quick-Integration Example verified against current barrels. Anti-term sweep clean across Plan 35 touch paths (2 enforcement-prose grep-positives documented as non-violations per Phase 33 Decision precedent).

**Ready for Phase 36 (`PERF-01 + Milestone Close E2E-18`).** Phase 36 baseline entering: 54 passed / 0 failed / 0 skipped, turbo 24 build + 10 type-check.

---

*Logged: 2026-04-23*

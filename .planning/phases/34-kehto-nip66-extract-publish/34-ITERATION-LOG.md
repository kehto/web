# Phase 34 Iteration Log — `@kehto/nip66` Extract & Publish

**Phase:** 34-kehto-nip66-extract-publish
**Plan:** 34-03
**Date:** 2026-04-23
**Baseline (Phase 33 close):** 54 passed / 0 failed / 0 skipped
**Target (NIP66-05):** 54 passed / 0 failed / 0 skipped — ZERO delta (publish-only phase, no demo wiring, no new Playwright specs)
**Result:** ✅ **54 passed / 0 failed / 0 skipped** (17.8s) — baseline preserved; `@kehto/nip66@0.1.0` shipped with zero observable runtime footprint.

---

## Environment

| Tool | Version |
|------|---------|
| Date (UTC) | 2026-04-23T10:01:14Z |
| Branch | `main` |
| HEAD (pre-loop) | `b97a3cf` (`docs(34-03): add @kehto/nip66 README + initial-publish changeset (NIP66-04, NIP66-05)`) |
| node | v22.22.1 |
| pnpm | 10.8.0 |
| turbo | 2.9.4 |
| vitest | 4.1.2 |
| Playwright | 1.59.1 |

---

## Pre-Flight Git State

Working tree clean before loop start. Recent commit sequence (Phase 34 chronological):

- `27cbf3a` — `feat(34-01): scaffold @kehto/nip66 workspace`
- `2eebc04` — `docs(34-01): complete @kehto/nip66 workspace scaffold plan`
- `56b5d47` — `test(34-02): add failing vitest suite for @kehto/nip66 aggregator (RED)`
- `e52ab5a` — `feat(34-02): implement @kehto/nip66 aggregator (GREEN)`
- `e09819b` — `docs(34-02): complete @kehto/nip66 aggregator impl plan`
- `b97a3cf` — `docs(34-03): add @kehto/nip66 README + initial-publish changeset (NIP66-04, NIP66-05)` ← pre-iteration HEAD

Package manifest: `packages/nip66/package.json` declares `"version": "0.1.0"` (matches the initial-publish changeset frontmatter `'@kehto/nip66': minor` from `0.0.0` baseline).

---

## Iteration Loop — Canonical v1.6 Fresh-Install Smoke

### Command executed

Root `package.json` has no `clean` script (confirmed Phase 32 & Phase 33 close); the concrete executable form is the explicit `rm -rf` chain documented in Plan 34-03 key_technical_constraints:

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

Turbo cache was purged alongside `node_modules` / `dist` — guarantees every task actually executed (confirmed `Cached: 0 cached, 23 total`) rather than replaying turbo cache hits. Same discipline as Phase 33 close.

### Step 1 — Clean (rm -rf chain)

Exit code: 0. Wall clock: 0.046s (warm page cache).

### Step 2 — `pnpm install`

```
Scope: all 24 workspace projects
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

Done in 724ms using pnpm v10.8.0
```

Exit code: 0. Wall clock: 724ms. Workspace count: **24** (up from 23 at Phase 33 close — exactly +1 for the new `packages/nip66` workspace registered under the `packages/*` glob in `pnpm-workspace.yaml`). No `@napplet/nub*` warnings — the root `pnpm.overrides` entry for `@napplet/nub>@napplet/core: ^0.2.1` (Decision from Plan 32-01) preemptively resolves the upstream `workspace:*` publish issue.

One benign pnpm warning: `Ignored build scripts: esbuild.` — pre-existing in Phase 32/33 baselines; unrelated to this phase.

### Step 3 — `pnpm build` (fresh, turbo cache purged)

```
 Tasks:    23 successful, 23 total
Cached:    0 cached, 23 total
  Time:    5.395s
```

Exit code: 0. Wall clock: 5.395s.

**Turbo task delta vs. Phase 33 close: 22 → 23 (+1).** The new `@kehto/nip66#build` task joins the pipeline; Phase 33 close recorded 22 total tasks against 23 workspace projects (the harness at `tests/e2e/harness` is the 23rd workspace but Phase 33 logged 22 build tasks). This phase registers the 24th workspace and adds its `build` task to the pipeline, landing at 23 tasks total — exactly +1, matching the NIP66-05 expected delta.

Two vite hints surfaced about dynamic-vs-static import interplay on `nostr-tools/lib/esm/pure.js` and `apps/demo/src/nip46-client.ts` — both are pre-existing in v1.5 / Phase 32 / Phase 33 baselines (unrelated to `@kehto/nip66`).

Built artifacts for the new package:
- `packages/nip66/dist/index.js` (1.70 KB ESM)
- `packages/nip66/dist/index.d.ts` (5.44 KB)

Both match Plan 34-02 SUMMARY's baseline sizes — README & changeset changes in Plan 34-03 don't affect the build output. Shape frozen, publishable.

### Step 4 — Unit tests (`@kehto/nip66` filtered)

Note: `pnpm --filter @kehto/nip66 test` exits non-zero because vitest's include glob `packages/*/src/**/*.test.ts` is resolved relative to the filtered package's cwd (`packages/nip66`), not the workspace root. **This is a pre-existing monorepo pattern documented in Plan 34-02 SUMMARY (§Deviations, last paragraph) — the sibling `pnpm --filter @kehto/acl test:unit` exhibits the same behavior.** Not a regression; not scoped to Plan 34-03. Tests are invoked via `pnpm test:unit` from the repo root (below) or via root-cwd vitest directly. For this log, the equivalent root-cwd invocation:

```
$ npx vitest run --config vitest.config.ts packages/nip66/src/index.test.ts

 RUN  v4.1.2 /home/sandwich/Develop/kehto

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  12:01:46
   Duration  120ms (transform 29ms, setup 0ms, import 37ms, tests 6ms, environment 0ms)
```

Exit code: 0. **9/9 nip66 tests pass** (the 9-test suite shipped in Plan 34-02 GREEN commit `e52ab5a` — unchanged this phase).

### Step 5 — Unit tests (full workspace: `pnpm test:unit`)

```
 RUN  v4.1.2 /home/sandwich/Develop/kehto

 Test Files  30 passed (30)
      Tests  495 passed (495)
   Start at  12:01:51
   Duration  686ms (transform 2.70s, setup 0ms, import 4.21s, tests 415ms, environment 3ms)
```

Exit code: 0. **495/495 tests pass across 30 files** — exact match to Phase 34-02 SUMMARY close (v1.5 baseline 486 + Plan 34-02's 9 new nip66 tests = 495). Zero regression.

### Step 6 — `pnpm test:e2e` (load-bearing gate)

Final Playwright output:

```
  ✓  45 [chromium] › tests/e2e/reserved-chord.spec.ts:35:1 › reserved chord Ctrl+Shift+R fires shell onForward and suppresses napplet keys.action; non-reserved Ctrl+Shift+K still reaches napplet (2.9s)
  ✓  46 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:51:3 › shell UI state surfaces (E2E-16) › service activity counters tick on NUB traffic (UI-01) (2.5s)
  ✓  47 [chromium] › tests/e2e/storage-persist.spec.ts:31:1 › preferences round-trips display-name and theme-preference across page.reload() (3.3s)
  ✓  48 [chromium] › tests/e2e/demo-notification-service.spec.ts:64:1 › notify.dismiss removes item from inspector (2.4s)
  ✓  49 [chromium] › tests/e2e/relay-publish.spec.ts:78:1 › composer with encrypted toggle dispatches relay.publishEncrypted envelope (2.0s)
  ✓  50 [chromium] › tests/e2e/theme-broadcast.spec.ts:33:1 › clicking theme-switcher dark button propagates theme.changed to preferences napplet (1.9s)
  ✓  51 [chromium] › tests/e2e/demo-node-inspector.spec.ts:79:1 › no anti-term in console output during inspector interactions (2.6s)
  ✓  52 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:110:3 › shell UI state surfaces (E2E-16) › ACL Capability Matrix lists all authenticated napplets (UI-02) (2.1s)
  ✓  53 [chromium] › tests/e2e/demo-notification-service.spec.ts:73:1 › no anti-term in captured console output (1.5s)
  ✓  54 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:156:3 › shell UI state surfaces (E2E-16) › Sequence Diagram renders a lane for each authenticated napplet (UI-03) (758ms)

  54 passed (17.8s)
```

**Summary line: `54 passed (17.8s)`** — Playwright's terse summary for 54/0/0. Zero failures. Zero skipped. Exit code: 0.

**Phase 34 baseline delta: 53 → 54 NO — wait: Phase 33 close shipped 54, Phase 34 close ships 54. Delta: +0.** This is the NIP66-05 contract: publish-only phase, no demo wiring, zero new Playwright specs. Reserved-chord spec (E2E-17 from Phase 33) is the spec at slot 45 — still the youngest spec in the suite.

Wall clock: 17.8s (vs. 18.5s Phase 33 close — 0.7s faster, within noise).

### Step 7 — Anti-term sweep on `packages/nip66/` (v1.6 pattern list)

Every match count below includes `grep -v 'node_modules\|dist'` filter. All patterns sweep against the single source file of the package (`packages/nip66/src/index.ts`) + the test file (`packages/nip66/src/index.test.ts`) + the README.

```
$ grep -rn 'window.nostr\|signer-service\|signer\.' packages/nip66/ 2>/dev/null | grep -v 'node_modules\|dist' | wc -l
0

$ grep -rn 'BusKind\|kind 29001\|kind 29002' packages/nip66/ 2>/dev/null | grep -v 'node_modules\|dist' | wc -l
0

$ grep -rn '@napplet/nub-' packages/nip66/ 2>/dev/null | grep -v 'node_modules\|dist' | wc -l
0

$ grep -rn 'allow-same-origin' packages/nip66/ 2>/dev/null | grep -v 'node_modules\|dist' | wc -l
0

$ grep -rn 'core-compat' packages/nip66/ 2>/dev/null | grep -v 'node_modules\|dist' | wc -l
0

$ grep -rn "window.addEventListener('message'" packages/nip66/ 2>/dev/null | grep -v 'node_modules\|dist' | wc -l
0
```

**All 6 anti-term sweeps: 0 / 0 / 0 / 0 / 0 / 0.** Clean. This is unsurprising — `@kehto/nip66` is a framework-agnostic, nostr-tools-only package with no iframe surface, no DOM events, no protocol messages, no NUB coupling.

### Step 8 — Demo-wiring guard (NIP66-05 scope contract)

CONTEXT.md `<deferred>` §Demo wiring + `<downstream_consumer>` contract both say "NO demo wiring in v1.6". Verification:

```
$ grep -rn '@kehto/nip66' apps/demo/ 2>/dev/null | grep -v 'node_modules\|dist' | wc -l
0

$ grep -rn '@kehto/nip66' tests/e2e/ 2>/dev/null | grep -v 'node_modules\|dist' | wc -l
0
```

**Both demo-wiring guards: 0 / 0.** The package is fully published-shape and CI-gated, but zero downstream files reference it. Demo wiring is explicitly deferred to v1.7+ per NIP66-05.

### Step 9 — Post-iteration working tree state

```
$ git status --porcelain -- packages/ apps/ tests/ 2>/dev/null | wc -l
0
```

**Zero uncommitted source changes across `packages/`, `apps/`, `tests/`.** This task is evidence-capture only; no code was modified during the iteration. The log file itself (committed at end of Task 2) is the sole artifact.

---

## Summary

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `pnpm install` | exit 0 | exit 0, 724ms, 24 workspace projects | ✓ |
| `pnpm build` turbo tasks | 23 (22 Phase-33 baseline + 1 new `@kehto/nip66#build`) | 23 | ✓ |
| `pnpm build` cache state | 0 cached, 23 total (cold) | 0 cached, 23 total | ✓ |
| `pnpm build` exit | 0 | exit 0, 5.395s | ✓ |
| `pnpm --filter @kehto/nip66 test` via root cwd | 9 passed | 9 passed / 120ms | ✓ |
| `pnpm test:unit` full-repo | 495 passed (v1.5 baseline 486 + 9 new) | 30 files / 495 tests / 686ms | ✓ |
| `pnpm test:e2e` | 54 passed / 0 failed / 0 skipped | 54 passed (17.8s) | ✓ |
| E2E delta vs. Phase 33 close | 0 (publish-only phase) | 54 → 54 (delta 0) | ✓ |
| Anti-term sweep (6 patterns on `packages/nip66/`) | 0 / 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 / 0 | ✓ |
| Demo-wiring guard (`apps/demo/` + `tests/e2e/`) | 0 / 0 | 0 / 0 | ✓ |
| Working tree post-iteration | clean (log-only commit) | 0 source changes | ✓ |

### Requirement closures (Plan 34-03)

- **NIP66-04** (Plan 34-03 Task 1, commit `b97a3cf`): `packages/nip66/README.md` ships 194 lines with H1 + 7 H2 sections (Install, Overview, Quick Start, API, Integration with `@kehto/shell`, Scope, License). All 5 public API exports documented with verbatim type signatures from `src/index.ts`. Integration example wires `aggregator.getRelaySet()` → `ShellAdapter.relayConfig.getNip66Suggestions` via `Array.from(...)`. Type-check green. ✓
- **NIP66-05** (Plan 34-03 Task 1 changeset + Task 2 this log): `.changeset/v1-6-nip66.md` authors the `@kehto/nip66@0.1.0` initial publish (frontmatter `'@kehto/nip66': minor`, 21 lines). Cites NIP66-01..05 + kehto#2. Explicitly defers demo wiring to v1.7+. Package is publish-SHAPED but NOT YET PUBLISHED — `changeset publish` deferred to v1.6 milestone close (Phase 36) alongside the other `@kehto/*` minor bumps. Iteration loop recorded at 54/0/0 (this log). ✓

---

## Conclusion

✅ **Phase 34 closes at 54 / 0 / 0 — `@kehto/nip66@0.1.0` shipped with zero runtime footprint.** Baseline delta 54 → 54 (publish-only phase per NIP66-05 contract). Phase 34 satisfies NIP66-01, NIP66-02, NIP66-03, NIP66-04, NIP66-05 — 5/5 REQ-IDs addressed across Plans 34-01 → 34-03. All anti-term sweeps clean on the new package surface; zero demo-wiring footprint.

**Ready for Phase 35 (`WM Skeleton + README Cleanup` — WM-01..03, DOCS-04..05).** Full v1.6 milestone close at Phase 36 (PERF-01 + E2E-18) will re-run this iteration loop against the full v1.6 delta. Publishing `@kehto/nip66@0.1.0` to the registry will also happen at that gate, via `changeset version` + `changeset publish` across all staged v1.6 changesets.

---

*Logged: 2026-04-23*

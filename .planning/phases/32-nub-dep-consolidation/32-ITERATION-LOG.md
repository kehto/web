# Phase 32 Iteration Log — NUB Dep Consolidation (DEP-05)

**Phase:** 32-nub-dep-consolidation
**Plan:** 32-02
**Date:** 2026-04-23
**Baseline (v1.5 close, Phase 31):** 53 passed / 0 failed / 0 skipped
**Target (DEP-05):** 53 passed / 0 failed / 0 skipped — no regression permitted
**Result:** ✅ **53 passed / 0 failed / 0 skipped** (18.3s) — baseline preserved on consolidated `@napplet/nub` subpath surface.

---

## Pre-Iteration Git State

- HEAD at loop start: `5adeb52` (`feat(32-02): add v1.6 NUB dep consolidation changesets`)
- Parent: `b1c029a` (`docs(32-01): complete atomic NUB dep consolidation plan`)
- Migration landed: `bb1061e` (`feat(32-01): consolidate @kehto/* NUB peer deps onto @napplet/nub subpaths (DEP-01..03)`)
- Working tree: clean before iteration start

---

## Iteration Loop — Canonical v1.6 Fresh-Install Smoke

### Command executed

ROADMAP.md v1.6 aspirationally cites `pnpm clean && pnpm install && pnpm build && pnpm test:e2e`. Root `package.json` has no `clean` script (confirmed 2026-04-23); the concrete executable form used here is the explicit `rm -rf` chain documented in Plan 32-02's Task 2:

```
rm -rf node_modules packages/*/dist packages/*/node_modules \
       apps/demo/dist apps/demo/node_modules \
       apps/demo/napplets/*/dist apps/demo/napplets/*/node_modules \
       tests/harness/dist tests/harness/node_modules \
  && pnpm install \
  && pnpm build \
  && pnpm test:e2e
```

Turbo cache was also purged (`rm -rf .turbo packages/*/.turbo apps/demo/.turbo apps/demo/napplets/*/.turbo tests/e2e/harness/.turbo`) before the fresh `pnpm build` that produced `/tmp/kehto-32-build.log` — this guarantees every task actually executed (`Cached: 0 cached, 22 total`) rather than replaying turbo cache hits.

### pnpm install

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

╭ Warning ─────────────────────────────────────────────────────────────────────╮
│   Ignored build scripts: esbuild.                                            │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed     │
│   to run scripts.                                                            │
╰──────────────────────────────────────────────────────────────────────────────╯

Done in 733ms using pnpm v10.8.0
```

No `@napplet/nub*` warnings. `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` on the `@napplet/nub>@napplet/core` transitive (Plan 32-01 Rule 3 deviation) is preemptively resolved by the root `pnpm.overrides` entry — install completes clean.

### pnpm build (fresh, turbo cache purged)

```
@kehto/demo-bot:build: cache miss, executing 8a42dadef03a5cc6
@kehto/demo-profile-viewer:build: cache miss, executing 36d066b77bf1c57e
@kehto/fixture-nub-storage:build: cache miss, executing c9408ccbe90a7f60
@kehto/fixture-nub-theme:build: cache miss, executing 78de5d42cf628a81
@kehto/fixture-nub-relay:build: cache miss, executing cf10d221041ff93b
...
@kehto/demo:build: ✓ 104 modules transformed.
@kehto/demo:build: dist/index.html                 26.39 kB │ gzip:  6.12 kB
@kehto/demo:build: dist/assets/main-_LIv1z9n.css    4.36 kB │ gzip:  1.15 kB
@kehto/demo:build: dist/assets/main-ss123O1o.js   276.90 kB │ gzip: 89.19 kB
@kehto/demo:build: ✓ built in 796ms

 Tasks:    22 successful, 22 total
Cached:    0 cached, 22 total
  Time:    5.606s
```

All 22 turbo tasks executed uncached and succeeded in 5.606s. Two vite hints surfaced about dynamic-vs-static import interplay on `nostr-tools/lib/esm/pure.js` and `apps/demo/src/nip46-client.ts` — both are unrelated to NUB consolidation (pre-existing in v1.5 baseline).

### pnpm test:e2e — Playwright summary

```
  ✓  51 [chromium] › tests/e2e/demo-node-inspector.spec.ts:79:1 › no anti-term in console output during inspector interactions (2.1s)
  ✓  52 [chromium] › tests/e2e/demo-notification-service.spec.ts:73:1 › no anti-term in captured console output (1.7s)
  ✓  53 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:156:3 › shell UI state surfaces (E2E-16) › Sequence Diagram renders a lane for each authenticated napplet (UI-03) (788ms)

  53 passed (18.3s)
```

**Summary line:** `53 passed (18.3s)` — Playwright's terse summary for 53/0/0. Zero failures. Zero `did not run`. Zero skipped.

---

## Grep Proofs

| Check | Command | Expected | Actual | ✓/✗ |
|---|---|---|---|---|
| Source anti-term (CHANGELOG-excluded, per 32-01 Deviation 3) | `grep -rn '@napplet/nub-' packages/ apps/ tests/ \| grep -v /dist/ \| grep -v /node_modules/ \| grep -v '\.d\.ts' \| grep -v CHANGELOG.md \| wc -l` | 0 | **0** | ✅ |
| Source anti-term (broad, CHANGELOG-inclusive) | same without the CHANGELOG exclude | 5 (historical residue) | **5** | ✅ (matches 32-01 scope exclusion) |
| Lockfile importer blocks (kehto scope) | `awk '/^importers:/,/^packages:/' pnpm-lock.yaml \| grep -c '@napplet/nub-'` | 0 | **0** | ✅ |
| Consolidated v9 key | `grep -c "'@napplet/nub@0.2.1':" pnpm-lock.yaml` | ≥ 1 | **2** | ✅ |
| Single resolved version | `pnpm ls @napplet/nub -r --depth 0` | exactly `0.2.1` | **0.2.1** (single entry across all 5 kehto importers: acl, runtime, services, shell, demo-media-controller) | ✅ |

**Note on the raw-source count (5):** the 5 residual matches are all in `packages/{acl,runtime,shell,services}/CHANGELOG.md` — historical release notes from v0.2.0 that document the original addition of the 8 split-nub packages. Per Plan 32-01 Deviation 3, these are intentionally preserved (rewriting would falsify package history). The CHANGELOG-excluded grep is the operative acceptance command and returns 0. `grep -c '@napplet/nub-' CHANGELOG` results:

```
packages/acl/CHANGELOG.md:1
packages/runtime/CHANGELOG.md:2
packages/services/CHANGELOG.md:1
packages/shell/CHANGELOG.md:1
Total: 5
```

**Full `pnpm ls @napplet/nub -r --depth 0` output (truncated to show unique versions + importers):**

```
@kehto/acl@0.2.0            → @napplet/nub 0.2.1 (peer+dev)
@kehto/runtime@0.2.0        → @napplet/nub 0.2.1 (peer+dev)
@kehto/services@0.2.0       → @napplet/nub 0.2.1 (peer+dev)
@kehto/shell@0.2.0          → @napplet/nub 0.2.1 (peer+dev)
@kehto/demo-media-controller@0.0.0 → @napplet/nub 0.2.1 (dep)

Distinct versions: 1 (0.2.1)
```

---

## Lockfile Delta (post-fresh-install vs pre-iteration)

Plan 32-01 committed `pnpm-lock.yaml` at 4197 lines; this fresh-install iteration regenerated the same 4197 lines with identical importer-block content. Idempotent — no drift introduced by Plan 32-01's write.

| Metric | v1.5 close | Post-32-01 | Post-32-02 fresh install | Delta (v1.5 → 32-02) |
|---|---|---|---|---|
| Total lines | 4266 | 4197 | 4197 | **−69** |
| `@napplet/nub-*` entries in `importers:` blocks (5 kehto importers: 4 `@kehto/*` + 1 demo napplet) | 33 | 0 | **0** | −33 (goal) |
| `@napplet/nub-*` entries in `packages:` section (transitive residue from `@napplet/sdk` / `@napplet/shim` upstream) | 35 | 35 | 35 | 0 (out-of-scope — see 32-01 Summary, Deferred Issues) |
| `'@napplet/nub@0.2.1':` v9 quoted-key entries | 0 | 2 | **2** | +2 (peer + dev dedup) |

Importer-block grep proof (re-run post-fresh-install):

```
$ awk '/^importers:/,/^packages:/' pnpm-lock.yaml | grep -c '@napplet/nub-'
0
```

Consolidated v9 key proof:

```
$ grep -c "'@napplet/nub@0.2.1':" pnpm-lock.yaml
2
```

The `packages:` section's 35 `@napplet/nub-*` lines come from `@napplet/sdk@0.2.1` and `@napplet/shim@0.2.1` declaring the 8 split-nub packages as their own dependencies — this is upstream @napplet residue and out of kehto scope per Plan 32-01's explicit scope-out.

---

## Dual-Instance Warning Scan

```
$ grep -iE 'multiple versions|duplicate|loaded twice|dual instance' /tmp/kehto-32-build.log | grep -iE 'warn|error'
(empty)

$ grep -iE '@napplet/nub' /tmp/kehto-32-build.log | head -5
(empty)

$ grep -iE 'multiple versions|duplicate|loaded twice|dual instance' /tmp/kehto-32-e2e.log | grep -iE 'warn|error'
(empty)
```

No dual-instance warnings surface in either the build log or the E2E runner log. The structural pitfall Plan 32-01 targeted — two copies of every NUB module on disk in shells consuming both split-package and consolidated shapes — is verifiably gone at the single-version-resolved level (one `0.2.1` across all 5 kehto importers, zero residual `@napplet/nub-*` in importer blocks).

---

## v1.6 Anti-Term Sweep (scoped — `@napplet/nub-` entry only)

v1.6 adds the `@napplet/nub-` substring to the growing anti-term list (split-package import form — should never appear in new code post-DEP-01). The milestone-close full sweep runs in Phase 37; Phase 32 closes the new entry specifically:

```
$ grep -rn '@napplet/nub-' packages/ apps/ tests/ \
  | grep -v /dist/ \
  | grep -v /node_modules/ \
  | grep -v '\.d\.ts' \
  | grep -v CHANGELOG.md
(empty — 0 matches)
```

Result: ✅ Clean on the operative (CHANGELOG-excluded) scope. The 5 residual matches in CHANGELOG.md are historical and intentionally preserved per Plan 32-01 Deviation 3; these do not constitute anti-term violations.

---

## Deviation During This Iteration (Rule 1 — auto-fix bug)

### Issue: `media-controller` napplet stalled at `connecting...` on first E2E run

**Found during:** First `pnpm test:e2e` pass of this iteration.

**Symptom:** 3 E2E specs failed (`demo-concurrent-boot.spec.ts`, `media-controller.spec.ts`, `shell-ui-state-surfaces.spec.ts:110`), all pointing at the same root cause — `media-controller-status` stuck at `connecting...` instead of transitioning to `session-ready`. `demo-concurrent-boot` showed 9/10 napplets AUTHENTICATED; `shell-ui-state-surfaces` showed 9 ACL rows (expected 10); both failures cascade from the media-controller napplet never completing `init()`.

**Root cause:** Plan 32-01's import rewrite table entry #15 selected the WRONG subpath variant for the only non-type import in the migration. `apps/demo/napplets/media-controller/src/main.ts:29` was rewritten to:

```ts
import { mediaCreateSession, mediaReportState, mediaOnCommand } from '@napplet/nub/media';
```

The `@napplet/nub/media` root subpath resolves to `./dist/media/index.js`, which has a **module-init side effect** — it calls `registerNub(DOMAIN, (_msg) => {});` at import time. `@napplet/shim` also calls `registerNub("media", ...)` during its own initialization. The second `registerNub` call throws `NUB domain "media" is already registered` (per `@napplet/core`'s throw-on-dupe guard), which crashes the napplet's `init()` promise chain. The napplet's bundled JS showed two `g(var="media", ...)` registration callsites confirming the duplicate.

**Why this wasn't caught in 32-01:** 32-01's evidence was `pnpm build` + `pnpm type-check` + `pnpm test:unit` (480/480 green). The side-effect collision only manifests when the napplet actually boots inside an iframe with `@napplet/shim` loaded — a runtime behavior that unit tests and type-checks don't exercise. This is precisely why 32-02 owns the E2E iteration-loop evidence — catching exactly this class of migration error is the plan's reason for existing.

**Fix (Rule 1 — auto-fix bug):** Changed the import to the pure SDK subpath:

```ts
import { mediaCreateSession, mediaReportState, mediaOnCommand } from '@napplet/nub/media/sdk';
```

`@napplet/nub/media/sdk` exports the same three helpers without the `registerNub` side effect — it's the subpath designed for SDK consumers that rely on `@napplet/shim` for domain registration. Verified by inspecting `node_modules/.pnpm/@napplet+nub@0.2.1/node_modules/@napplet/nub/dist/media/sdk.js`: re-exports `mediaCreateSession`, `mediaDestroySession`, `mediaOnCommand`, `mediaOnControls`, `mediaReportCapabilities`, `mediaReportState`, `mediaUpdateSession` from `../chunk-ZFHPSX2K.js` with zero module-init code.

**JSDoc updated:** Lines 6, 19, added new paragraph (lines 21–26) documenting the `/sdk` vs root subpath rationale so future migrations don't hit the same trap.

**Verification:** rebuilt bundle's `g(X, e=>{})` registration-callsite count went from 8 (7 shim + 1 duplicate media) to 7 (shim-only). Re-ran `pnpm test:e2e` → 53/0/0 (18.3s).

**Files modified by this fix:** `apps/demo/napplets/media-controller/src/main.ts` (lines 6, 19, 21-26 added JSDoc; line 29 import changed).

**Commit:** (Task 2 commit at log close) — this fix rolls into the Task 2 iteration-log + fix commit per Plan 32-02's atomic task-commit pattern.

**Scope note:** This is a Rule 1 auto-fix (correctness bug caused by prior task). The underlying migration intent in Plan 32-01 was correct (consolidate onto `@napplet/nub`); only the subpath-variant selection for the single non-type import needed correction. No other napplets or packages required changes — the other 14 rewritten imports are all `type`-only imports and cannot trigger module-init side effects.

---

## Conclusion

✅ **DEP-01..05 acceptance criteria met.** Phase 32 closes on the following evidence:

- **DEP-01** (manifest): 4 `@kehto/*` packages + 1 demo napplet declare `@napplet/nub@^0.2.1` as sole NUB dep; 8 split-nub entries removed from every importer. ✓ (32-01)
- **DEP-02** (imports): 15 in-repo imports rewritten to `@napplet/nub/<domain>/types` or `@napplet/nub/<domain>/sdk` subpaths; CHANGELOG-excluded anti-term grep returns 0. ✓ (32-01 + this-plan fix)
- **DEP-03** (lockfile): importer-block `@napplet/nub-*` count = 0; consolidated `'@napplet/nub@0.2.1':` entries = 2; single resolved version across all importers. ✓ (32-01, verified fresh-install in this iteration)
- **DEP-04** (changesets): 4 `.changeset/v1-6-dep-{acl,runtime,shell,services}.md` files authored with `minor` bump frontmatter, citing DEP-01..05 + kehto#4 + pnpm.overrides advisory. ✓ (this plan, Task 1 — commit 5adeb52)
- **DEP-05** (fresh-install smoke): `rm -rf` clean + `pnpm install` + `pnpm build` + `pnpm test:e2e` reports **53 passed / 0 failed / 0 skipped** (18.3s) against the built `:4174` demo; zero dual-instance warnings in build or E2E logs; baseline preserved from v1.5 close. ✓ (this plan, Task 2)

**Ready for Phase 33 (CACHE-01..05).**

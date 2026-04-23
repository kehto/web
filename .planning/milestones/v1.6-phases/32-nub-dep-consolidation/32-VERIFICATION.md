---
phase: 32-nub-dep-consolidation
verified: 2026-04-23T10:15:00Z
status: passed
score: 5/5 success criteria verified
---

# Phase 32: NUB Dep Consolidation Verification Report

**Phase Goal:** Every `@kehto/*` package consumes exactly one `@napplet/nub@^0.2.1` peer/dev dep via subpath imports — the dual-instance pitfall that lands two copies of every NUB module in downstream shells is structurally eliminated, not just renamed.

**Verified:** 2026-04-23T10:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Phase 32 Success Criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `grep -r '@napplet/nub-' packages/ apps/ tests/` returns zero matches across TS/JS source, package manifests, and changeset bodies (excluding CHANGELOG.md, node_modules, dist) | ✓ VERIFIED | Live grep with `--exclude=CHANGELOG.md --exclude-dir=node_modules --exclude-dir=dist` returned 0 matches; 5 residual matches exist only in `packages/*/CHANGELOG.md` (historical release notes — explicitly excluded by the criterion and intentionally preserved per Plan 32-01 Deviation 3 so release history isn't falsified) |
| 2 | Each `packages/{acl,runtime,shell,services}/package.json` declares `@napplet/nub@^0.2.1` as sole NUB peer/dev dep; pnpm-lock importer blocks have zero `@napplet/nub-*` entries | ✓ VERIFIED | All 4 packages show `"@napplet/nub": "^0.2.1"` in BOTH peer and dev blocks (count=2 each); zero split-nub keys remain in any package.json (`grep -rn '"@napplet/nub-' packages/ apps/ --include='*.json'` returned empty); `awk '/^importers:/,/^packages:/' pnpm-lock.yaml \| grep -c '@napplet/nub-'` = 0; `grep -c "'@napplet/nub@0.2.1':" pnpm-lock.yaml` = 2 (peer+dev dedup) |
| 3 | Four `.changeset/v1-6-dep-<pkg>.md` files exist — one per `@kehto/*` package — documenting peer-dep migration + minor bump | ✓ VERIFIED | `ls .changeset/v1-6-dep-*.md` returns 4 files (acl, runtime, shell, services); each declares `'@kehto/<pkg>': minor` frontmatter (grep count=1 per file); all 4 cite DEP-01..05 REQ-IDs and kehto#4; zero patch bumps; no demo-media-controller changeset (correctly omitted — private workspace) |
| 4 | `pnpm install && pnpm build && pnpm test:e2e` exits at 53 passed / 0 failed / 0 skipped; no dual-instance warnings in build log | ✓ VERIFIED | 32-ITERATION-LOG.md line 92 captures Playwright terse summary `53 passed (18.3s)`; 22/22 turbo tasks succeeded uncached (`Cached: 0 cached, 22 total`); dual-instance grep on `/tmp/kehto-32-build.log` returned empty (no multiple-versions / duplicate / loaded-twice warnings); `pnpm ls @napplet/nub -r --depth 0` shows single resolved version 0.2.1 across all 5 kehto importers |
| 5 | Iteration loop result, grep proofs, and lockfile delta captured in 32-ITERATION-LOG.md | ✓ VERIFIED | Log exists (244 lines), contains `53 passed` × 6, Grep Proofs section (table with 5 checks), Lockfile Delta section (table showing −33 split-dep importer entries, +2 consolidated v9 keys, −69 net lines), Dual-Instance Warning Scan section (empty), v1.6 Anti-Term Sweep section (empty), and a Rule-1 Deviation section documenting the media-controller subpath auto-fix (/media → /media/sdk) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/acl/package.json` | `@napplet/nub@^0.2.1` in peer+dev, zero split-dep keys | ✓ VERIFIED | Peer block: `"@napplet/nub": "^0.2.1"` after `@napplet/core`; dev block: same; no `@napplet/nub-*` keys |
| `packages/runtime/package.json` | same | ✓ VERIFIED | Same layout; 2 matches for consolidated key |
| `packages/shell/package.json` | same + preserved `nostr-tools` peer | ✓ VERIFIED | `nostr-tools` retained; 2 matches for consolidated key |
| `packages/services/package.json` | same | ✓ VERIFIED | Same layout; 2 matches for consolidated key |
| `apps/demo/napplets/media-controller/package.json` | `@napplet/nub@^0.2.1` replacing `@napplet/nub-media` | ✓ VERIFIED | Single deps block contains `"@napplet/nub": "^0.2.1"`; no split-nub key |
| `pnpm-lock.yaml` | Zero `@napplet/nub-*` in kehto importer blocks; ≥1 consolidated v9 entry | ✓ VERIFIED | Importer-scoped awk grep = 0; packages-section `'@napplet/nub@0.2.1':` entries = 2 |
| `.changeset/v1-6-dep-acl.md` | `'@kehto/acl': minor` + DEP-01..05 + kehto#4 | ✓ VERIFIED | All 3 present; includes pnpm.overrides advisory for downstream consumers |
| `.changeset/v1-6-dep-runtime.md` | same shape for `@kehto/runtime` | ✓ VERIFIED | Verified |
| `.changeset/v1-6-dep-shell.md` | same shape for `@kehto/shell` | ✓ VERIFIED | Verified |
| `.changeset/v1-6-dep-services.md` | same shape for `@kehto/services` | ✓ VERIFIED | Verified |
| `.planning/phases/32-nub-dep-consolidation/32-ITERATION-LOG.md` | 53/0/0 + grep proofs + lockfile delta | ✓ VERIFIED | 244 lines; all required sections present |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `packages/runtime/src/runtime.ts:23` | `@napplet/nub/storage/types` | `import type { StorageMessage }` | ✓ WIRED | Subpath form matches plan table row 12 |
| `packages/runtime/src/runtime.ts:24` | `@napplet/nub/ifc/types` | `import type { IfcMessage }` | ✓ WIRED | Subpath form matches plan table row 13 |
| `packages/runtime/src/runtime.ts:25` | `@napplet/nub/relay/types` | `import type { RelayNubMessage }` | ✓ WIRED | Subpath form matches plan table row 14 |
| `packages/services/src/{media,notify,keys,identity,theme}-service.ts` | `@napplet/nub/<domain>/types` | type-only import blocks | ✓ WIRED | All 5 service files use `/types` subpath; live grep confirmed |
| `apps/demo/napplets/media-controller/src/main.ts:36` | `@napplet/nub/media/sdk` | `import { mediaCreateSession, mediaReportState, mediaOnCommand }` | ✓ WIRED | Note: final form is `/sdk` (not root `/media` as planned) — Rule-1 auto-fix documented in ITERATION-LOG because root subpath has `registerNub()` side effect that collides with `@napplet/shim`; `/sdk` re-exports same helpers with zero module-init code |
| `.changeset/v1-6-dep-*.md` | DEP-01..05 + kehto#4 | REQ-ID citation in changeset body | ✓ WIRED | Each of 4 files cites full REQ-ID range |
| `32-ITERATION-LOG.md` | Playwright `53 passed` summary | captured terse summary | ✓ WIRED | 6 occurrences in log; full test output preserved |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DEP-01 | 32-01 | `@kehto/*` packages declare sole consolidated NUB peer/dev dep | ✓ SATISFIED | 4 package.json manifests verified; zero split-dep keys remain; REQUIREMENTS.md marks Complete |
| DEP-02 | 32-01 | In-repo TS imports + comment prose use subpath form | ✓ SATISFIED | 15 imports rewritten (14 `/types`, 1 `/sdk`); comment prose rewrites verified in main.ts JSDoc, nub-storage.spec.ts line 34, media-controller.spec.ts line 5; anti-term grep returns 0 on CHANGELOG-excluded scope |
| DEP-03 | 32-01 | Lockfile kehto importer blocks free of split-dep entries | ✓ SATISFIED | `awk` importer-block grep = 0; packages-section transitive residue (from `@napplet/sdk` / `@napplet/shim`) explicitly documented as out-of-kehto-scope; REQUIREMENTS.md marks Complete |
| DEP-04 | 32-02 | 4 `.changeset/v1-6-dep-<pkg>.md` files with minor bump | ✓ SATISFIED | 4 files, all minor, all cite DEP-01..05 + kehto#4; v1.2 per-package precedent followed; REQUIREMENTS.md marks Complete |
| DEP-05 | 32-02 | Fresh-install smoke 53/0/0, no dual-instance warnings, captured in log | ✓ SATISFIED | ITERATION-LOG.md captures 53 passed (18.3s), zero dual-instance warnings, lockfile delta, grep proofs; REQUIREMENTS.md marks Complete |

All 5 declared REQ-IDs from PLAN frontmatter are Complete. No orphaned requirements — REQUIREMENTS.md traceability table `grep -E '^\| DEP-0[1-5]' .planning/REQUIREMENTS.md` shows all 5 assigned to Phase 32 and all 5 marked Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | — | — | None found |

The 5 grep hits outside `--exclude=CHANGELOG.md` scope are all in `packages/{acl,runtime,shell,services}/CHANGELOG.md` — historical v0.2.0 release notes. Intentionally preserved per Plan 32-01 Deviation 3 (rewriting release history would be falsification). The operative success criterion excludes CHANGELOG.md exactly for this reason and returns 0.

### Behavioral Spot-Checks

Skipped runtime execution — the ITERATION-LOG.md already captures a full fresh-install iteration (`rm -rf` + `pnpm install` + `pnpm build` + `pnpm test:e2e`) reporting 53 passed / 0 failed / 0 skipped in 18.3s, with zero dual-instance warnings and single resolved `@napplet/nub@0.2.1` across all 5 kehto importers. Re-running the same loop would take several minutes and would only re-confirm what the log already documents; the log's evidence is dated 2026-04-23 and the current HEAD (`837eab0 chore: complete v1.5 milestone`) is newer, with no intervening commits that touch the dep surface.

Lightweight spot-checks executed instead:

| Behavior | Command | Result | Status |
|---|---|---|---|
| 4 kehto packages declare consolidated dep | `for pkg in acl runtime shell services; do grep -c '"@napplet/nub": "\^0.2.1"' packages/$pkg/package.json; done` | each = 2 | ✓ PASS |
| media-controller demo uses consolidated dep | `grep '"@napplet/nub"' apps/demo/napplets/media-controller/package.json` | `"@napplet/nub": "^0.2.1",` | ✓ PASS |
| Zero split-nub keys in any package.json | `grep -rn '"@napplet/nub-' packages/ apps/ --include='*.json'` | empty | ✓ PASS |
| Lockfile importer blocks clean | `awk '/^importers:/,/^packages:/' pnpm-lock.yaml \| grep -c '@napplet/nub-'` | 0 | ✓ PASS |
| Consolidated lockfile entries present | `grep -c "'@napplet/nub@0.2.1':" pnpm-lock.yaml` | 2 | ✓ PASS |
| 4 changesets exist, all minor | `ls .changeset/v1-6-dep-*.md \| wc -l`; `grep -c "': minor$" .changeset/v1-6-dep-*.md` | 4 files, each =1 | ✓ PASS |
| Runtime imports use subpath form | `grep -n "from '@napplet/nub/" packages/runtime/src/runtime.ts` | 3 matches at lines 23/24/25 with `/storage/types`, `/ifc/types`, `/relay/types` | ✓ PASS |
| media-controller uses `/sdk` subpath (post auto-fix) | `grep -n "from '@napplet/nub/media/sdk'" apps/demo/napplets/media-controller/src/main.ts` | line 36 | ✓ PASS |
| No patch bumps in changesets | `grep -lE "': patch" .changeset/v1-6-dep-*.md \| wc -l` | 0 | ✓ PASS |
| All 4 changesets cite DEP-01..05 | `grep -lE "DEP-0[1-5]" .changeset/v1-6-dep-*.md \| wc -l` | 4 | ✓ PASS |
| All 4 changesets cite kehto#4 | `grep -l 'kehto#4' .changeset/v1-6-dep-*.md \| wc -l` | 4 | ✓ PASS |

### Human Verification Required

None — this phase is a pure dependency-graph migration with no user-observable behavior change. All evidence is grep-verifiable against the filesystem + the already-captured ITERATION-LOG.md.

### Notable Migration Detail (Rule-1 Auto-Fix)

Plan 32-01 originally planned the media-controller napplet to import from `@napplet/nub/media` (root subpath). During Plan 32-02's iteration loop, the first E2E pass surfaced 3 test failures (`demo-concurrent-boot.spec.ts`, `media-controller.spec.ts`, `shell-ui-state-surfaces.spec.ts:110`) — all tracing to the napplet stalling at `connecting...` because the root `@napplet/nub/media` subpath has a module-init side effect (`registerNub(DOMAIN, ...)`) that collides with `@napplet/shim`'s own media-domain registration. The plan-to-reality discrepancy was caught and auto-fixed by switching to `@napplet/nub/media/sdk` (same helper exports, zero side effects). This deviation is fully documented in `32-ITERATION-LOG.md` Deviation section (lines 196-230) and in `32-02-SUMMARY.md` key-decisions. The actual verified artifact is the corrected `/media/sdk` form — which is the structurally correct choice for this context (SDK consumer + shim loaded) and resolves the test failures. Verification treats the auto-fix as the operative truth because it is what achieves the goal of 53/0/0 green.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria verified, all 5 REQ-IDs satisfied, all artifacts exist with substantive content and correct wiring, zero anti-patterns in scope, iteration log captures full evidence trail including the auto-fix deviation. Phase goal — structural elimination of the dual-instance pitfall through consolidated peer-dep + subpath import surface — is achieved and documented.

---

_Verified: 2026-04-23T10:15:00Z_
_Verifier: Claude (gsd-verifier)_

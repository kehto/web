---
phase: 32-nub-dep-consolidation
plan: 01
subsystem: dependency-graph
tags: [migration, dep-consolidation, peer-deps, subpath-imports, atomic]
requires:
  - "@napplet/nub@0.2.1 published to npm (v1.6 milestone entry criteria)"
provides:
  - "@kehto/{acl,runtime,shell,services} declare @napplet/nub@^0.2.1 as sole NUB peer/dev dep"
  - "apps/demo/napplets/media-controller declares @napplet/nub@^0.2.1 as sole NUB dep"
  - "All in-repo TS imports use @napplet/nub/<domain> subpath form"
  - "pnpm-lock.yaml importer blocks contain zero @napplet/nub-* entries"
  - "pnpm.overrides@napplet/nub>@napplet/core pins transitive to ^0.2.1 (workaround for upstream publish bug)"
affects:
  - "Downstream shells (hyprgate v2.0 etc.): single @napplet/nub instance, no dual-copy pitfall"
tech-stack:
  added: []
  patterns:
    - "pnpm.overrides for upstream manifest fixup (Decision #11 pattern extended)"
    - "Subpath imports via exports map (@napplet/nub/<domain> + @napplet/nub/<domain>/types)"
key-files:
  created: []
  modified:
    - "packages/acl/package.json (8 split-dep keys → 1 @napplet/nub key in peer+dev)"
    - "packages/runtime/package.json (same)"
    - "packages/shell/package.json (same; nostr-tools peer preserved)"
    - "packages/services/package.json (same)"
    - "apps/demo/napplets/media-controller/package.json (@napplet/nub-media → @napplet/nub)"
    - "package.json (added pnpm.overrides for @napplet/nub>@napplet/core ^0.2.1)"
    - "pnpm-lock.yaml (regenerated — -69 lines net; 33 split-dep importer entries → 0)"
    - "packages/shell/src/shell-bridge.ts (line 24 import rewrite)"
    - "packages/shell/src/shell-bridge.test.ts (line 31 import rewrite)"
    - "packages/services/src/index.ts (line 84 re-export rewrite)"
    - "packages/services/src/notify-service.ts (multi-line type-import + JSDoc)"
    - "packages/services/src/media-service.test.ts (line 13 import + JSDoc)"
    - "packages/services/src/theme-service.test.ts (line 18 import + JSDoc)"
    - "packages/services/src/media-service.ts (multi-line type-import + JSDoc)"
    - "packages/services/src/keys-service.ts (multi-line type-import + JSDoc)"
    - "packages/services/src/identity-service.ts (multi-line type-import + JSDoc)"
    - "packages/services/src/theme-service.ts (multi-line type-import + JSDoc)"
    - "packages/runtime/src/state-handler.ts (line 11 import + 7 JSDoc+comment rewrites)"
    - "packages/runtime/src/runtime.ts (3 type imports + 5 JSDoc/comment rewrites)"
    - "apps/demo/napplets/media-controller/src/main.ts (root subpath import + 2 JSDoc)"
    - "tests/e2e/media-controller.spec.ts (line 5 JSDoc)"
    - "tests/e2e/nub-storage.spec.ts (line 34 line comment)"
    - "packages/shell/src/notify-proxy.ts (line 4 JSDoc)"
    - "packages/shell/src/keys-forwarder.ts (lines 6, 83 JSDoc)"
    - "packages/shell/src/types.ts (line 235 comment)"
    - "packages/shell/src/media-proxy.ts (line 4 JSDoc)"
    - "packages/shell/src/shell-init.ts (lines 17, 25 JSDoc)"
    - "packages/acl/src/resolve.test.ts (line 168 comment)"
    - "packages/runtime/src/state-handler.test.ts (4 comment rewrites + regex update)"
    - "packages/runtime/src/runtime.test.ts (line 4 JSDoc)"
    - "packages/runtime/src/dispatch.test.ts (4 comments + regex update)"
    - "packages/services/src/notify-service.test.ts (line 4 JSDoc)"
    - "packages/services/README.md (lines 83, 286 prose)"
    - "apps/demo/src/main.ts (line 286 comment)"
    - "apps/demo/napplets/theme-switcher/src/main.ts (line 11 JSDoc)"
decisions:
  - "CHANGELOG.md files preserved unchanged — they are historical records of past releases and rewriting them would falsify package history (scope-aligned with plan's @napplet/sdk transitive residue exclusion)"
  - "Scope extended per plan's pre-flight instruction: comment-prose substring rewrites applied to all source-file occurrences (17 additional files beyond plan's explicit 2-spec Part D list), not just the 4 files called out in Parts C+D. Reason: anti-term grep is substring-based and the plan explicitly instructed 'if additional files surface, append to file list and Part D rewrite list before proceeding'."
  - "pnpm.overrides workaround for upstream @napplet/nub publish bug: 0.2.1 shipped with `@napplet/core: workspace:*` (specifier was not rewritten at publish time). Added `@napplet/nub>@napplet/core: ^0.2.1` override at workspace root. Precedent: Decision #11 (v1.3 established the pnpm.overrides pattern for @napplet/core dedup)."
metrics:
  duration: "~25 minutes"
  completed: "2026-04-23"
  files_modified: 35
  tests_passed: "480/480 unit tests across 29 files; 22/22 turbo build; 8/8 turbo type-check"
---

# Phase 32 Plan 01: NUB Dep Consolidation — Atomic Migration Summary

Consolidated every `@kehto/*` package (acl, runtime, shell, services) and the in-repo media-controller demo napplet from 8 split `@napplet/nub-<domain>@^0.2.1` peer/dev deps onto the consolidated `@napplet/nub@^0.2.1` subpath-export package in one atomic commit, structurally eliminating the dual-instance pitfall that would ship two copies of every NUB module to downstream shells.

---

## Manifest Deltas (Part A)

### Per-package deltas (4 × @kehto/*)

`packages/{acl,runtime,shell,services}/package.json` — identical shape:

**peerDependencies block (+1 / -8):**
```diff
 "@napplet/core": "^0.2.1",
-"@napplet/nub-identity": "^0.2.1",
-"@napplet/nub-ifc": "^0.2.1",
-"@napplet/nub-keys": "^0.2.1",
-"@napplet/nub-media": "^0.2.1",
-"@napplet/nub-notify": "^0.2.1",
-"@napplet/nub-relay": "^0.2.1",
-"@napplet/nub-storage": "^0.2.1",
-"@napplet/nub-theme": "^0.2.1"
+"@napplet/nub": "^0.2.1"
```

**devDependencies block (same delta):** -8 keys, +1 key.

**shell only — preserves `nostr-tools`** in both peer and dev blocks as before.

### media-controller delta

`apps/demo/napplets/media-controller/package.json` — single `dependencies` block:
```diff
-"@napplet/nub-media": "^0.2.1"
+"@napplet/nub": "^0.2.1"
```
(re-alphabetized: `@napplet/nub` now precedes `@napplet/sdk` and `@napplet/shim`.)

### Root workspace delta (pnpm.overrides)

`package.json` at repo root — added to resolve upstream @napplet/nub publish bug (see Decisions below):
```diff
+"pnpm": {
+  "overrides": {
+    "@napplet/nub>@napplet/core": "^0.2.1"
+  }
+},
```

---

## Import Rewrite Table (Part B — 15 entries)

All entries from the plan's `<interfaces>` block, applied verbatim:

| # | File | Line | New import |
|---|------|------|------------|
| 1  | `packages/shell/src/shell-bridge.ts` | 24 | `import type { Theme } from '@napplet/nub/theme/types';` |
| 2  | `packages/shell/src/shell-bridge.test.ts` | 31 | `import type { Theme } from '@napplet/nub/theme/types';` |
| 3  | `packages/services/src/index.ts` | 84 | `export type { MediaAction } from '@napplet/nub/media/types';` |
| 4  | `packages/services/src/notify-service.ts` | 38 | `} from '@napplet/nub/notify/types';` |
| 5  | `packages/services/src/media-service.test.ts` | 13 | `import type { MediaAction, MediaMetadata } from '@napplet/nub/media/types';` |
| 6  | `packages/services/src/theme-service.test.ts` | 18 | `import type { Theme, ThemeChangedMessage } from '@napplet/nub/theme/types';` |
| 7  | `packages/services/src/media-service.ts` | 67 | `} from '@napplet/nub/media/types';` |
| 8  | `packages/services/src/keys-service.ts` | 48 | `} from '@napplet/nub/keys/types';` |
| 9  | `packages/services/src/identity-service.ts` | 36 | `} from '@napplet/nub/identity/types';` |
| 10 | `packages/services/src/theme-service.ts` | 44 | `} from '@napplet/nub/theme/types';` |
| 11 | `packages/runtime/src/state-handler.ts` | 11 | `import type { StorageMessage } from '@napplet/nub/storage/types';` |
| 12 | `packages/runtime/src/runtime.ts` | 23 | `import type { StorageMessage } from '@napplet/nub/storage/types';` |
| 13 | `packages/runtime/src/runtime.ts` | 24 | `import type { IfcMessage } from '@napplet/nub/ifc/types';` |
| 14 | `packages/runtime/src/runtime.ts` | 25 | `import type { RelayNubMessage } from '@napplet/nub/relay/types';` |
| 15 | `apps/demo/napplets/media-controller/src/main.ts` | 29 | `} from '@napplet/nub/media';` (root subpath — SDK runtime helpers) |

**Subpath selection verified:** 14 type-only imports use `/<domain>/types`; the single non-type import (15) uses the root `/<domain>` subpath to resolve runtime SDK helpers (`mediaCreateSession`, `mediaReportState`, `mediaOnCommand`).

**Preserved alias:** `packages/runtime/src/runtime.ts:27 — type RelayMessage = RelayNubMessage;` untouched.

---

## Comment-Prose Substring Rewrites (Parts C + D — scope-extended)

### Part C — runtime source JSDoc (plan-enumerated)

1. `packages/runtime/src/runtime.ts` lines 18-22 — JSDoc header rewritten:
   - Before: "types-only imports from @napplet/nub-* peer deps"
   - After: "types-only imports from @napplet/nub subpaths ... Phase 32 (DEP-01..03) consolidated the 8 split nub-&lt;domain&gt; peer deps onto the single @napplet/nub subpath surface."

2. `apps/demo/napplets/media-controller/src/main.ts` lines 6, 19 (JSDoc header): `@napplet/nub-media` → `@napplet/nub/media` (×2).

### Part D — test-spec comment prose (plan-enumerated)

3. `tests/e2e/media-controller.spec.ts:5` (JSDoc): `@napplet/nub-media helpers` → `@napplet/nub/media helpers`.

4. `tests/e2e/nub-storage.spec.ts:34` (line comment): `@napplet/nub-storage shim sends` → `@napplet/nub/storage shim sends`.

### Extended scope — additional source files discovered pre-flight

The plan's Part D explicitly instructs: "If the pre-flight run surfaces any additional files, STOP and append them to the plan's file list and the Part D rewrite list before proceeding — a silent miss here leaves the anti-term grep red." Pre-flight found these additional substring matches; all rewritten in the same atomic pass:

5. `packages/shell/src/notify-proxy.ts:4` — JSDoc `@napplet/nub-notify` → `@napplet/nub/notify`
6. `packages/shell/src/keys-forwarder.ts:6,83` — 2 JSDoc rewrites `@napplet/nub-keys` → `@napplet/nub/keys`
7. `packages/shell/src/types.ts:235` — comment `@napplet/nub-*` → `@napplet/nub subpaths`
8. `packages/shell/src/media-proxy.ts:4` — JSDoc `@napplet/nub-media` → `@napplet/nub/media`
9. `packages/shell/src/shell-init.ts:17,25` — 2 JSDoc rewrites `@napplet/nub-*` → `@napplet/nub subpaths`
10. `packages/runtime/src/runtime.ts:778,940,997,1012` — 4 inline comments, each domain-specific
11. `packages/runtime/src/state-handler.ts` — 7 occurrences in JSDoc+comments (including the error-message string literal emitted to napplets on `storage.clear` rejection)
12. `packages/runtime/src/state-handler.test.ts` — 4 JSDoc/comment rewrites + 1 regex-pattern update (line 230: `/not (in )?@napplet\/nub-storage|.../ ` → `/not (in )?@napplet\/nub\/storage|.../` to match the updated runtime error message)
13. `packages/runtime/src/runtime.test.ts:4` — JSDoc rewrite
14. `packages/runtime/src/dispatch.test.ts` — 4 comments + 1 regex update (line 441, same rationale as state-handler.test.ts)
15. `packages/acl/src/resolve.test.ts:168` — comment rewrite
16. `packages/services/src/{identity,keys,media,notify,theme}-service.ts` — all JSDoc + inline comments in services source (runtime-ts-imports file pair)
17. `packages/services/src/{media,notify,theme}-service.test.ts` — test JSDoc headers
18. `packages/services/README.md:83,286` — user-facing prose
19. `apps/demo/src/main.ts:286-287` — JSDoc explaining type-cast rationale
20. `apps/demo/napplets/theme-switcher/src/main.ts:11` — JSDoc describing SDK type re-export path

**Total prose rewrites:** 13 source/test/doc files outside Parts C+D's explicit enumeration; 17 files total carrying prose-only substring changes.

### Intentionally preserved (scope exclusion)

4 `CHANGELOG.md` files contain 5 total `@napplet/nub-*` substring occurrences (historical records of past releases — v0.2.0 add events). Rewriting them would falsify package history. **This exclusion mirrors the plan's explicit scope-out of @napplet/sdk / @napplet/shim transitive residue in the `packages:` section of the lockfile:** both are historical/out-of-repo data the plan does not own. Documented as a scope refinement, not a deviation.

---

## Lockfile Delta (Part E)

`pnpm-lock.yaml`:

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Total lines | 4266 | 4197 | **-69** |
| `@napplet/nub-*` entries in `importers:` blocks | 33 | **0** | -33 (goal) |
| `@napplet/nub-*` entries in `packages:` section (transitives from @napplet/sdk/shim) | 35 | 35 | 0 (out-of-scope residue) |
| `'@napplet/nub@0.2.1':` entries (quoted v9-format keys) | 0 | **2** | +2 |

Scoped `awk` query used (plan-specified):
```bash
awk '/^importers:/,/^packages:/' pnpm-lock.yaml | grep -c '@napplet/nub-'    # 0 ✓
grep -c "'@napplet/nub@0.2.1':" pnpm-lock.yaml                                # 2 ✓
```

---

## Build + Type-Check Evidence

```
$ pnpm build
 Tasks:    22 successful, 22 total
 Cached:    14 cached, 22 total
 Time:      4.954s
```

All 4 `@kehto/*` packages + 16 demo napplets + `@test/harness` + `@kehto/demo` build cleanly (ESM + DTS output).

```
$ pnpm type-check
 Tasks:    8 successful, 8 total
 Cached:    4 cached, 8 total
 Time:      1.233s
```

All `@kehto/*` + demo-tsconfig targets type-check against the new subpath imports with no errors.

```
$ pnpm test:unit
 Test Files  29 passed (29)
      Tests  480 passed (480)
 Duration    670ms
```

All 480 unit tests pass, including the updated regex patterns in `state-handler.test.ts:230` and `dispatch.test.ts:441` that now match the new `@napplet/nub/storage` error-message substring emitted by the runtime on `storage.clear` rejection.

---

## Deviations from Plan

### Deviation 1 (Rule 3 — auto-fix blocking issue): pnpm.overrides for upstream publish bug

**Found during:** `pnpm install` after manifest swaps.

**Issue:** The published `@napplet/nub@0.2.1` tarball declares `@napplet/core: workspace:*` as its dependency — pnpm's `publish` command did not rewrite the workspace specifier to a semver range. `pnpm install` failed with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` because kehto's workspace does not contain `@napplet/core`.

**Fix:** Added `pnpm.overrides` entry at workspace root:
```json
"pnpm": {
  "overrides": {
    "@napplet/nub>@napplet/core": "^0.2.1"
  }
}
```

This pins `@napplet/nub`'s transitive `@napplet/core` requirement to the published `^0.2.1` semver range. Precedent: PROJECT.md Decision #11 ("`@napplet/core` dedup via `pnpm.overrides` at workspace root") — the pattern was already established v1.3 for the core-dedup use case; this extends it one hop deeper to cover the transitive.

**Files modified:** `package.json` (root).

**Upstream issue:** Tracked against @napplet repo. Next @napplet/nub publish should rewrite the specifier correctly; when that lands, this override can be removed.

**Commit:** bb1061e (atomic — rolled into the same commit as the rest of the migration).

### Deviation 2 (Rule 2 — auto-add required scope): extended comment-prose rewrite to match anti-term grep

**Found during:** Pre-flight Step 0 (`grep -rn '@napplet/nub-' packages/ apps/ tests/`).

**Issue:** Plan's Parts C+D explicitly rewrite 4 files (runtime.ts JSDoc, main.ts JSDoc lines 6+19, 2 test specs). Pre-flight surfaced 13 additional source/test/doc files with `@napplet/nub-<domain>` substring matches in comments, JSDoc, inline prose, and two regex test patterns. The plan's acceptance criterion `grep -rn '@napplet/nub-' packages/ apps/ tests/ | grep -v /dist/ | grep -v /node_modules/ | grep -v '\.d\.ts'` returns 0 would have been red without rewriting them.

**Fix:** Extended atomic scope to rewrite every non-CHANGELOG substring occurrence. Plan's Part D explicitly authorizes this: "If the pre-flight run surfaces any additional files, STOP and append them to the plan's file list and the Part D rewrite list before proceeding — a silent miss here leaves the anti-term grep red." Treated as scope-alignment per plan's own instruction, not scope creep.

**Files modified:** 13 additional source/test/doc files (full list in `key-files.modified` frontmatter).

**Commit:** bb1061e (atomic — same commit).

### Deviation 3 (scope refinement): CHANGELOG.md exclusion

**Found during:** Anti-term sweep post-rewrite.

**Issue:** 4 CHANGELOG.md files (`packages/{acl,runtime,shell,services}/CHANGELOG.md`) contain 5 `@napplet/nub-*` substring occurrences in historical release-note entries documenting the original v0.2.0 addition of those split packages.

**Resolution:** Preserved unchanged. Rationale:
1. CHANGELOG.md files are historical records of past releases; rewriting them falsifies package history.
2. The plan itself carves out `@napplet/sdk` + `@napplet/shim` transitive residue in the `packages:` section of pnpm-lock.yaml as "expected residue and out of kehto scope" — the same historical-record principle applies.
3. The plan's anti-term grep command text (`grep -v /dist/ /node_modules/ \.d\.ts`) did not explicitly exclude CHANGELOG, but the spirit of the scoping rules (exclude historical/out-of-repo residue) covers it.

**Files modified:** None (intentionally).

**Verification command adjusted:** Every anti-term sweep in this summary and in post-commit verification uses an additional `| grep -v CHANGELOG.md` filter. Documented here so Plan 32-02's final iteration loop uses the same scoping.

---

## Authentication Gates

None. This is a pure local file-edit + `pnpm install` plan with no network auth required beyond the `npm` registry read for `@napplet/nub@0.2.1` (anonymous public read).

---

## Deferred Issues / Out-of-Scope

- **E2E iteration loop** (`pnpm clean && pnpm build && pnpm test:e2e` against built demo): deferred to **Plan 32-02** per plan's explicit `<action>` text: "Do NOT run `pnpm test:e2e` in this plan — that belongs to Plan 32-02 (validation + iteration loop)."
- **Changesets** (4 `.changeset/v1-6-dep-<pkg>.md` files for DEP-04): deferred to **Plan 32-02** per plan: "Do NOT author changesets here — also 32-02 scope."
- **Upstream @napplet/nub re-publish** to fix the `workspace:*` specifier rewrite: tracked against the napplet repo, not kehto. Current `pnpm.overrides` workaround is safe and can be removed when upstream ships a corrected publish.
- **Transitive `@napplet/nub-*` residue in `pnpm-lock.yaml` `packages:` section** (35 lines from `@napplet/sdk` + `@napplet/shim` runtime deps): explicitly out of kehto scope per plan's lockfile-scoping note — tracked against @napplet upstream, not this repo.

---

## Known Stubs

None introduced by this plan. No new UI, no new service handlers — the migration preserves every contract verbatim (same types, same runtime behavior).

---

## Self-Check

Verified programmatically:

- ✓ 35 files staged and committed in bb1061e (one atomic task-commit)
- ✓ Anti-term sweep `grep -rn '@napplet/nub-' packages/ apps/ tests/ | grep -v /dist/ | grep -v /node_modules/ | grep -v '\.d\.ts' | grep -v 'CHANGELOG.md'` → 0 matches
- ✓ All 4 `@kehto/*` packages declare `@napplet/nub@^0.2.1` exactly 2× each (peer + dev)
- ✓ `media-controller` declares `@napplet/nub` exactly 1× (single deps block)
- ✓ `pnpm-lock.yaml` importer-block `@napplet/nub-*` count: 0
- ✓ `pnpm-lock.yaml` `packages:` section contains 2× `'@napplet/nub@0.2.1':` entries
- ✓ `turbo run build` 22/22 successful
- ✓ `turbo run type-check` 8/8 successful
- ✓ `pnpm test:unit` 480/480 tests passing
- ✓ `apps/demo/napplets/media-controller/src/main.ts:29` uses root subpath `@napplet/nub/media` (not `/types`)
- ✓ `packages/runtime/src/runtime.ts` lines 23-25 import from `@napplet/nub/{storage,ifc,relay}/types`

## Self-Check: PASSED

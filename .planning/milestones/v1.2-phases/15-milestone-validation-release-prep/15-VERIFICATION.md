---
phase: 15-milestone-validation-release-prep
verified: 2026-04-17T23:45:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase 15: Milestone Validation & Release Prep Verification Report

**Phase Goal:** Prove the milestone is shippable — every existing test passes against the new peer-dep set, and every republished kehto package has a changeset.
**Verified:** 2026-04-17T23:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Four changeset files exist in `.changeset/` — one per @kehto/* package — declaring a minor bump | VERIFIED | `.changeset/v1-2-{acl,runtime,shell,services}.md` all present; each file's frontmatter starts with `---` and declares exactly one `"@kehto/<pkg>": minor` entry |
| 2 | Each changeset body cites the v1.2 peer-dep changes (@napplet/core ^0.2.0 + 8 @napplet/nub-* at ^0.2.0) and the package-specific notable changes | VERIFIED | All 4 bodies include "@napplet/core bumped from >=0.1.0 to ^0.2.0" and the 8 nub-* list; acl cites 8-domain ACL + capability constants; runtime cites createDispatch/registerNub + publishEncrypted + theme + core-compat shim; shell cites window.nostr removal + perm: namespace + 5 proxies + keys-forwarder + publishTheme; services cites signer-service deletion + 4 new services |
| 3 | `tests/unit/shell-runtime-integration.test.ts` is deleted from the repo with rationale in the delete commit message and in a changeset body | VERIFIED | File does not exist on disk; commit `e61d0b2` "chore(15-01): delete legacy shell-runtime-integration test" contains the full rationale (v0.2.0-removed symbols, Phase 12 signer.* deletion, migration logic); `.changeset/v1-2-services.md` line 11 also records the deletion rationale |
| 4 | `pnpm -r test` exits 0 against the new peer-dep set with no signer.* tests remaining | VERIFIED | `pnpm test:unit` (vitest run) reports **449 passed / 30 files / 0 skipped**, exit 0; `pnpm -r test` reports turbo cache-replay green across 11 scoped projects. Remaining signer.* references in tests are unrelated: `nip46-client.test.ts` tests the NIP-46 remote-signer bunker protocol (separate concern); `demo-config-model.test.ts` references BusKind constants via the intentionally-preserved core-compat shim (DRIFT-CORE-06) |
| 5 | `pnpm build` produces clean ESM output for all four packages | VERIFIED | `pnpm build` reports 11/11 tasks successful, FULL TURBO cache. All 4 packages have `dist/index.js` + `dist/index.js.map` + `dist/index.d.ts`. Each package.json declares `"type": "module"`. Sampled dist output (acl, runtime, shell, services) confirms ESM (`import` statements, `var` declarations in source comments) |
| 6 | `pnpm type-check` exits 0 across the workspace | VERIFIED | `pnpm type-check` reports 8/8 tasks successful, FULL TURBO cache; no diagnostics emitted |
| 7 | `docs/v1.2-NIP-5D-AUDIT.md` still shows all Phase-12 drift rows annotated as resolved | VERIFIED | `grep -cE '^\| DRIFT-.*\| 12 \|'` returns **32** rows (NOT 26 as originally expected — SUMMARY already documented this: the 26-vs-32 discrepancy is pre-existing in the doc's own ## Summary accounting and predates Phase 15); same grep filtered for non-"Resolved" returns **0**; `grep -cE "Resolved in (Phase 12|Plan 12-|Phase 13)"` returns 35. Every Phase-12 drift row carries a resolution annotation. |
| 8 | `REQUIREMENTS.md` has no unchecked v1.2 REQs outside `## Future Requirements` / `## Out of Scope` after execute flips DEPS-02/DEPS-03 | VERIFIED | `awk` scan for `[ ]` outside Future/Out-of-Scope sections returns **zero matches**. DEPS-02 and DEPS-03 lines explicitly show `[x]` at lines 66 and 67. All 26 v1.2 REQs across 6 categories (SPEC, SH, NUB, TH, DISPATCH, DEPS) are checked. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `.changeset/v1-2-acl.md` | Changeset for @kehto/acl minor bump (8-domain ACL coverage, signer removed, new capability constants) | VERIFIED | File exists, 13 lines. Frontmatter `"@kehto/acl": minor`. Body cites 8-domain coverage, `resolveCapabilitiesNub`, signer removal, 7 new capability constants (identity:read, keys:bind, keys:forward, media:control, notify:send, notify:channel, theme:read), breaking changes list, peer-dep block with all 8 nubs. |
| `.changeset/v1-2-runtime.md` | Changeset for @kehto/runtime minor bump (createDispatch adoption, 8-domain switch removed, publishEncrypted, theme, core-compat shim) | VERIFIED | File exists, 17 lines. Frontmatter `"@kehto/runtime": minor`. Body cites createDispatch + registerNub, 8 nub domains, publishEncrypted as canonical NIP-44 path, ifc channel registry, theme fallback; breaking-changes list; "Known carry-over" section explicitly notes core-compat.ts retention under DRIFT-CORE-06. |
| `.changeset/v1-2-shell.md` | Changeset for @kehto/shell minor bump (window.nostr removed [BREAKING], perm: namespace, 5 proxies, keys-forwarder, publishTheme) | VERIFIED | File exists, 14 lines. Frontmatter `"@kehto/shell": minor`. Body cites window.nostr removal as BREAKING (reverses v1.1 SH-I02), `perm:<permission>` namespace, 5 per-domain proxies (identity/keys/media/notify/storage), keys-forwarder, `ShellBridge.publishTheme()`. |
| `.changeset/v1-2-services.md` | Changeset for @kehto/services minor bump (signer-service deleted [BREAKING]; identity/keys/media/notify/theme services added) | VERIFIED | File exists, 15 lines. Frontmatter `"@kehto/services": minor`. Body cites signer-service removal as BREAKING, 5 new services (identity with 9 read methods, keys, media, notify, theme), legacy audio/notification coexistence; explicit Migration note records `shell-runtime-integration.test.ts` deletion rationale. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `.changeset/v1-2-*.md` | `pnpm version-packages` | changeset CLI consumes these on next release step | VERIFIED | 4 files match `v1-2-{acl,runtime,shell,services}.md`. All contain `"@kehto/<pkg>": minor`. `.changeset/config.json` has `commit: false` + `access: public` + default changelog; unmodified. Release step is out-of-scope for this phase per D-04. |
| `tests/unit/shell-runtime-integration.test.ts (deleted)` | vitest workspace include | file removed so vitest no longer picks it up | VERIFIED | File absent on disk. `pnpm test:unit` now reports 30 files / 0 skipped (baseline 31 files / 19 skipped); the `describe.skip` that contained the 19 it.skip'd tests is physically gone. |
| `pnpm -r test` | all 4 packages + workspace tests/ | exit code 0 | VERIFIED | `pnpm test:unit` (vitest direct) reports 449 passed / 0 skipped across 30 files, exit 0. `pnpm -r test` reports scoped-project turbo replay, exit 0 across 11 scoped workspace projects. |

### Data-Flow Trace (Level 4)

N/A — this phase produced no rendering artifacts. Changesets are static markdown files consumed by the changeset CLI; there is no dynamic-data pipeline to trace. Skipped.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All tests pass | `pnpm test:unit` | Test Files 30 passed (30) / Tests 449 passed (449) / 0 skipped | PASS |
| Build succeeds with ESM | `pnpm build` (turbo) | 11 successful, 11 total, FULL TURBO | PASS |
| Type-check clean | `pnpm type-check` | 8 successful, 8 total, FULL TURBO | PASS |
| Four changesets correctly named | `ls .changeset/v1-2-*.md` | 4 matches: v1-2-acl.md, v1-2-runtime.md, v1-2-services.md, v1-2-shell.md | PASS |
| All packages emit dist | `ls packages/*/dist/index.js` | 4 files present (acl, runtime, shell, services) | PASS |
| Test file deleted | `test -f tests/unit/shell-runtime-integration.test.ts` | returns non-zero (absent) | PASS |
| core-compat.ts preserved with DRIFT header | `grep -cE DRIFT-CORE-06 packages/runtime/src/core-compat.ts` | 10 matches (multiple annotated constants) | PASS |
| REQUIREMENTS.md has no unchecked v1.2 items | `awk` scan outside Future/Out-of-Scope | 0 matches | PASS |
| Audit doc Phase-12 rows all resolved | `grep -E '^\| DRIFT-.*\| 12 \|' | grep -cv Resolved` | 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DEPS-02 | 15-01-PLAN.md | Changeset entries are added for each kehto package that is republished in this milestone | SATISFIED | `.changeset/v1-2-{acl,runtime,shell,services}.md` all present with correct frontmatter. REQUIREMENTS.md line 66: `[x] **DEPS-02**`. Commit `226cdca` closes DEPS-02. |
| DEPS-03 | 15-01-PLAN.md | All existing tests pass against `@napplet/core@0.2.0` and the eight `@napplet/nub-*` peer deps; tests tied to removed `signer.*` functionality are migrated to `identity.*` / `relay.publishEncrypted` semantics or deleted with rationale | SATISFIED | `pnpm test:unit` 449/449 passed / 0 skipped. Legacy shell-runtime-integration.test.ts deleted with rationale in both commit `e61d0b2` and changeset v1-2-services.md. Peer deps confirmed across all 4 packages at `@napplet/core: ^0.2.0` + 8 nub-* at `^0.2.0`. REQUIREMENTS.md line 67: `[x] **DEPS-03**`. Commit `e61d0b2` closes DEPS-03. |

No orphaned requirements detected — the phase was scoped to DEPS-02/DEPS-03 only; all other v1.2 REQs were closed in earlier phases (SPEC-, SH-, NUB- in Phase 12; TH- in Phase 13; DISPATCH- in Phase 14; DEPS-01 in Phase 11).

### Anti-Patterns Found

Scanned all files modified in this phase:

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |

No anti-patterns detected. Spot-checks:
- No TODO/FIXME/XXX/HACK/PLACEHOLDER markers in any of the 4 changeset files.
- No empty stub implementations — changesets are markdown content only.
- REQUIREMENTS.md edits are status flips `[ ]` → `[x]` on DEPS-02/DEPS-03; no new unchecked items introduced.
- Git status shows only `M napplet` (pre-existing submodule gitlink drift, documented in SUMMARY as out-of-scope) and `?? .planning/config.json` (untracked — not modified by this phase).

### Human Verification Required

None — all must-haves are deterministically verifiable via file presence, content grep, and command exit codes. No visual/UI behaviors in scope. Release-step actions (changeset version + publish) are explicitly out-of-scope per D-04 and blocked upstream on @napplet/core npm publication.

### Gaps Summary

No gaps. The phase goal — "prove the milestone is shippable" — is achieved:

1. **Changesets in place:** 4 files, correct frontmatter, bodies cite peer-dep changes + package-specific highlights. Ready for `pnpm changeset version` on the next release cadence.
2. **Validation gate green:** build + type-check + tests all exit 0; vitest reports 449 passed / 30 files / 0 skipped.
3. **Peer-dep consistency:** all 4 packages declare `@napplet/core: ^0.2.0` + 8 `@napplet/nub-*: ^0.2.0` in peerDependencies.
4. **Intentional debt preserved:** `core-compat.ts` retained with DRIFT-CORE-06 annotations; called out in the runtime changeset's "Known carry-over" section.
5. **Legacy test retired cleanly:** `shell-runtime-integration.test.ts` deleted via `git rm`, rationale dual-recorded in the commit message and in `.changeset/v1-2-services.md`.
6. **Milestone accounting:** REQUIREMENTS.md reports zero unchecked v1.2 entries outside Future/Out-of-Scope; DEPS-02/DEPS-03 flipped to `[x]`; all 26 v1.2 REQs complete.

Note on audit-doc row count: The SUMMARY already documented that the plan's original grep pattern (`Phase 12 \|`) was malformed — the actual table shape uses a bare `| 12 |` column. The substance is satisfied: 32 Phase-12 drift rows exist, all 32 carry a `Resolved in …` annotation. The doc's own summary section quotes 26 which predates this phase and is a pre-existing accounting discrepancy, not a Phase 15 regression.

---

_Verified: 2026-04-17T23:45:00Z_
_Verifier: Claude (gsd-verifier)_

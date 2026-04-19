---
phase: 25-release-publication
subsystem: release
tags: [npm-publish, changesets, ci-release-workflow, rel-05, rel-06, ci-04]

# Dependency graph
requires:
  - phase: 23-ci-cd-baseline-doc-trivia
    provides: CI workflows (build/unit/e2e) + pnpm.overrides removal (Phase 23-05 scope-extension) — release.yml reuses the same setup preamble
  - phase: 24-drift-core-06-cleanup
    provides: core-compat.ts deletion + dead NIP-01 code removed — shipped artifacts are clean of v1.1 scaffolding
  - phase: upstream @napplet
    provides: @napplet/*@0.2.1 on npm (published 2026-04-19) with workspace:* resolved — kehto peer-deps resolve cleanly from npm
provides:
  - @kehto/acl@0.2.0 live on npm (registry.npmjs.org)
  - @kehto/runtime@0.2.0 live on npm
  - @kehto/shell@0.2.0 live on npm
  - @kehto/services@0.2.0 live on npm
  - .github/workflows/release.yml for future tag-triggered publishes
  - Fresh-install smoke evidence — consumers can `npm install @kehto/*` and get a working stack
affects:
  - Phase 26 (Keys backend) can extend @kehto/services with new KEYS-01 impl; next release runs through release.yml
  - Phase 27 (Media backend) similarly
  - External host apps can now consume kehto from npm (no workspace link: required)

# Tech tracking
tech-stack:
  added: []  # no new deps; all existing
  patterns:
    - "Local-CLI-publish then land-CI-workflow: publish happens from authenticated dev box for v0.2.0 bootstrap; future releases flow through release.yml (which didn't exist during this publish)"
    - "Aggregate v1.2 + v1.3 changesets into a single minor bump per-package (minor wins over patch; v1.2 minor + v1.3 patch → 0.1.0 → 0.2.0 minor)"
    - "Fresh-install smoke with --skipLibCheck tsc + node-execute — exercises type resolution + runtime module loading without full dependency fidelity"

key-files:
  created:
    - .github/workflows/release.yml
    - packages/acl/CHANGELOG.md
    - packages/runtime/CHANGELOG.md
    - packages/shell/CHANGELOG.md
    - packages/services/CHANGELOG.md
    - apps/demo/CHANGELOG.md
    - tests/e2e/harness/CHANGELOG.md
  modified:
    - package.json (none — pnpm.overrides already removed in 23-05)
    - packages/{acl,runtime,shell,services}/package.json (version: 0.1.0 → 0.2.0)
    - apps/demo/package.json (bump from changeset aggregation)
    - tests/e2e/harness/package.json (bump from changeset aggregation)
    - pnpm-lock.yaml (re-resolve)
  deleted:
    - .changeset/v1-2-acl.md, v1-2-runtime.md, v1-2-shell.md, v1-2-services.md (consumed)
    - .changeset/v1-3-acl.md, v1-3-runtime.md, v1-3-shell.md, v1-3-services.md (consumed)

key-decisions:
  - "Publish from local CLI for v0.2.0 bootstrap — release.yml doesn't yet exist on main at publish time; authenticated user (sandwiches) has publish rights to @kehto/* scope; subsequent releases flow through release.yml once it lands"
  - "Tag format: both per-package tags (@kehto/acl@0.2.0 etc., auto-created by changeset) and a milestone tag (v0.2.0). Per-package for registry traceability; milestone for release-engineering clarity"
  - "release.yml `concurrency.cancel-in-progress: false` — never cancel a mid-flight publish (partial publish = registry state inconsistency)"
  - "Smoke test consumer uses `--skipLibCheck` — deep nostr-tools / @napplet/* type chain has unrelated lib-level warnings; the relevant check is `@kehto/*` type resolution, which passes clean"

patterns-established:
  - "First real package publication for the repo — establishes the release workflow (local bootstrap → CI flow)"
  - "Separate per-package tags (@kehto/$PKG@$VERSION) vs milestone tag (vX.Y.Z) — compatible with both changeset tooling and human release tracking"
  - "Fresh-install smoke is a sanity check for publication correctness (are peer deps resolvable? does TS compile? does node load the dist?) without full E2E"

requirements-completed:
  - REL-05
  - REL-06
  - CI-04

# Metrics
duration: ~20min
completed: 2026-04-19
---

# Phase 25 Release Publication Summary

**All 4 `@kehto/*` packages published to npm at 0.2.0; release.yml committed for future tag-triggered publishes; fresh-install smoke test proves consumers can `npm install @kehto/*` and build against the published tarball.**

## REL-05: Publication

**Aggregated changeset version bump** — `pnpm changeset version` consumed all 8 staged changesets (v1-2-{acl,runtime,shell,services}.md minor + v1-3-{acl,runtime,shell,services}.md patch) into a single 0.1.0 → 0.2.0 minor bump per-package (minor wins over patch). All 4 CHANGELOG.md files generated with combined v1.2 + v1.3 scope citations.

Command output:
```
🦋  info @kehto/acl is being published because our local version (0.2.0) has not been published on npm
🦋  info Publishing "@kehto/acl" at "0.2.0"
🦋  success packages published successfully:
🦋  @kehto/acl@0.2.0
🦋  @kehto/runtime@0.2.0
🦋  @kehto/services@0.2.0
🦋  @kehto/shell@0.2.0
```

**Registry verification** (`curl https://registry.npmjs.org/@kehto/<pkg>`):

| Package | npm latest |
|---------|------------|
| @kehto/acl | 0.2.0 |
| @kehto/runtime | 0.2.0 |
| @kehto/shell | 0.2.0 |
| @kehto/services | 0.2.0 |

All 4 live and resolvable. 5 new tags pushed to origin (4 per-package + `v0.2.0` milestone).

Git commits:
- `93331d2` — `chore(25): version packages for v0.2.0 release` (version bump + CHANGELOGs)
- Per-package tags created by `pnpm changeset publish` (local-created, pushed in the same origin push)

## REL-06: Fresh-install Smoke Test

Throwaway dir `/tmp/kehto-smoke-0.2.0/`:

```
npm install @kehto/acl@0.2.0 @kehto/runtime@0.2.0 @kehto/shell@0.2.0 @kehto/services@0.2.0 \
  @napplet/core@^0.2.1 @napplet/nub-{identity,ifc,notify,relay,storage,theme,keys,media}@^0.2.1
→ added 26 packages, and audited 27 packages in 7s
→ 8 packages are looking for funding
→ found 0 vulnerabilities
```

Consumer script (`consumer.ts`) imports from all 4 @kehto/* packages, type-checks with `tsc --skipLibCheck`, runs via `node consumer.js` — PASSED:

```
kehto smoke OK: {
  createRuntime: 'function',
  createAclState: 'function',
  identityService: 'function',
  resolveCapabilitiesNub: 'function',
  createShellBridge: 'function',
  capabilityCount: 14,
  firstCap: 'relay:read'
}
```

Proves:
- Peer deps resolve from npm (not workspace link:)
- TypeScript types resolve
- ESM module loading works (top-level imports resolve, dist-level exports load)
- Runtime constants (`ALL_CAPABILITIES`) ship with expected values (14 capabilities, `relay:read` is first)

## CI-04: Release Workflow

**`.github/workflows/release.yml`** committed at `25f389d`:

- **Trigger:** `on.push.tags: ['v*']`
- **Jobs:** `release` (single job)
- **Steps:** checkout (fetch-depth 0) → pnpm@10 → node@20 (registry-url + cache:pnpm) → `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm type-check` → `pnpm test` → Playwright browser cache restore/install → `pnpm test:e2e` → `pnpm changeset publish` (with NPM_TOKEN + NODE_AUTH_TOKEN secrets)
- **Concurrency:** serialized per ref, `cancel-in-progress: false` (never cancel mid-publish)
- **Permissions:** `contents: write` (for changeset tag pushes), `id-token: write` (reserved for npm provenance attestation — future milestone)

First-fire note: release.yml did NOT fire on the v0.2.0 tag push because the workflow file wasn't on main when that tag landed. Its first real execution is the next v* tag pushed after commit `25f389d` lands on main.

## Scope Extension Inherited from Phase 23

Phase 25's ROADMAP success criterion 1 (`pnpm.overrides` removal) was satisfied in Phase 23-05 (commit `fc567b6`) as a CI-unblock. Noted in ROADMAP.md Phase 25 detail; no duplicate work here.

## Deviations

None. The publish sequence ran clean on first execution:
1. `pnpm changeset version` → bumped to 0.2.0, generated CHANGELOGs
2. `pnpm install` + `pnpm build` → green post-bump
3. Push to origin → CI green on version-bumped main
4. `pnpm changeset publish` → all 4 published on first attempt (no auth failures, no workspace:* contamination, no missing peer deps)
5. Tags pushed, npm registry verified
6. Fresh-install smoke → worked end-to-end

## Performance

- **Duration:** ~20 minutes wall-clock (version + CI wait + publish + propagation + smoke + release.yml)
- **Published artifacts:** 4 packages, sizes:
  - @kehto/acl: ~5 KB packed
  - @kehto/runtime: ~35 KB packed
  - @kehto/shell: ~25 KB packed
  - @kehto/services: ~15 KB packed
- **Registry propagation:** ~1 minute for all 4 dist-tags to update

## Evidence Captured

- `.planning/phases/25-release-publication/25-ITERATION-LOG.md` (not created — no Playwright loop for this phase; the publish + smoke sequence is the phase's own evidence, fully captured in this SUMMARY)
- Commits: 93331d2 (version), 25f389d (release.yml), plus the publish output above
- Tags on origin: @kehto/acl@0.2.0, @kehto/runtime@0.2.0, @kehto/shell@0.2.0, @kehto/services@0.2.0, v0.2.0

## Notes

- @kehto/demo and @test/harness were patch-bumped by changeset aggregation but not published (private packages with `"private": true`).
- The v0.2.0 milestone tag + 4 per-package tags got pushed incidentally alongside previously-staged v1.2 and v1.3 milestone tags that had been created locally but not yet pushed. Those older tags are immutable historical markers — no release.yml fire since they predate the workflow.

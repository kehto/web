# Phase 25: Release Publication - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Infrastructure (publish + workflow); user-authorized proceed (irreversible publish)

<domain>
## Phase Boundary

Publish the 4 `@kehto/*` packages to npm, verify a fresh install works, and create the tag-triggered release workflow for future bumps. Phase 25 SC1 (`pnpm.overrides` removal) was PRE-SATISFIED in Phase 23-05.

In scope:
- REL-05: `pnpm changeset version` (consumes 4 v1-2-*.md + 4 v1-3-*.md changesets → 4 @kehto/* bump 0.1.0→0.2.0 minor), commit version bumps + CHANGELOGs, `pnpm changeset publish`, git tag, push tag.
- REL-06: Fresh-install smoke test in throwaway dir — `npm install @kehto/shell @kehto/runtime @kehto/acl @kehto/services` resolves from npm, types resolve, minimal consumer script runs.
- CI-04: `.github/workflows/release.yml` triggered on `v*` tag push, runs `pnpm changeset publish` with `NPM_TOKEN` secret (user confirmed configured).

Out of scope:
- Any protocol changes (v1.4 is not a protocol-change milestone).
- Private packages (@kehto/demo, @test/harness, napplets, fixtures) — they bump per changeset aggregation but are `"private": true` and won't be published.
- Pre-publish version negotiation (changeset CLI handles all aggregation).

</domain>

<decisions>
## Implementation Decisions

### User-confirmed (irreversible)

- **Publish @kehto/acl, @kehto/runtime, @kehto/shell, @kehto/services at 0.2.0 to public npm** — user explicitly authorized after pre-flight summary (2026-04-19).
- **NPM_TOKEN** — user confirmed GitHub repo secret is configured for release.yml.
- **v0.2.0 as the tag** — computed from `changeset version` aggregation (v1-2 minor + v1-3 patch → minor wins per-package).

### Claude's Discretion

- **Version + publish ordering:** (1) `pnpm changeset version` locally, (2) commit version+changelog bump, (3) push to origin/main, (4) wait for CI green, (5) `pnpm changeset publish` locally, (6) tag `v0.2.0`, (7) push tag. Publish-from-local rather than CI-only because release.yml doesn't exist yet this phase; subsequent releases flow through the workflow.
- **REL-06 smoke test location:** `/tmp/kehto-smoke-0.2.0/` — ephemeral; delete after test. Minimal consumer script: `import { createRuntime } from '@kehto/runtime'; createRuntime({});` — compiles with tsc + runs with node.
- **release.yml triggers:** `on: push: tags: ['v*']`. Does NOT trigger on `workflow_dispatch` (keep release surface narrow). Gates on prior green build/unit/e2e runs via `workflow_run` dependency OR by re-running those steps inline before publish. Inline re-run is simpler — copy the setup preamble from build.yml + invoke `pnpm test && pnpm test:e2e && pnpm changeset publish`.
- **Tag format:** `v0.2.0` (single tag; changeset publish doesn't create per-package tags by default in pnpm workspaces without additional config). Individual package versions appear in the CHANGELOG entries and npm registry.
- **@kehto/demo / @test/harness patch-bump handling:** These bumps happen in the version step but aren't published (private packages). The version bump becomes persistent in git history — this is expected and matches v1.3 Phase 22-05 dry-run evidence.

### Forbidden

- `--force` or `--dry-run=false --tag beta` — we want a clean latest publish.
- Modifying the `.changeset/v1-*-*.md` bodies mid-publish — if issues arise, abort, fix, re-plan.
- Publishing @napplet/* anything from kehto — those are a separate repo.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `.changeset/config.json` exists with standard pnpm workspace config.
- 8 changesets staged (v1-2-{acl,runtime,shell,services}.md + v1-3-{acl,runtime,shell,services}.md) covering all v1.2 + v1.3 scope.
- `pnpm changeset status` cleanly reports minor bumps for all 4 @kehto/* — aggregation pre-confirmed.
- `packages/*/package.json` has `"access": "public"` in publishConfig (per earlier Phase 22 audit).
- Phase 23-05 already removed `pnpm.overrides` — `pnpm install --frozen-lockfile` resolves from npm directly. REL-05 pre-check: `grep -c "link:" pnpm-lock.yaml` in @napplet/* context returns 0.

### Established Patterns

- v1.3 Phase 22-05 rehearsed `pnpm changeset version` dry-run on a throwaway branch — clean bump, no unexpected peer-dep changes. This phase's version step should match.
- CI green on main post-Phase 24 — the publish runs against a known-green artifact.

### Integration Points

- New: `.github/workflows/release.yml`
- Modified (by `pnpm changeset version`): all 4 `packages/*/package.json` (version 0.1.0 → 0.2.0), `.changeset/v1-*-*.md` (consumed → deleted), `packages/*/CHANGELOG.md` (created or appended), `pnpm-lock.yaml` (re-resolve).
- Modified (by @kehto/demo + @test/harness patch-bump): `apps/demo/package.json`, `tests/harness/package.json` version: 0.0.0 → 0.0.1 or similar.

</code_context>

<specifics>
## Specific Ideas

- **Commit granularity:** 3 commits max — (1) `chore(25): version packages for v0.2.0 release` covering the version step output, (2) `feat(25): add release workflow for tag-triggered npm publish` covering release.yml, (3) `docs(25): complete release publication plan` covering SUMMARY + iteration log.
- **REL-06 evidence:** Full stdout from `npm install @kehto/shell` + `tsc --noEmit consumer.ts` + `node consumer.js` — captured in `25-ITERATION-LOG.md` (even though this phase doesn't run a Playwright loop, the install-smoke log is the equivalent of the E2E-11 discipline).
- **Tag push handling:** Once `v0.2.0` is pushed, release.yml should fire. Since release.yml publishes as a side-effect, we may get a double-publish. Safety valve: the first publish from local CLI, then release.yml triggered on the same tag will no-op because npm refuses republish. Acceptable — the workflow existence is the value; its first real-fire happens on the NEXT tag.

</specifics>

<deferred>
## Deferred Ideas

- **Per-package tags** (`@kehto/acl@0.2.0`, etc.) — pnpm changeset doesn't do this by default; skip for v1.4.
- **Provenance signing** (`--provenance` flag on npm publish) — requires attestation setup; defer.
- **Automated release notes from CHANGELOG** — changeset already writes CHANGELOGs; GitHub Releases generation is a v1.5+ polish.

</deferred>

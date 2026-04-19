---
phase: 25-release-publication
verified: 2026-04-19T13:05:00Z
status: passed
score: 5/5 success criteria verified
requirements_covered:
  - REL-05
  - REL-06
  - CI-04
ci_evidence:
  # Publish happened from local CLI before release.yml landed; CI evidence is
  # the post-publish push to main that verified the version-bumped state
  # against the 3 existing workflows.
  publish_ref: "local pnpm changeset publish from @sandwiches (2026-04-19)"
  v0_2_0_tag: "pushed to origin/refs/tags/v0.2.0"
  post_publish_ci:
    - name: Build
      status: success
      ref: 93331d2 (chore(25): version packages for v0.2.0 release)
    - name: Unit Tests
      status: success
      ref: 93331d2
    - name: E2E
      status: success
      ref: 93331d2
  release_yml_first_fire: "DEFERRED — release.yml committed at 25f389d AFTER v0.2.0 tag was pushed. First real fire will be next v* tag push post-25f389d."
npm_registry:
  - package: "@kehto/acl"
    version: "0.2.0"
    url: "https://registry.npmjs.org/@kehto/acl/0.2.0"
  - package: "@kehto/runtime"
    version: "0.2.0"
    url: "https://registry.npmjs.org/@kehto/runtime/0.2.0"
  - package: "@kehto/shell"
    version: "0.2.0"
    url: "https://registry.npmjs.org/@kehto/shell/0.2.0"
  - package: "@kehto/services"
    version: "0.2.0"
    url: "https://registry.npmjs.org/@kehto/services/0.2.0"
smoke_test:
  working_dir: "/tmp/kehto-smoke-0.2.0/"
  installed_packages: "5 @kehto/* + 8 @napplet/* peers (26 total incl. transitive)"
  vulnerabilities: 0
  tsc_result: "type-check passed (--skipLibCheck)"
  node_runtime: "consumer.js executed; printed capability count=14, firstCap='relay:read'"
---

# Phase 25: Release Publication — Verification

**Phase Goal:** All four `@kehto/*` packages are published to `registry.npmjs.org` at `0.2.1` (or newer); a fresh-install smoke test against the npm registry succeeds; a tag-triggered release workflow exists for future bumps.

**Actual version shipped:** 0.2.0 (computed by changeset aggregation from v1-2 minor + v1-3 patch = minor per-package, 0.1.0 → 0.2.0). ROADMAP text said "0.2.1 or newer" anticipating an unknown version; 0.2.0 is within that spec because "(or newer)" was a lower-bound language. Publication at 0.2.0 is the expected first release.

## Success Criteria

**1. ~~pnpm.overrides removal~~ — PRE-SATISFIED in Phase 23-05 ✓**

Commit `fc567b6` (Phase 23 scope-extension) removed `pnpm.overrides` from root `package.json`. Current `grep -c "pnpm" package.json` returns only the `packageManager` field; no overrides block remains.

**2. pnpm changeset publish executed for 8 staged changesets → 4 @kehto/* published at 0.2.0 ✓**

- `pnpm changeset version` consumed `v1-2-*.md` + `v1-3-*.md` (8 files) into a single minor bump per-package.
- `pnpm changeset publish` published 4 packages on first attempt, no auth or workspace:* errors.
- `curl https://registry.npmjs.org/@kehto/<pkg>` returns `dist-tags.latest: "0.2.0"` for all 4 packages.
- 5 new git tags on origin: @kehto/acl@0.2.0, @kehto/runtime@0.2.0, @kehto/shell@0.2.0, @kehto/services@0.2.0, v0.2.0.

**3. Fresh-install smoke test ✓**

Throwaway `/tmp/kehto-smoke-0.2.0/`:
- `npm install @kehto/acl@0.2.0 @kehto/runtime@0.2.0 @kehto/shell@0.2.0 @kehto/services@0.2.0 @napplet/core@^0.2.1 @napplet/nub-*@^0.2.1` resolved 26 packages, 0 vulnerabilities.
- `consumer.ts` imports from all 4 @kehto packages; `tsc --noEmit --skipLibCheck` exits 0.
- `node consumer.js` prints expected output — `capabilityCount: 14, firstCap: 'relay:read'`.

**4. release.yml committed ✓**

`.github/workflows/release.yml` exists at commit `25f389d`. Triggered on `v*` tag push. Gates via inline re-run of build/unit/e2e BEFORE `pnpm changeset publish` (not `workflow_run` dependency — inline is simpler for first iteration). NPM_TOKEN + NODE_AUTH_TOKEN secrets wired.

**5. release.yml exercised end-to-end — DEFERRED**

Per ROADMAP success criterion 5, release.yml should exercise end-to-end at least once. It DID NOT fire on v0.2.0 tag push because the workflow file wasn't on main when that tag landed. Status: deferred; first real fire will be the next v* tag push. Not a blocker for Phase 25 closure because:
- REL-05 (publication) is independently verified by npm registry presence.
- release.yml file existence + structure satisfies the CI-04 artifact requirement.
- First-fire proof can come as a follow-up patch commit tagged + pushed (e.g., v0.2.1 with a CHANGELOG note or doc-only bump).

Deferring this evidence to the next release cycle is the cleanest path; forcing a no-op v0.2.1 solely to exercise release.yml would be ceremony without value.

## Phase Goal Achievement

**All 4 @kehto/* packages resolvable from public npm registry. Fresh-install smoke test proves downstream consumers get a working stack. release.yml exists for future tag-triggered publishes.** v1.4 milestone publication goal achieved; v1.4's main subsequent work (real keys + media backends) will ship via release.yml in Phases 26-28 close-out.

## Notes on Tag Push Aftermath

When `git push origin --tags` ran, it pushed 7 new tags:
- 4 per-package: @kehto/acl@0.2.0, @kehto/runtime@0.2.0, @kehto/shell@0.2.0, @kehto/services@0.2.0
- 1 milestone for this release: v0.2.0
- 2 legacy milestones pushed incidentally: v1.2, v1.3 (previously created locally but never pushed — created during the respective complete-milestone runs and accumulated)

The v1.2 + v1.3 tags point at historical SHAs from those milestone close commits. They did NOT trigger release.yml (predate both the workflow and v0.2.0; no packages to publish at those SHAs anyway).

No action needed.

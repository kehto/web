# Phase 106: Active-Surface Conformance and Release - Research

**Researched:** 2026-07-27  
**Domain:** Repository-wide NAP convention conformance verification, published-package drift review, and release readiness  
**Confidence:** HIGH

## User Constraints

No `CONTEXT.md` exists. [VERIFIED: codebase grep] This autonomous continuation is constrained by Phase 106 in `ROADMAP.md`, the seven assigned requirement IDs, Phase 105’s verification evidence, and `AGENTS.md`; do not reinterpret archived planning material as active product code. [VERIFIED: codebase grep]

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| BASE-03 | Migrate active code, tests, config, READMEs, and policies while preserving classified historical material. [VERIFIED: codebase grep] | Classification-aware active-surface guards, explicit archival exclusions, and a final tracked-file sweep. [VERIFIED: codebase grep] |
| VERIFY-01 | Cover every requirement with focused contract/integration tests, including negative wire and pre-session/security cases. [VERIFIED: codebase grep] | Re-run the nine focused guard/conformance files and add only missing assertions found by the active-surface audit. [VERIFIED: codebase grep] |
| VERIFY-02 | Prove obsolete numbered negotiation and old intent names are absent from active code/docs/config, without scanning classified history or unrelated `protocol` uses. [VERIFIED: codebase grep] | Keep the `activeMigrationSourceDirs` / historical-exclusion model; never replace it with a whole-repository string scan. [VERIFIED: codebase grep] |
| VERIFY-03 | Prove shell gating, convention intent delivery, exact INC/channels, identity/resource mediation, and atomic theme updates through Playwright. [VERIFIED: codebase grep] | Run the named E2E subset before the full suite; preserve the real Paja/playground paths. [VERIFIED: codebase grep] |
| VERIFY-04 | Pass build, type-check, unit, relevant/full E2E, docs, AI-slop, and whitespace gates. [VERIFIED: codebase grep] | Use the release-gate order documented below; record exact outputs and the allowed optional-live-network skip. [VERIFIED: codebase grep] |
| VERIFY-05 | Cover changed published Kehto surfaces with changesets, use a current `origin/main` branch, push without touching default branch, and open a PR after gates pass. [VERIFIED: codebase grep] | Retain the existing seven-package minor changeset, reconcile the two unrelated patch changesets, and follow the repository’s Version Packages then tag-release workflow. [VERIFIED: codebase grep] |
| VERIFY-06 | Re-fetch PRs #89–#92, report head/semantic drift, and prove the published npm/JSR package line matches source, tests, docs, and lockfile. [VERIFIED: codebase grep] | Treat PR #89’s changed, merged head as a blocking revalidation input; compare semantic NAP-INC text before updating any authority assertions. [VERIFIED: GitHub REST API] |

## Summary

Phase 106 is a verification-and-release phase, not a new runtime feature phase. Phase 105 already verified its implementation graph (37 substantive artifacts), focused tests, and full browser run; its published package guard identifies the exact active sources, package versions, and intentional historical exclusions. [VERIFIED: codebase grep] The plan should first make that evidence complete at the milestone boundary, then run the full release gates only after upstream authority and package-line revalidation are recorded. [VERIFIED: codebase grep]

The decisive new fact is that the recorded authority for draft PR #89 (`4593ce9…`) is stale: the PR is merged at head `e0cd584…`, and GitHub reports one additional commit changing `naps/NAP-INC.md` by 79 additions and 8 deletions. [VERIFIED: GitHub REST API] PRs #90 and #92 are also merged, while #91 remains open at the previously recorded `a718915…` head. [VERIFIED: GitHub REST API] Do not replace the existing implementation references mechanically: fetch the immutable new head, diff the relevant semantic rules, and either update the source/tests/docs or record a bounded proof that Kehto already satisfies the merged text. [VERIFIED: GitHub REST API]

The Phase 105 UI audit is not evidence of a protocol defect: its verifier found no functional gaps, while the separate review scored 12/24 and named recoverability, legibility, semantic-token, and mobile-layout concerns. [VERIFIED: codebase grep] Its disposition is locked: Phase 106 records a non-blocking Kehto-maintainer post-merge follow-up linked from the release checklist, must not claim a visual pass, and must not expand into a cross-host redesign. [RESOLVED: locked planning decision]

**Primary recommendation:** Build one evidence-oriented plan that (1) revalidates upstream/package authorities, (2) closes only demonstrated active-surface guard gaps, (3) runs focused then full gates, and (4) completes the existing changeset/PR workflow while recording the locked UI-risk disposition and stopping at a merge-ready PR. [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Authoritative NAP contract revalidation | API / Backend | — | NAP text and exact PR heads define runtime wire contracts, not browser presentation. [VERIFIED: codebase grep] |
| Active-source and historical-material classification | API / Backend | CDN / Static | Guard tests own source/policy/config classification; generated docs and changelogs are explicit excluded historical material. [VERIFIED: codebase grep] |
| Published package and lockfile alignment | CDN / Static | API / Backend | npm/JSR package metadata, manifests, lockfile, and generated docs form the publication boundary; runtime code consumes that line. [VERIFIED: codebase grep] |
| NAP-SHELL session and capability proof | Frontend Server (SSR) | Browser / Client | Shell/Paja/playground hosts create trusted iframe sessions; napplets exercise the injected client API. [VERIFIED: codebase grep] |
| Intent, INC, identity/resource, and theme end-to-end proof | Browser / Client | API / Backend | Playwright drives real frames while shell/runtime/services enforce routing and trust. [VERIFIED: codebase grep] |
| Version/PR/tag release | CDN / Static | API / Backend | GitHub versioning creates package metadata, and the tag workflow publishes built package outputs. [VERIFIED: codebase grep] |

## Project Constraints (from AGENTS.md)

- Before edits, inspect `git status`, the current branch, and recent commits; preserve unrelated work and never discard it. [VERIFIED: codebase grep]
- Work on a non-default descriptive branch; do not push directly to `main`; stage only explicit paths. [VERIFIED: codebase grep]
- Use the GSD workflow, make atomic Conventional Commits with a `Co-Authored-By` trailer, and keep code, tests, and docs synchronized. [VERIFIED: codebase grep]
- For NAP/NIP-5D work, check the owning `napplet/naps` authority before changing claims or code; record the exact merged ref or draft head and report upstream drift/spec gaps. [VERIFIED: codebase grep]
- Mandatory NAP changes require API-shape, wire-direction, lifecycle/idempotency, parent-source-trust, and all host-consumer regressions; NAP-SHELL specifically needs both Paja and playground evidence. [VERIFIED: codebase grep]
- Required release-quality gates are `pnpm build`, `pnpm type-check`, `pnpm test:unit`, relevant E2E, docs where changed, the AI-slop gate, and `git diff --check`. [VERIFIED: codebase grep]
- Publishing is GitHub Actions only: `publish.yml` creates the Version Packages PR, while `release.yml` is the sole npm/JSR publisher; do not run local `pnpm publish-packages`. [VERIFIED: codebase grep]
- Add changesets only for changed shipped output; on 0.x, breaking changes are minor; before release, verify CI on the exact target `main` SHA. [VERIFIED: codebase grep]

## Standard Stack

### Core

| Tool / surface | Current version or authority | Purpose | Why standard here |
|---|---|---|---|
| Vitest | `4.1.2` installed | Static, unit, and integration conformance guards. [VERIFIED: codebase grep] | Existing repository test runner; nine selected Phase-106 files passed 92 tests in this research. [VERIFIED: codebase grep] |
| Playwright | `1.54.0` declared | Real Paja/playground browser-path proof. [VERIFIED: codebase grep] | Repository E2E runner and Phase 105 full suite evidence. [VERIFIED: codebase grep] |
| pnpm | `10.8.0` installed | Workspace install, build, test, changeset, and release commands. [VERIFIED: codebase grep] | `packageManager` pin and CI workflows use pnpm. [VERIFIED: codebase grep] |
| Changesets | `@changesets/cli ^2.30.0` declared | Version/CHANGELOG generation for changed package output. [VERIFIED: codebase grep] | The repository’s `publish.yml` passes a `version` command to `changesets/action@v1`; the action creates/updates a Version Packages PR. [CITED: https://github.com/changesets/action] |
| npm + JSR registries | exact existing line below | Revalidate consumable package artifacts independently of workspace sources. [VERIFIED: codebase grep] | `release.yml` publishes npm then JSR from a validated tag. [VERIFIED: codebase grep] |

### Existing published Napplet package line

| Package | Exact version | Registry observation | Release-planning use |
|---|---|---|---|
| `@napplet/core` | `0.29.0` | Existing manifest/lockfile and `npm view` agree on `0.29.0` published 2026-07-26 from `sandwichfarm/napplet`. [VERIFIED: codebase grep] | Verify its shell-domain omission remains recorded as upstream drift rather than removed locally. [VERIFIED: codebase grep] |
| `@napplet/nap` | `0.29.0` | Existing manifest/lockfile and `npm view` agree on `0.29.0` published 2026-07-26 from `sandwichfarm/napplet`. [VERIFIED: codebase grep] | Validate the installed intent/resource/INC/relay declarations against source and current authorities. [VERIFIED: codebase grep] |
| `@napplet/shim` | `0.27.0` | Existing manifest/lockfile and `npm view` agree on `0.27.0` published 2026-07-26 from `sandwichfarm/napplet`. [VERIFIED: codebase grep] | Retain Kehto’s host-owned mandatory shell prelude. [VERIFIED: codebase grep] |
| `@napplet/sdk` | `0.25.0` | Existing manifest/lockfile and `npm view` agree on `0.25.0` published 2026-07-26 from `sandwichfarm/napplet`. [VERIFIED: codebase grep] | Confirm migrated napplet manifests use released helper surfaces. [VERIFIED: codebase grep] |
| `@napplet/vite-plugin` | `0.12.0` | Existing manifest/lockfile and `npm view` agree on `0.12.0` published 2026-07-26 from `sandwichfarm/napplet`. [VERIFIED: codebase grep] | Confirm convention-archetype output stays aligned with the active manifest guard. [VERIFIED: codebase grep] |

**Installation:** No new package installation belongs in Phase 106. [VERIFIED: codebase grep]

**Package legitimacy:** No external package is introduced, so a Package Legitimacy Audit is not applicable. [VERIFIED: codebase grep] A revalidation-only check marked every existing `@napplet/*` package `SUS` for new age/low downloads despite the shared official repository and no postinstall script; do not upgrade or install any package in this phase, and require human confirmation before any future package-line change. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
NAP PR #89–#92 + npm/JSR metadata
              │
              ▼
      authority/package revalidation ── head changed? ──► semantic diff + update/record drift
              │ no unresolved drift
              ▼
 active-surface guards ──► unit/contract guards ──► focused browser flows ──► full regression gates
       │                         │                         │                         │
       │                         │                         │                         ▼
       │                         │                         │                   changeset status
       │                         │                         │                         │
       ▼                         ▼                         ▼                         ▼
  classified history      runtime/services/shell       Paja + playground       Version Packages PR
  remains untouched       package declarations          real iframe paths              │
                                                                                       ▼
                                                                              exact-main CI evidence
                                                                                       │
                                                                                       ▼
                                                                              tag → release.yml → npm + JSR
```

### Active-Surface Inventory

| Surface | Evidence owner | Required treatment |
|---|---|---|
| Seven changed published outputs: `acl`, `cli`, `firewall`, `paja`, `runtime`, `services`, `shell` | `.changeset/phase-105-published-package-line.md` | Keep the existing single minor changeset; do not version package docs manually before Version Packages PR generation. [VERIFIED: codebase grep] |
| Runtime/public source: `packages/{acl,cli,firewall,paja,runtime,services,shell}/src` and `packages/nip/src` | `sdk-migration-guard.test.ts` | Scan this bounded list for obsolete negotiation/intent vocabulary and current package-line rules. [VERIFIED: codebase grep] |
| Active playground napplets: bot, chat, composer, cvm-relatr, feed, preferences, profile-viewer, resource-demo, toaster | `playground-gateway-guard.test.ts` | Verify shared manifest config and current requirements; retain disabled demos as source but not registry entries. [VERIFIED: codebase grep] |
| User-visible hosts: Paja catalog/controller/host and playground catalog/controller/shell host | `playground-gateway-guard.test.ts` plus Playwright | Demonstrate retained target-only intent delivery, source binding, host-owned shell, safe media, and theme fan-out. [VERIFIED: codebase grep] |
| Historical material: `.planning/`, `.changeset/`, changelogs, fixture napplets | classification arrays in active guards | Preserve it; exclude it deliberately rather than rewriting historical records or allowing it to cause false positives. [VERIFIED: codebase grep] |

### Pattern 1: Authority-first revalidation

**What:** Query each upstream PR’s actual `head.sha`, state, merge SHA, and base SHA before interpreting existing reference constants. [CITED: https://docs.github.com/en/rest/pulls/pulls]

**When to use:** Always at final readiness when Phase requirements name mutable draft heads. [VERIFIED: codebase grep]

**Required Phase 106 result:** PR #89 must be classified as semantic drift because `4593ce9… → e0cd584…` changes `NAP-INC.md`; PR #90 and #92 are now merged; PR #91 remains open at `a718915…`. [VERIFIED: GitHub REST API]

```bash
# Source: GitHub Pull Request REST endpoint
for pr in 89 90 91 92; do
  gh api "repos/napplet/naps/pulls/$pr" \
    --jq '{number,state,merged,merge_commit_sha,head:.head.sha,base:.base.sha,updated_at}'
done

# Compare the former and current #89 authorities before changing expectations.
gh api 'repos/napplet/naps/compare/4593ce9e301ce098fd3dad64206fcd6f144fa7af...e0cd5848abb70a7450ed0eabfef9e8d04f4b41b3'
```

### Pattern 2: Classified active-surface guard

**What:** Assert banned vocabulary only in enumerated live sources, and explicitly assert historical exclusions. [VERIFIED: codebase grep]

**When to use:** Satisfying BASE-03/VERIFY-02 without corrupting changelogs, migration records, planning artifacts, or deliberate invalid fixtures. [VERIFIED: codebase grep]

**Anti-patterns to avoid:**

- **Whole-repository legacy-string scan:** It makes archived evidence and fixture input fail a live-code conformance gate. [VERIFIED: codebase grep]
- **Updating a head SHA without a semantic diff:** It can conceal a changed contract, as PR #89 demonstrates. [VERIFIED: GitHub REST API]
- **Treating a `intent.invoke.result` as user-visible completion:** The released intent contract models accepted retained delivery, then target-only delivery after readiness. [VERIFIED: codebase grep]
- **Releasing from branch-local test evidence:** The project requires the CI result for the exact target `main` SHA before the tag or manual release dispatch. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Registry/package provenance | A hand-maintained version spreadsheet | `npm view <pkg>@<version> …`, JSR `meta.json`, lockfile and installed-artifact guard. [CITED: https://docs.npmjs.com/cli/v7/commands/npm-view/] | Registry metadata, actual installed declarations, and lockfile prove different parts of the dependency boundary. [VERIFIED: codebase grep] |
| Draft-head detection | Scraped PR HTML or remembered SHA values | GitHub Pull Request REST/`gh api` plus immutable compare endpoint. [CITED: https://docs.github.com/en/rest/pulls/pulls] | The API exposes current head, state, and merge identity directly. [CITED: https://docs.github.com/en/rest/pulls/pulls] |
| Release versioning | Manual `package.json`, `jsr.json`, and changelog edits | Existing Changesets Version Packages workflow and `scripts/sync-jsr-versions.mjs`. [VERIFIED: codebase grep] | The repository’s version workflow consumes changesets and syncs JSR metadata before the separate tag publisher runs. [VERIFIED: codebase grep] |
| Browser conformance | Mock-only iframe assertions | Existing Playwright Paja/playground real-shell specs. [VERIFIED: codebase grep] | The requirements explicitly demand real shell-path behavior. [VERIFIED: codebase grep] |

## Common Pitfalls

### Pitfall 1: Collapsing merged upstream PRs into the old draft baseline

**What goes wrong:** Existing constants retain a former draft head while the merged authority contains subsequent semantic text. [VERIFIED: GitHub REST API]

**How to avoid:** Fetch/query PR state and head at execution time, produce a narrow diff, then state whether code is conformant, needs a repair, or is an explicit spec gap. [CITED: https://docs.github.com/en/rest/pulls/pulls]

**Warning sign:** PR #89 has moved from recorded `4593ce9…` to merged `e0cd584…`, with only `naps/NAP-INC.md` changed. [VERIFIED: GitHub REST API]

### Pitfall 2: Erasing historical evidence to make a static guard green

**What goes wrong:** A broad migration scan tells developers to rewrite `.planning`, `.changeset`, CHANGELOG, or intentionally obsolete fixtures. [VERIFIED: codebase grep]

**How to avoid:** Test the inclusion and exclusion arrays themselves, scan only executable/current documentation/config surfaces, and retain dated material unchanged. [VERIFIED: codebase grep]

### Pitfall 3: Calling a technical pass a complete UX sign-off

**What goes wrong:** The Phase 105 verifier reports no code gaps while the separate UI review records unresolved recoverability, type-scale, token, and mobile concerns. [VERIFIED: codebase grep]

**How to avoid:** Link the audit from the release checklist, retain the 12/24 findings, and assign the locked non-blocking post-merge follow-up to Kehto maintainers without claiming visual sign-off or redesigning the hosts in Phase 106. [RESOLVED: locked planning decision]

### Pitfall 4: Making a release tag before target-main CI is known

**What goes wrong:** A locally green branch or a prior CI run can differ from the exact source/release-metadata target that `release.yml` will publish. [VERIFIED: codebase grep]

**How to avoid:** After Version Packages merges, identify `origin/main`’s SHA and inspect the matching CI run before tag/dispatch. [VERIFIED: codebase grep]

## Code Examples

### Focused active-conformance gate

```bash
# Source: existing Phase 105 active guard/test inventory
pnpm exec vitest run \
  tests/unit/nip5d-conformance-guard.test.ts \
  tests/unit/sdk-migration-guard.test.ts \
  tests/unit/playground-gateway-guard.test.ts \
  tests/unit/napplet-package-alignment.test.ts \
  tests/unit/published-napplet-contract.test.ts \
  packages/shell/src/napplet-namespace.test.ts \
  packages/shell/src/shell-supports-conformance.test.ts \
  tests/unit/identity-theme-conformance-guard.test.ts \
  tests/unit/nap-inc-conformance.test.ts
```

This command passed 9 files / 92 tests during research. [VERIFIED: codebase grep]

### Release-gate sequence

```bash
# Source: package scripts, CI workflow, and AGENTS.md release policy
pnpm build
pnpm type-check
pnpm test:unit
pnpm test:e2e -- tests/e2e/napplet-auth.spec.ts tests/e2e/inc-roundtrip.spec.ts \
  tests/e2e/nap-inc-playground.spec.ts tests/e2e/identity-flow.spec.ts \
  tests/e2e/theme-broadcast.spec.ts tests/e2e/playground-profile-intent.spec.ts \
  tests/e2e/profile-open.spec.ts
pnpm test:e2e
pnpm docs:check
npx --no-install aislop scan -d
git diff --check
pnpm changeset status
```

Run the named E2E subset before the full suite so failures map directly to VERIFY-03; the phase planner should retain the documented optional live-network skip as a known non-blocking result only when every mandatory assertion passes. [VERIFIED: codebase grep]

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Draft PR #89 head `4593ce9…` treated as proposed authority | Merged PR #89 head `e0cd584…` with `NAP-INC.md` semantic changes | 2026-07-24 [VERIFIED: GitHub REST API] | Phase 106 must re-audit INC semantics before final sign-off. [VERIFIED: GitHub REST API] |
| Package adoption held behind unpublished convention APIs | Published core/nap `0.29.0`, shim `0.27.0`, SDK `0.25.0`, and Vite plugin `0.12.0` are installed/pinned | 2026-07-26 [VERIFIED: npm registry] | Maintain published-artifact guards rather than a local mirror. [VERIFIED: codebase grep] |
| Numbered negotiation tolerated in active migration surfaces | Current guards use exact queryless conventions and classify historical exclusions | Phase 105 [VERIFIED: codebase grep] | Final guard must detect only active regressions. [VERIFIED: codebase grep] |

## Resolved Decisions Log

| # | Decision | Section | Execution consequence |
|---|---|---|---|
| R1 | Phase 105 UI findings are a locked non-blocking Kehto-maintainer post-merge follow-up. | Summary / Common Pitfalls | Link the audit from the release checklist; do not claim a visual pass or expand Phase 106 into redesign. |
| R2 | PR #89's merged authority is not assumed conformant. | Summary / Authority-first revalidation | Task 106-01-01 must record a semantic verdict before later evidence work can proceed. |

## Open Questions (RESOLVED)

1. **How should the Phase 105 UI audit be dispositioned?**
   - What we know: The audit reports 12/24 and actionable recoverability, typography, token, and mobile-layout warnings; Phase 105’s functional verifier found no implementation gap. [VERIFIED: codebase grep]
   - Resolution: The audit is a locked, non-blocking Kehto-maintainer post-merge follow-up linked from the Phase 106 release checklist. Phase 106 must preserve the 12/24 findings, must not claim a visual pass, and must not expand into redesign. [RESOLVED: locked planning decision]

2. **Does the merged PR #89 text require a code change?**
   - What we know: The current head differs from the recorded authority and changes only `NAP-INC.md`. [VERIFIED: GitHub REST API]
   - Resolution: Conformance is not assumed from the prior implementation or test state. Task 106-01-01 must compare the semantic delta, record a clause-level verdict, and block Task 106-01-02, Task 106-01-03, and all later evidence work until the verdict is conformant, repaired, or a bounded spec gap rather than repair-required/blocked. [RESOLVED: authority-verdict gate]

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | builds, tests, tooling | ✓ | `25.2.1` [VERIFIED: codebase grep] | CI uses Node 20/22 per workflow. [VERIFIED: codebase grep] |
| pnpm | workspace/gates | ✓ | `10.8.0` [VERIFIED: codebase grep] | — |
| npm | registry revalidation | ✓ | `11.6.2` [VERIFIED: codebase grep] | — |
| Git + GitHub CLI | exact refs, branch/PR/CI release evidence | ✓ | Git `2.50.1`; gh `2.83.2` [VERIFIED: codebase grep] | GitHub REST with authenticated curl where `gh` is unavailable. [CITED: https://docs.github.com/en/rest/pulls/pulls] |
| AI-slop scanner | required quality gate | ✓ | `0.14.0` available via local `npx --no-install` [VERIFIED: codebase grep] | None; do not download an unpinned replacement. [VERIFIED: codebase grep] |

**Missing dependencies with no fallback:** None found. [VERIFIED: codebase grep]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest `4.1.2`; Playwright `1.54.0`. [VERIFIED: codebase grep] |
| Config file | `vitest.config.ts` and `playwright.config.ts`. [VERIFIED: codebase grep] |
| Quick run command | focused nine-file Vitest command above. [VERIFIED: codebase grep] |
| Full suite command | `pnpm test:unit` and `pnpm test:e2e`. [VERIFIED: codebase grep] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| BASE-03 | Active versus historical classification preserves archives while banning live legacy surfaces. [VERIFIED: codebase grep] | unit/static | `pnpm exec vitest run tests/unit/sdk-migration-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts` | ✅ |
| VERIFY-01 | Published contracts, shell, INC, identity/theme, and host flow negative cases remain covered. [VERIFIED: codebase grep] | unit/integration | focused nine-file Vitest command | ✅ |
| VERIFY-02 | Bounded active code/package/host checks reject stale vocabulary and graph drift. [VERIFIED: codebase grep] | unit/static | `pnpm exec vitest run tests/unit/sdk-migration-guard.test.ts tests/unit/playground-gateway-guard.test.ts` | ✅ |
| VERIFY-03 | Real shell gating, exact INC, profile intent, identity/resource, and theme paths. [VERIFIED: codebase grep] | E2E | named Playwright subset, then `pnpm test:e2e` | ✅ |
| VERIFY-04 | Whole monorepo regression health. [VERIFIED: codebase grep] | build/type/unit/E2E/docs/quality | release-gate sequence above | ✅ |
| VERIFY-05 | Changed package releases are correctly declared. [VERIFIED: codebase grep] | release metadata | `pnpm changeset status` and exact-main CI inspection | ✅ |
| VERIFY-06 | Draft/package/registry line matches current authority and installed outputs. [VERIFIED: codebase grep] | external integration/manual review | `gh api …pulls/{89,90,91,92}`, `npm view`, JSR metadata check, focused published-contract guards | ❌ Wave 0 evidence script |

### Wave 0 Gaps

- [ ] Add a small, reviewable Phase-106 authority-revalidation script or test artifact that records PR state/head/merge values, the `4593ce9… → e0cd584…` #89 semantic diff verdict, npm/JSR versions, and lockfile/test alignment. [VERIFIED: GitHub REST API]
- [ ] Add a release-checklist artifact that captures exact commands, exit status, mandatory E2E results, allowed skips, `origin/main` SHA, CI run URL/status, changeset status, and UI-audit disposition. [ASSUMED]

### Sampling Rate

- **Per task commit:** focused guard command plus `git diff --check`. [VERIFIED: codebase grep]
- **Per wave merge:** `pnpm test:unit` plus the relevant Playwright subset. [VERIFIED: codebase grep]
- **Phase gate:** every VERIFY-04 command green and exact-main CI confirmed before release tag/dispatch. [VERIFIED: codebase grep]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | Yes | Preserve authenticated source binding and pre-session rejection through shell/Paja/playground regressions. [VERIFIED: codebase grep] |
| V3 Session Management | Yes | One bare `shell.ready`, one init, duplicate-ready idempotency, and per-frame isolation guards. [VERIFIED: codebase grep] |
| V4 Access Control | Yes | Continue ACL/capability, explicit target authorization, and exact routing tests. [VERIFIED: codebase grep] |
| V5 Input Validation | Yes | Exact queryless convention matching; malformed/obsolete metadata and wire shapes fail closed. [VERIFIED: codebase grep] |
| V6 Cryptography | Indirect | Verify the published source and signed-artifact/runtime boundary; do not introduce custom cryptography. [VERIFIED: codebase grep] |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Stale PR head silently changes contract semantics | Tampering | Fetch head/state and semantic diff before accepting existing assertions. [VERIFIED: GitHub REST API] |
| Forged sibling-frame shell readiness/theme event | Spoofing | Parent-source trust and real-browser shell/theme tests. [VERIFIED: codebase grep] |
| Legacy numbered route remains reachable in a live surface | Elevation of privilege | Bounded static guards plus exact route/channel E2E proof. [VERIFIED: codebase grep] |
| Package source/registry provenance diverges from lockfile | Tampering | npm/JSR metadata, installed declarations, lockfile, and package-alignment tests. [VERIFIED: codebase grep] |
| Release from unvalidated commit | Tampering | Exact `origin/main` SHA and matching CI evidence before tag/dispatch. [VERIFIED: codebase grep] |

## Sources

### Primary (HIGH confidence)

- [Repository requirements](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/.planning/REQUIREMENTS.md) - Phase requirements and release gates. [VERIFIED: codebase grep]
- [Phase 105 verification](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/.planning/phases/105-published-convention-adoption-and-host-flows/105-VERIFICATION.md) - completed dependency evidence and E2E result. [VERIFIED: codebase grep]
- [Active migration guard](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/tests/unit/sdk-migration-guard.test.ts) and [published contract guard](/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/tests/unit/published-napplet-contract.test.ts) - bounded active surface, package versions, and current drift assertions. [VERIFIED: codebase grep]
- [GitHub PR API](https://docs.github.com/en/rest/pulls/pulls) - current PR head/state/merge observations. [CITED: https://docs.github.com/en/rest/pulls/pulls]

### Secondary (MEDIUM confidence)

- [Changesets action](https://github.com/changesets/action) - Version Packages behavior. [CITED: https://github.com/changesets/action]
- [npm view documentation](https://docs.npmjs.com/cli/v7/commands/npm-view/) - registry metadata query behavior. [CITED: https://docs.npmjs.com/cli/v7/commands/npm-view/]

### Tertiary (LOW confidence)

- None. [VERIFIED: codebase grep]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — derived from declared scripts, installed tooling, CI workflows, and registry checks. [VERIFIED: codebase grep]
- Architecture: HIGH — active guards enumerate source ownership and Phase 105 verified the real data paths. [VERIFIED: codebase grep]
- Pitfalls: HIGH except the UI-release disposition, which is LOW because it requires product authority. [VERIFIED: codebase grep]

**Research date:** 2026-07-27  
**Valid until:** Upstream PR/package authority portions expire at the next execution; re-query them immediately before merge readiness. [VERIFIED: GitHub REST API]

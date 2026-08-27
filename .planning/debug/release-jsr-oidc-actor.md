---
status: resolved
trigger: "Release workflow run 33105559535 failed again; CD should release reliably without manual recovery."
created: 2026-08-27
updated: 2026-08-27
---

# Release JSR OIDC actor mismatch

## Symptoms

expected: A successful main CI run for a merged Version Packages commit should
  publish the exact commit to npm and JSR without operator intervention.
actual: npm publishing succeeds, then the first JSR package fails authorization.
error: `actorNotScopeMember`: the authenticated actor is not authorized as an
  `@kehto` scope member.
timeline: Automated releases have repeated this failure since the release
  handoff began dispatching `release.yml` with a workflow token. Manual recovery
  dispatches succeed.
reproduction: Merge the Version Packages PR, let main CI complete, and allow
  `publish.yml` to dispatch `release.yml` through `GITHUB_TOKEN`.

## Current Focus

hypothesis: The nested workflow dispatch changes the Release run actor from the
  human who merged the Version Packages PR to `github-actions[bot]`; JSR binds
  OIDC authorization to that actor and rejects it as a non-member of `@kehto`.
test: Compare actor and outcome for automated and manual Release runs, including
  two runs against the same commit.
expecting: Automated `github-actions[bot]` runs fail with
  `actorNotScopeMember`; manual `dskvr` runs succeed.
next_action: Ship the direct-CI-trigger workflow change and verify its next
  Version Packages release runs with the preserved human actor.

## Evidence

- timestamp: 2026-08-27T19:00:00Z
  observation: Run 33105559535 built successfully and published npm, then JSR
    rejected `@kehto/acl@0.19.0` with `actorNotScopeMember`.
- timestamp: 2026-08-27T19:00:00Z
  observation: Automated failures 33105559535, 32971065565, 32580980654,
    32577025556, 32573551700, 32396440133, and 31317913102 all have actor
    `github-actions[bot]` and the same JSR error.
- timestamp: 2026-08-27T19:00:00Z
  observation: Manual successes 32578386649, 32576815383, and 32384983782 have
    actor `dskvr`. Commit 456d8a4 failed automatically in 32577025556 and then
    succeeded manually in 32578386649.
- timestamp: 2026-08-27T19:00:00Z
  observation: The successful `publish.yml` workflow-run jobs preserve actor
    `dskvr`, but their `gh workflow run release.yml` handoff creates a new run
    whose actor is `github-actions[bot]`.
- timestamp: 2026-08-27T19:04:00Z
  observation: Manual recovery run 33106428997 ran as actor `dskvr`, skipped
    npm, and successfully published all missing JSR versions. Direct registry
    metadata reports `@kehto/paja@0.16.0` and `@kehto/services@0.21.0` on both
    npm and JSR.

## Eliminated

- hypothesis: npm OIDC or the package build is failing.
  reason: Both steps completed successfully before JSR.
- hypothesis: Package order or transient JSR availability is the primary cause.
  reason: The error is deterministic by workflow actor and occurs before the
    first package can publish.

## Resolution

root_cause: `publish.yml` used its workflow token to dispatch `release.yml`.
  That nested dispatch replaced the human main-CI actor with
  `github-actions[bot]`; JSR bound the OIDC request to that actor and rejected
  it because the bot is not an `@kehto` scope member. npm published first,
  leaving every automated release partially complete.
fix: Let `release.yml` observe successful main CI directly, admit only a merged
  Version Packages commit, and publish that exact SHA. Remove the nested
  dispatch from `publish.yml`. Keep tag/manual recovery triggers and exact-main
  ancestry verification.
verification: Recovery run 33106428997 succeeded; npm/JSR metadata matches;
  actionlint passed; `pnpm build`, `pnpm type-check`, `pnpm test:unit` (145
  files, 1706 tests), `pnpm docs:check`, and AI-slop 100/100 passed.
files_changed: `.github/workflows/publish.yml`,
  `.github/workflows/release.yml`, `tests/unit/ci-release-gate.test.ts`, and
  `AGENTS.md`.

---
status: resolved
trigger: "Resolve failed Release workflow run 30595067663"
created: 2026-07-31
updated: 2026-08-20
---

# JSR release scope authorization

## Symptoms

- Release workflow run `30595067663` failed while publishing `@kehto/acl@0.17.0` to JSR.
- Build, tests, npm publishing, and JSR version synchronization completed successfully.
- JSR returned `actorNotScopeMember` for the authenticated GitHub Actions actor.

## Hypotheses

1. The `@kehto` JSR scope or its packages are not associated with `kehto/web` for OIDC publishing.
2. The release workflow's OIDC permissions or JSR invocation do not match JSR's current requirements.
3. Registry-side scope membership changed and cannot be repaired by a repository change.

## Current focus

Inspect public JSR metadata, historical releases, and repository workflow configuration to distinguish a repository configuration error from required JSR-side authorization.

## Evidence

- Failed run `30595067663` was triggered as `github-actions[bot]` and JSR rejected
  `@kehto/acl@0.17.0` with `actorNotScopeMember`.
- Manual recovery run `30595607858`, triggered by the scope member `dskvr` against
  the exact same commit `d42b3c3da7e0ad3cea233b34458997b09b11960d`, published the
  JSR package graph successfully. This excludes package source, build output, workflow
  permissions, and the release commit as the cause of the original failure.
- The later automated Version Packages handoff `31317913102` reproduced the same
  actor-membership failure on `f031d5d2264d047cd40e2524bf12b7f68c74caa6`, while CI
  run `31317631604` for that exact SHA was green.
- Authorized recovery run `32384983782` used the workflow's documented
  `skip_npm=true` path for that validated SHA and completed successfully.
- Public JSR metadata now reports `@kehto/acl@0.18.0`, `@kehto/cli@0.4.2`,
  `@kehto/paja@0.12.0`, `@kehto/runtime@0.22.0`, `@kehto/services@0.20.0`, and
  `@kehto/shell@0.20.0` as current.

## Resolution

- root_cause: "JSR authorization depended on the workflow-triggering actor. Automated handoff runs authenticated as `github-actions[bot]`, which was not authorized as an `@kehto` scope member; a manual dispatch by `dskvr` was authorized. The identical-SHA comparison proves this was registry-side actor/package-link authorization, not a repository build or OIDC-permission defect."
- fix: "Recovered the validated Version Packages SHA through the release workflow's JSR-only manual dispatch as the authorized scope member. npm was explicitly skipped, and all missing JSR versions were published in topological order."
- verification: "GitHub Actions release run `32384983782` succeeded; the JSR publish step passed; official `https://jsr.io/@kehto/<package>/meta.json` metadata reports all six intended versions as latest. Automated handoffs still depend on every JSR package being linked to `kehto/web`, as documented in AGENTS.md."

---
status: resolved
trigger: https://github.com/kehto/web/issues/194
created: 2026-07-12
updated: 2026-07-12
---

# Publish @kehto/services 0.16.5

## Root cause

The Version Packages PR merged package metadata for 0.16.5, but no release tag or manual `release.yml` dispatch followed. Its exact merge SHA had green CI but red Pages because the CLI, Paja, and Services package documentation rows were not updated.

PR #173 then merged an outbox regression test and patch changeset after the version commit. Its original relay-plan fix was not translated to the stream-first query path introduced on `main`, leaving current CI red and the still-unpublished 0.16.5 release incomplete.

## Specification check

NAP-OUTBOX draft PR napplet/naps#32 was checked at `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e` against `origin/master` `5fd99465892fbead3888d7146e1737f77b0ed0b4`. Read-side `options.relays` are hints or policy override candidates, fallback remains shell-owned, and all candidates remain subject to shell validation. The Kehto behavior is conformant; fallback-plus-hint union is a stronger local policy established by issue #168 and PR #173.

## Resolution

- Restore fallback-plus-hint routing only for authorless outbox queries.
- Synchronize package documentation rows with current manifest versions.
- Fold the already-merged #173 behavior into the unpublished 0.16.5 changelog and consume its pending changeset, avoiding a duplicate future 0.16.6 metadata-only release.
- Admit that narrow recovery in the changeset deletion guard only for explicit `fix(release):` PRs that update both package docs and a package changelog.
- Refresh the Pages gateway audit to enforce the current NAP-SHELL lifecycle: creation-time computed identity is registered before render and bound only after bare `shell.ready` establishes the session.

## Verification target

Build, type-check, full unit tests, docs audit, AI-slop 100/100, green GitHub CI and Pages on the exact merged SHA, successful `release.yml`, and live npm/JSR resolution of `@kehto/services@0.16.5`.

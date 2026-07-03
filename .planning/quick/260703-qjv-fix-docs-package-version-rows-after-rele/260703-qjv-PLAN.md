# Quick Plan: Fix docs package version rows after release version bump

## Status

complete

## Context

`main` failed CI and Pages after PR #138 merged because `pnpm docs:check`
audited package pages against package versions from the merged release PR.

## Scope

- Update docs package `Version` rows for the packages bumped by the release PR.
- Verify `pnpm docs:check` and lightweight diff hygiene.

## Out of Scope

- Workflow changes.
- Package source changes.

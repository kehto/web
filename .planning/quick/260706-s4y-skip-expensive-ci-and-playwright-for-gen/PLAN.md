---
status: complete
created: 2026-07-06
---

# Skip Expensive CI for Generated Version Packages Changes

Task: avoid rerunning full build/unit/Playwright for generated Version Packages metadata while preserving the release docs and JSR metadata checks that have caught real release failures.

## Plan

1. Confirm the duplicate workflow path from the live PR/run history.
2. Add a CI change classifier that recognizes generated Version Packages metadata only in release-intent contexts.
3. Keep `Build & Type-Check` as the required check surface, but run only docs and JSR metadata validation for release-only changes.
4. Skip Vitest and Playwright for release-only changes.
5. Add focused unit tests and update AGENTS release guidance.

## Acceptance

- The exact PR #156 file set classifies as release-only only when the PR/head/commit is a Version Packages context.
- The same file set does not select Playwright.
- Source file changes still force normal CI and Playwright selection.
- Local unit, type-check, docs, and diff hygiene gates pass.

---
status: complete
completed: 2026-07-06
commit: fix/version-packages-ci-gating
---

# Summary

Reduced generated release metadata CI work without removing the release guard:

- Added `scripts/classify-ci-changes.mjs` to identify Version Packages-only diffs in trusted release contexts.
- Updated CI so `Build & Type-Check` remains the required check but runs only `pnpm docs:check` plus JSR metadata sync validation for generated release metadata.
- Skipped `Vitest`, `Detect Playwright Scope`, and `Playwright` for release-only changes.
- Updated the Playwright selector so package version metadata does not select browser tests.
- Updated AGENTS release policy to distinguish source validation from generated release metadata validation.

## Verification

- `PR_TITLE='Version Packages' PR_HEAD_REF='changeset-release/main' node scripts/classify-ci-changes.mjs --base 36d673004d26ad6d2aa988c6a535be013414dec7 --head 1f5b9568c8bff539536ee22953524563c7f9fd47 --json`
- `COMMIT_TITLE='Merge pull request #156 from kehto/changeset-release/main' node scripts/classify-ci-changes.mjs --base 36d673004d26ad6d2aa988c6a535be013414dec7 --head 1f5b9568c8bff539536ee22953524563c7f9fd47 --json`
- `node scripts/select-e2e-tests.mjs --files docs/packages/shell.md packages/paja/jsr.json packages/shell/CHANGELOG.md packages/shell/jsr.json packages/shell/package.json --json`
- `pnpm exec vitest run tests/unit/classify-ci-changes.test.ts tests/unit/select-e2e-tests.test.ts`
- `pnpm docs:check`
- `pnpm test:unit`
- `pnpm type-check`
- `git diff --check`

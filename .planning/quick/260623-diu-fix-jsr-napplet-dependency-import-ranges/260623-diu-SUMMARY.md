---
quick_id: 260623-diu
slug: fix-jsr-napplet-dependency-import-ranges
status: complete
---

# Summary

Updated public package `jsr.json` import maps so `@napplet/core` and
`@napplet/nap` resolve to the current `^0.20.0` release line instead of the
stale `^0.12.0` range.

## Context

The v1.35 release workflow passed build, type-check, unit, and e2e validation,
then failed during publishing. The JSR step failed while publishing
`@kehto/services@0.12.0` because the stale `@napplet/nap@^0.12.0` range does
not export `./serial/types`.

## Verification

- `rg 'jsr:@napplet/(core|nap)@\^0\.12\.0' packages/*/jsr.json`
- `git diff --check`
- `pnpm build`
- `pnpm type-check`
- `pnpm docs:check`

## Remaining Risk

The npm publish failure for `@kehto/cli@0.2.1` and `@kehto/paja@0.3.0` is a
registry Trusted Publisher/permission issue and is intentionally outside this
metadata patch.

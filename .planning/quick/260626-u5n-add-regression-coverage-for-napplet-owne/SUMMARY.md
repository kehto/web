# Quick Task 260626-u5n Summary

Status: complete

## Result

Added regression coverage proving authored napplet `window.napplet` assignments are filtered through the host-injected NIP-5D domain allowlist.

## Behavior Proven

- Allowed domain implementations supplied by the napplet survive assignment.
- Pre-existing allowed domain implementations survive prelude installation.
- Unexposed domains supplied by the napplet are stripped.
- The transition-only legacy `shell` object remains available when supplied by the current shim.
- No private diagnostic properties are exposed on `window.napplet`.

## Verification

- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` passed, 5 tests.
- `git diff --check` passed.

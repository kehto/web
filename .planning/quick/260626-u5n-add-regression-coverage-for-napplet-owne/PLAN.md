# Quick Task 260626-u5n

## Goal

Add regression coverage for napplet-owned `window.napplet` assignment against the injected NIP-5D domain allowlist.

## Plan

1. Execute the generated namespace prelude in a test-local window object.
2. Simulate authored napplet code assigning its own `window.napplet` object with both allowed and unexposed domains.
3. Verify allowed domain implementations survive, unexposed domains are stripped, and no private diagnostic properties are exposed.

## Verification

- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts`
- `pnpm dlx aislop@0.9.3 scan --staged`
- `git diff --check`

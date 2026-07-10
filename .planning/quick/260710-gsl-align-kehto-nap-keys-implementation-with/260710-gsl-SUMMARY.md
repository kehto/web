---
status: complete
completed: 2026-07-10
branch: fix/keys-bindings-issue-169
commit: 5f03089
---

# Quick Task 260710-gsl Summary

Aligned Kehto's NAP-KEYS behavior with the active `napplet/naps` PR #9 draft
(`nub-keys`, `cecb642`): `keys.forward` is napplet-to-shell only, while active
bound action keys are handled locally from `keys.bindings` before forwarding.

## Changes

- Removed service-side `keys.forward` to `keys.action` dispatch in both the
  document-listener and `HostKeysBridge` paths.
- Removed the non-conforming shell-side host keydown forwarder source, test,
  export, and automatic `createShellBridge` installation.
- Added canonical binding normalization, reserved-key unbound results, and
  `keys.registerAction.result` error envelopes.
- Made runtime `keys.forward` silently ignore unmapped window identities and
  avoid returning fake fallback bindings when no keys service owns bindings.
- Updated unit coverage, package docs, and the changeset for runtime/services/shell.

## Verification

- `pnpm type-check` — includes full `pnpm build`
- `pnpm test:unit` — 101 files, 1301 tests
- `pnpm docs:check`
- `npx aislop@0.12.0 scan --changes --base origin/main` — clean 100/100
- `git diff --check`

## Notes

The target NAP-KEYS text is not on `napplet/naps` master yet; it is the open
draft in PR #9. The implementation intentionally follows that draft because PR
#174 was already based on NAP-KEYS work.

---
status: complete
---

# Summary

## Result

Playground UI session state now survives reloads for the requested controls. Height and debugger persistence remain intact; color mode, ACL panel expansion, ACL capability/block state, and service enable/disable state are now restored from browser storage.

## Changed

- Added color-mode persistence under `kehto.playground.colorMode`.
- Added ACL expansion persistence under `kehto.playground.aclExpansion.v1`.
- Hydrated ACL buttons/block state from runtime ACL state instead of rendering every control as enabled.
- Persisted ACL grant/revoke/block/unblock mutations through the existing `napplet:acl` runtime persistence backend.
- Fixed the runtime ACL wrapper so the first permissive revoke/block seeds all runtime-known capability bits, not just the older low-bit ACL range.
- Persisted disabled services under `kehto.playground.disabledServices.v1` and restored topology node state on boot.
- Preserved existing NAP-IDENTITY feed/signer behavior already in the working tree.

## Verification

- `pnpm vitest run packages/runtime/src/acl-state.test.ts tests/unit/playground-gateway-guard.test.ts` - 2 files, 11 tests passed.
- `pnpm type-check` - 11 successful Turbo tasks.
- `pnpm test:e2e -- playground-usability-controls.spec.ts demo-service-toggle.spec.ts relay-subscribe.spec.ts signer-persistence.spec.ts` - 10 Chromium tests passed.

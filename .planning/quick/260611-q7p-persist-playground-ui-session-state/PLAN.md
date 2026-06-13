# Quick Task: Persist Playground UI Session State

## Goal

Persist user-controlled playground UI state across reloads/sessions: color mode, napplet height, debugger visibility, per-napplet ACL expansion, ACL grant/revoke/block state, and service enable/disable state.

## Current Findings

- Napplet height already persists through `kehto.playground.nappletHeightPx`.
- Debugger visibility already persists through `kehto.playground.debuggerHidden`.
- Color mode is currently in-memory only.
- ACL panel expansion is currently in-memory only.
- Runtime ACL has a `napplet:acl` localStorage backend, but playground UI mutations do not call `aclState.persist()`.
- ACL UI defaults every capability button to enabled instead of hydrating from the runtime ACL snapshot.
- NIP-5D napplets use `pubkey: ""`, so ACL checks must use `identityBound` plus `(dTag, aggregateHash)`, not truthiness of `pubkey`.
- Service enable/disable toggles are currently in-memory only.

## Acceptance

- Color mode selection survives reload.
- Existing height and debugger persistence remains intact.
- ACL panel expansion/collapse survives reload, including per-panel and expand-all state.
- ACL capability revokes/grants and whole-napplet block state survive reload.
- Service enable/disable state survives reload and the topology node reflects restored state.
- NAP-IDENTITY/feed changes already in the working tree remain intact.

## Verification

- `pnpm vitest run packages/runtime/src/acl-state.test.ts tests/unit/playground-gateway-guard.test.ts`
- `pnpm type-check`
- `pnpm test:e2e -- playground-usability-controls.spec.ts demo-service-toggle.spec.ts relay-subscribe.spec.ts signer-persistence.spec.ts`
- `git diff --check`

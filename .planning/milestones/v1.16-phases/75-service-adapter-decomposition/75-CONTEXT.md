# Phase 75: Service and Adapter Decomposition - Context

**Gathered:** 2026-05-24
**Status:** Ready for execution planning

<domain>
## Phase Boundary

Remove the remaining six `complexity/function-too-long` warnings from the local `aislop` gate without changing NIP-5D behavior, playground UI behavior, service descriptors, or public package contracts.

</domain>

<scanner_baseline>
## Current Scanner Findings

`npx --no-install aislop scan -d` after Phase 74 reports `86 / 100 Healthy`, 0 errors, 6 warnings, and 0 fixable findings.

Remaining warnings:

- `apps/playground/src/acl-modal.ts:38` `openPolicyModal` - 252 lines
- `apps/playground/src/nip46-client.ts:92` `createNip46Client` - 279 lines
- `packages/services/src/media-service.ts:431` `createMediaService` - 200 lines
- `packages/services/src/notification-service.ts:51` `createNotificationService` - 225 lines
- `packages/services/src/resource-service.ts:168` `createResourceService` - 189 lines
- `packages/shell/src/hooks-adapter.ts:83` `adaptHooks` - 274 lines

</scanner_baseline>

<code_context>
## Existing Coverage

- `tests/e2e/shell-ui-state-surfaces.spec.ts` opens the ACL policy modal and verifies it renders one row per identity-bound napplet.
- `tests/unit/nip46-client.test.ts` covers NIP-46 URI parsing, nostrconnect URI generation, client shape, signer shape, close behavior, and connection failure state.
- `packages/services/src/media-service.test.ts` covers media session create/update/destroy/state/capabilities, unknown action, host bridge behavior, media session integration, action forwarding, and teardown.
- `packages/services/src/notification-service.test.ts` covers legacy `notifications:*` IFC lifecycle, `onChange`, per-window list isolation, max-per-window eviction, and window teardown.
- `packages/services/src/resource-service.test.ts` covers construction guard, denied/granted fetch, invalid URL, cancellation, network error, and window teardown.
- `packages/shell/src/shell-bridge.test.ts` constructs a bridge through `adaptHooks`, covering adapter construction against the browser singleton dependencies.

## Extraction Strategy

- Keep factory functions as orchestration shells.
- Move DOM/table builders, message case handlers, and adapter builders into private helpers in the same source files.
- Prefer deletion of dead helper code before adding new layers.
- Keep imports, descriptors, envelope types, callback order, and side effects stable.

</code_context>

<deferred>
## Deferred

- Phase 76 owns final all-repo verification: `pnpm build`, `pnpm test:unit`, docs build, final zero-warning scanner, and milestone closeout.
- Broader architecture cleanup beyond the six scanner findings remains out of scope.

</deferred>


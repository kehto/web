---
phase: quick
plan: 260617-qoi
subsystem: runtime,shell,services,playground,tests,docs
tags: [cleanup, breaking-change, nap-class, nap-connect, removal]
dependency-graph:
  requires: []
  provides: [clean-nap-class-nap-connect-removal]
  affects: [packages/runtime, packages/shell, packages/services, apps/playground, tests/e2e, tests/unit, specs, docs]
tech-stack:
  added: []
  patterns: [static-allowlist for resource-demo origins]
key-files:
  created: [.changeset/drop-nap-class-nap-connect.md]
  modified:
    - packages/runtime/src/types.ts
    - packages/runtime/src/enforce.ts
    - packages/runtime/src/index.ts
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/test-utils.ts
    - packages/runtime/src/types.test.ts
    - packages/runtime/src/intent-dispatch.test.ts
    - packages/runtime/src/outbox-dispatch.test.ts
    - packages/runtime/src/upload-dispatch.test.ts
    - packages/shell/src/shell-init.ts
    - packages/shell/src/shell-ready.ts
    - packages/shell/src/shell-bridge.ts
    - packages/shell/src/types.ts
    - packages/shell/src/index.ts
    - packages/shell/src/shell-init.test.ts
    - packages/shell/src/shell-bridge.test.ts
    - packages/shell/src/shell-supports-conformance.test.ts
    - packages/shell/tests/no-window-nostr.test.ts
    - packages/shell/tests/perm-namespace.test.ts
    - packages/services/src/resource-service.ts
    - apps/playground/src/demo-definitions.ts
    - apps/playground/src/demo-hooks.ts
    - apps/playground/src/shell-host.ts
    - apps/playground/src/main.ts
    - apps/playground/vite.config.ts
    - apps/playground/napplets/resource-demo/src/main.ts
    - apps/playground/napplets/resource-demo/vite.config.ts
    - tests/unit/nip5d-conformance-guard.test.ts
    - tests/unit/playground-gateway-guard.test.ts
    - tests/e2e/gateway-artifact-parity.spec.ts
    - specs/NAP-SHELL.md
    - specs/NAP-INTENT.md
    - specs/NIP-5D.md
    - RUNTIME-SPEC.md
    - docs/.vitepress/config.ts
    - docs/packages/shell.md
    - docs/policies/index.md
    - docs/policies/SHELL-RESOURCE-POLICY.md
  deleted:
    - packages/shell/src/types/internal-class.ts
    - packages/shell/src/types/internal-connect.ts
    - packages/shell/src/connect-store.ts
    - tests/e2e/class-invariant.spec.ts
    - tests/e2e/connect-consent.spec.ts
    - tests/e2e/connect-csp-preview.spec.ts
    - tests/e2e/connect-revocation.spec.ts
    - docs/policies/SHELL-CLASS-POLICY.md
    - docs/policies/SHELL-CONNECT-POLICY.md
decisions:
  - "Task 4 static-allowlist: resource-demo origins sourced from STATIC_ORIGIN_ALLOWLIST constant map in shell-host.ts and STATIC_CONNECT_GRANTS in demo-hooks.ts"
  - "getConnectGrants option on ResourceServiceOptions retained as the host-supplied grant interface (renamed context, not renamed API)"
  - "ConsentRequest/ConsentHandler/firewall-policy variant kept (not NAP-CONNECT)"
  - "consent-modal.ts left intact (uses local ConnectConsentRequest type, wired to firewall consent system)"
  - "@kehto/services: docstring-only change, no changeset added"
  - "pregrantBeforeRender replaced with no-op since static-allowlist handles origin grants at load time"
metrics:
  duration: "~3 hours"
  completed: "2026-06-17"
  tasks: 8
  files: 48
---

# Quick Task 260617-qoi: Drop NAP-CLASS, NAP-CLASS-1, NAP-CONNECT (Clean Break)

**One-liner:** Clean-break removal of NAP-CLASS, NAP-CLASS-1, and NAP-CONNECT from the kehto monorepo with static-allowlist replacement for resource-demo origin grants.

## What Was Done

Executed a complete removal of the three deprecated NAPs from all packages, the playground app, tests, and documentation. No backwards-compat shims, no deprecation aliases.

### Task 1: @kehto/runtime — NAP-CLASS removal

- Deleted `NappletClass` type from `types.ts`
- Deleted `SessionEntry.class` field
- Deleted `CLASS_CAPABILITY_ALLOWLIST` from `enforce.ts`
- Removed class pre-filter block from `enforceNub`
- `EnforceResult.reason` narrowed to `'allowed' | 'capability-missing'`
- Removed `class-forbidden` from `AclCheckEvent.reason`
- Removed `NappletClass` from `index.ts` exports
- Updated `runtime.ts` `resolveIdentityByWindowId` to drop `class` field
- Cleaned `test-utils.ts`, `types.test.ts`, `intent-dispatch.test.ts`, `outbox-dispatch.test.ts`, `upload-dispatch.test.ts`
- Commit: `d45c62d`

### Task 2: @kehto/shell — NAP-CLASS + NAP-CONNECT removal

- Deleted `internal-class.ts`, `internal-connect.ts`, `connect-store.ts`
- Removed `'connect'`, `'class'` from `LEGACY_NUB_DOMAINS` and `NAP_DOMAINS` in `shell-init.ts`
- Removed `class` from `SessionEntry` creation in `shell-ready.ts`
- Deleted `classToWireCode` function, removed `class` wire field from `postShellInit`
- Removed `connectStore` getter from `ShellBridge`
- Updated `types.ts` `onNip5dIframeCreate` return to drop `class` field
- Removed all deleted exports from `index.ts`
- Removed `class-forbidden` from `ResourceErrorCode`
- Cleaned all shell tests
- Commit: `dbd8252`

### Task 3: @kehto/services — JSDoc cleanup

- Updated `getConnectGrants` JSDoc `@example` blocks to remove `connectStore.getOrigins(...)` reference
- Updated field-level JSDoc to "host-supplied grant source" language
- No API or behavior change; no changeset added
- Commit: `507cc00`

### Task 4+5: Playground — static-allowlist + connect/class removal

- **Task 4 resolved as static-allowlist**: `STATIC_ORIGIN_ALLOWLIST` map in `shell-host.ts` and `STATIC_CONNECT_GRANTS` in `demo-hooks.ts` replace `connectStore` for resource-demo
- Removed `CLASS_BY_DTAG`, `NappletClass` from `demo-definitions.ts`
- Removed `connectStore` from `shell-host.ts` imports; replaced `connectStore.getOrigins()` with static map
- Removed `connectStore` from `demo-hooks.ts`; `getConnectGrants` now reads `STATIC_CONNECT_GRANTS`
- Deleted `syncGrantsToVite`, `grantConnectOrigin`, `__grantConnectOrigin__`, `__revokeConnect__`, `shell:connect-revoked` listener, `__setNappletClass__` hook from `main.ts`
- Deleted entire `serveNappletCsp` Vite plugin and all CSP/connect-grant-sync machinery from `vite.config.ts`
- Commit: `d37614c`

### Task 6: Tests sweep

- Deleted 4 e2e specs: `class-invariant`, `connect-consent`, `connect-csp-preview`, `connect-revocation`
- Updated `shell-supports-conformance.test.ts`: removed `class: null` from `shell.init` messages
- Updated `no-window-nostr.test.ts`: removed `'connect'/'class'` from expected nubs set
- Updated `nip5d-conformance-guard.test.ts`: resource-demo requires `['resource', 'theme']` (Addendum D)
- Updated `gateway-artifact-parity.spec.ts`: resource-demo requires updated; comment updated
- Updated `resource-demo/src/main.ts` and `vite.config.ts`: removed `'connect'` from requires
- Updated `playground-gateway-guard.test.ts`: requires updated; dropped deleted `isStaticPagesDemo` guard assertion
- Commit: `9f1a45c`

### Task 7: Docs + specs sweep

- Deleted `docs/policies/SHELL-CLASS-POLICY.md` and `SHELL-CONNECT-POLICY.md`
- Removed sidebar entries and index entries for deleted policy docs
- Updated `docs/packages/shell.md` module table
- Updated `docs/policies/SHELL-RESOURCE-POLICY.md` cross-references
- Replaced 3 spec files with living-doc reference stubs (Addendum B)
- Updated `RUNTIME-SPEC.md`: removed class wire prose; redirected spec pointers to living docs (Addendum C)
- Updated `no-window-nostr.test.ts` and `perm-namespace.test.ts`: replaced `specs/NIP-5D.md lines NN` citations with living doc URL
- Commit: `8ef6609`

### Task 8: Residue gate, gates, changesets

- All residue: clean (only historical CHANGELOGs, auto-generated API docs, legitimate `getConnectGrants` option references)
- Build: 24/24 tasks passed
- Type-check: 13/13 tasks passed
- Unit tests: 1058/1058 passed
- Added `.changeset/drop-nap-class-nap-connect.md` with `@kehto/runtime` + `@kehto/shell` minor bumps
- Commit: `bfc2ee3`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Required Fields] Fixed pre-existing `getShellCapabilities` missing `domains`/`protocols` fields**
- **Found during:** Task 5 (playground type-check)
- **Issue:** `getShellCapabilities()` in `demo-hooks.ts` returned `{ naps, nubs, sandbox }` but `ShellCapabilities` type requires `domains` and `protocols`
- **Fix:** Added `domains: [...shellCapabilities.domains]` and `protocols: { ...shellCapabilities.protocols }` to the return object
- **Files modified:** `apps/playground/src/demo-hooks.ts`
- **Commit:** `d37614c`

**2. [Rule 1 - Bug] Updated `playground-gateway-guard.test.ts` to remove stale `isStaticPagesDemo` guard assertion**
- **Found during:** Task 6 (unit tests)
- **Issue:** Test asserted `if (isStaticPagesDemo) return;` in `main.ts` — this guard lived inside `syncGrantsToVite` which was deleted in Task 5
- **Fix:** Removed the stale assertion; the test still verifies the static-demo-banner removal
- **Files modified:** `tests/unit/playground-gateway-guard.test.ts`
- **Commit:** `9f1a45c`

## Gate Results

| Gate | Result |
|------|--------|
| `pnpm build` | 24/24 tasks passed |
| `pnpm type-check` | 13/13 tasks passed |
| `pnpm test:unit` | 1058/1058 passed |

## Residue Grep Result

Clean — no active-code residue of `NappletClass`, `CLASS_BY_DTAG`, `CLASS_CAPABILITY_ALLOWLIST`, `class-forbidden`, `classToWireCode`, `ConnectStore`, `ConnectGrant`, `ConnectGrantKey`, `connectGrantKey`. Only historical `CHANGELOG.md` entries and auto-generated `docs/api/` files (both excluded per Addendum F).

## Changesets Added

- `.changeset/drop-nap-class-nap-connect.md` — `@kehto/runtime` minor, `@kehto/shell` minor
- `@kehto/services` excluded (docstring-only change, no shipped output change)

## E2E Specs Deleted

- `tests/e2e/class-invariant.spec.ts`
- `tests/e2e/connect-consent.spec.ts`
- `tests/e2e/connect-csp-preview.spec.ts`
- `tests/e2e/connect-revocation.spec.ts`

## E2E Specs Edited

- `tests/e2e/gateway-artifact-parity.spec.ts` — resource-demo requires updated

## Self-Check: PASSED

All commits exist and are verified. All modified files are present on disk.

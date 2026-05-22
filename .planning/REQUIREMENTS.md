# Requirements: Kehto Runtime — v1.9 Napplet SDK Migration

**Defined:** 2026-05-22
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Move the 18 demo/fixture napplet packages from `@napplet/sdk@^0.2.1` namespace-style usage to the `@napplet/sdk@0.3.0` function-export surface while preserving the v1.8 build, unit, and Playwright baselines.

**Baseline:** 18 package manifests under `apps/playground/napplets/*` and `tests/fixtures/napplets/*` still declare `@napplet/sdk: ^0.2.1`. Sixteen `main.ts` files import old SDK namespaces directly; `media-controller` and `resource-demo` carry the old SDK dependency but currently use domain helpers/raw resource wiring instead of direct SDK imports. `decrypt-demo` is intentionally excluded because it does not depend on `@napplet/sdk`.

**Published surface checked:** `@napplet/sdk@0.3.0` is published as latest and depends on `@napplet/core@0.3.0` plus `@napplet/nub@0.3.0`. The root SDK re-exports direct helpers for relay, identity, storage, ifc, keys, media, notify, and resource (`relaySubscribe`, `identityGetPublicKey`, `storageGetItem`, `ifcEmit`, `keysRegisterAction`, `mediaCreateSession`, `notifySend`, `resourceBytes`, etc.). Config helper names are collision-prone at the SDK root; use the verified `@napplet/nub/config/sdk` helper surface if root SDK does not provide collision-free direct config exports.

## v1 Requirements

### SDK package graph

- [x] **SDK-01**: All 18 SDK-bearing demo/fixture package manifests replace `@napplet/sdk: ^0.2.1` with exact `@napplet/sdk: 0.3.0`
- [x] **SDK-02**: The same 18 package manifests align companion `@napplet/shim` and `@napplet/vite-plugin` entries to `0.3.0` where those companions are declared, unless a verified incompatibility is documented in the phase summary
- [ ] **SDK-03**: The root lockfile resolves the active demo/fixture graph without `@napplet/sdk@0.2.1` or legacy split-form `@napplet/nub-*` packages pulled only by the old SDK

### Function exports

- [x] **FUNC-01**: IFC call sites migrate from the old `ipc` SDK namespace to direct `ifcEmit` / `ifcOn` helper functions, including bot, chat, and `nub-ifc`
- [x] **FUNC-02**: Storage call sites migrate from `storage.*` namespace usage to direct `storageGetItem`, `storageSetItem`, `storageRemoveItem`, or `storageKeys` helpers, including bot, chat, preferences, `nub-storage`, and `nub-theme`
- [ ] **FUNC-03**: Relay and identity call sites migrate from `relay.*` / `identity.*` namespaces to direct helpers such as `relayPublish`, `relayPublishEncrypted`, `relaySubscribe`, `identityGetPublicKey`, and `identityGetProfile`
- [ ] **FUNC-04**: Keys and notify call sites migrate to direct helpers (`keysRegisterAction`, `keysOnAction`, `notifySend`, `notifyDismiss`, etc.) wherever `@napplet/sdk@0.3.0` or its `@napplet/nub@0.3.0` helper surface covers the existing behavior
- [ ] **FUNC-05**: Config, media, and resource demo surfaces use the `0.3.0` helper surface instead of old SDK pins or raw-envelope workarounds where published helpers cover the behavior; any unavoidable raw-envelope exception is documented with a grepable reason and a follow-up boundary

### Verification

- [ ] **GUARD-01**: A static guard or test prevents reintroducing namespace imports from `@napplet/sdk` in the 18 migrated packages
- [ ] **E2E-29**: All migrated napplet packages build successfully through the existing workspace build pipeline
- [ ] **E2E-30**: The affected Layer-A/Layer-B specs and full Playwright suite preserve the v1.8 close baseline of 86 passed / 0 failed / 0 skipped, or explicitly document any intentional test count increase
- [ ] **DOCS-08**: Comments, fixture README prose, and E2E spec descriptions no longer teach the old `ipc`, `storage`, `relay`, `identity`, `keys`, `config`, or `notify` namespace style as the current SDK pattern

## Future Requirements

Deferred to a later milestone or a separate v1.9 follow-up.

### Identity topic cleanup

- **RENAME-HARD-01**: Remove the v1.8 soft-rename dual-emit branch for `'auth:identity-changed'` in `packages/shell/src/shell-bridge.ts` after external consumers have had one release to migrate

### Host bridge reference impls

- **BRIDGE-ELECTRON-01**: Electron HostKeysBridge / HostMediaBridge / HostCacheBridge reference impl
- **BRIDGE-TAURI-01**: Tauri equivalents

### CI surface

- **CI-MATRIX-01**: GitHub Actions Build + Playwright workflows expanded `ubuntu-latest` → matrix of `ubuntu-latest`, `macos-latest`, `windows-latest`

## Out of Scope

Explicitly excluded for v1.9. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Runtime protocol changes in `@kehto/{acl,runtime,shell,services}` | This milestone is a consumer migration for demo/fixture napplets, not a shell/runtime wire-protocol change. |
| Migrating `decrypt-demo` to `identityDecrypt` | `decrypt-demo` does not depend on `@napplet/sdk` today and was not part of the user's 18-package scope. It can become a separate follow-up after the SDK-bearing packages are clean. |
| Replacing kehto's internal class/connect/resource shell-side types with upstream napplet-side types | Phase 44 proved those concepts diverge; future adoption remains a distinct design migration, not part of SDK call-site cleanup. |
| Publishing or versioning `@kehto/*` packages | The changed surfaces are demo/fixture packages and planning docs; package release prep only applies if implementation touches published `@kehto/*` APIs. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SDK-01 | Phase 47 | Complete |
| SDK-02 | Phase 47 | Complete |
| FUNC-01 | Phase 47 | Complete |
| FUNC-02 | Phase 47 | Complete |
| FUNC-03 | Phase 48 | Pending |
| FUNC-04 | Phase 48 | Pending |
| FUNC-05 | Phase 48 | Pending |
| SDK-03 | Phase 49 | Pending |
| GUARD-01 | Phase 49 | Pending |
| E2E-29 | Phase 49 | Pending |
| E2E-30 | Phase 49 | Pending |
| DOCS-08 | Phase 49 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after Phase 47 verification*

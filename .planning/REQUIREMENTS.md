# Requirements: Kehto Runtime — v1.10 Compatibility Window Cleanup & Decrypt Demo Parity

**Defined:** 2026-05-22
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Close the v1.8/v1.9 cleanup window without crossing a v2 boundary: remove the stale identity-topic compatibility branch, migrate `decrypt-demo` to the `@napplet/nub@0.3.0` `identityDecrypt` helper, and retire the remaining old demo package graph while preserving the shell unit tests, package graph guardrails, and Playwright baseline.

**Baseline:** v1.9 is archived with 545 unit tests and 86 Playwright E2E tests passing. The remaining local cleanup surface is explicit: `packages/shell/src/shell-bridge.ts` still dual-emits deprecated `auth:identity-changed`, and `apps/playground/napplets/decrypt-demo` still declares `@napplet/shim` / `@napplet/vite-plugin` `^0.2.1` while manually posting `identity.decrypt` envelopes instead of using the published helper.

## v1 Requirements

### Identity topic cleanup

- [ ] **RENAME-HARD-01**: Napplets receive exactly one `identity:changed` push when host code injects the canonical identity-change topic
- [ ] **RENAME-HARD-02**: The deprecated `auth:identity-changed` topic has no special compatibility branch in `ShellBridge.injectEvent()`; if passed through the generic injection API, it emits only the supplied topic once and no longer fans out to `identity:changed`

### Decrypt demo helper parity

- [ ] **DECRYPT-DEMO-01**: `decrypt-demo` declares exact `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` `0.3.0` dependencies, with no remaining `0.2.1` demo package edge
- [ ] **DECRYPT-DEMO-02**: `decrypt-demo` imports and calls `identityDecrypt` from the `@napplet/nub@0.3.0` identity helper surface instead of constructing raw `identity.decrypt` request IDs, pending maps, and `window.parent.postMessage()` request/reply plumbing
- [ ] **DECRYPT-DEMO-03**: The existing decrypt-demo happy path and class-2 forbidden path keep their DOM sentinel contracts and user-visible success/error behavior after the helper migration

### Package graph and regression guard

- [ ] **GRAPH-01**: The active demo/fixture lockfile graph no longer resolves `@napplet/shim@0.2.1` or `@napplet/vite-plugin@0.2.1` for `decrypt-demo` or any other active demo package
- [ ] **GUARD-02**: The SDK migration guardrail covers `decrypt-demo` and fails if old `0.2.1` napplet helper packages or manual `identity.decrypt` raw-envelope plumbing are reintroduced where `identityDecrypt` covers the behavior

### Verification and release notes

- [ ] **E2E-31**: Focused shell bridge unit tests and decrypt-demo Playwright tests pass after the compatibility removal and helper migration
- [ ] **E2E-32**: Full `pnpm build`, `pnpm type-check`, `pnpm test:unit`, and `pnpm test:e2e` pass, preserving the v1.9 baseline unless an intentional test-count increase is documented
- [ ] **DOCS-09**: Source comments, generated API docs, and changeset/release-note prose no longer teach the v1.8/v1.9 compatibility branch or manual decrypt-envelope workaround as current behavior

## Future Requirements

Deferred to a later milestone.

### Host bridge reference impls

- **BRIDGE-ELECTRON-01**: Electron HostKeysBridge / HostMediaBridge / HostCacheBridge reference impl
- **BRIDGE-TAURI-01**: Tauri equivalents

### CI surface

- **CI-MATRIX-01**: GitHub Actions Build + Playwright workflows expanded `ubuntu-latest` -> matrix of `ubuntu-latest`, `macos-latest`, `windows-latest`

### Upstream helper gaps

- **NOTIFY-HELPER-01**: Revisit toaster create/list raw-envelope usage if upstream publishes create/list helpers alongside `notifySend` / `notifyDismiss`
- **RESOURCE-HELPER-01**: Revisit resource-demo helper adoption only after the Kehto service contract converges with upstream `id` / `Blob` resource semantics

## Out of Scope

Explicitly excluded for v1.10. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| v2 boundary or major-release compatibility redesign | User explicitly kept this as a v1 cleanup/continuity milestone. |
| Electron / Tauri host bridge implementations | Valuable but broader than the compatibility cleanup and not needed to retire the current local debt. |
| Multi-OS GitHub Actions matrix | Infrastructure expansion is deferred until after the active compatibility window is closed. |
| Resource-demo or toaster raw-envelope rewrites beyond current helper coverage | v1.9 documented real upstream helper/contract gaps; this milestone only removes raw decrypt plumbing where `identityDecrypt` exists. |
| Replacing kehto's internal class/connect/resource shell-side types with upstream napplet-side types | Phase 44 proved those concepts diverge; future adoption remains a distinct design migration. |
| Publishing packages to npm | This milestone may stage changesets if package behavior changes, but actual publication remains a release process outside milestone initialization. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RENAME-HARD-01 | Phase 50 | Pending |
| RENAME-HARD-02 | Phase 50 | Pending |
| DECRYPT-DEMO-01 | Phase 51 | Pending |
| DECRYPT-DEMO-02 | Phase 51 | Pending |
| DECRYPT-DEMO-03 | Phase 51 | Pending |
| GRAPH-01 | Phase 52 | Pending |
| GUARD-02 | Phase 52 | Pending |
| E2E-31 | Phase 52 | Pending |
| E2E-32 | Phase 52 | Pending |
| DOCS-09 | Phase 52 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after v1.10 roadmap creation*

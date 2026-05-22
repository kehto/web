# Requirements: Kehto Runtime - v1.12 NIP-5D Contract Conformance

**Defined:** 2026-05-22
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Establish a precise repo-local NIP-5D contract from the pinned NIP-5D source, then bring the playground shell, shared napplet runtime/shim surface, and all 13 playground napplets into conformance with that contract.

**Authoritative source:** `https://raw.githubusercontent.com/dskvr/nips/d80d7b25f9c4331acbeb40dbeb3b077caa80e885/5D.md`

**Current-state inventory:** `.planning/NIP-5D-DELTA-AUDIT.md`

**Non-authoritative drift sources:** `RUNTIME-SPEC.md` and `napplet/specs/NIP-5D.md` must be repaired, replaced, or explicitly marked non-authoritative. They must not be used as the source of truth for this milestone.

**Baseline entering v1.12:** v1.11 is archived with `@napplet/vite-plugin` single-file artifact mode, local playground gateway loading through `/napplet-gateway/<dTag>/<aggregateHash>/index.html`, 551 unit tests, `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and 87/87 Playwright E2E tests passing.

**Critical invariant:** NIP-5D identity is assigned by the shell at iframe creation from the NIP-5A `(dTag, aggregateHash)` tuple. No active NIP-5D code path may rely on NIP-42 AUTH, REGISTER, delegated IDENTITY, or NIP-01 array negotiation for protocol identity.

## v1 Requirements

### Contract authority and stale-spec repair

- [ ] **CONTRACT-01**: Repo-local NIP-5D contract content is written or updated from only the pinned NIP-5D source URL above, with the pinned commit/source recorded in the document.
- [ ] **CONTRACT-02**: The repo-local contract captures the active NIP-5D primitives: opaque-origin `sandbox="allow-scripts"`, `postMessage(..., '*')`, JSON object envelopes with `type`, `MessageEvent.source` identity binding, NIP-5A `(dTag, aggregateHash)` identity, manifest `requires`, shell-derived `supports()`, and no napplet-visible `window.nostr`.
- [ ] **CONTRACT-03**: `RUNTIME-SPEC.md` no longer describes AUTH/REGISTER/NIP-01 identity negotiation as the active NIP-5D model; it is either replaced by the current contract or clearly reframed as historical/internal drift.
- [ ] **CONTRACT-04**: `napplet/specs/NIP-5D.md` is repaired, replaced, or marked non-authoritative so extra residual content is not presented as pinned NIP-5D.
- [ ] **CONTRACT-05**: Unknown `type` behavior is documented: unrecognized NIP-5D envelope types are silently ignored, and any NUB-specific errors are allowed only where the relevant NUB contract defines them.

### Source-of-truth package wiring

- [ ] **SOURCE-01**: The playground consumes the local package sources being changed for protocol behavior (`@napplet/core`, `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` as applicable) rather than stale published `@napplet/*@0.3.0` packages.
- [ ] **SOURCE-02**: Package graph checks fail if a playground napplet resolves a protocol package from the published store when the repo-local source is the intended milestone target.

### Shell capabilities and hosted supports()

- [ ] **SUPPORTS-01**: The shell derives a capability inventory from actual shell/runtime service registration, NUB extension decisions, and sandbox permission policy.
- [ ] **SUPPORTS-02**: Hosted napplets' `window.napplet.shell.supports()` answers from shell-provided capability state, not from the shim's static package knowledge.
- [ ] **SUPPORTS-03**: `supports()` accepts bare NUB names, `nub:` names, and `perm:` names; unknown capabilities return `false`.
- [ ] **SUPPORTS-04**: The static shim fallback is limited to shell-less preview or test-only contexts and cannot be the hosted playground contract.

### Manifest requires and gateway load checks

- [ ] **REQUIRES-01**: Playground napplet build configuration accepts explicit `requires` declarations using short NUB names, never spec identifiers such as `NUB-IDENTITY`.
- [ ] **REQUIRES-02**: All 13 playground napplet source manifests declare their required NUB capabilities.
- [ ] **REQUIRES-03**: Built NIP-5A manifest artifacts include the expected `requires` tags for all 13 playground napplets.
- [ ] **REQUIRES-04**: Playground gateway metadata exposes parsed `requires` tags to the shell load path.
- [ ] **REQUIRES-05**: The playground shell rejects the napplet or displays a clear compatibility warning when manifest `requires` contains a capability the shell does not support.

### NUB extension and raw-envelope boundaries

- [ ] **EXT-01**: `connect`, `class`, `nostrdb`, `identity.decrypt`, and `relay.publishEncrypted` are each documented as an official Kehto-supported NUB extension or as out-of-scope/non-conformant for the active NIP-5D playground contract.
- [ ] **EXT-02**: `connect` and `class` are advertised by `supports()` only if this milestone classifies them as active NUB capabilities and backs them with shell behavior.
- [ ] **EXT-03**: `identity.decrypt` and `relay.publishEncrypted` are documented as NUB-mediated shell operations with cleartext/key-material boundaries, or removed from the conformance path.
- [ ] **RAW-01**: Raw demo envelopes (`demo.publishTheme`, `demo.decrypt.fixtures`, raw `notify.create`/`notify.list`, raw `resource.bytes`, and raw `theme.changed` listeners) are removed, replaced with SDK/NUB helpers, or explicitly classified as demo/test-only exceptions.
- [ ] **RAW-02**: Any remaining raw-envelope exceptions are enumerated in one allowlist and guarded so new unclassified raw envelopes fail static checks.

### Playground napplet conformance

- [ ] **NAPPLET-01**: Every playground napplet has an explicit NIP-5D/NUB capability contract in source and docs.
- [ ] **NAPPLET-02**: Every playground napplet gates optional capabilities with `window.napplet.shell.supports()` and gracefully degrades when a capability is absent.
- [ ] **NAPPLET-03**: Readiness probes that currently use identity helpers only to trigger old AUTH/authenticated state are replaced by a real NIP-5D ready/capability path.
- [ ] **NAPPLET-04**: Stale AUTH/authenticated wording is renamed where it describes NIP-5D protocol identity rather than user or signer authentication.

#### Initial playground capability matrix

The implementation phase may refine optional/required boundaries, but it must leave each row explicit.

| Napplet | Required NUBs / contract decisions |
|---------|-------------------------------------|
| `bot` | `ifc`, `storage`; decide whether notification-like IFC topic stays IFC-only or requires `notify`. |
| `chat` | `ifc`, `storage`; `relay` and notification behavior must be declared required or gated optional. |
| `composer` | `identity`, `relay`; `relay.publishEncrypted` classification required. |
| `config-demo` | `config`. |
| `decrypt-demo` | `identity`; `demo.decrypt.fixtures` classification required. |
| `feed` | `relay`. |
| `hotkey-chord` | `keys`. |
| `media-controller` | `media`. |
| `preferences` | `storage`, `theme`; raw `theme.changed` listener classification/replacement required. |
| `profile-viewer` | `identity`. |
| `resource-demo` | `resource`; `connect` dependency and raw `resource.bytes` classification required. |
| `theme-switcher` | `theme`; remove or justify identity readiness probe and `demo.publishTheme`. |
| `toaster` | `notify`; remove or justify identity readiness probe plus raw create/list envelopes. |

### Regression guards and full verification

- [ ] **GUARD-01**: Static or unit guard coverage fails if active napplet iframe sandbox policy adds `allow-same-origin` or drops required `allow-scripts`.
- [ ] **GUARD-02**: Source-validation coverage proves unknown `MessageEvent.source` senders are silently dropped.
- [ ] **GUARD-03**: Static guards fail on napplet-visible `window.nostr`, direct `localStorage`, `sessionStorage`, `IndexedDB`, direct `WebSocket`, or direct signing/encryption primitives in playground napplet source.
- [ ] **GUARD-04**: Static guards fail when any playground napplet lacks manifest `requires` coverage.
- [ ] **GUARD-05**: Unit or E2E coverage proves hosted `supports()` reflects actual shell capabilities and not only static shim knowledge.
- [ ] **GUARD-06**: Static guards fail on unclassified raw demo envelopes and pass only the documented allowlist.
- [ ] **E2E-35**: Playground E2E proves missing required NUB capabilities are rejected or surfaced as compatibility warnings at load time.
- [ ] **E2E-36**: Playground E2E proves all 13 napplets boot through the gateway path with their declared `requires` and shell-derived `supports()` behavior.
- [ ] **VERIFY-01**: Full verification passes after implementation: `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and `pnpm test:e2e`.

## Future Requirements

Deferred to a later milestone.

### Host bridge reference impls

- **BRIDGE-ELECTRON-01**: Electron HostKeysBridge / HostMediaBridge / HostCacheBridge reference impl.
- **BRIDGE-TAURI-01**: Tauri equivalents.

### CI surface

- **CI-MATRIX-01**: GitHub Actions Build + Playwright workflows expanded from `ubuntu-latest` to an OS matrix.

### Public gateway product

- **GATEWAY-PROD-01**: Public production gateway hosting and deployment pipeline. v1.12 only aligns local contract/conformance in this repo.

## Out of Scope

Explicitly excluded for v1.12. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Treating `RUNTIME-SPEC.md` or `napplet/specs/NIP-5D.md` as authoritative | User explicitly narrowed authority to the pinned raw NIP-5D spec. |
| Adding `allow-same-origin` | Forbidden by pinned NIP-5D; opaque origin is the load-bearing isolation invariant. |
| Reintroducing NIP-42 AUTH / REGISTER / IDENTITY as NIP-5D identity negotiation | Pinned NIP-5D assigns identity at iframe creation from `(dTag, aggregateHash)`. |
| Publishing packages to npm | This milestone may change package source wiring and changesets; publication remains a release process outside milestone execution. |
| Electron / Tauri host bridge implementations | Still useful, but unrelated to NIP-5D contract conformance. |
| Multi-OS GitHub Actions matrix | Infrastructure expansion remains deferred. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONTRACT-01 | Phase 56 | Pending |
| CONTRACT-02 | Phase 56 | Pending |
| CONTRACT-03 | Phase 56 | Pending |
| CONTRACT-04 | Phase 56 | Pending |
| CONTRACT-05 | Phase 56 | Pending |
| SOURCE-01 | Phase 56 | Pending |
| SOURCE-02 | Phase 56 | Pending |
| EXT-01 | Phase 56 | Pending |
| SUPPORTS-01 | Phase 57 | Pending |
| SUPPORTS-02 | Phase 57 | Pending |
| SUPPORTS-03 | Phase 57 | Pending |
| SUPPORTS-04 | Phase 57 | Pending |
| REQUIRES-01 | Phase 57 | Pending |
| REQUIRES-04 | Phase 57 | Pending |
| REQUIRES-05 | Phase 57 | Pending |
| EXT-02 | Phase 57 | Pending |
| EXT-03 | Phase 57 | Pending |
| REQUIRES-02 | Phase 58 | Pending |
| REQUIRES-03 | Phase 58 | Pending |
| RAW-01 | Phase 58 | Pending |
| RAW-02 | Phase 58 | Pending |
| NAPPLET-01 | Phase 58 | Pending |
| NAPPLET-02 | Phase 58 | Pending |
| NAPPLET-03 | Phase 58 | Pending |
| NAPPLET-04 | Phase 58 | Pending |
| GUARD-01 | Phase 59 | Pending |
| GUARD-02 | Phase 59 | Pending |
| GUARD-03 | Phase 59 | Pending |
| GUARD-04 | Phase 59 | Pending |
| GUARD-05 | Phase 59 | Pending |
| GUARD-06 | Phase 59 | Pending |
| E2E-35 | Phase 59 | Pending |
| E2E-36 | Phase 59 | Pending |
| VERIFY-01 | Phase 59 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after v1.12 milestone initialization*

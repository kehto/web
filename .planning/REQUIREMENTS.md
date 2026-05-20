# Requirements: Kehto Runtime — v1.8 Upstream Alignment & NIP-44 Decrypt

**Defined:** 2026-05-20
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Consume `@napplet/nub@^0.3.0`, retire all provisional types, ship the canonical `identity.decrypt` surface per upstream NUB-IDENTITY amendments, and clear v1.7 tech-debt carryovers.

**Upstream gate:** Items in DEP, VALIDATOR, DECRYPT, and E2E categories all require `@napplet/nub@0.3.0` to be published on npm. As of milestone start, latest is 0.2.1 — publish is blocked by Actions PR-permission setting on `napplet/napplet`. Bug/Polish/Rename/Validate items execute first.

## v1 Requirements

### Bug fixes

- [x] **BUG-01**: `apps/playground/index.html` references vendored `/vendor/leader-line.min.js` (not `/node_modules/`) so topology connector lines render in both `pnpm dev` and `pnpm preview` — **completed in commit `4f02c1e` (2026-05-20) prior to milestone kickoff**
- [ ] **BUG-02**: Playwright regression spec asserts ≥1 `LeaderLine` instance is created against the built preview playground (`tests/e2e/topology-lines.spec.ts`)

### Polish

- [ ] **POLISH-01**: `apps/playground/napplets/resource-demo/index.html:61` h2 label reads `:4174` (matches actual GRANTED_URL)

### Renames

- [ ] **RENAME-01**: `SessionEntry.identitySource: 'auth' | 'source'` discriminant renamed to a domain-meaningful name; migration note in changeset
- [ ] **RENAME-02**: `bridge.injectEvent('auth:identity-changed', ...)` shell hook renamed; migration note in changeset

### Validation

- [ ] **VALIDATE-01**: Nyquist retroactive validation pass for v1.7 phases 37–41 produces VALIDATION.md artifacts under each phase directory

### Dependency consumption

- [ ] **DEP-01**: `@napplet/nub` peer dep bumped `^0.2.1` → `^0.3.0` across `@kehto/acl`, `@kehto/runtime`, `@kehto/shell`, `@kehto/services`
- [ ] **DEP-02**: `@napplet/core` peer dep bumped `^0.2.0` → `^0.3.0` across all 4 packages
- [ ] **DEP-03**: `pnpm.overrides @napplet/nub>@napplet/core` workaround removed from root `package.json` (verifies upstream packaging-bug fix is live)
- [ ] **DEP-04**: `packages/shell/src/types/provisional-class.ts` deleted; imports swapped to `@napplet/nub/class`
- [ ] **DEP-05**: `packages/shell/src/types/provisional-connect.ts` deleted; imports swapped to `@napplet/nub/connect`
- [ ] **DEP-06**: `packages/shell/src/types/provisional-resource.ts` deleted; imports swapped to `@napplet/nub/resource`
- [ ] **DEP-07**: 4 minor-bump changesets staged (`@kehto/{acl,runtime,shell,services}`)

### Validator parity

- [ ] **VALIDATOR-01**: Behavioral parity audit between kehto's local `normalizeConnectOrigin` and upstream `@napplet/nub/connect`'s shared validator (21 rules, 28 smoke tests)
- [ ] **VALIDATOR-02**: Kehto replaces local impl with upstream import OR records intentional divergence in PROJECT.md Key Decisions with reasoning

### NUB-IDENTITY decrypt

- [ ] **DECRYPT-01**: `@kehto/runtime` IDENTITY domain dispatcher handles `identity.decrypt` envelope; correlates response by `id`; emits `identity.decrypt.result` or `identity.decrypt.error`
- [ ] **DECRYPT-02**: Shell verifies outer event signature before any decrypt attempt (1 of 4 shell MUSTs)
- [ ] **DECRYPT-03**: Shell performs impersonation check `seal.pubkey === rumor.pubkey` for NIP-17 gift-wrap path (2 of 4 shell MUSTs)
- [ ] **DECRYPT-04**: Shell hides outer `created_at` from rumor result to preserve NIP-59 ±2-day randomization privacy floor (3 of 4 shell MUSTs)
- [ ] **DECRYPT-05**: 8-code error union (`class-forbidden`, `signer-denied`, `signer-unavailable`, `decrypt-failed`, `malformed-wrap`, `impersonation`, `unsupported-encryption`, `policy-denied`) maps to `identity.decrypt.error` envelope
- [ ] **DECRYPT-06**: `enforce.ts` class-gate rejects `identity.decrypt` for class-2 napplets with `class-forbidden` BEFORE invoking signer (4 of 4 shell MUSTs — extends Decisions #23/24)
- [ ] **DECRYPT-07**: Auto-detect router classifies event as NIP-04 / NIP-44-direct / NIP-17 gift-wrap and dispatches to matching decrypt path; unknown encryption returns `unsupported-encryption`
- [ ] **DECRYPT-08**: `@kehto/services` ships an `identity.decrypt` reference service handler taking `{ getDecryptor }` host bridge (extends Decision #18 options-as-bridge pattern)
- [ ] **DECRYPT-09**: 13th playground napplet `decrypt-demo` (class-1 posture; keeps `@kehto/demo-*` package family name) exercises NIP-04 + NIP-44 + NIP-17 decrypt round-trips with `__publishDecryptFixtures__` test hook
- [ ] **DECRYPT-10**: Class-2 variant in `decrypt-demo` proves class-2 rejection produces `class-forbidden` (negative test path)

### E2E coverage

- [ ] **E2E-27**: Layer-A parameterized spec covers all 3 encryption modes + all 8 error codes against the runtime dispatcher
- [ ] **E2E-28**: Layer-B Playwright spec walks `decrypt-demo` napplet through happy + class-forbidden paths against the built `:4174` preview

## Future Requirements

Deferred to v1.9 or beyond. Tracked but not in current roadmap.

### Cross-NUB invariant (CROSSNUB-*)

- **CROSSNUB-01**: Lock biconditional `class === 2 iff connect.granted === true` at `class.assigned` send time in a dedicated invariant spec (currently covered partially by `class-invariant.spec.ts` allowlist verification)

### NUB-CLASS-1 amendments (CLASS1-*)

- **CLASS1-AMEND-01**: Shell SHOULD emit `report-to` CSP header pointing at a class-violation collector endpoint
- **CLASS1-AMEND-02**: Violations MUST be correlated by `(dTag, aggregateHash)` tuple in any local logging surface

### Capability deprecation sweep (DEPRECAP-*)

- **DEPRECAP-01**: Grep kehto for `perm:strict-csp` references (deprecated on `NamespacedCapability` in upstream v0.29.0); migrate to `nub:connect` / `nub:class`
- **DEPRECAP-02**: Inline-script audit across `apps/playground/napplets/*/index.html` for any `<script>` without `src` (upstream `@napplet/vite-plugin@0.29.0` breaks build on these; kehto uses its own plugin but contributors' napplets may not)

### Host bridge reference impls (BRIDGE-*)

- **BRIDGE-ELECTRON-01**: Electron HostKeysBridge / HostMediaBridge / HostCacheBridge reference impl
- **BRIDGE-TAURI-01**: Tauri equivalents

### CI surface (CI-*)

- **CI-MATRIX-01**: GitHub Actions Build + Playwright workflows expanded `ubuntu-latest` → matrix of `ubuntu-latest`, `macos-latest`, `windows-latest`

## Out of Scope

Explicitly excluded for v1.8. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `relay.subscribeEncrypted` (alternative decrypt surface) | Upstream decision landed on `identity.decrypt` per closed napplet/napplet#3 + v0.30.0 changeset. Symmetric send/receive design lost to per-event explicit decrypt. |
| Class-3+ posture work | Upstream NUB-CLASS only defines class-1 (strict baseline) and class-2 (user-approved direct network). No class-3+ in spec. |
| New NUB domains (e.g. media-recording, file-system) | None defined upstream at v0.3.0. Kehto adds new domains only when canonical spec lands. |
| Real backend impls for `getDecryptor` host bridge | Kehto ships reference handler + interface contract only; downstream shells (hyprgate, Electron, Tauri) plug NIP-44/NIP-04/NIP-17 backends. Same pattern as v1.4 keys/media. |
| Migration of existing demo napplets to class-2 | Phase 38 set all 12 napplets to class-1 default. Class-2 testing covered by single `decrypt-demo` class-2 variant in DECRYPT-10. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 42 | Pending |
| BUG-02 | Phase 42 | Pending |
| POLISH-01 | Phase 42 | Pending |
| RENAME-01 | Phase 42 | Pending |
| RENAME-02 | Phase 42 | Pending |
| VALIDATE-01 | Phase 43 | Pending |
| DEP-01 | Phase 44 | Pending |
| DEP-02 | Phase 44 | Pending |
| DEP-03 | Phase 44 | Pending |
| DEP-04 | Phase 44 | Pending |
| DEP-05 | Phase 44 | Pending |
| DEP-06 | Phase 44 | Pending |
| DEP-07 | Phase 44 | Pending |
| VALIDATOR-01 | Phase 44 | Pending |
| VALIDATOR-02 | Phase 44 | Pending |
| DECRYPT-01 | Phase 45 | Pending |
| DECRYPT-02 | Phase 45 | Pending |
| DECRYPT-03 | Phase 45 | Pending |
| DECRYPT-04 | Phase 45 | Pending |
| DECRYPT-05 | Phase 45 | Pending |
| DECRYPT-06 | Phase 45 | Pending |
| DECRYPT-07 | Phase 45 | Pending |
| DECRYPT-08 | Phase 46 | Pending |
| DECRYPT-09 | Phase 46 | Pending |
| DECRYPT-10 | Phase 46 | Pending |
| E2E-27 | Phase 46 | Pending |
| E2E-28 | Phase 46 | Pending |

**Coverage:**
- v1 requirements: 27 total (1 completed pre-kickoff: BUG-01)
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 — BUG-01 marked complete (shipped pre-kickoff in commit `4f02c1e`); `apps/demo` → `apps/playground` rename reflected (commit `4208d91`)*

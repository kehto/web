# Requirements: Kehto Runtime - v1.16 Structural Code Quality Refactor

**Defined:** 2026-05-24
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Eliminate the remaining 16 `aislop` structural code-quality warnings without changing Kehto runtime, service, playground, or docs behavior.

**Baseline entering v1.16:** v1.15 closed the corrected local quality-gate invocation at `64 / 100 Needs Work`, 0 errors, 16 warnings, and 0 fixable findings. Formatting, Linting, AI Slop, and Security all report 0 issues. The remaining warnings are structural only: 10 long functions over 150 LOC, 3 files over 700 LOC, and 3 deep-nesting findings.

**Scope boundary:** This milestone is behavior-preserving refactor work. It may split modules, extract helpers, add focused regression tests, and update imports/exports around existing boundaries. It must not change NIP-5D protocol behavior, public package contracts, playground user flows, `.aislop` thresholds, published package versions, or the public Pages route contract.

## v1.16 Requirements

### Scanner Baseline

- [x] **SCAN-01**: Maintainer can reproduce the v1.16 starting baseline with `npx --no-install aislop scan -d` and see the same 16 structural warnings documented in the milestone artifacts.
- [ ] **SCAN-02**: Maintainer can run `npx --no-install aislop scan -d` after the milestone and see 0 errors, 0 warnings, and 0 fixable findings.
- [ ] **SCAN-03**: The existing `.aislop/config.yml` complexity thresholds remain unchanged during the milestone unless a phase explicitly documents and approves a policy change.

### Runtime Core

- [x] **CORE-01**: `packages/runtime/src/runtime.ts` no longer triggers the `complexity/file-too-large` warning under the current 700-line threshold.
- [x] **CORE-02**: `createRuntime` no longer triggers `complexity/function-too-long` or `complexity/deep-nesting`.
- [x] **CORE-03**: `handleRelayMessage` no longer triggers `complexity/function-too-long` or `complexity/deep-nesting`.

### Playground Shell

- [x] **PLAY-01**: `apps/playground/src/main.ts` no longer triggers the `complexity/file-too-large` warning under the current 700-line threshold.
- [x] **PLAY-02**: `apps/playground/src/shell-host.ts` no longer triggers the `complexity/file-too-large` warning under the current 700-line threshold.
- [x] **PLAY-03**: `createDemoHooks` no longer triggers `complexity/function-too-long`.
- [x] **PLAY-04**: `bootShell` no longer triggers `complexity/function-too-long` or `complexity/deep-nesting`.
- [x] **PLAY-05**: `openPolicyModal` no longer triggers `complexity/function-too-long`.
- [x] **PLAY-06**: `createNip46Client` no longer triggers `complexity/function-too-long`.

### Services and Adapters

- [x] **SVC-01**: `createMediaService` no longer triggers `complexity/function-too-long`.
- [x] **SVC-02**: `createNotificationService` no longer triggers `complexity/function-too-long`.
- [x] **SVC-03**: `createResourceService` no longer triggers `complexity/function-too-long`.
- [x] **ADAPT-01**: `adaptHooks` no longer triggers `complexity/function-too-long`.

### Verification

- [ ] **VERIFY-01**: `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and `pnpm --dir docs docs:build` pass after the structural refactors.
- [ ] **VERIFY-02**: Each extracted boundary is covered by existing or new focused tests when behavior is not already protected by current unit/static coverage.

## Future Requirements

Deferred to later milestones.

### Stricter Complexity Policy

- **STRICT-01**: Lower `maxFunctionLoc` from 150 toward the scanner default of 80 after the current 16-warning baseline is eliminated.
- **STRICT-02**: Lower `maxFileLoc` from 700 toward the scanner default of 400 after current large-file warnings are eliminated.

### Broader Architecture Cleanup

- **ARCH-01**: Revisit package-level runtime module boundaries after `runtime.ts` is split and stable.
- **ARCH-02**: Revisit playground app architecture after `main.ts` and `shell-host.ts` are split and stable.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Runtime protocol changes | The milestone is structural cleanup and must preserve NIP-5D behavior. |
| Public package API changes | Existing consumers should not need migration work for refactor-only cleanup. |
| `.aislop` threshold loosening | The milestone target is removing warnings, not hiding them. |
| Full UI redesign | Playground files may be split, but visible UI behavior should remain stable. |
| New dependencies | Existing repo guidance forbids new dependencies without explicit request. |
| Decrypt-demo fixture repair | Backlog 999.1 remains valid but is unrelated to structural scanner warnings. |
| Package publication | This milestone prepares code quality, not release publishing. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAN-01 | Phase 73 | Complete |
| SCAN-02 | Phase 76 | Pending |
| SCAN-03 | Phase 76 | Pending |
| CORE-01 | Phase 73 | Complete |
| CORE-02 | Phase 73 | Complete |
| CORE-03 | Phase 73 | Complete |
| PLAY-01 | Phase 74 | Complete |
| PLAY-02 | Phase 74 | Complete |
| PLAY-03 | Phase 74 | Complete |
| PLAY-04 | Phase 74 | Complete |
| PLAY-05 | Phase 75 | Complete |
| PLAY-06 | Phase 75 | Complete |
| SVC-01 | Phase 75 | Complete |
| SVC-02 | Phase 75 | Complete |
| SVC-03 | Phase 75 | Complete |
| ADAPT-01 | Phase 75 | Complete |
| VERIFY-01 | Phase 76 | Pending |
| VERIFY-02 | Phase 76 | Pending |

**Coverage:**
- v1.16 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-05-24*
*Last updated: 2026-05-24 after Phase 75 service and adapter decomposition*

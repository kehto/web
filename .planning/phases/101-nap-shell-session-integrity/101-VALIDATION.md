---
phase: 101
slug: nap-shell-session-integrity
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-23
---

# Phase 101 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2; Playwright 1.59.1 |
| **Config file** | `vitest.config.ts`; `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts packages/shell/src/shell-bridge.test.ts packages/shell/src/shell-init.test.ts packages/shell/src/shell-supports-conformance.test.ts packages/paja/src/parity.test.ts` |
| **Full suite command** | `pnpm test:unit && pnpm test:e2e -- gateway-artifact-parity naps-path-conformance paja-single-window` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick Vitest command above.
- **After every plan wave:** Run `pnpm test:unit` and the affected focused Playwright specs.
- **Before `$gsd-verify-work`:** The full phase suite must be green.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 101-01-01 | 101-01 | 1 | SHELL-04 | T-101-02 | Pre-session traffic returns before ACL, firewall, service, or domain dispatch | integration | `pnpm exec vitest run packages/runtime/src/dispatch.test.ts` | ✅ extend | ✅ green |
| 101-01-02 | 101-01 | 1 | SHELL-03, SHELL-05 | T-101-01, T-101-03, T-101-06, T-101-07 | Only the first valid ready from a registered identity creates one session/init; forged, identity-less, and duplicate ready are inert while reload remains valid | unit | `pnpm exec vitest run packages/shell/src/shell-bridge.test.ts` | ✅ extend | ✅ green |
| 101-02-01 | 101-02 | 2 | SHELL-01, SHELL-02, SHELL-06 | T-101-08, T-101-09 | The exported host-integrator-only resolver produces fresh domain-only immutable environments from OriginIdentity and concrete live wiring, and remains absent from napplet/shim surfaces | unit + static | `pnpm exec vitest run packages/shell/src/shell-init.test.ts packages/shell/src/shell-supports-conformance.test.ts` | ✅ extend | ✅ green |
| 101-02-02 | 101-02 | 2 | SHELL-05 | T-101-09, T-101-10, T-101-12 | Ready passes creation identity explicitly and independent frames cannot observe or mutate one another's environments | unit | `pnpm exec vitest run packages/shell/src/shell-init.test.ts packages/shell/src/shell-bridge.test.ts` | ✅ extend | ✅ green |
| 101-03-01 | 101-03 | 3 | SHELL-01, SHELL-02, SHELL-05 | T-101-13, T-101-14, T-101-15 | Injected shell support is unary exact membership over the first valid immutable parent init | unit | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` | ✅ extend | ✅ green |
| 101-03-02 | 101-03 | 3 | SHELL-01 | T-101-16 | Public types, fixtures, static guards, and package README expose no legacy capability shape and classify resolveShellEnvironment as host-only rather than injected/shim API | unit + static + docs | `pnpm exec vitest run packages/shell/src/shell-supports-conformance.test.ts tests/unit/nip5d-conformance-guard.test.ts && pnpm docs:check` | ✅ extend | ✅ green |
| 101-04-01 | 101-04 | 4 | SHELL-02, SHELL-05, SHELL-06 | T-101-04-02, T-101-04-03 | Paja bootstrap and init call the shared host resolver with trusted identity and produce content-equal independently immutable live/disabled environments | unit | `pnpm exec vitest run packages/paja/src/parity.test.ts` | ✅ extend | ✅ green |
| 101-04-02 | 101-04 | 4 | SHELL-05, SHELL-06 | T-101-04-01, T-101-04-04, T-101-04-05 | Paja registers identity before ready and preserves duplicate-ready and reload semantics without provenance drift | unit + browser | `pnpm exec vitest run packages/paja/src/browser-host.test.ts && pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1` | ✅ extend | ✅ green |
| 101-05-01 | 101-05 | 4 | SHELL-02, SHELL-05, SHELL-06 | T-101-05-01, T-101-05-03, T-101-05-04 | Playground prelude and init call the shared host resolver with trusted identity and produce content-equal independently immutable live/disabled environments while preserving byte provenance | unit + static | `pnpm exec vitest run tests/unit/playground-gateway-guard.test.ts` | ✅ extend | ✅ green |
| 101-05-02 | 101-05 | 4 | SHELL-02, SHELL-05, SHELL-06 | T-101-05-02, T-101-05-05 | Concurrent playground frames retain isolated truthful environments; duplicate ready is inert and reload is reinitialized once | browser | `pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts tests/e2e/naps-path-conformance.spec.ts tests/e2e/demo-service-toggle.spec.ts --workers=1` | ✅ extend | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] No separate Wave 0 scaffold is required: every task names an existing focused test file and extends it fail-first.
- [x] Runtime ingress coverage lives in `packages/runtime/src/dispatch.test.ts`.
- [x] Shell handshake, init, namespace, and static coverage have existing homes named by Plans 101-01 through 101-03.
- [x] Paja and playground unit/Playwright coverage have existing homes named by Plans 101-04 and 101-05.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or Wave 0 dependencies.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Wave 0 covers every missing reference.
- [x] No watch-mode flags.
- [x] Focused unit feedback remains below 120 seconds; browser and full-suite gates run at plan/phase boundaries.
- [x] `nyquist_compliant: true` is set in frontmatter after validation.

## Validation Audit 2026-07-23

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Focused audit evidence: 9 files and 175 Vitest assertions green, with the
mapped Playwright behaviors covered by the Phase 101 execution gate.

**Approval:** validated

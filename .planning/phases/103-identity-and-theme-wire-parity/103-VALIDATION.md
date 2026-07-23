---
phase: 103
slug: identity-and-theme-wire-parity
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 103 — Validation Strategy

> Feedback contract for NAP-IDENTITY and NAP-THEME wire parity.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 and Playwright 1.54.0 |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run packages/services/src/identity-service.test.ts packages/services/src/theme-service.test.ts packages/runtime/src/dispatch.test.ts packages/shell/src/napplet-namespace.test.ts packages/shell/src/shell-bridge.test.ts` |
| **Host-focused command** | `pnpm exec vitest run packages/paja/src/browser-host.test.ts tests/unit/playground-gateway-guard.test.ts` |
| **Browser command** | `KEHTO_PLAYGROUND_BASE_URL=http://[::1]:4174 pnpm exec playwright test tests/e2e/nap-identity.spec.ts tests/e2e/nap-theme.spec.ts tests/e2e/theme-broadcast.spec.ts tests/e2e/paja-single-window.spec.ts --workers=1` |
| **Full suite command** | `pnpm test:unit && pnpm test:e2e` |
| **Estimated quick runtime** | under 30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the narrowest affected Vitest file(s).
- **After every plan wave:** Run the quick cross-layer command.
- **After host integration waves:** Run the host-focused command and relevant browser specs.
- **Before phase verification:** Type-check affected packages, run the focused matrix, relevant browser proofs, and `git diff --check`.
- **Max feedback latency:** 30 seconds for unit feedback; browser proof at wave boundaries.

---

## Requirement Verification Map

| Requirement | Secure Behavior | Test Type | Automated Command | Current Coverage | Status |
|-------------|-----------------|-----------|-------------------|------------------|--------|
| IDENTITY-01 | Signer absence/failure yields exactly one `identity.getPublicKey.result` with `pubkey: ""` and no error envelope. | unit/runtime | quick command | Extend existing service/runtime tests | ⬜ pending |
| IDENTITY-02 | Supported reads return matching safe result shapes; unknown actions are ignored at handler and ingress gates. | unit/runtime | quick command | Extend existing service/runtime tests | ⬜ pending |
| IDENTITY-03 | Readonly API and normal/sign-out changes reach each eligible authenticated session exactly once. | unit/host/browser | quick + host/browser commands | Add eligibility/cardinality regression | ⬜ pending |
| IDENTITY-04 | Child forgery and unrelated domains cannot mutate or disclose identity state. | unit/browser | quick + browser commands | Add source/isolation regression | ⬜ pending |
| THEME-01 | Normal, unavailable, ACL-denied, and firewall-denied `theme.get` produce one complete safe result. | unit/runtime | quick command | Extend denial/fallback matrix | ⬜ pending |
| THEME-02 | Unknown actions are silent and no `theme.*.error` message type is emitted. | unit/runtime/static | quick command | Extend handler and guard coverage | ⬜ pending |
| THEME-03 | One host update mutates stored state before one matching eligible-session push in Paja and playground. | unit/host/browser | host + browser commands | Add state/cardinality proofs | ⬜ pending |
| THEME-05 | No subscribe/unsubscribe API or wire operation is generated or accepted. | unit/static | quick command | Add binding/guard assertion | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Extend identity service/runtime fixtures for exact result defaults, unknown-action silence, and envelope cardinality.
- [ ] Extend theme service/runtime fixtures for complete fallback results and forbidden `.error` message types.
- [ ] Add shell-bridge eligibility fixtures covering pre-session, ungranted, granted, revoked, and destroyed sessions.
- [ ] Add Paja and playground state-before-push/cardinality proofs.
- [ ] Add binding/source-isolation and no-subscription assertions.

No dependency installation is required.

---

## Manual-Only Verifications

All phase behaviors are intended to have automated unit or browser verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or explicit Wave 0 dependencies
- [ ] Sampling continuity: no three consecutive tasks without automated verification
- [ ] Wave 0 covers all missing references
- [x] No watch-mode flags
- [ ] Feedback latency remains under 30 seconds for unit checks
- [ ] `nyquist_compliant: true` set after execution audit

**Approval:** pending

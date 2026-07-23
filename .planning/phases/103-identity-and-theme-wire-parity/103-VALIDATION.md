---
phase: 103
slug: identity-and-theme-wire-parity
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase)
status: gaps_found
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
| IDENTITY-01 | Signer absence/failure yields exactly one `identity.getPublicKey.result` with `pubkey: ""` and no error envelope. | unit/runtime | quick command | Service and runtime exact-envelope/cardinality tests | ✅ covered |
| IDENTITY-02 | Every NAP-IDENTITY read returns its matching safe result; unknown actions are ignored at handler and ingress gates. | unit/runtime/browser | quick command | **Gap:** runtime ingress and injected binding omit `getList`, `getZaps`, `getMutes`, `getBlocked`, and `getBadges`; no end-to-end test can fail on their loss. | ❌ blocked |
| IDENTITY-03 | Readonly API and normal/sign-out changes reach each eligible authenticated session exactly once. | unit/host/browser | quick + host/browser commands | Shell eligibility and playground signer-transition cardinality tests | ✅ covered |
| IDENTITY-04 | Child forgery and unrelated domains cannot mutate or disclose identity state. | unit/browser | quick + browser commands | **Gap:** tests cover assignment but not root-descriptor replacement/deletion; `window.napplet` is configurable, so a child can replace the protected namespace. | ❌ blocked |
| THEME-01 | Normal, unavailable, ACL-denied, and firewall-denied `theme.get` produce one complete safe result. | unit/runtime | quick command | Runtime/service denial/fallback exact-shape tests | ✅ covered |
| THEME-02 | Unknown actions are silent and no `theme.*.error` message type is emitted. | unit/runtime/static | quick command | Runtime silence and static guard tests | ✅ covered |
| THEME-03 | One host update mutates stored state before one matching eligible-session push in Paja and playground. | unit/host/browser | host + browser commands | **Gap:** playground browser proof waits 150 ms before subscribing, masking two readiness-timer broadcasts; global untrusted `shell.ready` can trigger duplicate pushes and persisted state is not seeded before readiness. | ❌ blocked |
| THEME-05 | No subscribe/unsubscribe API or wire operation is generated or accepted. | unit/static | quick command | Binding API-shape, service, and static-guard tests | ✅ covered |

---

## Post-Execution Nyquist Audit (2026-07-23)

Authority checked: draft `NAP-IDENTITY.md`, `NAP-THEME.md`, and `projections/web.md` at
`napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f`. This audit also incorporates
the Phase 103 code review's CR-01 through CR-03. The existing focused matrix was run:

```text
pnpm exec vitest run packages/runtime/src/dispatch.test.ts \
  packages/shell/src/napplet-namespace.test.ts \
  packages/services/src/identity-service.test.ts \
  packages/paja/src/browser-host.test.ts \
  tests/unit/playground-gateway-guard.test.ts
# 5 files, 186 passed
```

Those passing tests do not prove the following observable requirements:

| Gap | Requirement(s) | Missing behavioral proof / observed implementation conflict | Required regression |
|-----|----------------|-------------------------------------------------------------|---------------------|
| V-103-01 | IDENTITY-02 | `domain-results.ts` allowlists only four of nine NAP-IDENTITY reads, and `runtime.ts` drops every identity message outside that list before registered services run. The web binding exposes the same four reads only. The reference service implements the missing five, so direct service tests are insufficient. | For each of `getList` (including `listType`), `getZaps`, `getMutes`, `getBlocked`, and `getBadges`, drive an authenticated runtime with a registered identity service and assert one same-id result; drive the injected binding and assert its corresponding request/result surface. Include an unavailable/denied safe-default case. |
| V-103-02 | IDENTITY-04 | `napplet-namespace.ts` defines `window.napplet` with `configurable: true`. Direct assignment guards do not prevent `Reflect.defineProperty(window, 'napplet', ...)` or deletion/recreation, which replaces the frozen identity/theme objects. | Execute both descriptor replacement and deletion/recreation against the injected prelude; assert the operations fail and the original identity/theme object identities, parent-source gate, and readonly descriptors remain intact. |
| V-103-03 | THEME-03 (and active-theme freshness for THEME-01) | `main.ts` accepts any `shell.ready`, schedules broadcasts at both 0 and 100 ms, and broadcasts again after each napplet load. `main-preferences.ts` does not seed `ThemeService` before these timers. The existing E2E deliberately waits 150 ms before subscribing, so it cannot observe duplicate/forged readiness events or stale immediate reads. | Register `theme.onChanged` before readiness; send a forged cross-window `shell.ready` and assert zero pushes; assert a real ready does not create duplicate delivery; assert one host theme mutation produces one event whose immediate `theme.get` equals the event; assert an immediately-ready napplet reads the persisted active theme. |

### Required Follow-up

- [ ] Resolve CR-01 and add V-103-01 runtime + binding coverage.
- [ ] Resolve CR-02 and add V-103-02 descriptor-attack coverage.
- [ ] Resolve CR-03 and add V-103-03 pre-listener, forged-source, freshness, and exact-cardinality coverage.
- [ ] Re-run the focused cross-layer matrix and the isolated-IPv6 browser proofs after fixes.

No dependency installation is required.

---

## Manual-Only Verifications

All phase behaviors are intended to have automated unit or browser verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or explicit Wave 0 dependencies
- [x] Sampling continuity: existing tasks have automated commands, but the audit found three adversarial gaps
- [ ] V-103-01, V-103-02, and V-103-03 have passing behavioral regressions
- [x] No watch-mode flags
- [ ] Feedback latency remains under 30 seconds for unit checks
- [ ] `nyquist_compliant: true` set after execution audit

**Approval:** blocked — 5/8 requirements have proportionate automated evidence; IDENTITY-02, IDENTITY-04, and THEME-03 require implementation remediation and adversarial regressions.

---
phase: 39-nub-connect-nub-config
validated_at: 2026-05-20
validator: gsd-nyquist-auditor (retroactive — v1.8 Phase 43)
status: passed
score: 5/5
---

# Phase 39: NUB-CONNECT Adoption + NUB-CONFIG Reference Service — Retroactive Validation

## Validation Source
Validated against `.planning/milestones/v1.7-ROADMAP.md` Phase 39 Success Criteria (canonical) plus shipped evidence in the working tree and per-plan SUMMARY.md files under `.planning/milestones/v1.7-phases/39-nub-connect-nub-config/`.

## Per-Criterion Verdicts

### Criterion 1: Per-napplet `Content-Security-Policy: connect-src <origins>` header is present on napplet HTML responses in both `vite dev` and `vite preview` modes (asserted by `connect-csp-preview.spec.ts`).
- **Verdict:** PASS
- **Evidence:** `apps/demo/vite.config.ts` defines `serveNappletCsp()` with both `configureServer` (dev) at line 209 and `configurePreviewServer` (preview) at line 221 (2 occurrences of `configurePreviewServer` confirmed). `CSP_NO_GRANTS = "connect-src 'none'"` at line 89. `tests/e2e/connect-csp-preview.spec.ts` asserts `content-security-policy` response header against `:4174` baseURL — recorded GREEN in `39-ITERATION-LOG.md` 67/0/0 close. Cross-verified `39-VERIFICATION.md` Observable Truth #1.

### Criterion 2: Consent dialog approve flow enables subsequent fetch; dismiss = deny flow returns canonical refusal (asserted by `connect-consent.spec.ts`).
- **Verdict:** PASS
- **Evidence:** `apps/demo/src/consent-modal.ts` resolves `true` only on `closeModal('approve')`; all other outcomes (`deny`, `dismiss`, `timeout`) resolve `false` — M-04 anti-feature scan: `grep "resolve(true)" apps/demo/src/consent-modal.ts` = 0 matches (only the approve branch). `tests/e2e/connect-consent.spec.ts` contains 2 tests (approve + dismiss=deny), serial mode with Vite reset in `beforeEach`. Recorded GREEN in 67/0/0 close.

### Criterion 3: Revoking a connect grant triggers iframe destroy + recreate; the newly-mounted iframe receives the updated CSP header excluding the revoked origin (asserted by `connect-revocation.spec.ts`).
- **Verdict:** PASS
- **Evidence:** `apps/demo/src/main.ts:964-991` defines `__revokeConnect__` which dispatches `shell:connect-revoked` CustomEvent; listener snapshots `[...napps.entries()]` before iteration (Dev 2 fix at commit `c764e7d` to prevent infinite loop) then calls `loadNapplet()` for re-mount. `tests/e2e/connect-revocation.spec.ts` uses `waitForFunction` asserting iframe replacement (old element gone, new mounted). Cross-verified `39-VERIFICATION.md` Observable Truth #3 and Notable Deviations section.

### Criterion 4: `pnpm audit:csp` runs post-build, recursively scans built napplet `dist/index.html` files, and exits non-zero if any `<meta http-equiv="Content-Security-Policy">` tag is found.
- **Verdict:** PASS
- **Evidence:** `scripts/audit-csp.mjs` exists with case-insensitive `META_CSP_REGEX` scan over built napplet HTML. `package.json:6` declares `"audit:csp": "node scripts/audit-csp.mjs"`. `.github/workflows/build.yml:37` adds the "Audit CSP (residual meta-CSP scan)" step ordered Build → Audit CSP → Type-check. Iteration log records `[audit:csp] OK — scanned 11 napplet dist/index.html file(s), no meta-CSP found`. Anti-feature sweep: `grep -rni 'http-equiv.*CSP' apps/demo/napplets/*/dist/index.html` = 0 matches.

### Criterion 5: config-demo napplet exercises `config.get` + `config.watch` round-trip against the shell-side reference service; values propagate correctly (asserted by `nub-config.spec.ts`).
- **Verdict:** PASS
- **Evidence:** `apps/demo/napplets/config-demo/src/main.ts` calls `config.subscribe()` (≥3 occurrences) and updates `#config-demo-values` sentinel on every push. `createConfigService` (packages/services/src/config-service.ts, 380 lines) is registered via `nubDispatch.registerNub('config', configAdapter)` at `packages/runtime/src/runtime.ts:1129` (Dev 1 fix at commit `fb81401` — without this registration all `config.*` messages were silently dropped). `tests/e2e/nub-config.spec.ts` uses `__publishConfigValues__` test hook + `frameLocator` + `#config-demo-values` sentinel assertion. Recorded GREEN in 67/0/0 close. Cross-verified `39-VERIFICATION.md` Observable Truth #5.

## Summary
- Total criteria: 5
- PASS: 5
- FAIL: 0
- N/A: 0
- Overall: **passed** — CSP authority shifts to HTTP headers in both dev + preview, consent flow correctly distinguishes approve/dismiss outcomes, revocation triggers iframe re-mount, CI audit catches meta-CSP regressions, and NUB-CONFIG round-trip is live. E2E baseline advanced 62 → 67 (+5).

## Notes
Three in-execution deviations were detected and fixed before close (Dev 1: missing runtime registration; Dev 2: infinite revoke loop from live-Map iteration; Dev 3: three spec corrections). All resolved in 67/0/0 canonical close. The H-03 prevention factory dependency (`connectStore` singleton) is consumed by Phase 40 RESOURCE-01.

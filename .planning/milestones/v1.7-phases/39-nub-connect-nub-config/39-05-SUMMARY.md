---
phase: 39-nub-connect-nub-config
plan: 05
subsystem: testing
tags: [playwright, e2e, nub-connect, nub-config, csp, policy]

requires:
  - phase: 39-nub-connect-nub-config/39-04
    provides: consent modal + config-demo napplet + test hooks (__grantConnectOrigin__, __revokeConnect__, __publishConfigValues__)
  - phase: 39-nub-connect-nub-config/39-03
    provides: serveNappletCsp Vite plugin with configurePreviewServer + POST /__connect-grants
  - phase: 39-nub-connect-nub-config/39-01
    provides: connectStore singleton + audit-csp script

provides:
  - SHELL-CONNECT-POLICY.md with kehto cross-refs + Production Deployment Gap section (CONNECT-07)
  - 5 new E2E tests (E2E-21..24): consent approve, consent dismiss=deny, revocation iframe reload, preview CSP, config round-trip
  - 39-ITERATION-LOG.md confirming 67/0/0 canonical phase close (62+5)
  - Infinite loop bug fix in main.ts shell:connect-revoked listener (live Map iterator → snapshot)
  - Config NUB domain dispatch wired in runtime.ts (handleConfigMessage + nubDispatch.registerNub)

affects: [phase-40-nub-resource, hyprgate-connect-consumer, downstream-csp-audit]

tech-stack:
  added: []
  patterns:
    - "Playwright serial describe mode for tests sharing Vite in-memory state"
    - "AbortSignal.timeout(3000) on best-effort Vite reset fetches"
    - "Snapshot-before-mutation pattern for live Map iteration in event listeners"
    - "DOM CSP header assertion via Playwright request fixture (not page-level)"

key-files:
  created:
    - docs/policies/SHELL-CONNECT-POLICY.md
    - tests/e2e/connect-consent.spec.ts
    - tests/e2e/connect-revocation.spec.ts
    - tests/e2e/connect-csp-preview.spec.ts
    - tests/e2e/nub-config.spec.ts
    - .planning/phases/39-nub-connect-nub-config/39-ITERATION-LOG.md
  modified:
    - README.md (Policies section cross-ref)
    - packages/runtime/src/runtime.ts (config NUB dispatch)
    - apps/demo/src/main.ts (shell:connect-revoked infinite loop fix)
    - tests/e2e/shell-ui-state-surfaces.spec.ts (11th napplet count update)
    - tests/e2e/connect-consent.spec.ts (serial mode + Vite reset in beforeEach)
    - tests/e2e/connect-revocation.spec.ts (serial mode + AbortSignal + domcontentloaded)
    - tests/e2e/nub-config.spec.ts (__publishConfigValues__ hook instead of hidden button)

key-decisions:
  - "serial describe mode required for connect specs sharing Vite in-memory grants state"
  - "snapshot napplets Map before revocation loop — live iterator + loadNapplet() insertion = infinite loop"
  - "config NUB domain requires explicit nubDispatch.registerNub call (not auto-discovered from serviceRegistry)"

requirements-completed:
  - CONNECT-07
  - E2E-21
  - E2E-22
  - E2E-23
  - E2E-24

duration: ~4h (across continuation sessions)
completed: 2026-04-24
---

# Phase 39 Plan 05: SHELL-CONNECT-POLICY + E2E specs + Phase 39 Close Summary

**Policy doc + 5 new E2E tests locking NUB-CONNECT consent/revocation/CSP and NUB-CONFIG round-trip; two critical bugs fixed (Map iteration infinite loop + missing config NUB dispatch) to achieve canonical 67/0/0.**

## Performance

- **Duration:** ~4h (multi-session)
- **Completed:** 2026-04-24
- **Tasks:** 3 (policy doc, 4 E2E specs, iteration log + canonical loop)
- **Files modified:** 10

## Accomplishments

- Authored `docs/policies/SHELL-CONNECT-POLICY.md` — verbatim mirror of napplet canonical + kehto cross-refs into connect-store.ts / vite.config.ts / consent-modal.ts + Production Deployment Gap section (CONNECT-07)
- Wrote 5 new E2E tests across 4 spec files (E2E-21..24): consent approve, consent dismiss=deny (CSP assert), revocation iframe destroy+recreate, preview-mode CSP header, NUB-CONFIG config.subscribe round-trip
- Fixed critical infinite loop in `main.ts` shell:connect-revoked listener (live Map iterator visited newly-inserted loadNapplet entry repeatedly); fixed missing config NUB domain dispatch in runtime.ts
- Canonical phase-close loop: 67 passed / 0 failed / 0 skipped (24.9s) — Phase 40 unblocked

## Task Commits

1. **Task 1: SHELL-CONNECT-POLICY.md + README** — `ea3cee6` (docs)
2. **Task 2: 4 new E2E specs (E2E-21..24)** — `48a4ebb` (test)
3. **Dev 1: runtime.ts config NUB dispatch** — `fb81401` (fix)
4. **Dev 2: main.ts revoke loop infinite loop** — `c764e7d` (fix)
5. **Dev 3: E2E spec corrections (run 1+2 failures)** — `80ccc90` (fix)
6. **pnpm-lock.yaml** — `a23e66c` (chore)

## Files Created/Modified

- `/home/sandwich/Develop/kehto/docs/policies/SHELL-CONNECT-POLICY.md` — shell HTTP-header authority policy with kehto cross-refs + Production Deployment Gap
- `/home/sandwich/Develop/kehto/tests/e2e/connect-consent.spec.ts` — E2E-21 (approve + dismiss=deny, serial mode, Vite state reset)
- `/home/sandwich/Develop/kehto/tests/e2e/connect-revocation.spec.ts` — E2E-22 (iframe destroy+recreate via ID change detection, serial mode)
- `/home/sandwich/Develop/kehto/tests/e2e/connect-csp-preview.spec.ts` — E2E-23 (preview server CSP header assertion)
- `/home/sandwich/Develop/kehto/tests/e2e/nub-config.spec.ts` — E2E-24 (config.subscribe round-trip via __publishConfigValues__)
- `/home/sandwich/Develop/kehto/.planning/phases/39-nub-connect-nub-config/39-ITERATION-LOG.md` — per-plan entries + 67/0/0 canonical close
- `/home/sandwich/Develop/kehto/packages/runtime/src/runtime.ts` — handleConfigMessage + nubDispatch.registerNub('config', ...)
- `/home/sandwich/Develop/kehto/apps/demo/src/main.ts` — snapshot napplets Map before revocation loop
- `/home/sandwich/Develop/kehto/README.md` — Policies cross-ref for SHELL-CONNECT-POLICY.md
- `/home/sandwich/Develop/kehto/tests/e2e/shell-ui-state-surfaces.spec.ts` — 10→11 napplet count

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing config NUB domain dispatch in runtime.ts**
- **Found during:** Task 2 / E2E run 1
- **Issue:** `createConfigService` was registered in `serviceRegistry` but no `nubDispatch.registerNub('config', ...)` existed. All `config.*` NUB messages were silently dropped. `#config-demo-values` stayed at "(no values yet)".
- **Fix:** Added `handleConfigMessage()` mirroring `handleThemeMessage` pattern; registered `configAdapter` via `nubDispatch.registerNub('config', configAdapter)`.
- **Files modified:** `packages/runtime/src/runtime.ts`
- **Commit:** fb81401

**2. [Rule 1 - Bug] Infinite loop in shell:connect-revoked listener**
- **Found during:** Task 2 / E2E run 3 (diagnosis after repeated 45s/60s/90s timeouts)
- **Issue:** `for (const [windowId, info] of napps.entries())` iterated a live Map iterator. `loadNapplet()` added a new chat entry to the same `napplets` Map during iteration. The live iterator visited the new entry, triggering another `loadNapplet` call → infinite loop. `page.evaluate(__revokeConnect__)` hung indefinitely, consuming the entire test timeout budget.
- **Fix:** Pre-snapshot: `const toRevoke = [...napps.entries()].filter(([, info]) => info.name === detail.dTag)`. Frozen array is not affected by subsequent Map mutations.
- **Files modified:** `apps/demo/src/main.ts`
- **Commit:** c764e7d

**3. [Rule 1 - Bug] E2E spec failures from run 1 and run 2**
- **Found during:** Task 2 / E2E run 1 and run 2
- **Issues:**
  - `shell-ui-state-surfaces.spec.ts`: hardcoded count 10 → needed 11 (config-demo added in Plan 39-04); `config-demo-status` missing from poll list
  - `nub-config.spec.ts`: clicked `#config-demo-update-btn` (wrapped in `display:none`). Plan 39-04 docs specify E2E should use `__publishConfigValues__` test hook
  - `connect-consent.spec.ts` dismiss=deny: Vite in-memory grant for `wss://relay.damus.io` leaked from approve test running in parallel → CSP showed `wss://relay.damus.io` instead of `'none'`. Fixed with serial mode + `beforeEach` Vite state reset
- **Fix:** Updated 4 specs with corrections; added `AbortSignal.timeout(3000)` to best-effort fetch calls; `waitUntil: 'domcontentloaded'` for faster `page.goto`
- **Files modified:** 4 spec files
- **Commit:** 80ccc90

## Canonical Phase-Close Loop Results

```
pnpm install  →  Done in 820ms using pnpm v10.8.0
pnpm build    →  25 successful, 25 total (0 cached, 6.518s)
pnpm audit:csp →  [audit:csp] OK — scanned 11 napplet dist/index.html file(s), no meta-CSP found
pnpm test:e2e →  67 passed (24.9s)
```

## Anti-Feature Verification

| Check | Result |
|-------|--------|
| `grep -rni 'http-equiv.*Content-Security-Policy' apps/demo/napplets/*/dist/index.html` | 0 matches (C-03 CLEAN) |
| `grep -n "resolve(true)" apps/demo/src/consent-modal.ts` | 0 matches (M-04 CLEAN) |
| `grep -c "configurePreviewServer" apps/demo/vite.config.ts` | 2 (C-05 covered) |
| `grep -c "connect-src 'none'" apps/demo/vite.config.ts` | 1 (D4 default present) |
| `grep -c "registerNub.*config" packages/runtime/src/runtime.ts` | 1 (CONFIG-03 wired) |

## REQ-ID Coverage (Phase 39)

| REQ-ID | Plan | Status |
|--------|------|--------|
| CONNECT-01 | 39-01 | shipped |
| CONNECT-02 | 39-03 | shipped |
| CONNECT-03 | 39-04 | shipped |
| CONNECT-04 | 39-04 | shipped |
| CONNECT-05 | 39-01, 39-03 | shipped |
| CONNECT-06 | 39-01 | shipped |
| CONNECT-07 | 39-05 | shipped |
| CONFIG-01 | 39-02 | shipped |
| CONFIG-02 | 39-01 | shipped |
| CONFIG-03 | 39-04 | shipped |
| CONFIG-04 | 39-02 | shipped |
| E2E-21 | 39-05 | shipped |
| E2E-22 | 39-05 | shipped |
| E2E-23 | 39-05 | shipped |
| E2E-24 | 39-05 | shipped |

**15/15 Phase 39 REQ-IDs shipped.**

## Self-Check: PASSED

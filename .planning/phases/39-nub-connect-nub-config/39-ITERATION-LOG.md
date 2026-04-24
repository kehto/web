# Phase 39 Iteration Log — NUB-CONNECT + NUB-CONFIG

**Phase:** 39-nub-connect-nub-config
**Baseline entering phase (v1.7 Phase 38 close):** 62 passed / 0 failed / 0 skipped
**Target at phase close (Plan 39-05):** 67 passed / 0 failed / 0 skipped (62 prior + 5 new)

---

## Plan 39-01 — ConnectStore Foundation + Config ACL

**Date:** 2026-04-24
**Scope:** CONNECT-01/02/06 (connectStore + audit-csp script + config:read ACL fix)
**Gate:** `pnpm type-check` + `pnpm build` + `pnpm audit:csp` clean. NOT a full E2E run.

### pnpm type-check + build

Both passed. turbo cache hits for non-modified packages.

### pnpm audit:csp

```
[audit:csp] OK — scanned 10 napplet dist/index.html file(s), no meta-CSP found
```

### Grep self-check

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "connectStore" packages/shell/src/index.ts` | >= 1 | 1 |
| `grep -c "revoke" packages/shell/src/connect-store.ts` | >= 1 | 2 (method + Map.delete) |
| `grep -c "config:read" packages/runtime/src/acl.ts` | >= 1 | 2 (CAP_MAP entry) |
| `test -f scripts/audit-csp.mjs` | exit 0 | EXISTS |

---

## Plan 39-02 — serveNappletCsp Vite Plugin (Phase 39 Plan 2)

**Date:** 2026-04-24
**Scope:** CONNECT-02/03 (serveNappletCsp Vite plugin, dev + preview CSP headers, POST /__connect-grants)
**Gate:** `pnpm audit:csp` CLEAN.

### pnpm audit:csp

```
[audit:csp] OK — scanned 10 napplet dist/index.html file(s), no meta-CSP found
```

### Grep self-check

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "configurePreviewServer" apps/demo/vite.config.ts` | 2 (dev + preview) | 2 |
| `grep -c "connect-src" apps/demo/vite.config.ts` | >= 2 | 3 |
| `grep -c "/__connect-grants" apps/demo/vite.config.ts` | >= 2 | 4 |
| `grep -c "GRANT_SYNC_ORIGIN_ALLOWLIST" apps/demo/vite.config.ts` | >= 1 | 3 |

---

## Plan 39-03 — CI CSP Audit Step

**Date:** 2026-04-24
**Scope:** D16 (pnpm audit:csp wired to GitHub Actions Build workflow)
**Gate:** `pnpm audit:csp` CLEAN + workflow file updated.

### pnpm audit:csp

```
[audit:csp] OK — scanned 10 napplet dist/index.html file(s), no meta-CSP found
```

### Grep self-check

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "audit:csp" .github/workflows/build.yml` | >= 1 | 2 |
| `grep -c "pnpm audit:csp" .github/workflows/build.yml` | 1 | 1 |

---

## Plan 39-04 — Consent Modal + Config Service + Test Hooks

**Date:** 2026-04-24
**Scope:** CONNECT-04/05/07 (consent modal, iframe destroy+recreate, syncGrantsToVite), CONFIG-01/02/03 (createConfigService, config-demo napplet, NUB-CONFIG wiring), D11 (__publishConfigValues__), M-04 (dismiss=deny)
**Gate:** `pnpm build` + `pnpm audit:csp` CLEAN + `pnpm type-check` CLEAN.

### pnpm type-check + build

Both passed. 11th napplet (config-demo) scaffolded and wired.

### pnpm audit:csp

```
[audit:csp] OK — scanned 11 napplet dist/index.html file(s), no meta-CSP found
```

### Grep self-check

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "ConsentModal\|createConsentModal" apps/demo/src/consent-modal.ts` | >= 2 | 3 |
| `grep -c "resolve(true)" apps/demo/src/consent-modal.ts` | 0 (M-04: no implicit allow) | 0 |
| `grep -c "shell:connect-revoked" apps/demo/src/main.ts` | >= 1 | 4 |
| `grep -c "createConfigService" apps/demo/src/shell-host.ts` | >= 1 | 2 |
| `grep -c "__publishConfigValues__" apps/demo/src/main.ts` | >= 1 | 2 |
| `grep -c "config-demo" apps/demo/src/shell-host.ts` | >= 1 | 2 (DEMO_NAPPLETS + frameContainerId) |
| `test -f apps/demo/napplets/config-demo/dist/index.html` | exit 0 | EXISTS |

---

## Plan 39-05 — SHELL-CONNECT-POLICY + E2E specs + Phase Close

**Date:** 2026-04-24
**Scope:** CONNECT-07 (policy doc), E2E-21..24 (4 new specs), Phase 39 canonical close

### Canonical iteration loop

```
cd /home/sandwich/Develop/kehto
rm -rf node_modules packages/*/dist packages/*/node_modules \
       apps/demo/dist apps/demo/node_modules \
       apps/demo/napplets/*/dist apps/demo/napplets/*/node_modules \
       tests/e2e/harness/dist tests/e2e/harness/node_modules \
       .turbo packages/*/.turbo apps/demo/.turbo apps/demo/napplets/*/.turbo
pnpm install
pnpm build
pnpm audit:csp
pnpm test:e2e
```

### pnpm install

```
Done in 820ms using pnpm v10.8.0
```

### pnpm build

```
 Tasks:    25 successful, 25 total
Cached:    0 cached, 25 total
  Time:    6.518s
```

### pnpm audit:csp

```
[audit:csp] OK — scanned 11 napplet dist/index.html file(s), no meta-CSP found
```

### pnpm test:e2e

Final Playwright summary: **67 passed (24.9s)**

All 5 new tests PASSED:
- NUB-CONNECT consent flow (E2E-21): approve flow — __grantConnectOrigin__ records the grant and localStorage reflects it
- NUB-CONNECT consent flow (E2E-21): dismiss = deny — without any grant, CSP header is connect-src none and connectStore has no chat entry
- NUB-CONNECT revocation (E2E-22 / CONNECT-04): revoke triggers iframe destroy+recreate and connectStore clears the grant
- NUB-CONNECT preview-mode CSP (E2E-23 / C-05): preview server emits connect-src none on /napplets/<dTag>/index.html
- NUB-CONFIG round-trip (E2E-24 / CONFIG-03): config.subscribe receives initial snapshot and subsequent publishValues push

All 62 prior tests still PASSED. Zero regressions.

### Grep self-check

| Check | Expected | Actual |
|-------|----------|--------|
| `test -f docs/policies/SHELL-CONNECT-POLICY.md` | exit 0 | EXISTS |
| `grep -c "CONNECT-07" docs/policies/SHELL-CONNECT-POLICY.md` | >= 1 | 1 |
| `grep -c "Production Deployment Gap" docs/policies/SHELL-CONNECT-POLICY.md` | >= 1 | 1 |
| `test -f tests/e2e/connect-consent.spec.ts` | exit 0 | EXISTS |
| `test -f tests/e2e/connect-revocation.spec.ts` | exit 0 | EXISTS |
| `test -f tests/e2e/connect-csp-preview.spec.ts` | exit 0 | EXISTS |
| `test -f tests/e2e/nub-config.spec.ts` | exit 0 | EXISTS |
| `grep -c "E2E-21" tests/e2e/connect-consent.spec.ts` | >= 1 | 2 |
| `grep -c "E2E-22" tests/e2e/connect-revocation.spec.ts` | >= 1 | 2 |
| `grep -c "E2E-23" tests/e2e/connect-csp-preview.spec.ts` | >= 1 | 2 |
| `grep -c "E2E-24" tests/e2e/nub-config.spec.ts` | >= 1 | 2 |
| `grep -c "resolve(true)" apps/demo/src/consent-modal.ts` | 0 (M-04) | 0 |
| `grep -c "configurePreviewServer" apps/demo/vite.config.ts` | 2 (C-05) | 2 |
| `grep -c "registerNub.*config" packages/runtime/src/runtime.ts` | >= 1 (CONFIG-03) | 1 |
| Final Playwright summary | `67 passed / 0 failed / 0 skipped` | **67 passed (24.9s)** |

### Deviation record

#### Dev 1 — [Rule 1 - Bug] Missing config NUB domain dispatch in runtime.ts

- **Found during:** Plan 39-05 E2E run 1
- **Issue:** `createConfigService` was registered in `serviceRegistry` but `nubDispatch.registerNub('config', ...)` was never called. All `config.*` NUB messages were silently dropped, causing E2E-24 to fail with `#config-demo-values` staying at "(no values yet)".
- **Fix:** Added `handleConfigMessage()` function (mirrors `handleThemeMessage` pattern) and registered `configAdapter` via `nubDispatch.registerNub('config', configAdapter)` in `packages/runtime/src/runtime.ts`.
- **Commit:** fb81401

#### Dev 2 — [Rule 1 - Bug] Infinite loop in shell:connect-revoked listener

- **Found during:** Plan 39-05 E2E run 3 (diagnosis)
- **Issue:** `for (const [windowId, info] of napps.entries())` iterated a live Map iterator. `loadNapplet()` added a new chat entry to the same Map during iteration, causing the iterator to visit the new entry and call `loadNapplet` again — an infinite destroy+recreate loop. `page.evaluate(__revokeConnect__)` hung indefinitely, burning the 90s test timeout.
- **Fix:** Snapshot entries before mutation: `const toRevoke = [...napps.entries()].filter(([, info]) => info.name === detail.dTag)` in `apps/demo/src/main.ts`.
- **Commit:** c764e7d

#### Dev 3 — [Rule 1 - Bug] E2E spec corrections

- **Found during:** Plan 39-05 E2E run 1 and run 2
- **Issue 1:** `shell-ui-state-surfaces.spec.ts` expected 10 rows / polled 10 status IDs — config-demo is the 11th napplet added in Plan 39-04.
- **Issue 2:** `nub-config.spec.ts` clicked `#config-demo-update-btn` (hidden via `display:none`). Plan 39-04 documentation specifies E2E uses `__publishConfigValues__` test hook instead.
- **Issue 3:** `connect-consent.spec.ts` dismiss=deny test received `connect-src wss://relay.damus.io` instead of `'none'` — Vite in-memory grants bleed from the approve test running in parallel (same server, same chat dTag). Fixed by adding Vite state reset in `beforeEach`.
- **Fix:** Updated all 4 specs accordingly. Added `AbortSignal.timeout(3000)` to Vite reset fetches, `test.describe.configure({ mode: 'serial' })`, and `waitUntil: 'domcontentloaded'` for faster page.goto in revocation spec.
- **Commit:** 80ccc90

### Anti-term sweep

```
grep -rE "window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]" apps/demo/napplets/ \
    | grep -v "node_modules|dist" | grep -v "^\s*\*" | grep -v "^[^:]*:\s*\*"
```
Result: CLEAN (zero hits outside comments)

```
grep -rn "resolve(true)" apps/demo/src/consent-modal.ts
```
Result: CLEAN (zero hits — M-04 anti-feature absent)

```
grep -rn "http-equiv.*Content-Security-Policy" apps/demo/napplets/*/dist/*.html
```
Result: CLEAN (zero hits — C-03 anti-feature absent)

```
grep -c "configurePreviewServer" apps/demo/vite.config.ts
```
Result: 2 (C-05 coverage confirmed — dev + preview modes)

### Diff from v1.7 Phase 38 close

- 1 new policy doc (`docs/policies/SHELL-CONNECT-POLICY.md`) — verbatim mirror of napplet canonical + kehto cross-refs
- 4 new E2E spec files: connect-consent.spec.ts, connect-revocation.spec.ts, connect-csp-preview.spec.ts, nub-config.spec.ts
- 5 new tests (E2E-21: 2 tests, E2E-22: 1 test, E2E-23: 1 test, E2E-24: 1 test)
- config NUB dispatch wired in `packages/runtime/src/runtime.ts` (handleConfigMessage + nubDispatch.registerNub)
- Infinite loop fix in `apps/demo/src/main.ts` (snapshot napplets Map before revoke loop)
- `shell-ui-state-surfaces.spec.ts` updated for 11th napplet (config-demo)
- README.md Policies section updated with SHELL-CONNECT-POLICY.md link
- Expected E2E count: 67 (62 prior + 5 new)
- Actual E2E count: 67

### Result

**PHASE 39 CLOSE CONFIRMED** — 67 passed / 0 failed / 0 skipped. Phase 40 (NUB-RESOURCE) is unblocked.

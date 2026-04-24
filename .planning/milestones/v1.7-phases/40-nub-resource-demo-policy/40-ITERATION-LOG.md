# Phase 40 Iteration Log — NUB-RESOURCE + Demo Napplets + Policy Docs

**Phase close date:** 2026-04-24
**Milestone:** v1.7 NIP-5D Spec Adoption & New NUB Domains
**Entering baseline:** 67 passed / 0 failed / 0 skipped (Phase 39 close)
**Expected close:** 71 passed / 0 failed / 0 skipped
**Actual close:** 71 passed / 0 failed / 0 skipped

## Canonical loop artifacts

| Step | Command | Result |
|------|---------|--------|
| 1 | `pnpm build` | 26 successful / 26 total (turborepo — all cached or rebuilt) |
| 2 | `pnpm test:e2e` | **71 passed / 0 failed / 0 skipped** (26.6s) |
| 3 | `pnpm audit:csp` | exit 0 — scanned 12 napplet dist/index.html files, no meta-CSP found |

Note: Project has no `pnpm clean` script. The build was run from current state (turbo cache is authoritative; modified source files trigger cache invalidation automatically). `pnpm build` re-ran affected packages.

## New tests this phase (+4 delta)

| Spec | Tests | Purpose |
|------|-------|---------|
| `nub-resource.spec.ts` | 2 | E2E-25 — granted (decoded JSON `"kehto demo"`) + denied (`code=denied`) |
| `class-invariant.spec.ts` | +2 (8 → 10 params) | E2E-20 completion — config + resource domain labels added |

## Artifact ledger

| Requirement | Artifact | Status |
|-------------|----------|--------|
| RESOURCE-01 | `packages/services/src/resource-service.ts` (createResourceService factory w/ H-03 guard) | ✅ |
| RESOURCE-02 | `packages/acl/src/capabilities.ts` + `resolve.ts` + `runtime.ts` registerNub('resource') | ✅ |
| RESOURCE-03 | `resource-service.ts` cancel correlation (in-flight Map + AbortController) | ✅ |
| RESOURCE-04 | `apps/demo/napplets/resource-demo` + DEMO_NAPPLETS[12] + CLASS_BY_DTAG[12] + main.ts auto-grant | ✅ |
| RESOURCE-05 | `docs/policies/SHELL-RESOURCE-POLICY.md` (canonical header + cross-refs) | ✅ |
| RESOURCE-06 | `@kehto/shell` barrel re-exports provisional-resource wire types | ✅ |
| E2E-25 | `tests/e2e/nub-resource.spec.ts` (2 tests, Layer-B) | ✅ |
| E2E-20 | `tests/e2e/class-invariant.spec.ts` (10 params — 8→10 extension; E2E-20 complete) | ✅ |
| DOCS-07 | `docs/policies/` contains all 3 policy files + README reference | ✅ |

## Anti-features held

- No meta-CSP in built napplet HTML (`pnpm audit:csp` exit 0, 12 napplets)
- No streaming / chunked response in `resource-service.ts`
- No POST body / upload surface
- No redirect / MIME / SVG / private-IP filtering in service (delegated to host fetch per `SHELL-RESOURCE-POLICY.md`)
- No createResourceService without getConnectGrants (H-03 guard verified at construction — tests (a)+(b) pass)
- No silent-drop of resource.* envelopes (`nubDispatch.registerNub('resource', ...)` explicit — Phase 39 Dev 1 lesson held)

## Deviations / incidents

**1. [Rule 1 - Bug] GRANTED_URL corrected from localhost:5174 → localhost:4174**
- **Found during:** Task 2 spec pre-verification run
- **Issue:** `apps/demo/napplets/resource-demo/src/main.ts` used `GRANTED_URL = 'http://localhost:5174/demo-data.json'`. Port 5174 is the napplet dev server (Vite napplet dev mode) — but `demo-data.json` lives in `apps/demo/public/` (served by the demo app at 4174). In preview mode (E2E), no server runs at 5174. Result: `code=network-error message=Failed to fetch`.
- **Fix:** Changed `GRANTED_URL` to `http://localhost:4174/demo-data.json`; updated auto-grant in `apps/demo/src/main.ts` from `http://localhost:5174` to `http://localhost:4174`; updated `SHELL-RESOURCE-POLICY.md` cross-ref accordingly.
- **Files modified:** `apps/demo/napplets/resource-demo/src/main.ts`, `apps/demo/src/main.ts`, `docs/policies/SHELL-RESOURCE-POLICY.md`
- **Commit:** `7584f05`

**2. [Rule 1 - Bug] shell-ui-state-surfaces ACL policy modal row count 11→12**
- **Found during:** Task 3 canonical loop first run (1 failure)
- **Issue:** `tests/e2e/shell-ui-state-surfaces.spec.ts` asserted `toHaveCount(11)` for ACL policy modal rows (comment said "config-demo is the 11th"). Wave 2 (Plan 40-02) added `resource-demo` as the 12th napplet without updating this assertion — introducing a regression.
- **Fix:** Updated assertion to `toHaveCount(12)` with updated comment "resource-demo is the 12th — Phase 40".
- **Files modified:** `tests/e2e/shell-ui-state-surfaces.spec.ts`
- **Commit:** `ccd8d78`

**3. Canonical source available** — `https://raw.githubusercontent.com/napplet/napplet/main/specs/SHELL-RESOURCE-POLICY.md` returned HTTP 200 at copy time (SHA 27e1624). Policy file is a verbatim mirror + kehto cross-ref appendix. No placeholder required.

## Close decision

✅ Phase 40 closes at **71/0/0**. v1.7 milestone close check:
- Phase 41 (Polish Wave) unblocked — nip66 + wm + CACHE are independent.
- Phase 42 (NIP-44 Decrypt, soft-gated) — evaluate at Phase 41 close.
- E2E-20 checkbox flips to checked (10/10 NUB domains covered in class-invariant.spec.ts).
- DOCS-07 checkbox flips to checked (docs/policies/ has all 3 policy files + README reference).

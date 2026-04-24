---
phase: 39-nub-connect-nub-config
plan: "03"
subsystem: infra, demo, ci
tags: [vite-plugin, csp, connect-src, github-actions, CONNECT-02, NUB-CONNECT, D1, D2, D3, D4, D16]

requires:
  - phase: 39-nub-connect-nub-config
    plan: "01"
    provides: connectStore singleton (grant/revoke/getOrigins), connectGrantKey helper, pnpm audit:csp script

provides:
  - serveNappletCsp() Vite plugin in apps/demo/vite.config.ts with in-memory grants Map + configureServer + configurePreviewServer hooks
  - POST /__connect-grants endpoint (origin-allowlisted D3, body-validated, 204/400/403 responses)
  - CSP header injection on /napplets/<dTag>/index.html: connect-src <sorted-origins> or connect-src 'none' (D4)
  - GitHub Actions Build workflow step running pnpm audit:csp after build (D16)

affects:
  - 39-04 (shell-side connectStore.grant() -> POST /__connect-grants wiring)
  - 39-05 (connect-csp-preview.spec.ts exercises CSP header in preview mode; connect-revocation.spec.ts exercises revoke + iframe recreate)

tech-stack:
  added: []
  patterns:
    - Vite plugin pair pattern -- serveNappletCsp registers BEFORE serveDemoNapplets so CSP headers are set before file stream starts
    - Volatile in-memory Map<string, readonly string[]> keyed '<dTag>:<aggregateHash>' (D2) -- no file persistence, cleared on dev-server restart
    - D3 origin allowlist -- POST /__connect-grants validates Origin header against localhost:5174/4174 and 127.0.0.1:5174/4174
    - D4 strict default -- connect-src 'none' emitted when grants Map has no entries for requested dTag
    - Origins deterministically sorted (Array.sort()) for idempotent CSP header values in test assertions
    - CI gate pattern -- audit step inserted between build and type-check in GitHub Actions workflow

key-files:
  created: []
  modified:
    - apps/demo/vite.config.ts
    - .github/workflows/build.yml

key-decisions:
  - "127.0.0.1 forms included in GRANT_SYNC_ORIGIN_ALLOWLIST alongside localhost forms for defensive parity (tests may use 127.0.0.1)"
  - "CSP header applied only to index.html document responses (parts.length <= 2, last part == '' or 'index.html'); subresources pass through without CSP injection"
  - "Revoke path: empty origins array -> grants.delete(key), which causes next /napplets/<dTag>/index.html request to get connect-src 'none'"
  - "Plugin registered BEFORE serveDemoNapplets() in plugins array -- Vite registers middleware in plugin-array order"

patterns-established:
  - "serveNappletCsp pattern: configureServer + configurePreviewServer both wire identical middleware (C-05 prevention -- preview-mode CSP is explicit)"
  - "Grant key: '<dTag>:<aggregateHash>' mirrors connectGrantKey from packages/shell/src/connect-store.ts"

requirements-completed:
  - CONNECT-02

duration: 2min
completed: "2026-04-24"
---

# Phase 39 Plan 03: serveNappletCsp Vite Plugin + CI Audit Step Summary

**Vite CSP plugin giving the shell HTTP-header authority for per-napplet connect-src (dev + preview), with POST /__connect-grants endpoint and GitHub Actions audit:csp gate**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-24T14:36:15Z
- **Completed:** 2026-04-24T14:38:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `serveNappletCsp()` Vite plugin implemented in `apps/demo/vite.config.ts` with both `configureServer` (dev, port 5174) and `configurePreviewServer` (preview, port 4174) hooks wired (C-05 prevention)
- Volatile in-memory `Map<string, readonly string[]>` holds grant state keyed `'<dTag>:<aggregateHash>'` (D2) — cleared on dev-server restart, no file persistence
- `POST /__connect-grants` endpoint validates Origin header against D3 allowlist (`localhost:5174/4174`, `127.0.0.1:5174/4174`); returns 403 on mismatch, 400 on malformed JSON, 204 on success; empty origins array triggers `grants.delete(key)` (revoke path)
- CSP middleware sets `Content-Security-Policy: connect-src <sorted-origins>` on `/napplets/<dTag>/index.html` responses before `serveDemoNapplets()` streams the file; D4 strict default `connect-src 'none'` when no grants exist
- Plugin registered BEFORE `serveDemoNapplets()` in the plugins array so middleware order is correct
- `.github/workflows/build.yml` extended with new step `Audit CSP (residual meta-CSP scan)` running `pnpm audit:csp` after build and before type-check (D16)

## Task Commits

1. **Task 1: Implement serveNappletCsp Vite plugin** - `87fe17f` (feat)
2. **Task 2: Wire pnpm audit:csp into GitHub Actions Build workflow** - `a3b9aeb` (chore)

## Files Created/Modified

- `apps/demo/vite.config.ts` — added: `serveNappletCsp()` plugin (~150 lines) with volatile grants Map, POST `/__connect-grants` endpoint, CSP header middleware; registered before `serveDemoNapplets()` in plugins array
- `.github/workflows/build.yml` — added: `Audit CSP (residual meta-CSP scan)` step running `pnpm audit:csp` between build and type-check

## Decisions Made

- Included `127.0.0.1` forms in `GRANT_SYNC_ORIGIN_ALLOWLIST` alongside `localhost` forms for defensive parity — E2E tests may use 127.0.0.1 rather than localhost
- CSP header applied ONLY to index.html document responses (path depth 1 or `<dTag>/index.html`); subresources (`.js`, `.css`) pass through without CSP injection — only the document response needs the header; subresources inherit from the iframe's policy
- Plugin registered before `serveDemoNapplets()` in plugins array — Vite registers Connect middleware in plugin-array order, so CSP header is set before file stream starts

## Deviations from Plan

None - plan executed exactly as written.

## Grep Self-Check Results

```
grep -c "serveNappletCsp" apps/demo/vite.config.ts → 3 (function def + plugins array call + makeCspMiddleware call) ✓
grep -c "configurePreviewServer" apps/demo/vite.config.ts → 2 (serveDemoNapplets + serveNappletCsp) ✓
grep -c "__connect-grants" apps/demo/vite.config.ts → 7 (configureServer x1 + configurePreviewServer x1 + comment refs) ✓
grep -c "connect-src 'none'" apps/demo/vite.config.ts → 1 (D4 constant CSP_NO_GRANTS) ✓
grep -q "audit:csp" .github/workflows/build.yml → PASS ✓
YAML parse → PASS ✓
Step ordering (build < csp < type-check at lines 34/42/44) → PASS ✓
pnpm audit:csp → OK -- scanned 10 napplet dist/index.html file(s), no meta-CSP found ✓
```

## pnpm audit:csp Output

```
[audit:csp] OK -- scanned 10 napplet dist/index.html file(s), no meta-CSP found
```

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **39-04 (consent flow + iframe destroy/recreate)**: The `POST /__connect-grants` endpoint is live and origin-allowlisted. Shell-side `connectStore.grant()` and `connectStore.revoke()` (from Plan 39-01) need to HTTP POST to `/__connect-grants` to sync state into the Vite middleware. Plan 39-04 wires this plus the consent dialog modal and iframe destroy+recreate on revocation.
- **39-05 (E2E specs)**: `connect-csp-preview.spec.ts` can assert that a GET against `/napplets/<dTag>/index.html` on the preview server (`:4174`) returns `Content-Security-Policy: connect-src 'none'` when no grants are seeded. The `configurePreviewServer` hook is wired. `connect-revocation.spec.ts` can assert that after revoke + iframe recreate, the CSP header no longer includes the revoked origin.

---
*Phase: 39-nub-connect-nub-config*
*Completed: 2026-04-24*

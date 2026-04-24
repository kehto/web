# Phase 40: NUB-RESOURCE Reference Service + Demo Napplets + Policy Docs - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Mode:** Smart discuss (grey-area batch — all 8 recommendations accepted by user)

<domain>
## Phase Boundary

Shell acts as an authenticated fetch proxy for the 10th NUB domain (resource); `resource-demo` napplet is live in the demo (DEMO_NAPPLETS 11 → 12 — `config-demo` already added in Phase 39); all three policy docs (class + connect + resource) are collected under `docs/policies/`; the Phase 38 `class-invariant.spec.ts` is extended with 2 more tests (config + resource) to reach 10/10 domains, completing E2E-20.

Phase 40 depends on Phase 39's `connectStore` grants store (RESOURCE-01's required `getConnectGrants` factory dep) — the H-03 coupling prevention is enforced by the factory throwing on construction if the grants source is missing.

</domain>

<decisions>
## Implementation Decisions

### Grey Area 1: resource-demo napplet behavior
- **D1**: resource-demo fetches a **small JSON payload from demo-local origin** `http://localhost:5174/demo-data.json` — Vite serves `apps/demo/public/demo-data.json` as a static file. Deterministic; no external network.
- **D2**: UI displays **two panels** — "Granted fetch" showing decoded JSON under `#resource-demo-granted` + "Denied fetch" showing canonical error code + message under `#resource-demo-denied`. Both panels populate on demo boot.
- **D3**: Demo grant fixture: **shell auto-grants `http://localhost:5174` for `resource-demo`** at demo boot via `__grantConnectOrigin__('resource-demo', 'http://localhost:5174')` inside `createDemoHooks()`. Deterministic; no consent click-through required for E2E.
- **D4**: Denied-origin target: **`https://untrusted.example`** (RFC-2606 reserved domain — guaranteed not to resolve; no accidental real network).

### Grey Area 2: Host `fetch` implementation in demo
- **D5**: Demo's host `fetch` = **native browser `fetch()` wrapped in `AbortController`** with 10-second timeout. Minimal deps; real HTTP semantics. Errors map to canonical NUB-RESOURCE error codes (`timeout`, `network`, `not-found`, etc.).
- **D6**: Response body encoding = **base64** via `btoa(String.fromCharCode(...new Uint8Array(buffer)))` for browser compatibility. Matches canonical `bodyBase64` field in `provisional-resource.ts`.
- **D7**: Redirect / MIME sniffing / SVG rasterization / private-IP blocking = **not implemented in demo; documented in `SHELL-RESOURCE-POLICY.md` as host-app responsibility**. Demo is reference; production hardening is host-app concern.
- **D8**: Demo-local JSON fixture = **static file `apps/demo/public/demo-data.json`** with 3-4 sample keys (e.g., `{ "name": "kehto demo", "version": "1.7", "items": [1,2,3] }`). Vite serves `public/` by default — no plugin changes needed.

### Claude's Discretion
- Exact field names / values in `demo-data.json` (pick something obviously demo-like)
- `resource-demo` CSS styling (panels layout) — follow existing demo napplet conventions
- Error-code surface mapping: if `fetch()` throws `TypeError` (network error), canonical code is `'network'`; if `AbortError`, code is `'timeout'`; `429` status → `'rate-limit'`; etc. — Claude decides based on canonical NUB-RESOURCE error taxonomy (see provisional-resource.ts)
- `__resourceFetchBypass__` test hook (optional) — if needed for deterministic E2E without real network — Claude decides whether it's necessary or if Vite static-serve is enough

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 39 deliverables)
- `packages/shell/src/connect-store.ts` — grants source for `getConnectGrants`
- `packages/shell/src/shell-bridge.ts` — `ShellBridge.connectStore` readonly surface
- `apps/demo/vite.config.ts` — `serveNappletCsp` plugin; grants already synced to this plugin (resource-demo CSP header will include `http://localhost:5174` after grant fixture applies)
- `apps/demo/src/main.ts` — `__grantConnectOrigin__` test hook (D3 calls this at demo boot)
- `docs/policies/SHELL-CLASS-POLICY.md` (Phase 38)
- `docs/policies/SHELL-CONNECT-POLICY.md` (Phase 39)

### Reusable Assets (pre-Phase 40)
- `packages/services/src/config-service.ts` — 379-line Phase 39 factory pattern to mirror
- `packages/shell/src/types/provisional-resource.ts` — 4-message protocol types ready
- `apps/demo/napplets/config-demo/` — 11th napplet structure to mirror for resource-demo

### Established Patterns
- Data-driven DEMO_NAPPLETS + CLASS_BY_DTAG module-load assertion (enforced by Phase 38)
- Options-as-bridge pattern (v1.6 Decision 18) — `createResourceService({ fetch, isOriginGranted, getConnectGrants })`
- Base64 wire encoding — must work in browser (no Node Buffer in napplet context)
- `capabilities.ts` add `'resource:fetch'`; `resolve.ts` extend switch; `runtime.ts` `registerService` + `nubDispatch.registerNub('resource', ...)` — CRITICAL per Phase 39's Dev 1 fix (forgetting nubDispatch registration silently drops all envelopes)

### Integration Points
- `createResourceService` factory REQUIRES `getConnectGrants` option from day one — factory throws at construction if missing (H-03 prevention)
- resource-demo napplet auto-granted at demo boot (D3) — no user click-through for E2E determinism
- `resource.cancel` correlates to in-flight `resource.bytes` via `requestId`
- SHELL-RESOURCE-POLICY.md copied from canonical napplet repo (same pattern as Phases 38-39)
- E2E-20 extension: `class-invariant.spec.ts` gains 2 new parameterized tests (config + resource) — Phase 38 Blocker 3 resolution

</code_context>

<specifics>
## Specific Ideas

- `resource-demo` napplet uses `@napplet/sdk` like `config-demo` (Phase 39 precedent). Issues `resource.bytes` on init; populates DOM sentinels based on response.
- Canonical error codes (from NUB-RESOURCE spec): `denied` (not granted), `timeout`, `network`, `not-found`, `canceled`, `forbidden`, `rate-limit`, `oversize`.
- The `createDemoHooks()` update: add a line calling the grant helper BEFORE iframe loads, e.g., `connectStore.grant({ dTag: 'resource-demo', aggregateHash: '' }, ['http://localhost:5174'])` and POST to `/__connect-grants` (via the sync endpoint added in Phase 39).
- E2E-25: `tests/e2e/nub-resource.spec.ts` — (a) granted-fetch success asserts `#resource-demo-granted` populated with decoded JSON; (b) denied-origin asserts `#resource-demo-denied` shows canonical error code.
- DOCS-07 verification: `docs/policies/` directory contains exactly 3 markdown files (CLASS, CONNECT, RESOURCE); root README Policies section references the directory.

</specifics>

<deferred>
## Deferred Ideas

- Production-grade `fetch` implementation with redirect limits, MIME sniffing, SVG rasterization, private-IP blocking — host-app concern (kehto doesn't ship)
- Resource streaming (chunked response) — canonical NUB-RESOURCE is atomic fetch-then-result; no streaming in v1.7
- Response caching / conditional requests (ETag, If-Modified-Since) — out of scope; shell passes through semantically transparent
- Upload / POST body support — canonical NUB-RESOURCE v1.7 is read-only fetch; no upload surface

</deferred>

---

*Phase: 40-nub-resource-demo-policy*
*Context gathered: 2026-04-24 via smart-discuss (8 decisions accepted wholesale)*

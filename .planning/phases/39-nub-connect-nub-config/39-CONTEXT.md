# Phase 39: NUB-CONNECT Adoption + NUB-CONFIG Reference Service - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Mode:** Smart discuss (grey-area batch — all 16 recommendations accepted by user)

<domain>
## Phase Boundary

Shell becomes the HTTP-header authority for napplet CSP (`connect-src`), a consent flow gates origin grants with dismiss=deny/timeout=deny semantics, grant revocation triggers iframe destroy+recreate, and the 9th NUB domain (config) ships live as a reference service — so napplets can only connect to origins they've been granted and can read shell-owned configuration.

Phase 39 merges NUB-CONNECT (7 REQs + 4 E2E specs) with NUB-CONFIG (4 REQs) because CONFIG has no blocker after Phase 38 and shares the same E2E iteration loop with CONNECT. NUB-RESOURCE (Phase 40) hard-depends on CONNECT-01's grants store.

</domain>

<decisions>
## Implementation Decisions

### Grey Area 1: Grants-to-middleware data flow
- **D1**: Sync mechanism = **Vite dev-only HTTP endpoint**. Vite plugin (`serveNappletCsp`) exposes `POST /__connect-grants` receiving a JSON body `{ dTag, aggregateHash, origins: string[] }`. Shell calls this endpoint inside `connectStore.grant()` and `connectStore.revoke()`. Plugin holds the state in an in-memory `Map<string, readonly string[]>` keyed by `"<dTag>:<aggregateHash>"`.
- **D2**: Plugin-map persistence = **volatile** (in-memory only; cleared on dev-server restart).
- **D3**: Endpoint protection = **origin allowlist** — plugin validates the POST's `Origin` header against the Vite server's own base URL (`localhost:4174`, `localhost:5174`). Rejects all others with 403.
- **D4**: CSP when no grants exist = **`connect-src 'none'`** (strict default). Exercised by the E2E preview-mode spec.

### Grey Area 2: Consent UI
- **D5**: Consent dialog = **custom shell DOM modal** (plain HTML+CSS, no framework). Reuses existing `ConsentHandler` registration pattern from v1.1.
- **D6**: Positioning = **fixed center overlay**, `z-index: 10000`, above iframe sandbox layer.
- **D7**: Timeout = **60 seconds** → resolves to `deny`. Timer starts when modal mounts; cleared on approve/deny/dismiss.
- **D8**: UI shows **full verbatim origin list**. Any non-`https://` / non-`wss://` origin triggers a visible cleartext warning row.

### Grey Area 3: NUB-CONFIG demo napplet
- **D9**: `config-demo` napplet renders a **config display panel** showing current values; live-updates via `config.watch`.
- **D10**: Schema source = **inline JSON Schema fixture** at `apps/demo/napplets/config-demo/config-schema.json` with 3–4 fields (e.g., `theme`, `density`, `notifications-enabled`, `recentSearches`). Simple; exercises watch mechanic.
- **D11**: Shell-side config values source = **hardcoded fixture in `createDemoHooks()`** + a shell UI button that writes new values and triggers the config.watch push.
- **D12**: Schema validation = **`ajv@8` if already in workspace; otherwise hand-coded validator** for the 3-4 fields. Keep deps minimal.

### Grey Area 4: CI meta-CSP audit script
- **D13**: Implementation = **Node script `scripts/audit-csp.mjs`** wired via `pnpm audit:csp` in root `package.json`.
- **D14**: Scan scope = **`apps/demo/napplets/*/dist/index.html`** recursively (napplet build outputs only).
- **D15**: Whitelist = **none**. ANY `<meta http-equiv="Content-Security-Policy">` fails build (NUB-CONNECT: shell is sole CSP authority).
- **D16**: CI wiring = **GitHub Actions Build workflow step** immediately after `pnpm build`; local dev: `pnpm audit:csp` runs manually.

### Claude's Discretion
- Exact JSON shape of the `/__connect-grants` endpoint body — use whatever composes cleanly with the `ConnectGrant` shape in `provisional-connect.ts`.
- Modal DOM classes + inline styles vs a new `.css` file — Claude decides based on existing shell chrome conventions.
- Button label / placement for the shell-side config-update trigger (demo ergonomics).
- Exact test napplet fixture structure under `apps/demo/napplets/config-demo/`.
- `ajv` detection: if the workspace doesn't have it, implement a ~30-line hand validator rather than adding a new dep.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/demo/vite.config.ts:43-53` — existing `serveDemoNapplets` plugin with both `configureServer` + `configurePreviewServer` hooks. New `serveNappletCsp` plugin mirrors this shape.
- `packages/shell/src/types/provisional-connect.ts` — `ConnectGrant`, `ConnectConsentRequest`, `ConsentResult`, `ConnectGrantKey` already defined (Phase 37)
- `packages/shell/src/acl-store.ts` — singleton pattern to mirror for `connect-store.ts`
- `packages/shell/src/shell-bridge.ts:98-111,253-255` — `registerConsentHandler(handler: ConsentHandler)` existing pattern
- `packages/runtime/src/types.ts:356` — `ConsentHandler = (request: ConsentRequest) => void` type
- `packages/services/src/cache-service.ts` — existing `createXxxService` factory pattern with options-as-bridge (v1.6 Decision 18) for CONFIG-01 to mirror
- `@napplet/nub/config` — published at `^0.2.1`, import directly (no provisional file needed)

### Established Patterns
- **Data-driven demo UI (v1.5 D16)** — `DEMO_NAPPLETS` grows 10 → 11 with `config-demo` entry; `CLASS_BY_DTAG` gets a corresponding null entry (keep permissive)
- **Module-load assertion** — existing in `shell-host.ts` for `CLASS_BY_DTAG`; may extend to CSP defaults
- **Anti-term discipline** — grep passes must show zero leaks
- **`pnpm audit:csp`** — new script following `pnpm build`/`pnpm test:e2e` naming

### Integration Points
- Demo `main.ts` registers consent handler via `bridge.registerConsentHandler(...)` for the NUB-CONNECT flow (new handler, distinct from existing signing-consent handlers)
- `connect-store.ts` exposed via `ShellBridge.connectStore` — new public surface (changeset: minor bump for `@kehto/shell`)
- `runtime.ts` wires `createConfigService()` via `runtime.registerService('config', ...)` — follows existing 8-domain registration pattern
- `capabilities.ts` adds `'config:read'`; `resolve.ts` extends switch

### Test Hooks (v1.4 pattern)
- `window.__grantConnectOrigin__(dTag, origin)` — bypass consent UI for E2E; assigns grant directly
- `window.__revokeConnect__(dTag, origin)` — bypass revocation UI for E2E
- Consent modal is user-facing for real UX; test hook is for automated testing only

</code_context>

<specifics>
## Specific Ideas

- `connect-store.ts` singleton persists via the shell storage proxy (same mechanism as `acl-store.ts`) under localStorage key `'napplet:connect'`. Map shape: `Record<string, { origins: string[]; grantedAt: number }>`.
- Revocation path: shell emits a synthetic `shell.revokeConnect(dTag)` event → the orchestrating code in `main.ts` destroys the iframe and recreates it (iframe src unchanged; but the Vite middleware now serves a CSP header without the revoked origin).
- CSP header format: `Content-Security-Policy: connect-src <space-separated-origins>` — origins sorted deterministically for idempotent tests.
- Residual meta-CSP fail message format (for clear CI output): `audit:csp FAILED — meta-CSP tag found in apps/demo/napplets/<name>/dist/index.html (line N). Remove it — shell is CSP authority.`
- `config-demo` napplet exercises `config.get` (one-shot read) + `config.watch` (stream). Spec asserts: (1) initial values propagate, (2) shell-side update triggers a watch push, (3) values visible in `#config-demo-values` DOM sentinel.

</specifics>

<deferred>
## Deferred Ideas

- Production reverse-proxy reference impl (Express/Fastify/Cloudflare Worker) — documented in SHELL-CONNECT-POLICY.md as host-app responsibility; kehto does not ship
- Per-origin consent scopes (read-only vs read-write) — canonical NUB-CONNECT treats origins atomically; no intra-origin granularity in v1.7
- Grant expiry (time-based) — out of scope; grants persist until explicit revoke or hash upgrade
- `config.set` wire message — anti-feature; NUB-CONFIG is shell-writes, napplet-reads only (D9)
- Consent UI for production host-apps (non-demo) — kehto demo is the reference impl; host-apps provide their own UX

</deferred>

---

*Phase: 39-nub-connect-nub-config*
*Context gathered: 2026-04-24 via smart-discuss (16 decisions accepted wholesale)*

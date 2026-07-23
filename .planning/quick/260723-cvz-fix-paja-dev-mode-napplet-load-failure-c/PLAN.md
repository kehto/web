---
quick_id: 260723-cvz
slug: fix-paja-dev-mode-napplet-load-failure-c
date: 2026-07-23
branch: fix/paja-dev-cors-diagnostic
---

# Quick: Paja dev-mode opaque-origin CORS failure

## Problem (reproduced)

In `iframe-url` (dev) mode Paja loads the napplet's `index.html` into a
`srcdoc` iframe sandboxed **without** `allow-same-origin`
(`packages/paja/src/browser-host.ts:249-250`,
`packages/paja/src/browser-runtime-tabs.ts:416-417`). The document therefore has
an opaque origin and sends `Origin: null` on subresource fetches.

`<script type="module">` is always fetched in CORS mode. Vite 6's default
`server.cors` allowlist matches only `localhost` / `127.0.0.1` / `[::1]`
origins, so `Origin: null` gets no `Access-Control-Allow-Origin` and every
module script in the napplet is blocked. The iframe renders blank with only a
console CORS error — Paja itself reports no problem.

Verified against Vite 6.4.2:

```
curl -D- -H 'Origin: null'                    http://127.0.0.1:5173/src/main.js  → no ACAO
curl -D- -H 'Origin: http://127.0.0.1:5198'   http://127.0.0.1:5173/src/main.js  → ACAO echoed
```

Adding `server: { cors: { origin: '*' } }` to the napplet's Vite config makes
the napplet boot and HMR connect.

The `<base href>` injection is correct and is *not* the cause — asset URLs
resolve to the target dev server's port, they are simply blocked.

## Scope

1. **Document the requirement** — napplet dev servers must allow `Origin: null`.
   `packages/paja/README.md`, `docs/packages/paja.md`,
   `docs/how-tos/paja-local-authoring.md`, `docs/how-tos/paja-getting-started.md`.

2. **Diagnose it automatically** — Paja probes the target dev server with an
   explicit `Origin: null` request and surfaces an actionable error in the host
   page message log + console instead of a silent blank iframe.

Out of scope (deferred): proxying target assets through Paja's own origin so
nothing is cross-origin. That removes the requirement entirely but needs HMR
websocket proxying.

## Tasks

- [ ] `packages/paja/src/target-cors.ts` — pure `classifyTargetCors()` +
      `probeTargetCors()` (injectable fetch for tests).
- [ ] `packages/paja/src/server.ts` — serve `/__kehto/target-cors.json`.
- [ ] `packages/paja/src/browser-host.ts` — call the probe after navigation in
      `iframe-url` mode; log `paja.target.cors.error` + `console.warn` the fix.
- [ ] `packages/paja/src/target-cors.test.ts` + `server.test.ts` coverage.
- [ ] Docs (4 files above).
- [ ] Changeset (patch, `@kehto/paja`).

## Verification

`pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm docs:check`, AI-slop
gate, plus a manual browser re-run of the original repro (blocked → warning
appears; allowed → no warning, napplet boots).

## NAP conformance

No NAP/NIP-5D surface changes. The sandbox flags, `srcdoc` provenance, injected
namespace prelude, and wire messages are untouched; this adds a Paja-local dev
diagnostic and documentation only.

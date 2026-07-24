---
quick_id: 260723-cvz
slug: fix-paja-dev-mode-napplet-load-failure-c
date: 2026-07-23
status: complete
branch: fix/paja-dev-cors-diagnostic
commits:
  - 0af445b fix(paja): diagnose dev servers that block the sandboxed napplet frame
  - f705ecc docs(paja): document the dev-server Origin: null requirement
  - 19e532a chore(changeset): patch @kehto/paja for target CORS diagnostic
---

# Summary

Napplets served by a local dev server failed to load in Paja: the frame stayed
blank and only the browser console showed why.

## Root cause

The dev iframe is sandboxed without `allow-same-origin`, so the napplet document
has an opaque origin and requests its own assets with `Origin: null`.
`<script type="module">` is always fetched in CORS mode, and Vite 6's default
`server.cors` allowlist matches only `localhost` / `127.0.0.1` / `[::1]` — so the
entry module was blocked.

The `<base href>` injection was never at fault; asset URLs resolved to the
correct dev-server port and were rejected there, not misrouted to Paja's port.
The only request that does hit Paja's port is `/favicon.ico`, which its
catch-all 404s — easy to mistake for the failing asset.

## Delivered

- `packages/paja/src/target-cors.ts` — `classifyTargetCors()` (pure) and
  `probeTargetCors()` (injectable fetch), exported from the package index.
- `GET /__kehto/target-cors.json` in `server.ts`. The probe runs server-side
  because a browser cannot send a forged `Origin` header.
- `browser-host.ts` requests it once per target-url boot; anything but `allowed`
  produces a `paja.target.cors.error` message-log row (rendered as an error) and
  a `console.warn` carrying the remedy.
- `node-compat.d.ts` — `createServer` listener request now types `headers`.
- Docs: package README, `docs/packages/paja.md`, `paja-local-authoring.md`,
  `paja-getting-started.md`. Also corrected the paja version row from `0.8.0` to
  the shipped `0.8.1` — pre-existing drift that had the docs gate failing on
  `main` before this branch.
- Changeset: `@kehto/paja` patch.

## Verification

- `pnpm build`, `pnpm type-check`, `pnpm test:unit` (1385 passed),
  `pnpm docs:check`, aislop 100/100.
- 9 new unit tests: header classification (wildcard, explicit `null`, missing,
  empty, echoed-localhost, whitespace), probe header/erroring behavior, plus
  three server-level tests hitting the live endpoint against blocking,
  allowing, and unreachable targets.
- Browser re-run of the original repro against a Vite-default target: frame
  still blank (expected — the fix is the dev-server config), but the error row
  and console warning now name the exact remedy. Against a `cors: '*'` target
  the napplet boots and no diagnostic fires.

## Deferred

Proxying target assets through Paja's own origin so nothing is cross-origin.
That removes the requirement entirely rather than reporting it, but needs HMR
websocket proxying.

## NAP conformance

No NAP/NIP-5D surface touched. Sandbox flags, `srcdoc` provenance, the injected
namespace prelude, and all wire messages are unchanged; this is a Paja-local dev
diagnostic plus documentation. No `napplet/naps` spec check was required.

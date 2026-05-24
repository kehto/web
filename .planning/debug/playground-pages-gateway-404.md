---
slug: playground-pages-gateway-404
status: resolved
trigger: "playground is no longer loading; deployed GitHub Pages build requests /napplet-gateway/*/manifest.json at the site root and gets 404"
created: 2026-05-24
updated: 2026-05-24T14:31:03Z
---

# Debug: Playground Pages Gateway 404

## Symptoms

**Expected:** The published playground at `https://kehto.github.io/web/playground/` should load demo napplets.

**Actual:** The playground shell loads, but every napplet fails to load its gateway metadata.

**Error messages:** Browser console shows requests such as `https://kehto.github.io/napplet-gateway/chat/manifest.json` returning 404, followed by `[demo] gateway metadata load failed for <dTag>: 404`.

**Timeline:** Reported 2026-05-24 after the GitHub Pages workflow and recent housekeeping changes reached `main`.

**Reproduction:** Open the published playground, observe XHR requests to root `/napplet-gateway/...` instead of `/web/playground/napplet-gateway/...`.

## Current Focus

hypothesis: confirmed. The static Pages build contains gateway artifacts under `/web/playground/napplet-gateway/`, but the published bundle fell back to `/` for manifest fetches.
test: Build a Pages-base playground bundle, pack `.pages`, and verify browser requests against `/web/playground/`.
expecting: manifest requests resolve under `/web/playground/napplet-gateway/`, no root `/napplet-gateway/` requests occur, and the static demo banner appears.
next_action: Commit and push the fix to `main` so Pages redeploys.

## Evidence

- `curl https://kehto.github.io/napplet-gateway/chat/manifest.json` returned 404.
- `curl https://kehto.github.io/web/playground/napplet-gateway/chat/manifest.json` returned 200.
- The old published bundle contained `import.meta.env` at runtime because `shell-host.ts` stored `import.meta` in a local typed variable before reading `.env.BASE_URL`; Vite did not inline that indirect access, so the browser fallback path was `/`.
- The fixed Pages-base bundle inlines `"/web/playground/"` in the manifest path helper and omits `__connect-grants` from the static build path.
- Browser proof against a local `/web/playground/` mount: 26 gateway requests, 13 manifest responses, zero root gateway requests, zero non-200 gateway responses, static demo banner visible.

## Eliminated

- GitHub Pages artifact absence: the deployed `/web/playground/napplet-gateway/chat/manifest.json` route already returned 200.
- Need for immediate nsite publication: the static Pages artifact can serve the packaged gateway routes once the shell resolves the correct base path.

## Resolution

root_cause: Vite only replaces direct `import.meta.env.BASE_URL` access. The playground helper read `BASE_URL` through an aliased `import.meta`, leaving `import.meta.env` undefined in the browser and falling back to `/`.
fix: Use direct `import.meta.env.BASE_URL`, add Vite env typing, show a static GitHub Pages demo banner for the Pages-base build, and skip the dev-only CSP grant sync POST in that static build.
verification: `pnpm vitest run tests/unit/playground-gateway-guard.test.ts`; `PLAYGROUND_BASE_PATH=/web/playground/ pnpm --filter @kehto/playground build`; `VITEPRESS_BASE=/web/docs/ pnpm docs:check`; `PLAYGROUND_BASE_PATH=/web/playground/ VITEPRESS_BASE=/web/docs/ pnpm build:pages`; `pnpm audit:gateway-artifacts`; `pnpm audit:pages`; `pnpm type-check`; `pnpm test:unit`; `pnpm lint`; `npx aislop scan`; Playwright local `/web/playground/` browser proof.
files_changed: `apps/playground/src/shell-host.ts`, `apps/playground/src/main.ts`, `apps/playground/src/vite-env.d.ts`, `apps/playground/index.html`, `tests/unit/playground-gateway-guard.test.ts`, `scripts/audit-gateway-artifacts.mjs`

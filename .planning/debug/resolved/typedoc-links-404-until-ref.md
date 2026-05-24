---
slug: typedoc-links-404-until-ref
status: resolved
trigger: "for some reason the typedoc links from the vitepress site throw 404 until I refresh the page"
created: 2026-05-24
updated: 2026-05-24T14:00:42Z
---

# Debug: TypeDoc Links 404 Until Refresh

## Symptoms

**Expected:** TypeDoc/API links opened from the VitePress docs site should load directly on first navigation.

**Actual:** Some TypeDoc links opened from the VitePress site show a 404 until the browser page is refreshed.

**Error messages:** Browser-visible VitePress `PAGE NOT FOUND`; local preview returned HTTP 404 for the missing TypeDoc target before the fix.

**Timeline:** Reported 2026-05-24 after the docs site and generated API integration work.

**Reproduction:** Navigate from the VitePress site to generated TypeDoc links and observe first-load 404; refresh the same URL can load when the static TypeDoc file exists in the served artifact.

## Current Focus

hypothesis: Confirmed and fixed. The docs site emitted normal same-origin `.html` anchors for static TypeDoc pages, so VitePress intercepted first-click navigation and routed to its own 404; plain VitePress preview also omitted generated TypeDoc HTML files from `docs/.vitepress/dist`.
test: Verified authored TypeDoc anchors bypass VitePress SPA routing and `docs/api` is copied into the VitePress dist artifact after build.
expecting: Rendered TypeDoc anchors include a `target` attribute, the preview artifact contains `api/modules/_kehto_acl.html`, and browser click navigation lands on TypeDoc content without a 404.
next_action: None. Keep the docs audit guard in place for future TypeDoc link changes.

## Evidence

- timestamp: 2026-05-24T13:48:00Z
  observation: `rm -rf docs/api docs/.vitepress/dist && pnpm docs:site:build` succeeded, but `docs/.vitepress/dist/api/modules/_kehto_acl.html` was absent.
  supports: Plain VitePress preview output does not include generated TypeDoc HTML.
- timestamp: 2026-05-24T13:49:00Z
  observation: `curl http://127.0.0.1:4175/api/modules/_kehto_acl.html` returned 404 after serving the fresh VitePress preview.
  supports: Direct refresh/load of the TypeDoc target fails in local VitePress preview without an extra copy step.
- timestamp: 2026-05-24T13:50:00Z
  observation: The rendered API reference anchor was `href="./../api/modules/_kehto_acl.html"` with no `target` attribute.
  supports: VitePress client router is allowed to intercept the TypeDoc link.
- timestamp: 2026-05-24T13:51:00Z
  observation: Browser automation clicked `docs/api/modules/_kehto_acl.html` from `/reference/api.html` and landed at `http://127.0.0.1:4175/api/modules/_kehto_acl` with title `404 | Kehto Runtime` and h1 `PAGE NOT FOUND`.
  supports: The user-visible first-click 404 is reproducible.
- timestamp: 2026-05-24T13:56:00Z
  observation: `rm -rf docs/api docs/.vitepress/dist && pnpm docs:check` passed after the fix, including `[copy-docs-api] OK` and `[audit:docs] OK`.
  supports: Fresh generated docs builds include the TypeDoc artifact and satisfy the docs guard.
- timestamp: 2026-05-24T13:57:00Z
  observation: The built reference page now renders `href="../api/modules/_kehto_acl.html" target="_self"`, and `docs/.vitepress/dist/api/modules/_kehto_acl.html` exists.
  supports: The link bypasses VitePress SPA routing and the target is available to the preview/static server.
- timestamp: 2026-05-24T13:58:00Z
  observation: `curl http://127.0.0.1:4175/api/modules/_kehto_acl.html` returned 200 with title `@kehto/acl | Documentation`.
  supports: Direct TypeDoc loads work from VitePress preview output.
- timestamp: 2026-05-24T13:59:00Z
  observation: Browser automation clicked the `docs/api/modules/_kehto_acl.html` link from `/reference/api.html` and landed at `/api/modules/_kehto_acl.html` with title `@kehto/acl | Documentation`, h1 `Module @kehto/acl`, and no page-not-found text.
  supports: First-click navigation into TypeDoc no longer 404s.
- timestamp: 2026-05-24T14:00:00Z
  observation: `git diff --check`, `npx aislop scan`, `pnpm lint`, `pnpm type-check`, `pnpm test:unit`, `PLAYGROUND_BASE_PATH=/web/playground/ pnpm --filter @kehto/playground build`, and `pnpm build:pages` all passed.
  supports: The fix passes static, build, docs, and unit-test verification.

## Eliminated

## Resolution

root_cause:
VitePress intercepts same-origin `.html` anchors without a `target` attribute and resolves them through its SPA route table. TypeDoc pages are static HTML, not VitePress routes, so first-click navigation landed on the VitePress 404 route. Local VitePress preview also lacked the generated TypeDoc files because the build produced `docs/api` beside the VitePress dist instead of copying it into `docs/.vitepress/dist/api`.
fix:
Added a `scripts/copy-docs-api.mjs` build step, called it from both root `docs:site:build` and `docs/package.json` `docs:build`, converted authored TypeDoc links to same-tab HTML anchors with `target="_self"`, and extended `scripts/audit-docs.mjs` to require copied TypeDoc artifacts plus router-bypassing links.
verification:
Fresh `pnpm docs:check`; local VitePress preview direct `curl` to `/api/modules/_kehto_acl.html` returned 200; browser click from `/reference/api.html` landed on `@kehto/acl | Documentation`; `git diff --check`; `npx aislop scan`; `pnpm lint`; `pnpm type-check`; `pnpm test:unit`; `PLAYGROUND_BASE_PATH=/web/playground/ pnpm --filter @kehto/playground build`; `pnpm build:pages`.
files_changed:
package.json; docs/package.json; scripts/copy-docs-api.mjs; scripts/audit-docs.mjs; docs/reference/api.md; docs/packages/acl.md; docs/packages/nip66.md; docs/packages/runtime.md; docs/packages/services.md; docs/packages/shell.md; docs/packages/wm.md.

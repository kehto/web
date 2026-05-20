---
slug: topology-connector-lines-missing
status: resolved
trigger: the lines connecting nodes are no longer visible
created: 2026-05-20
updated: 2026-05-20
---

# Debug: Topology connector lines missing

## Symptoms

**Expected:** SVG lines connect the topology nodes (napplets ↔ shell ↔ acl ↔ runtime ↔ services) and light up / flash when data travels each path. Implemented via the `leader-line` UMD library; `initTopologyEdges()` in `apps/demo/src/topology.ts` creates one `LeaderLine` per edge and the returned `EdgeFlasher` mutates color on each routed envelope.

**Actual:** Topology view renders all nodes (shell card, acl card, runtime card with live MESSAGE FLOW, 7 SERVICE cards along bottom, napplet cards along top — visible in user screenshot). Message flow is alive — `MESSAGES: 53`, `MESSAGES ROUTED: 53`, MESSAGE FLOW table updating. But **zero SVG connector lines render between any of the nodes**. Visually: dark space between cards instead of the expected flashing lines.

**Error messages:** No visible console errors — the `try/catch` in `initTopologyEdges()` (topology.ts:235-253) silently swallows the `ReferenceError` when `LeaderLine` is undefined.

**Timeline:** Was working in v1.6. Regressed sometime during v1.7. Screenshot shows the current 12-napplet topology (post-Phase 40) including config-demo / resource-demo additions.

**Reproduction:** Open the kehto demo via `pnpm preview` at `:4174`. Topology section renders. Lines that previously connected node DOM elements are absent.

## Initial Code Scout (pre-investigation, by orchestrator)

- `apps/demo/index.html:461-462` — `<script src="/node_modules/leader-line/leader-line.min.js"></script>` loads the UMD lib BEFORE the module script. The src is an **absolute path into node_modules**, which Vite resolves in dev but NOT in built `dist/` for `pnpm preview` (preview only serves the built output unless explicitly configured).
- `apps/demo/src/topology.ts:1-4` — declares `LeaderLine: any` (global from UMD).
- `apps/demo/src/topology.ts:205` — `initTopologyEdges()` creates `LeaderLine` instances; if `LeaderLine` is undefined, this throws.
- `apps/demo/src/main.ts:263` — `const edgeFlasher = initTopologyEdges(topology);` — called once; no try/catch visible. Failure here would block subsequent demo init.
- Topology node IDs are computed by helpers: `topology-node-shell` / `-acl` / `-runtime` / `-napplet-<slug>` / `-service-<slug>`.
- Edge IDs: `topology-edge-napplet-<name>-shell`, `topology-edge-shell-acl`, `topology-edge-acl-runtime`, `topology-edge-runtime-service-<name>`.

## Top Hypotheses (orchestrator pre-analysis)

1. **leader-line script fails to load in preview mode (`/node_modules/...` path doesn't resolve in built output).** Vite's `pnpm preview` serves `dist/`; node_modules paths only resolve via Vite's dev middleware, not its preview static server. If the user's running preview (port 4174 per most v1.7 work), `<script src="/node_modules/leader-line/leader-line.min.js">` would 404, `window.LeaderLine` would be undefined, `initTopologyEdges()` would throw, and lines would be absent while everything else (message flow, ACL etc.) keeps working since they don't depend on leader-line. **MOST LIKELY.**

2. **Phase 39's `serveNappletCsp` plugin accidentally injects CSP on the shell's own `/index.html` blocking the inline LeaderLine UMD eval.** Less likely because the plugin is documented as targeting `/napplets/<dTag>/index.html` only, but worth a grep.

3. **A v1.7 layout change (e.g., the new `#nip66-panel` or consent-modal DOM) shifts topology nodes' computed positions in a way that makes the lines render at 0,0 or behind a `z-index` element.** Less likely because the user says lines are entirely absent, not visually mispositioned.

4. **The 12-napplet expansion (Phase 39 config-demo, Phase 40 resource-demo) added DEMO_NAPPLETS entries but the topology edge-creation code or container CSS wasn't updated to accommodate 12 nodes, throwing at edge ID generation.** Worth checking.

5. **leader-line UMD globally-loaded `window.LeaderLine` got tree-shaken / replaced by Vite production minification on the built shell HTML.** Edge case.

## Current Focus

hypothesis: CONFIRMED — leader-line script fails to load in `pnpm preview` because `<script src="/node_modules/leader-line/leader-line.min.js">` returns `text/html` (SPA 404 fallback) from the preview static server. `window.LeaderLine` is never set. `initTopologyEdges()` silently catches the `ReferenceError` and returns an empty map; zero lines are drawn.

## Evidence

- timestamp: 2026-05-20T10:30:21Z
  finding: `curl -I http://localhost:4174/node_modules/leader-line/leader-line.min.js` returns `Content-Type: text/html` — Vite preview serves index.html as SPA fallback instead of the actual JS file. The `/node_modules/` directory is not inside `dist/` and the preview server has no middleware to serve it.
  confirms: hypothesis 1

- timestamp: 2026-05-20T10:30:21Z
  finding: `dist/` directory contains only `assets/`, `demo-data.json`, and `index.html`. No `node_modules/` subtree. The built `dist/index.html` still contains the hard-coded `/node_modules/leader-line/leader-line.min.js` src path — Vite does not rewrite `<script src>` attributes that aren't module entry points.
  confirms: hypothesis 1

- timestamp: 2026-05-20T10:30:21Z
  finding: `topology.ts:235-253` wraps `new LeaderLine(...)` in `try/catch` with empty catch — a `ReferenceError` (LeaderLine is not defined) is silently swallowed and no lines are ever added to the `lines` Map. This explains zero console errors visible to the user.
  confirms: why the bug is silent

## Eliminated

- hypothesis 2 (CSP blocking): `serveNappletCsp` plugin only sets headers on `/napplets/<dTag>/` paths, never on the shell's own index.html. Not relevant.
- hypothesis 3 (z-index/layout): Lines are absent entirely, not mispositioned.
- hypothesis 4 (edge ID generation): Edge creation never reaches LeaderLine calls because LeaderLine is undefined.
- hypothesis 5 (tree-shaking): Script is a literal `<script src>` tag outside of Vite's module graph; tree-shaking doesn't apply to it.

## Resolution

root_cause: `<script src="/node_modules/leader-line/leader-line.min.js">` in `apps/demo/index.html` resolved correctly during `pnpm dev` (Vite dev server serves node_modules via its transform middleware) but fails in `pnpm preview` (static file server serves only `dist/`, returning the SPA fallback HTML for any unknown path). The `leader-line.min.js` file was never copied into the build output so `window.LeaderLine` is never defined in preview mode. The silent `try/catch` in `initTopologyEdges()` hid the failure.

fix: Copied `leader-line.min.js` from `apps/demo/node_modules/leader-line/` to `apps/demo/public/vendor/leader-line.min.js`. Updated `apps/demo/index.html` script src from `/node_modules/leader-line/leader-line.min.js` to `/vendor/leader-line.min.js`. Vite's build copies everything in `public/` to `dist/` verbatim, so the file is now available at a stable path in both dev and preview modes. Rebuilt demo (`pnpm --filter demo build`). Confirmed `http://localhost:4174/vendor/leader-line.min.js` returns `Content-Type: text/javascript` with HTTP 200.

files_changed:
  - apps/demo/index.html (script src updated)
  - apps/demo/public/vendor/leader-line.min.js (new file — vendored UMD copy)

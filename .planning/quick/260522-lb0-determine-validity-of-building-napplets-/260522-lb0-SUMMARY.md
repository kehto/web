---
quick_id: 260522-lb0
status: complete
date: 2026-05-22
commit: 8d763b5
---

# Quick Task 260522-lb0: vite-single-file playground napplet validity - Summary

## Verdict

Correction: local playground testing and production NIP-5A gateway loading are the same validity question for this decision. The playground must reproduce the production NIP-5D posture, including sandboxed iframes with opaque origins and no `allow-same-origin`.

Under that requirement, single-file napplet output is valid and likely desirable for gateway-compatible artifacts.

`vite-plugin-singlefile` is not valid as a blind config-only drop-in today only because `@napplet/vite-plugin` currently rejects inline executable scripts. That is a current implementation policy blocker, not a NIP-5D or NIP-5A invalidity.

## Evidence

- The playground has 13 napplet packages under `apps/playground/napplets/*`, each with its own Vite config using `base: './'`, `nip5aManifest(...)`, and `build.outDir: 'dist'`.
- The playground host loads each napplet as `/napplets/{name}/index.html` in a sandboxed iframe, and the dev/preview middleware streams files from `apps/playground/napplets/{name}/dist`.
- Current built napplet HTML keeps executable code external: every checked `dist/index.html` references `./assets/index-*.js`.
- The current napplet source set has no image/media files that would independently block a single-HTML experiment.
- NIP-5D requires napplet iframes to omit `allow-same-origin`, which means production-equivalent local testing must use opaque-origin iframes.
- `@napplet/vite-plugin` scans `dist/index.html` during `closeBundle()` and fails the build on inline executable `<script>` tags before manifest signing is considered.
- `vite-plugin-singlefile@2.3.3` supports the repo's Vite major range, but its core behavior is to replace external script and CSS references with inline `<script>` and `<style>` blocks and delete the inlined bundle files by default.

## Compatibility Assessment

The current playground serving path is compatible with a single `index.html`: a single file in each napplet `dist` directory would still be reachable at the same URL.

The production-equivalence path favors single-file artifacts:

- Opaque-origin module subresource loading makes external `./assets/index-*.js` files dependent on gateway asset routing and CORS behavior.
- A single verified `index.html` artifact avoids that gateway subresource/CORS dependency.
- The NIP-5A aggregate hash can cover the final single file; that is a valid artifact model.

The current build path is not compatible yet:

- The single-file plugin would inline the module script into `index.html`.
- The napplet manifest plugin would reject that output as an inline executable script.
- The current inline-script rejection is based on a shell/CSP assumption that does not yet model single-file NIP-5A gateway artifacts.

The manifest semantics change, but not invalidly. A true single-file output would collapse the real file hash set to mostly `index.html` plus synthetic entries such as config schema or connect origins. That is a valid provenance model if it is made explicit.

## Recommendation

Adopt a production-equivalent single-file artifact direction for local playground testing, but do it by changing the artifact contract explicitly rather than adding `vite-plugin-singlefile` to every napplet config as an isolated tweak.

The playground should not rely on a local-only external asset serving shape unless the NIP-5A gateway path is required to provide the same asset and CORS behavior.

Treat this as a dedicated milestone:

1. Add an explicit single-file artifact mode to `@napplet/vite-plugin`.
2. In that mode, allow build-generated inline module scripts after the final artifact is known.
3. Define gateway/shell CSP expectations for NIP-5D opaque-origin single-file artifacts.
4. Define aggregate-hash and manifest behavior for one-file outputs.
5. Add a local NIP-5A-gateway-style test path that loads sandboxed opaque-origin iframes from the same artifact shape production will use.
6. Add build/e2e coverage across all 13 playground napplets.
7. Centralize playground napplet Vite config to avoid changing 13 configs independently.

## Sources

- Local: `apps/playground/vite.config.ts`
- Local: `apps/playground/src/shell-host.ts`
- Local: `apps/playground/napplets/*/vite.config.ts`
- Local: `napplet/packages/vite-plugin/src/index.ts`
- Local: `specs/NIP-5D.md`
- External: `vite-plugin-singlefile` README and packaged source from npm package `2.3.3`
- External: https://github.com/richardtallent/vite-plugin-singlefile
- External: https://www.npmjs.com/package/vite-plugin-singlefile

## Verification

- Counted 13 playground napplet Vite configs.
- Confirmed current built napplet HTML references external `./assets/index-*.js` scripts.
- Confirmed no static image/media files exist in playground napplet source trees.
- Confirmed NIP-5D requires opaque-origin sandboxed iframe loading without `allow-same-origin`.
- Confirmed `npm view vite-plugin-singlefile@latest` reports `2.3.3`, peer support for Vite `^5.4.21 || ^6.0.0 || ^7.0.0 || ^8.0.0`, and MIT license.
- Inspected the `vite-plugin-singlefile@2.3.3` package tarball and confirmed `replaceScript()` rewrites `<script src="..."></script>` to inline `<script>...</script>`.

## Remaining Risk

No patched build was run with `vite-plugin-singlefile` installed because this task is an architecture validity check, not an implementation change. The remaining incompatibility is source-level and deterministic unless the napplet plugin's inline-script policy is changed for an explicit single-file artifact mode.

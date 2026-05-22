---
quick_id: 260522-lb0
status: complete
date: 2026-05-22
commit: 8d763b5
---

# Quick Task 260522-lb0: vite-single-file playground napplet validity - Summary

## Verdict

`vite-plugin-singlefile` is not valid as a drop-in build change for the current playground napplets.

It is valid only as a deliberate new artifact mode after changing the napplet build policy and CSP contract. The current architecture intentionally keeps executable JavaScript in external files, and `vite-plugin-singlefile` intentionally inlines JavaScript into `dist/index.html`.

## Evidence

- The playground has 13 napplet packages under `apps/playground/napplets/*`, each with its own Vite config using `base: './'`, `nip5aManifest(...)`, and `build.outDir: 'dist'`.
- The playground host loads each napplet as `/napplets/{name}/index.html` in a sandboxed iframe, and the dev/preview middleware streams files from `apps/playground/napplets/{name}/dist`.
- Current built napplet HTML keeps executable code external: every checked `dist/index.html` references `./assets/index-*.js`.
- The current napplet source set has no image/media files that would independently block a single-HTML experiment.
- `@napplet/vite-plugin` scans `dist/index.html` during `closeBundle()` and fails the build on inline executable `<script>` tags before manifest signing is considered.
- `vite-plugin-singlefile@2.3.3` supports the repo's Vite major range, but its core behavior is to replace external script and CSS references with inline `<script>` and `<style>` blocks and delete the inlined bundle files by default.

## Compatibility Assessment

The serving path is compatible: a single `index.html` in each napplet `dist` directory would still be reachable at the same URL.

The build/security path is not compatible:

- The single-file plugin would inline the module script into `index.html`.
- The napplet manifest plugin would reject that output as an inline executable script.
- Even if the guard were bypassed, the current shell-authoritative CSP posture assumes executable scripts come from `script-src 'self'`; inline execution would require explicit hash or nonce handling.

The manifest semantics also change. A true single-file output would collapse the real file hash set to mostly `index.html` plus synthetic entries such as config schema or connect origins. That is not inherently invalid, but it is a behavioral change to provenance/update granularity and should not be smuggled in as a playground-only convenience.

## Recommendation

Do not adopt `vite-plugin-singlefile` in playground napplet configs right now.

If the desired outcome is fewer dev-server requests, keep the current external asset model and improve the playground build/serve orchestration instead.

If the desired outcome is portable one-file napplet artifacts, treat it as a dedicated milestone:

1. Add an explicit single-file artifact mode to `@napplet/vite-plugin`.
2. Define hash-based CSP support for generated inline module scripts, or make an intentional policy decision to reject inline single-file artifacts.
3. Define aggregate-hash and manifest behavior for one-file outputs.
4. Add build/e2e coverage across all 13 playground napplets.
5. Centralize playground napplet Vite config to avoid changing 13 configs independently.

## Sources

- Local: `apps/playground/vite.config.ts`
- Local: `apps/playground/src/shell-host.ts`
- Local: `apps/playground/napplets/*/vite.config.ts`
- Local: `napplet/packages/vite-plugin/src/index.ts`
- External: `vite-plugin-singlefile` README and packaged source from npm package `2.3.3`
- External: https://github.com/richardtallent/vite-plugin-singlefile
- External: https://www.npmjs.com/package/vite-plugin-singlefile

## Verification

- Counted 13 playground napplet Vite configs.
- Confirmed current built napplet HTML references external `./assets/index-*.js` scripts.
- Confirmed no static image/media files exist in playground napplet source trees.
- Confirmed `npm view vite-plugin-singlefile@latest` reports `2.3.3`, peer support for Vite `^5.4.21 || ^6.0.0 || ^7.0.0 || ^8.0.0`, and MIT license.
- Inspected the `vite-plugin-singlefile@2.3.3` package tarball and confirmed `replaceScript()` rewrites `<script src="..."></script>` to inline `<script>...</script>`.

## Remaining Risk

No patched build was run with `vite-plugin-singlefile` installed because this task is an architecture validity check, not an implementation change. The incompatibility is source-level and deterministic unless the napplet plugin's inline-script policy is changed.

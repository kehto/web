# Phase 53: Single-File Artifact Contract - Summary

## Outcome

Implemented explicit single-file artifact support in `@napplet/vite-plugin` while preserving the default external-asset guard behavior.

## Delivered

- Added `artifactMode?: 'external-assets' | 'single-file'` and exported `Nip5aArtifactMode`.
- Kept `external-assets` as the default mode and kept inline executable script rejection active there.
- Made `single-file` mode ask Vite/Rollup for a single-entry output shape, inline local JS/CSS build references into `dist/index.html`, and fail if any local stylesheet, modulepreload, script source, or extra emitted file remains.
- Normalized Vite `base` handling so root-relative built asset references such as `/subapp/assets/index.js` resolve to the emitted `dist/assets/index.js` file.
- Kept aggregate-hash and manifest generation based on final post-inline artifact bytes, with `config:schema` and `connect:origins` synthetic inputs still participating in `aggregateHash`.
- Added direct Vitest coverage for default inline-script rejection, successful single-file artifact hashing, Vite `base` variants, code-split chunk rejection, and synthetic config/connect hash participation.
- Documented the artifact mode and added a changeset for `@napplet/vite-plugin`.

## Changed Files

- `napplet/packages/vite-plugin/src/index.ts`
- `napplet/packages/vite-plugin/src/index.test.ts`
- `napplet/packages/vite-plugin/vitest.config.ts`
- `napplet/packages/vite-plugin/package.json`
- `napplet/packages/vite-plugin/tsconfig.json`
- `napplet/packages/vite-plugin/README.md`
- `napplet/.changeset/v1-11-single-file-artifact-mode.md`

## Review Closure

The phase review requested changes for three issues:

- Code-split artifacts were not collapsed or rejected. Fixed by forcing single-entry Vite/Rollup settings and failing closeBundle when local external assets remain.
- Vite `base` was ignored for root-relative asset URLs. Fixed by normalizing and stripping the configured base during dist asset resolution.
- `vitest.config.ts` was outside package type-check coverage. Fixed by including it in the package tsconfig.


# Phase 53: Single-File Artifact Contract - Verification

Verified: 2026-05-22T17:38:34+02:00

## Commands

| Command | Result |
|---------|--------|
| `cd napplet && pnpm --filter @napplet/vite-plugin test:unit` | Passed: 1 file, 5 tests |
| `cd napplet && pnpm --filter @napplet/vite-plugin type-check` | Passed |
| `cd napplet && pnpm --filter @napplet/vite-plugin build` | Passed: ESM and DTS outputs built |

## Evidence

- Test coverage now includes:
  - default mode rejects inline executable scripts;
  - explicit `single-file` mode inlines JS/CSS and computes `aggregateHash` from final artifact bytes;
  - `./`, `/assets/...`, and `/subapp/assets/...` Vite base variants resolve correctly;
  - code-split leftovers fail with a loud single-file artifact error;
  - config and connect synthetic hash inputs still change `aggregateHash` without being emitted as public `x` tags.
- Type-check covers `src` and `vitest.config.ts`.
- Package build emits both ESM and declaration output successfully.

## Remaining Risks

- The strict single-file contract intentionally fails builds that emit any extra dist file. That is correct for the v1.11 gateway artifact invariant, but downstream napplets with copied public assets or non-inlined media must convert them to bundled/data-URL assets before opting in.


# @kehto/conformance-app

Private static build of the `@kehto/conformance` web UI, published with GitHub
Pages at `/web/conformance/`. It runs the conformance catalog against the
first-party Kehto target in the visitor's browser. Deep links select the
profile and domains, for example `?profile=minimal&domain=theme`.

`pnpm --filter @kehto/conformance-app build` writes `dist/`. For live re-runs
while developing, use `kehto conformance --ui` instead.

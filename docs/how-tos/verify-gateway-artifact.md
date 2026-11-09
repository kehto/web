# How-to: Verify a Gateway Artifact

Use this when checking whether a napplet build matches the production-equivalent local loading path.

## Commands

```bash
pnpm --filter "./tests/fixtures/napplets/*" build
pnpm audit:csp
kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1
```

## What to check

- Each napplet emits `dist/index.html`.
- Each napplet emits `dist/.nip5a-manifest.json`.
- The manifest has the expected `R` requirements and optional `O` declarations.
- The manifest has one `x` matching the SHA-256 of the final `index.html`.
- The shell verifies relay events and Blossom bytes, then assigns iframe `srcdoc`.
- Runtime injection stays outside the verified artifact bytes.
- The iframe remains opaque-origin.

Do not treat direct `/napplets/<name>/` static serving as the canonical proof path.

Paja's loader and the shared `prepareNappletSrcdoc` helper own CSP and
namespace injection. The helper receives verified
`resolved.indexHtml`; its additions stay outside the signed artifact bytes.
Executable regression tests reject raw `srcdoc`, unverified input, and removal
of either CSP or namespace injection.

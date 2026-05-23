# How-to: Verify a Gateway Artifact

Use this when checking whether a napplet build matches the production-equivalent local loading path.

## Commands

```bash
pnpm --filter "./apps/playground/napplets/*" build
pnpm audit:gateway-artifacts
pnpm --filter @kehto/playground preview --port 4174
```

## What to check

- Each napplet emits `dist/index.html`.
- Each napplet emits `dist/.nip5a-manifest.json`.
- The manifest has the expected `requires` tags.
- The shell loads `/napplet-gateway/<dTag>/<aggregateHash>/index.html`.
- The iframe remains opaque-origin.

Do not treat direct `/napplets/<name>/` static serving as the canonical proof path.

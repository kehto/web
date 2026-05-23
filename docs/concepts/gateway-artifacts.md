# Gateway Artifacts

The playground's active path is production-equivalent gateway loading:

1. Build each napplet as a single-file artifact.
2. Emit `dist/index.html` and `dist/.nip5a-manifest.json`.
3. Fetch manifest metadata through `/napplet-gateway/<dTag>/manifest.json`.
4. Register `(dTag, aggregateHash)` before iframe navigation.
5. Navigate to `/napplet-gateway/<dTag>/<aggregateHash>/index.html`.

This path keeps the iframe opaque-origin and avoids direct dev-server shortcuts. Use `pnpm audit:gateway-artifacts` to verify the artifact shape.

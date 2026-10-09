# Gateway Artifacts

The playground loads napplets through content verification:

1. Build a self-contained `dist/index.html` and signed `.nip5a-manifest.json`.
2. Resolve the manifest from the relay simulation and verify its signature.
3. Fetch the artifact by its `x` hash from Blossom and verify its bytes.
4. Bind the iframe Window to `(dTag, aggregateHash)` before execution. The existing
   field name carries the current artifact hash, or a legacy aggregate hash.
5. Inject the runtime namespace and CSP outside signed bytes, then assign `srcdoc`
   with `sandbox="allow-scripts"`.

Gateway routes remain debugging/acceleration surfaces. Neither their metadata nor
their bytes are trusted. Legacy path/aggregate events share the same verified
loader through a separate compatibility adapter. Use `pnpm audit:gateway-artifacts`
to verify the build shape and [event migration](../migrations/NIP-5D-EVENT-SCHEMA.md)
for the schema boundary.

---
"@kehto/runtime": patch
---

v1.3 bug-fix rollup — no protocol changes. Fixes landed during the demo-rewire and napplet-migration phases:

- **Session registry registration on napplet load.** `sessionRegistry.register()` is now invoked inside the loadNapplet path so `storage.*` / `notify.*` NUB handlers resolve napplet identity correctly in the demo shell host (Phase 19 fix).
- **Identity error-path shim routing.** The napplet-shim central handler now forwards `identity.*.error` envelopes so denial paths propagate to the napplet SDK (Phase 21 fix).
- **Documentation surface.** 8 runtime source files received `@example` JSDoc blocks on non-type factory exports (`createManifestCache`, `createReplayDetector`, `createEventBuffer`, `matchesFilter`, `matchesAnyFilter`, `handleStateRequest`, `handleStorageNub`, `cleanupNappState`) so the typedoc-generated API reference is complete.

Behavioral fan-out of these fixes is proved green end-to-end by the Phase 18-21 Layer-A + Layer-B Playwright specs.

Requirement IDs covered:
- NAP-01, NAP-02 (bot + chat SDK migration consuming runtime routing)
- NAP-03..09 (single-domain napplets exercising runtime dispatch)
- E2E-07 (napplet-auth, ifc-roundtrip, relay-publish, relay-publish-encrypted, relay-subscribe, identity-flow, storage-persist, notify-lifecycle, theme-broadcast specs)
- E2E-09 (Layer-A nub-* specs against the harness)
- DOCS-01, DOCS-02 (typedoc + runtime README)

No new public API. Compat re-exports under `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) unchanged; removal awaits @napplet/core upstream export restoration.
